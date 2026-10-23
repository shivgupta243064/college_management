const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, 'college_events.db');

let dbWrapper = null;

/**
 * Compatibility wrapper that provides a better-sqlite3-like API on top of sql.js.
 * This allows all route files to work unchanged.
 */
class DatabaseWrapper {
  constructor(sqlJsDb) {
    this._db = sqlJsDb;
    this.inTransaction = false;
  }

  prepare(sql) {
    const db = this._db;
    const wrapper = this;
    const trimmedUpper = sql.trim().toUpperCase();

    return {
      get(...params) {
        let result = null;
        try {
          const stmt = db.prepare(sql);
          if (params.length > 0) stmt.bind(params);
          if (stmt.step()) {
            result = stmt.getAsObject();
          }
          stmt.free();
        } catch (e) {
          // If the query returns no results, sql.js may throw
          if (e.message && e.message.includes('nothing to prepare')) {
            return null;
          }
          throw e;
        }
        return result;
      },

      all(...params) {
        const results = [];
        try {
          const stmt = db.prepare(sql);
          if (params.length > 0) stmt.bind(params);
          while (stmt.step()) {
            results.push(stmt.getAsObject());
          }
          stmt.free();
        } catch (e) {
          if (e.message && e.message.includes('nothing to prepare')) {
            return [];
          }
          throw e;
        }
        return results;
      },

      run(...params) {
        // Handle transaction commands
        if (trimmedUpper === 'BEGIN TRANSACTION' || trimmedUpper === 'BEGIN') {
          db.run('BEGIN TRANSACTION');
          wrapper.inTransaction = true;
          wrapper._save();
          return { changes: 0, lastInsertRowid: 0 };
        }
        if (trimmedUpper === 'COMMIT') {
          db.run('COMMIT');
          wrapper.inTransaction = false;
          wrapper._save();
          return { changes: 0, lastInsertRowid: 0 };
        }
        if (trimmedUpper === 'ROLLBACK') {
          db.run('ROLLBACK');
          wrapper.inTransaction = false;
          wrapper._save();
          return { changes: 0, lastInsertRowid: 0 };
        }

        db.run(sql, params);
        const changes = db.getRowsModified();

        // Get last insert rowid
        let lastInsertRowid = 0;
        try {
          const ridStmt = db.prepare('SELECT last_insert_rowid() as rid');
          if (ridStmt.step()) {
            lastInsertRowid = ridStmt.getAsObject().rid;
          }
          ridStmt.free();
        } catch (e) {
          // Ignore errors getting rowid
        }

        wrapper._save();

        return { changes, lastInsertRowid };
      }
    };
  }

  exec(sql) {
    this._db.exec(sql);
    this._save();
  }

  _save() {
    try {
      const data = this._db.export();
      fs.writeFileSync(DB_PATH, Buffer.from(data));
    } catch (e) {
      console.error('Error saving database:', e);
    }
  }
}

/**
 * Returns the database wrapper instance (singleton).
 * Must call initDb() first.
 */
function getDb() {
  if (!dbWrapper) {
    throw new Error('Database not initialized. Call initDb() first.');
  }
  return dbWrapper;
}

/**
 * Initialize the database (async — must be awaited).
 * Creates tables and seeds sample data.
 */
async function initDb() {
  const SQL = await initSqlJs();

  let db;
  // Load existing database if it exists
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  dbWrapper = new DatabaseWrapper(db);

  // Create tables
  dbWrapper.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fullname TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      username TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'student',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event_name TEXT NOT NULL,
      event_date TEXT NOT NULL,
      event_time TEXT DEFAULT '10:00',
      venue TEXT NOT NULL,
      description TEXT,
      category TEXT DEFAULT 'general',
      max_capacity INTEGER DEFAULT 100,
      image_url TEXT,
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      event_id INTEGER REFERENCES events(id),
      registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, event_id)
    );
  `);

  // Seed admin user if not exists
  const adminCheck = dbWrapper.prepare('SELECT id FROM users WHERE username = ?').get('admin');
  if (!adminCheck) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    const result = dbWrapper.prepare(`
      INSERT INTO users (fullname, email, username, password, role)
      VALUES (?, ?, ?, ?, ?)
    `).run('Admin User', 'admin@college.edu', 'admin', hashedPassword, 'admin');
    const adminId = result.lastInsertRowid;

    // Seed sample events
    const eventCount = dbWrapper.prepare('SELECT COUNT(*) as count FROM events').get();
    if (!eventCount || eventCount.count === 0) {
      const eventsData = [
        ['Tech Symposium 2026', '2026-09-15', '09:00', 'Main Auditorium', 'Annual technical symposium featuring coding competitions, hackathons, and expert talks from industry leaders.', 'technical', 300, adminId],
        ['Cultural Fest - Synergy', '2026-09-22', '17:00', 'Open Air Theatre', 'Experience the biggest cultural extravaganza with music, dance, drama performances and art exhibitions.', 'cultural', 1000, adminId],
        ['Inter-College Basketball', '2026-09-28', '14:00', 'Sports Ground', 'Cheer for your college basketball team as they face off against rival colleges in this thrilling tournament.', 'sports', 200, adminId],
        ['AI & Machine Learning Workshop', '2026-10-05', '10:00', 'CS Lab', 'Hands-on workshop on the latest trends in Artificial Intelligence and Machine Learning with real-world projects.', 'workshop', 50, adminId],
        ['Career Guidance Seminar', '2026-10-12', '11:00', 'Seminar Hall', 'Seminar on career opportunities, resume building, and interview preparation by top industry experts.', 'seminar', 150, adminId],
        ['Freshers Welcome Party', '2026-10-20', '18:00', 'Main Auditorium', 'Welcome event for the incoming batch with fun activities, talent showcase, and a grand dinner.', 'general', 500, adminId]
      ];

      for (const event of eventsData) {
        dbWrapper.prepare(`
          INSERT INTO events (event_name, event_date, event_time, venue, description, category, max_capacity, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(...event);
      }
    }

    console.log('Database seeded with admin user and sample events.');
  }

  console.log('Database initialized successfully.');
}

module.exports = {
  getDb,
  initDb
};
