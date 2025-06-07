const request = require('supertest');
const app = require('../server'); // Import the app instance
// No need to import sqlite3 or db directly in the test file unless you
// are writing specific database integration tests here.

describe('Server Basic Functionality', () => {
  // No need for beforeAll/afterAll for DB connection for these basic tests
  // since the server.js is now structured not to connect to DB during import.

  // Test case 1: Check for 404 on an undefined route
  test('GET /nonexistent-route should return 404', async () => {
    const response = await request(app).get('/nonexistent-route');
    expect(response.statusCode).toBe(404);
    expect(response.body).toEqual({ error: 'Route not found' });
  });

  // Test case 2: Check if / serves index.html
  test('GET / should serve index.html with correct content type', async () => {
    const response = await request(app).get('/');
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toMatch(/text\/html/);
    expect(response.text).toContain('<title>Medicine Tracker Pro</title>'); // Check content
  });

  // Example of how you would test an API endpoint that *might* use the DB
  // For this to work without errors, you'd typically mock db operations (db.run, db.get etc.)
  // or use an in-memory test database for this specific test suite.
  // test('POST /api/auth/register should return 400 for missing credentials', async () => {
  //   const response = await request(app)
  //     .post('/api/auth/register')
  //     .send({}); // Send empty body to test validation
  //   expect(response.statusCode).toBe(400);
  //   expect(response.body.error).toEqual('Username and password required');
  // });
});