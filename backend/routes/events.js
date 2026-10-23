const express = require('express');
const { getDb } = require('../db/init');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const { search, category } = req.query;
    const db = getDb();
    
    let query = `
      SELECT e.*, COUNT(r.id) as registration_count
      FROM events e
      LEFT JOIN registrations r ON e.id = r.event_id
    `;
    const params = [];
    let whereClauses = [];

    if (search) {
      whereClauses.push('(e.event_name LIKE ? OR e.description LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    if (category && category !== 'all') {
      whereClauses.push('e.category = ?');
      params.push(category);
    }

    if (whereClauses.length > 0) {
      query += ` WHERE ` + whereClauses.join(' AND ');
    }

    query += ` GROUP BY e.id ORDER BY e.event_date ASC`;

    const events = db.prepare(query).all(...params);
    res.json({ success: true, events });
  } catch (error) {
    console.error('Get events error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    
    const event = db.prepare(`
      SELECT e.*, COUNT(r.id) as registration_count
      FROM events e
      LEFT JOIN registrations r ON e.id = r.event_id
      WHERE e.id = ?
      GROUP BY e.id
    `).get(id);

    if (!event) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    
    res.json({ success: true, event });
  } catch (error) {
    console.error('Get event error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.post('/', authenticate, requireAdmin, (req, res) => {
  try {
    const { event_name, event_date, event_time, venue, description, category, max_capacity, image_url } = req.body;
    const db = getDb();
    
    const insertStmt = db.prepare(`
      INSERT INTO events (event_name, event_date, event_time, venue, description, category, max_capacity, image_url, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    const result = insertStmt.run(event_name, event_date, event_time || '10:00', venue, description, category || 'general', max_capacity || 100, image_url || null, req.user.id);
    
    const newEvent = db.prepare('SELECT * FROM events WHERE id = ?').get(result.lastInsertRowid);
    res.json({ success: true, event: newEvent });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.put('/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { event_name, event_date, event_time, venue, description, category, max_capacity, image_url } = req.body;
    const db = getDb();
    
    const updateStmt = db.prepare(`
      UPDATE events 
      SET event_name = ?, event_date = ?, event_time = ?, venue = ?, description = ?, category = ?, max_capacity = ?, image_url = ?
      WHERE id = ?
    `);
    
    const result = updateStmt.run(event_name, event_date, event_time, venue, description, category, max_capacity, image_url, id);
    
    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    
    const updatedEvent = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
    res.json({ success: true, event: updatedEvent });
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.delete('/:id', authenticate, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    
    db.prepare('BEGIN TRANSACTION').run();
    db.prepare('DELETE FROM registrations WHERE event_id = ?').run(id);
    const result = db.prepare('DELETE FROM events WHERE id = ?').run(id);
    db.prepare('COMMIT').run();
    
    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    
    res.json({ success: true, message: 'Event deleted' });
  } catch (error) {
    const db = getDb();
    if (db.inTransaction) db.prepare('ROLLBACK').run();
    console.error('Delete event error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.post('/:id/register', authenticate, (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;
    const db = getDb();
    
    db.prepare('BEGIN TRANSACTION').run();
    
    const event = db.prepare(`
      SELECT e.max_capacity, COUNT(r.id) as current_registrations
      FROM events e
      LEFT JOIN registrations r ON e.id = r.event_id
      WHERE e.id = ?
      GROUP BY e.id
    `).get(id);
    
    if (!event) {
      db.prepare('ROLLBACK').run();
      return res.status(404).json({ success: false, message: 'Event not found' });
    }
    
    if (event.current_registrations >= event.max_capacity) {
      db.prepare('ROLLBACK').run();
      return res.status(400).json({ success: false, message: 'Event capacity exceeded' });
    }
    
    const existingRegistration = db.prepare('SELECT id FROM registrations WHERE user_id = ? AND event_id = ?').get(user_id, id);
    if (existingRegistration) {
      db.prepare('ROLLBACK').run();
      return res.status(400).json({ success: false, message: 'Already registered for this event' });
    }
    
    db.prepare('INSERT INTO registrations (user_id, event_id) VALUES (?, ?)').run(user_id, id);
    
    db.prepare('COMMIT').run();
    res.json({ success: true, message: 'Registered successfully' });
  } catch (error) {
    const db = getDb();
    if (db.inTransaction) db.prepare('ROLLBACK').run();
    console.error('Register event error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.delete('/:id/register', authenticate, (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;
    const db = getDb();
    
    const result = db.prepare('DELETE FROM registrations WHERE user_id = ? AND event_id = ?').run(user_id, id);
    
    if (result.changes === 0) {
      return res.status(404).json({ success: false, message: 'Registration not found' });
    }
    
    res.json({ success: true, message: 'Unregistered successfully' });
  } catch (error) {
    console.error('Unregister event error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.get('/:id/registrations', authenticate, requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const db = getDb();
    
    const registrations = db.prepare(`
      SELECT r.id, r.registered_at, u.id as user_id, u.fullname, u.email, u.username
      FROM registrations r
      JOIN users u ON r.user_id = u.id
      WHERE r.event_id = ?
    `).all(id);
    
    res.json({ success: true, registrations });
  } catch (error) {
    console.error('Get registrations error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.get('/:id/check-registration', authenticate, (req, res) => {
  try {
    const { id } = req.params;
    const user_id = req.user.id;
    const db = getDb();
    
    const registration = db.prepare('SELECT id FROM registrations WHERE user_id = ? AND event_id = ?').get(user_id, id);
    
    res.json({ success: true, registered: !!registration });
  } catch (error) {
    console.error('Check registration error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
