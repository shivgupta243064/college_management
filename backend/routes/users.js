const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb } = require('../db/init');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

router.get('/profile', (req, res) => {
  try {
    const db = getDb();
    const user = db.prepare('SELECT id, fullname, email, username, role, created_at FROM users WHERE id = ?').get(req.user.id);
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    
    res.json({ success: true, user });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.put('/profile', (req, res) => {
  try {
    const { fullname, email, password } = req.body;
    const db = getDb();
    
    let updateQuery = 'UPDATE users SET fullname = ?, email = ?';
    let params = [fullname, email];
    
    if (password && password.trim() !== '') {
      updateQuery += ', password = ?';
      const hashedPassword = bcrypt.hashSync(password, 10);
      params.push(hashedPassword);
    }
    
    updateQuery += ' WHERE id = ?';
    params.push(req.user.id);
    
    db.prepare(updateQuery).run(...params);
    
    const updatedUser = db.prepare('SELECT id, fullname, email, username, role, created_at FROM users WHERE id = ?').get(req.user.id);
    
    res.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

router.get('/my-events', (req, res) => {
  try {
    const db = getDb();
    
    const events = db.prepare(`
      SELECT e.*, r.registered_at
      FROM events e
      JOIN registrations r ON e.id = r.event_id
      WHERE r.user_id = ?
      ORDER BY e.event_date ASC
    `).all(req.user.id);
    
    res.json({ success: true, events });
  } catch (error) {
    console.error('Get my events error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

module.exports = router;
