const express = require('express');
const sqlite3 = require('sqlite3').verbose(); // Keep this require at the top
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Declare db variable globally but don't initialize immediately
let db;

// Function to initialize the database
function initializeDatabase() {
  if (db) {
    console.log("Database already initialized.");
    return; // Already connected
  }
  db = new sqlite3.Database('./medicine_tracker.db', (err) => {
    if (err) {
      console.error('Could not connect to database', err.message);
      // In a real app, you might want to exit or handle this more robustly
    } else {
      console.log('Connected to the SQLite database.');
      // Create tables if they don't exist, ONLY AFTER successful connection
      db.serialize(() => {
        // Users table
        db.run(`CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          email TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        // Medicines table
        db.run(`CREATE TABLE IF NOT EXISTS medicines (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          dose TEXT NOT NULL,
          time TEXT NOT NULL,
          frequency TEXT DEFAULT 'daily',
          notes TEXT,
          active BOOLEAN DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id)
        )`);

        // Medicine history table
        db.run(`CREATE TABLE IF NOT EXISTS medicine_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          medicine_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          taken_at DATETIME NOT NULL,
          status TEXT DEFAULT 'taken', -- taken, missed, skipped
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (medicine_id) REFERENCES medicines (id),
          FOREIGN KEY (user_id) REFERENCES users (id)
        )`);

        // Reminders table
        db.run(`CREATE TABLE IF NOT EXISTS reminders (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          medicine_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          reminder_time TIME NOT NULL,
          enabled BOOLEAN DEFAULT 1,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (medicine_id) REFERENCES medicines (id),
          FOREIGN KEY (user_id) REFERENCES users (id)
        )`);
        console.log('Database tables checked/created.');
      });
    }
  });
}

// Middleware
app.use(cors());
app.use(express.json());
// app.use(express.static('public')); // Removed this, handled by app.get('/') or specific routes

// ... (REST OF YOUR ROUTES: AUTH, MEDICINE, HISTORY, STATS, SCHEDULE) ...

// Serve frontend
app.get('/', (req, res) => {
  // Assuming index.html is in ../frontend relative to backend/server.js
  res.sendFile(path.join(__dirname, '../frontend', 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack); // Only log detailed stack in dev/test
  }
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler - This should come after all other routes and static serving attempts
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Export the app instance. This is what supertest will use.
module.exports = app;

// Export the db instance and initializer for potential use in tests or other modules
module.exports.db = db; // This will initially be null/undefined when imported
module.exports.initializeDatabase = initializeDatabase; // Export the initializer function

// Start server ONLY if this script is executed directly (not imported as a module)
if (require.main === module) {
  // Initialize DB before starting the server
  initializeDatabase();
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  if (db) { // Only close if db connection was actually established
    db.close((err) => {
      if (err) {
        console.error("Error closing DB:", err.message);
      } else {
        console.log('Database connection closed.');
      }
      process.exit(0);
    });
  } else {
    process.exit(0); // No DB to close, just exit
  }
});