// backend/__tests__/server.test.js
const request = require('supertest');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// 1. IMPORTANT: Set a JWT_SECRET for testing.
// This ensures consistency if your server.js relies on process.env.JWT_SECRET.
// Replace 'your-very-strong-secret-key-for-medicine-app' with the actual secret
// string your server.js uses or expects from an environment variable.
process.env.JWT_SECRET = 'your-very-strong-secret-key-for-medicine-app'; 

const app = require('../server'); // Import app AFTER setting the environment variable

// Test database
const testDb = new sqlite3.Database(':memory:');

describe('Medicine Tracker API', () => {
  let authToken;
  let userId;

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
        
        authToken = response.body.token;
        userId = response.body.user.id;
      });

      test('should fail with missing username', async () => {
        const userData = {
          password: 'testpass123'
          // Email will also be undefined if not provided, and backend might require it
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData)
          .expect(400);

        // 2. Updated expectation based on Jenkins log for missing username and email
        expect(response.body).toHaveProperty('error', 'Missing required fields: username, email');
      });

      test('should fail with missing password', async () => {
        const userData = {
          username: 'testuser2'
          // Email will also be undefined if not provided, and backend might require it
        };

        const response = await request(app)
          .post('/api/auth/register')
          .send(userData)
          .expect(400);

        // 3. Updated expectation based on Jenkins log for missing email and password
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
    let medicineId;

    describe('POST /api/medicines', () => {
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
          .set('Authorization', `Bearer ${authToken}`)
          .send(medicineData)
          .expect(201);

        expect(response.body).toHaveProperty('name', 'Aspirin');
        expect(response.body).toHaveProperty('dose', '100mg');
        expect(response.body).toHaveProperty('time', '08:00');
        
        medicineId = response.body.id;
      });

      test('should fail without authentication', async () => {
        const medicineData = {
          name: 'Aspirin',
          dose: '100mg',
          time: '08:00'
        };

        const response = await request(app)
          .post('/api/medicines')
          .send(medicineData)
          .expect(401);

        expect(response.body).toHaveProperty('error', 'Access token required');
      });

      test('should fail with missing required fields', async () => {
        const medicineData = {
          name: 'Aspirin'
          // Missing dose and time
        };

        const response = await request(app)
          .post('/api/medicines')
          .set('Authorization', `Bearer ${authToken}`)
          .send(medicineData)
          .expect(400);

        expect(response.body).toHaveProperty('error', 'Name, dose, and time are required');
      });
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

      test('should fail without authentication', async () => {
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
          .put(`/api/medicines/${medicineId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body).toHaveProperty('message', 'Medicine updated successfully');
      });

      test('should fail for non-existent medicine', async () => {
        const updateData = {
          name: 'Non-existent',
          dose: '100mg',
          time: '08:00',
          frequency: 'daily'
        };

        const response = await request(app)
          .put('/api/medicines/9999')
          .set('Authorization', `Bearer ${authToken}`)
          .send(updateData)
          .expect(404);

        expect(response.body).toHaveProperty('error', 'Medicine not found');
      });
    });

    describe('DELETE /api/medicines/:id', () => {
      test('should delete medicine successfully', async () => {
        const response = await request(app)
          .delete(`/api/medicines/${medicineId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('message', 'Medicine deleted successfully');
      });

      test('should fail for non-existent medicine', async () => {
        const response = await request(app)
          .delete('/api/medicines/9999')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);

        expect(response.body).toHaveProperty('error', 'Medicine not found');
      });
    });
  });

  describe('Medicine History', () => {
    let newMedicineId;

    beforeAll(async () => {
      // Create a new medicine for history tests
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

      newMedicineId = response.body.id;
    });

    describe('POST /api/medicines/:id/record', () => {
      test('should record medicine intake', async () => {
        const recordData = {
          status: 'taken',
          notes: 'Taken with breakfast'
        };

        const response = await request(app)
          .post(`/api/medicines/${newMedicineId}/record`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(recordData)
          .expect(201);

        expect(response.body).toHaveProperty('status', 'taken');
        expect(response.body).toHaveProperty('medicine_id', newMedicineId);
      });

      test('should record missed medicine', async () => {
        const recordData = {
          status: 'missed',
          notes: 'Forgot to take'
        };

        const response = await request(app)
          .post(`/api/medicines/${newMedicineId}/record`)
          .set('Authorization', `Bearer ${authToken}`)
          .send(recordData)
          .expect(201);

        expect(response.body).toHaveProperty('status', 'missed');
      });
    });

    describe('GET /api/history', () => {
      test('should get medicine history', async () => {
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
          .get(`/api/history?medicine_id=${newMedicineId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(Array.isArray(response.body)).toBe(true);
        response.body.forEach(record => {
          expect(record.medicine_id).toBe(newMedicineId);
        });
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
        expect(typeof response.body.adherenceRate).toBe('number');
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
          expect(medicine).toHaveProperty('time');
          expect(medicine).toHaveProperty('taken_today');
          expect(typeof medicine.taken_today).toBe('number');
        });
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
        .set('Authorization', 'Bearer invalid-token')
        .expect(403);

      expect(response.body).toHaveProperty('error', 'Invalid token');
    });
  });
});

// Additional utility tests
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
      const payload = { userId: 123 };
      const secret = 'test-secret'; // This is for the utility test, not necessarily the app's secret
      
      const token = jwt.sign(payload, secret, { expiresIn: '1h' });
      expect(typeof token).toBe('string');
      
      const decoded = jwt.verify(token, secret);
      expect(decoded.userId).toBe(123);
    });
  });
});
