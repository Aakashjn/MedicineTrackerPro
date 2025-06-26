const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key";

// Database setup
const dbPath = path.join(__dirname, "medicine_tracker.db");
const db = new sqlite3.Database(dbPath);

// Enhanced CORS configuration for Render deployment
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      "http://localhost:3000",
      "http://localhost:4000",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:4000",
      // Add your actual Render frontend URL here
      "https://medicinetrackerpro-production.up.railway.app",
      // This allows any onrender.com subdomain - replace with your specific URL
      /^https:\/\/.*\.onrender\.com$/
    ];
    
    // Check if origin matches any allowed pattern
    const isAllowed = allowedOrigins.some(pattern => {
      if (typeof pattern === "string" ) {
        return pattern === origin;
      } else if (pattern instanceof RegExp) {
        return pattern.test(origin);
      }
      return false;
    });
    
    if (isAllowed) {
      callback(null, true);
    } else {
      console.log("Blocked origin:", origin);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  optionsSuccessStatus: 200 // For legacy browser support
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, "public")));

// Add request logging for debugging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - Origin: ${req.get("Origin")}`);
  next();
});

// Database initialization
const initializeDatabase = () => {
  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS medicines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      dosage TEXT NOT NULL,
      frequency TEXT NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE,
      notes TEXT,
      active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users (id)
    )`,
    `CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      medicine_id INTEGER NOT NULL,
      scheduled_time TIME NOT NULL,
      taken BOOLEAN DEFAULT FALSE,
      taken_at DATETIME,
      scheduled_date DATE DEFAULT (DATE("now")),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (medicine_id) REFERENCES medicines (id)
    )`,
    `CREATE TABLE IF NOT EXISTS medicine_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      medicine_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      taken_at DATETIME NOT NULL,
      status TEXT DEFAULT "taken",
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (medicine_id) REFERENCES medicines (id),
      FOREIGN KEY (user_id) REFERENCES users (id)
    )`,
    `CREATE TABLE IF NOT EXISTS reminders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      medicine_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      reminder_time TIME NOT NULL,
      enabled BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (medicine_id) REFERENCES medicines (id),
      FOREIGN KEY (user_id) REFERENCES users (id)
    )`
  ];

  db.serialize(() => {
    tables.forEach(tableQuery => {
      db.run(tableQuery, (err) => {
        if (err) {
          console.error("Error creating table:", err);
        }
      });
    });
  });
  
  console.log("Database initialized successfully");
};

// Utility functions
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

const sendResponse = (res, status, data, message = null) => {
  const response = message ? { message, ...data } : data;
  res.status(status).json(response);
};

const sendError = (res, status, error) => {
  console.error("API Error:", error);
  res.status(status).json({ message: error }); 
};


const validateRequiredFields = (data, requiredFields) => {
  const missing = requiredFields.filter(field => !data[field]);
  return missing.length > 0 ? missing : null;
};

const dbQuery = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) {
        console.error("Database query error:", err);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
};

const dbGet = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) {
        console.error("Database get error:", err);
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
};

const dbRun = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(query, params, function(err) {
      if (err) {
        console.error("Database run error:", err);
        reject(err);
      } else {
        resolve({ id: this.lastID, changes: this.changes });
      }
    });
  });
};

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return sendError(res, 401, "Access token required");
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      console.error("JWT verification error:", err);
      return sendError(res, 403, "Invalid or expired token");
    }
    req.user = user;
    next();
  });
};

// User management utilities
const hashPassword = async (password) => {
  return await bcrypt.hash(password, 10);
};

const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

const generateToken = (user) => {
  return jwt.sign(
    { userId: user.id, email: user.email },
    JWT_SECRET,
    { expiresIn: "24h" }
  );
};

const findUserByEmail = async (email) => {
  const user = await dbGet("SELECT * FROM users WHERE email = ?", [email]);
  return user || null;
};

const createUser = async (userData) => {
  const { username, email, password } = userData;
  const hashedPassword = await hashPassword(password);
  
  const result = await dbRun(
    "INSERT INTO users (username, email, password) VALUES (?, ?, ?)",
    [username, email, hashedPassword]
  );
  
  return {
    id: result.id,
    username,
    email,
    created_at: new Date().toISOString()
  };
};

// Medicine management utilities
const validateMedicineData = (data) => {
  const required = ["name", "dosage", "frequency", "start_date"];
  return validateRequiredFields(data, required);
};

const getMedicinesByUserId = async (userId) => {
  return await dbQuery(
    "SELECT * FROM medicines WHERE user_id = ? AND active = 1 ORDER BY created_at DESC",
    [userId]
  );
};

// In server.js, find the createMedicine function
const createMedicine = async (medicineData, userId) => {
  const { name, dosage, frequency, start_date, end_date, notes } = medicineData;

  const result = await dbRun(
    `INSERT INTO medicines (user_id, name, dosage, frequency, start_date, end_date, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [userId, name, dosage, frequency, start_date, end_date, notes]
  );

  const newMedicineId = result.id;

  // --- NEW LOGIC STARTS HERE: Generate initial schedules based on frequency ---
  const schedulesToCreate = [];
  const today = new Date().toISOString().split('T')[0]; // Get today's date in YYYY-MM-DD format

  switch (frequency) {
    case 'daily':
      // For daily, create one schedule for today at 9 AM
      schedulesToCreate.push({ medicine_id: newMedicineId, scheduled_time: '09:00', scheduled_date: today });
      break;
    case 'twice-daily':
      // For twice-daily, create two schedules for today at 9 AM and 6 PM
      schedulesToCreate.push({ medicine_id: newMedicineId, scheduled_time: '09:00', scheduled_date: today });
      schedulesToCreate.push({ medicine_id: newMedicineId, scheduled_time: '18:00', scheduled_date: today });
      break;
    case 'three-times-daily':
      // For three-times-daily, create three schedules for today at 8 AM, 2 PM, and 8 PM
      schedulesToCreate.push({ medicine_id: newMedicineId, scheduled_time: '08:00', scheduled_date: today });
      schedulesToCreate.push({ medicine_id: newMedicineId, scheduled_time: '14:00', scheduled_date: today });
      schedulesToCreate.push({ medicine_id: newMedicineId, scheduled_time: '20:00', scheduled_date: today });
      break;
    case 'weekly':
      // For weekly, create one schedule for today if the medicine's start date is today or in the past
      // (Note: For full weekly recurrence, you'd need more advanced scheduling logic)
      if (new Date(start_date) <= new Date(today)) {
        schedulesToCreate.push({ medicine_id: newMedicineId, scheduled_time: '09:00', scheduled_date: today });
      }
      break;
    case 'as-needed':
      // No automatic schedule generation for 'as-needed' medicines
      break;
    default:
      console.warn(`Unknown frequency: ${frequency} for medicine ${newMedicineId}. No schedules generated.`);
  }

  // Insert all generated schedules into the database
  for (const scheduleData of schedulesToCreate) {
    await createSchedule(scheduleData); // Reuse your existing createSchedule function
  }
  // --- NEW LOGIC ENDS HERE ---

  return {
    id: newMedicineId,
    user_id: userId,
    ...medicineData,
    created_at: new Date().toISOString()
  };
};

const updateMedicine = async (medicineId, updateData, userId) => {
  const fields = [];
  const values = [];
  
  Object.entries(updateData).forEach(([key, value]) => {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  });
  
  if (fields.length === 0) {
    throw new Error("No fields to update");
  }
  
  values.push(medicineId, userId);
  
  const result = await dbRun(
    `UPDATE medicines SET ${fields.join(", ")} WHERE id = ? AND user_id = ?`,
    values
  );
  
  return result.changes > 0;
};

const deleteMedicine = async (medicineId, userId) => {
  const result = await dbRun(
    "UPDATE medicines SET active = 0 WHERE id = ? AND user_id = ?",
    [medicineId, userId]
  );
  
  return result.changes > 0;
};

// Schedule management utilities
const getSchedulesByUserId = async (userId) => {
  return await dbQuery(`
    SELECT s.*, m.name as medicine_name, m.dosage, m.frequency 
    FROM schedules s 
    JOIN medicines m ON s.medicine_id = m.id 
    WHERE m.user_id = ? AND m.active = 1
    ORDER BY s.scheduled_date DESC, s.scheduled_time
  `, [userId]);
};

const getTodaysSchedule = async (userId) => {
  const today = new Date().toISOString().split("T")[0];
  return await dbQuery(`
    SELECT s.*, m.name as medicine_name, m.dosage, m.frequency 
    FROM schedules s 
    JOIN medicines m ON s.medicine_id = m.id 
    WHERE m.user_id = ? AND m.active = 1 AND s.scheduled_date = ?
    ORDER BY s.scheduled_time
  `, [userId, today]);
};

const createSchedule = async (scheduleData) => {
  const { medicine_id, scheduled_time, scheduled_date } = scheduleData;
  const date = scheduled_date || new Date().toISOString().split("T")[0];
  
  const result = await dbRun(
    "INSERT INTO schedules (medicine_id, scheduled_time, scheduled_date) VALUES (?, ?, ?)",
    [medicine_id, scheduled_time, date]
  );
  
  return {
    id: result.id,
    medicine_id,
    scheduled_time,
    scheduled_date: date,
    taken: false,
    created_at: new Date().toISOString()
  };
};

const markScheduleAsTaken = async (scheduleId, userId) => {
  // First, get the medicine_id associated with the schedule
  const schedule = await dbGet(`
    SELECT medicine_id FROM schedules
    WHERE id = ? AND medicine_id IN (SELECT id FROM medicines WHERE user_id = ?)
  `, [scheduleId, userId]);

  if (!schedule) {
    console.warn(`Schedule ${scheduleId} not found or not owned by user ${userId}`);
    return false; // Schedule not found or not authorized
  }

  // Update the schedule as taken, ensuring user ownership
  const updateResult = await dbRun(`
    UPDATE schedules
    SET taken = 1, taken_at = CURRENT_TIMESTAMP
    WHERE id = ? AND medicine_id IN (SELECT id FROM medicines WHERE user_id = ?)
  `, [scheduleId, userId]); // FIX: Added userId to WHERE clause

  if (updateResult.changes > 0) {
    // If schedule was successfully updated, record it in history
    await recordMedicineHistory(schedule.medicine_id, userId, "taken");
    return true;
  }
  return false;
};

// History and Statistics utilities
const recordMedicineHistory = async (medicineId, userId, status = "taken", notes = null) => {
  const result = await dbRun(
    "INSERT INTO medicine_history (medicine_id, user_id, taken_at, status, notes) VALUES (?, ?, ?, ?, ?)",
    [medicineId, userId, new Date().toISOString(), status, notes]
  );
  
  return {
    id: result.id,
    medicine_id: medicineId,
    user_id: userId,
    taken_at: new Date().toISOString(),
    status,
    notes
  };
};

const getMedicineHistory = async (userId, filters = {}) => {
  let query = `
    SELECT mh.*, m.name as medicine_name, m.dosage 
    FROM medicine_history mh 
    JOIN medicines m ON mh.medicine_id = m.id 
    WHERE mh.user_id = ?
  `;
  let params = [userId];

  if (filters.date_from) {
    query += " AND DATE(mh.taken_at) >= ?";
    params.push(filters.date_from);
  }

  if (filters.date_to) {
    query += " AND DATE(mh.taken_at) <= ?";
    params.push(filters.date_to);
  }

  if (filters.medicine_id) {
    query += " AND mh.medicine_id = ?";
    params.push(filters.medicine_id);
  }

  query += " ORDER BY mh.taken_at DESC";

  return await dbQuery(query, params);
};

const getStatistics = async (userId) => {
  const stats = {};
  
  // Total active medicines
  const totalMedicines = await dbGet(
    "SELECT COUNT(*) as count FROM medicines WHERE user_id = ? AND active = 1",
    [userId]
  );
  stats.totalMedicines = totalMedicines.count;
  
  // Total doses taken
  const totalTaken = await dbGet(
    "SELECT COUNT(*) as count FROM medicine_history WHERE user_id = ? AND status = \"taken\"",
    [userId]
  );
  stats.totalDosesTaken = totalTaken.count;
  
  // Total doses missed
  const totalMissed = await dbGet(
    "SELECT COUNT(*) as count FROM medicine_history WHERE user_id = ? AND status = \"missed\"",
    [userId]
  );
  stats.totalDosesMissed = totalMissed.count;
  
  // Adherence rate (last 30 days)
  const adherence = await dbGet(`
    SELECT 
      ROUND(
        (COUNT(CASE WHEN status = \"taken\" THEN 1 END) * 100.0 / COUNT(*)), 2
      ) as rate 
    FROM medicine_history 
    WHERE user_id = ? AND DATE(taken_at) >= DATE("now", "-30 days")
  `, [userId]);
  stats.adherenceRate = adherence.rate || 0;
  
  return stats;
};

// Reminder utilities
const getRemindersByUserId = async (userId) => {
  return await dbQuery(`
    SELECT r.*, m.name as medicine_name, m.dosage 
    FROM reminders r 
    JOIN medicines m ON r.medicine_id = m.id 
    WHERE r.user_id = ? AND r.enabled = 1 AND m.active = 1
    ORDER BY r.reminder_time
  `, [userId]);
};

const createReminder = async (reminderData, userId) => {
  const { medicine_id, reminder_time } = reminderData;
  
  const result = await dbRun(
    "INSERT INTO reminders (medicine_id, user_id, reminder_time) VALUES (?, ?, ?)",
    [medicine_id, userId, reminder_time]
  );
  
  return {
    id: result.id,
    medicine_id,
    user_id: userId,
    reminder_time,
    enabled: true,
    created_at: new Date().toISOString()
  };
};

const updateReminder = async (reminderId, updateData, userId) => {
  const fields = [];
  const values = [];
  
  Object.entries(updateData).forEach(([key, value]) => {
    if (value !== undefined) {
      fields.push(`${key} = ?`);
      values.push(value);
    }
  });
  
  if (fields.length === 0) {
    throw new Error("No fields to update");
  }
  
  values.push(reminderId, userId);
  
  const result = await dbRun(
    `UPDATE reminders SET ${fields.join(", ")} WHERE id = ? AND user_id = ?`,
    values
  );
  
  return result.changes > 0;
};

const deleteReminder = async (reminderId, userId) => {
  const result = await dbRun(
    "DELETE FROM reminders WHERE id = ? AND user_id = ?",
    [reminderId, userId]
  );
  
  return result.changes > 0;
};

// API Routes
const router = express.Router();

// Auth Routes
router.post("/auth/register", asyncHandler(async (req, res) => {
  const { username, email, password } = req.body;
  const missing = validateRequiredFields(req.body, ["username", "email", "password"]);
  if (missing) {
    return sendError(res, 400, `Missing required fields: ${missing.join(", ")}`);
  }

  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    return sendError(res, 400, "User with this email already exists");
  }

  const newUser = await createUser({ username, email, password });
  sendResponse(res, 201, { user: newUser }, "User registered successfully");
}));

router.post("/auth/login", asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const missing = validateRequiredFields(req.body, ["email", "password"]);
  if (missing) {
    return sendError(res, 400, `Missing required fields: ${missing.join(", ")}`);
  }

  const user = await findUserByEmail(email);
  if (!user) {
    return sendError(res, 401, "Invalid credentials");
  }

  const isPasswordValid = await comparePassword(password, user.password);
  if (!isPasswordValid) {
    return sendError(res, 401, "Invalid credentials");
  }

  const token = generateToken(user);
  sendResponse(res, 200, { token, user: { id: user.id, username: user.username, email: user.email } }, "Login successful");
}));

// Medicine Routes
router.post("/medicines", authenticateToken, asyncHandler(async (req, res) => {
  const missing = validateMedicineData(req.body);
  if (missing) {
    return sendError(res, 400, `Missing required fields: ${missing.join(", ")}`);
  }

  const newMedicine = await createMedicine(req.body, req.user.userId);
  sendResponse(res, 201, { medicine: newMedicine }, "Medicine added successfully");
}));

router.get("/medicines", authenticateToken, asyncHandler(async (req, res) => {
  const medicines = await getMedicinesByUserId(req.user.userId);
  sendResponse(res, 200, { medicines });
}));

router.put("/medicines/:id", authenticateToken, asyncHandler(async (req, res) => {
  const medicineId = parseInt(req.params.id);
  const updated = await updateMedicine(medicineId, req.body, req.user.userId);
  
  if (!updated) {
    return sendError(res, 404, "Medicine not found or you do not have permission to update it");
  }

  sendResponse(res, 200, {}, "Medicine updated successfully");
}));

router.delete("/medicines/:id", authenticateToken, asyncHandler(async (req, res) => {
  const medicineId = parseInt(req.params.id);
  const deleted = await deleteMedicine(medicineId, req.user.userId);
  
  if (!deleted) {
    return sendError(res, 404, "Medicine not found or you do not have permission to delete it");
  }

  sendResponse(res, 200, {}, "Medicine deleted successfully");
}));

// Schedule Routes
router.get("/schedules", authenticateToken, asyncHandler(async (req, res) => {
  const schedules = await getSchedulesByUserId(req.user.userId);
  sendResponse(res, 200, { schedules });
}));

router.get("/schedules/today", authenticateToken, asyncHandler(async (req, res) => {
  const schedules = await getTodaysSchedule(req.user.userId);
  sendResponse(res, 200, { schedules });
}));

router.put("/schedules/:id/taken", authenticateToken, asyncHandler(async (req, res) => {
  const scheduleId = parseInt(req.params.id);
  
  const updated = await markScheduleAsTaken(scheduleId, req.user.userId);
  
  if (!updated) {
    return sendError(res, 404, "Schedule not found or you do not have permission to update it");
  }

  sendResponse(res, 200, {}, "Schedule marked as taken");
}));

// History Routes
router.get("/history", authenticateToken, asyncHandler(async (req, res) => {
  const history = await getMedicineHistory(req.user.userId, req.query);
  sendResponse(res, 200, { history });
}));

// Stats Routes
router.get("/stats", authenticateToken, asyncHandler(async (req, res) => {
  const stats = await getStatistics(req.user.userId);
  sendResponse(res, 200, { stats });
}));

// Reminder Routes
router.post("/reminders", authenticateToken, asyncHandler(async (req, res) => {
  const { medicine_id, reminder_time } = req.body;
  const missing = validateRequiredFields(req.body, ["medicine_id", "reminder_time"]);
  if (missing) {
    return sendError(res, 400, `Missing required fields: ${missing.join(", ")}`);
  }

  const newReminder = await createReminder(req.body, req.user.userId);
  sendResponse(res, 201, { reminder: newReminder }, "Reminder added successfully");
}));

router.get("/reminders", authenticateToken, asyncHandler(async (req, res) => {
  const reminders = await getRemindersByUserId(req.user.userId);
  sendResponse(res, 200, { reminders });
}));

router.put("/reminders/:id", authenticateToken, asyncHandler(async (req, res) => {
  const reminderId = parseInt(req.params.id);
  const updated = await updateReminder(reminderId, req.body, req.user.userId);
  
  if (!updated) {
    return sendError(res, 404, "Reminder not found or you do not have permission to update it");
  }

  sendResponse(res, 200, {}, "Reminder updated successfully");
}));

router.delete("/reminders/:id", authenticateToken, asyncHandler(async (req, res) => {
  const reminderId = parseInt(req.params.id);
  const deleted = await deleteReminder(reminderId, req.user.userId);
  
  if (!deleted) {
    return sendError(res, 404, "Reminder not found or you do not have permission to delete it");
  }

  sendResponse(res, 200, {}, "Reminder deleted successfully");
}));

app.use("/api", router);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Unhandled error:", err.stack);
  sendError(res, 500, "Something went wrong!");
});

// Start server
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📊 Database: ${dbPath}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/api/health` );
  });
}

// Initialize database on startup
initializeDatabase();

module.exports = app;
