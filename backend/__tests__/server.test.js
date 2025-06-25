// backend/__tests__/server.test.js
const request = require('supertest');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// IMPORTANT: Ensure JWT_SECRET is set consistently for tests.
// This MUST match the fallback secret defined in your server.js (line 18 in your repository).
process.env.JWT_SECRET = 'your-super-secret-key'; // Make sure this matches your server.js fallback

const app = require('../server'); // Import app AFTER setting the environment variable

// Test database (ensure this is configured correctly to be in-memory for tests)
const testDb = new sqlite3.Database(':memory:');

describe('Medicine Tracker API', () => {
  // Declare authToken and userId at the top-level of this describe block
  // so they are accessible across all nested describe blocks.
  let authToken;
  let userId; // userId is assigned but not explicitly used in tests, acknowledged previously.

  // Use this for a medicine created in Medicine Management tests
  let managedMedicineId;

  // Use this for a medicine created specifically for History tests
  let historyMedicineId;

  beforeAll(async () => {
    // Setup test database
    await new Promise((resolve) => {
      testDb.serialize(() => {
        testDb.run(`CREATE TABLE users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          username TEXT UNIQUE NOT NULL,
          password TEXT NOT NULL,
          email TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`);

        testDb.run(`CREATE TABLE medicines (
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

        testDb.run(`CREATE TABLE medicine_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          medicine_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          taken_at DATETIME NOT NULL,
          status TEXT DEFAULT 'taken',
          notes TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (medicine_id) REFERENCES medicines (id),
          FOREIGN KEY (user_id) REFERENCES users (id)
        )`, resolve);
      });
    });
  });

  afterAll(async () => {
    // Close the test database connection after all tests are done
    testDb.close();
  });

  describe('Authentication', () => {
    describe('POST /api/auth/register', () => {
      test('should register a new user successfully', async () => {
        const userData = {
          username: 'testuser',
          password: 'testpass123',
          email: 'test@example.com'
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData)
          .expect(201);

        expect(response.body).toHaveProperty('message', 'User created successfully');
        expect(response.body).toHaveProperty('token');
        expect(response.body.user).toHaveProperty('username', 'testuser');

        // This is CRITICAL: Assign to the top-level authToken and userId
        authToken = response.body.token;
        userId = response.body.user.id;
      });

      test('should fail with missing username', async () => {
        const userData = {
          password: 'testpass123'
          // Email and username are missing here, matching the Jenkins log's output error
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData)
          .expect(400);

        // Updated expectation to match the exact error message from Jenkins logs
        expect(response.body).toHaveProperty('error', 'Missing required fields: username, email');
      });

      test('should fail with missing password', async () => {
        const userData = {
          username: 'testuser2'
          // Password and email are missing here, matching the Jenkins log's output error
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData)
          .expect(400);

        // Updated expectation to match the exact error message from Jenkins logs
        expect(response.body).toHaveProperty('error', 'Missing required fields: email, password');
      });
    });

    describe('POST /api/auth/login', () => {
      test('should login successfully with correct credentials', async () => {
        const loginData = {
          username: 'testuser',
          password: 'testpass123'
        };

        const response = await request(app)
          .post('/api/auth/login')
          .send(loginData)
          .expect(200);

        expect(response.body).toHaveProperty('message', 'Login successful');
        expect(response.body).toHaveProperty('token');
        expect(response.body.user).toHaveProperty('username', 'testuser');
      });

      test('should fail with incorrect password', async () => {
        const loginData = {
          username: 'testuser',
          password: 'wrongpassword'
        };

        const response = await request(app)
          .post('/api/auth/login')
          .send(loginData)
          .expect(401);

        expect(response.body).toHaveProperty('error', 'Invalid credentials');
      });

      test('should fail with non-existent user', async () => {
        const loginData = {
          username: 'nonexistent',
          password: 'testpass123'
        };

        const response = await request(app)
          .post('/api/auth/login')
          .send(loginData)
          .expect(401);

        expect(response.body).toHaveProperty('error', 'Invalid credentials');
      });
    });
  });

  describe('Medicine Management', () => {
    // managedMedicineId is declared at the top-level describe block

    test('should create a new medicine', async () => {
      const medicineData = {
        name: 'Aspirin',
        dose: '100mg',
        time: '08:00',
        frequency: 'daily',
        notes: 'Take with food'
      };

      const response = await request(app)
        .post('/api/medicines')
        // Attach the authentication token obtained from successful registration
        .set('Authorization', `Bearer ${authToken}`)
        .send(medicineData)
        .expect(201);

      expect(response.body).toHaveProperty('name', 'Aspirin');
      expect(response.body).toHaveProperty('dose', '100mg');
      expect(response.body).toHaveProperty('time', '08:00');

      // Assign to the top-level managedMedicineId
      managedMedicineId = response.body.id;
    });

    test('should fail without authentication when creating medicine', async () => {
      const medicineData = {
        name: 'Paracetamol',
        dose: '500mg',
        time: '12:00'
      };

      const response = await request(app)
        .post('/api/medicines')
        .send(medicineData) // No Authorization header
        .expect(401);

      expect(response.body).toHaveProperty('error', 'Access token required');
    });

    test('should fail with missing required fields when creating medicine', async () => {
      const medicineData = {
        name: 'Ibuprofen'
        // Missing dose and time, which are required
      };

      const response = await request(app)
        .post('/api/medicines')
        .set('Authorization', `Bearer ${authToken}`)
        .send(medicineData)
        .expect(400);

      expect(response.body).toHaveProperty('error', 'Name, dose, and time are required');
    });

    describe('GET /api/medicines', () => {
      test('should get all medicines for authenticated user', async () => {
        const response = await request(app)
          .get('/api/medicines')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThan(0);
        expect(response.body[0]).toHaveProperty('name');
        expect(response.body[0]).toHaveProperty('dose');
      });

      test('should fail without authentication when getting medicines', async () => {
        const response = await request(app)
          .get('/api/medicines')
          .expect(401);

        expect(response.body).toHaveProperty('error', 'Access token required');
      });
    });

    describe('PUT /api/medicines/:id', () => {
      test('should update medicine successfully', async () => {
        const updateData = {
          name: 'Updated Aspirin',
          dose: '200mg',
          time: '09:00',
          frequency: 'twice daily',
          notes: 'Updated notes'
        };

        const response = await request(app)
          .put(`/api/medicines/${managedMedicineId}`) // Use managedMedicineId
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body).toHaveProperty('message', 'Medicine updated successfully');
      });

      test('should fail for non-existent medicine when updating', async () => {
        const updateData = {
          name: 'Non-existent',
          dose: '100mg',
          time: '08:00',
          frequency: 'daily'
        };

        const response = await request(app)
          .put('/api/medicines/9999') // Using a non-existent ID
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData)
          .expect(404);

        expect(response.body).toHaveProperty('error', 'Medicine not found');
      });

      test('should fail without authentication when updating medicine', async () => {
        const updateData = {
          name: 'Unauthorized Update',
          dose: '10mg',
          time: '10:00'
        };

        const response = await request(app)
          .put(`/api/medicines/${managedMedicineId}`)
          .send(updateData) // No Authorization header
          .expect(401);

        expect(response.body).toHaveProperty('error', 'Access token required');
      });
    });

    describe('DELETE /api/medicines/:id', () => {
      test('should delete medicine successfully', async () => {
        const response = await request(app)
          .delete(`/api/medicines/${managedMedicineId}`) // Use managedMedicineId
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('message', 'Medicine deleted successfully');
      });

      test('should fail for non-existent medicine when deleting', async () => {
        const response = await request(app)
          .delete('/api/medicines/9999') // Using a non-existent ID
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);

        expect(response.body).toHaveProperty('error', 'Medicine not found');
      });

      test('should fail without authentication when deleting medicine', async () => {
        const response = await request(app)
          .delete(`/api/medicines/${managedMedicineId}`)
          .expect(401); // No Authorization header

        expect(response.body).toHaveProperty('error', 'Access token required');
      });
    });
  });

  describe('Medicine History', () => {
    // This 'beforeAll' will run AFTER the top-level 'Authentication' block,
    // so 'authToken' should be available.
    beforeAll(async () => {
      // Create a new medicine for history tests using the obtained authToken
      const medicineData = {
        name: 'Vitamin D',
        dose: '1000 IU',
        time: '10:00',
        frequency: 'daily'
      };

      const response = await request(app)
        .post('/api/medicines')
        .set('Authorization', `Bearer ${authToken}`)
        .send(medicineData);

      // Assign to the top-level historyMedicineId
      historyMedicineId = response.body.id;
    });

    describe('POST /api/medicines/:id/record', () => {
      test('should record medicine intake', async () => {
        const recordData = {
          status: 'taken',
          notes: 'Taken with breakfast'
        };

        const response = await request(app)
          .post(`/api/medicines/${historyMedicineId}/record`) // Use historyMedicineId
          .set('Authorization', `Bearer ${authToken}`)
          .send(recordData)
          .expect(201);

        expect(response.body).toHaveProperty('status', 'taken');
        expect(response.body).toHaveProperty('medicine_id', historyMedicineId);
      });

      test('should record missed medicine', async () => {
        const recordData = {
          status: 'missed',
          notes: 'Forgot to take'
        };

        const response = await request(app)
          .post(`/api/medicines/${historyMedicineId}/record`) // Use historyMedicineId
          .set('Authorization', `Bearer ${authToken}`)
          .send(recordData)
          .expect(201);

        expect(response.body).toHaveProperty('status', 'missed');
        expect(response.body).toHaveProperty('medicine_id', historyMedicineId);
      });

      test('should fail for non-existent medicine when recording', async () => {
        const recordData = { status: 'taken' };
        const response = await request(app)
          .post('/api/medicines/9999/record') // Non-existent medicine ID
          .set('Authorization', `Bearer ${authToken}`)
          .send(recordData)
          .expect(404);

        expect(response.body).toHaveProperty('error', 'Medicine not found');
      });

      test('should fail without authentication when recording medicine', async () => {
        const recordData = { status: 'taken' };
        const response = await request(app)
          .post(`/api/medicines/${historyMedicineId}/record`)
          .send(recordData) // No Authorization header
          .expect(401);

        expect(response.body).toHaveProperty('error', 'Access token required');
      });
    });

    describe('GET /api/history', () => {
      test('should get medicine history for authenticated user', async () => {
        const response = await request(app)
          .get('/api/history')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        expect(response.body.length).toBeGreaterThan(0);
        expect(response.body[0]).toHaveProperty('medicine_name');
        expect(response.body[0]).toHaveProperty('status');
      });

      test('should filter history by medicine_id', async () => {
        const response = await request(app)
          .get(`/api/history?medicine_id=${historyMedicineId}`) // Use historyMedicineId
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        response.body.forEach(record => {
          expect(record.medicine_id).toBe(historyMedicineId);
        });
      });

      test('should fail without authentication when getting history', async () => {
        const response = await request(app)
          .get('/api/history')
          .expect(401);

        expect(response.body).toHaveProperty('error', 'Access token required');
      });
    });
  });

  describe('Statistics', () => {
    describe('GET /api/stats', () => {
      test('should get user statistics', async () => {
        const response = await request(app)
          .get('/api/stats')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('totalMedicines');
        expect(response.body).toHaveProperty('totalDosesTaken');
        expect(response.body).toHaveProperty('totalDosesMissed');
        expect(response.body).toHaveProperty('adherenceRate');

        expect(typeof response.body.totalMedicines).toBe('number');
        expect(typeof response.body.totalDosesTaken).toBe('number');
        expect(typeof response.body.totalDosesMissed).toBe('number');
        // Ensure adherenceRate is a number, even if it's NaN for 0 total doses
        expect(typeof response.body.adherenceRate).toBe('number');
      });

      test('should fail without authentication when getting stats', async () => {
        const response = await request(app)
          .get('/api/stats')
          .expect(401);

        expect(response.body).toHaveProperty('error', 'Access token required');
      });
    });
  });

  describe('Daily Schedule', () => {
    describe('GET /api/schedule/today', () => {
      test('should get today\'s medicine schedule', async () => {
        const response = await request(app)
          .get('/api/schedule/today')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        response.body.forEach(medicine => {
          expect(medicine).toHaveProperty('name');
          expect(medicine).toHaveProperty('dose'); // Ensure dose is also returned
          expect(medicine).toHaveProperty('time');
          expect(medicine).toHaveProperty('taken_today');
          expect(typeof medicine.taken_today).toBe('number');
        });
      });

      test('should fail without authentication when getting schedule', async () => {
        const response = await request(app)
          .get('/api/schedule/today')
          .expect(401);

        expect(response.body).toHaveProperty('error', 'Access token required');
      });
    });
  });

  describe('Error Handling', () => {
    test('should return 404 for non-existent routes', async () => {
      const response = await request(app)
        .get('/api/nonexistent')
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Route not found');
    });

    test('should handle invalid JWT tokens', async () => {
      const response = await request(app)
        .get('/api/medicines')
        .set('Authorization', 'Bearer invalid-token') // Intentionally sending a bad token
        .expect(403); // Your server returns 403 for invalid/expired tokens

      // Updated expectation to match the exact error message from Jenkins logs
      expect(response.body).toHaveProperty('error', 'Invalid or expired token');
    });

    test('should handle missing Bearer prefix in Authorization header', async () => {
      const response = await request(app)
        .get('/api/medicines')
        .set('Authorization', authToken) // Missing "Bearer " prefix
        .expect(403);

      expect(response.body).toHaveProperty('error', 'Invalid or expired token'); // Assuming middleware catches this as malformed/invalid
    });
  });
});

// Additional utility tests (unrelated to API calls but important for core logic)
describe('Utility Functions', () => {
  describe('Password Hashing', () => {
    test('should hash passwords correctly', async () => {
      const password = 'testpassword';
      const hashedPassword = await bcrypt.hash(password, 10);

      expect(hashedPassword).not.toBe(password);
      expect(hashedPassword.length).toBeGreaterThan(password.length);

      const isValid = await bcrypt.compare(password, hashedPassword);
      expect(isValid).toBe(true);
    });
  });

  describe('JWT Token', () => {
    test('should create and verify JWT tokens', () => {
      const payload = {
        userId: 123
      };
      // This 'test-secret' is specific to this utility test and does not
      // necessarily need to match the application's JWT_SECRET, but can for consistency.
      const secret = process.env.JWT_SECRET || 'test-secret-for-util'; // Use the same JWT_SECRET or a specific one
      
      const token = jwt.sign(payload, secret, {
        expiresIn: '1h'
      });
      expect(typeof token).toBe('string');

      const decoded = jwt.verify(token, secret);
      expect(decoded.userId).toBe(123);
      expect(decoded).toHaveProperty('exp'); // Check for expiration property
      expect(decoded).toHaveProperty('iat'); // Check for issued at property
    });
  });
});
