const request = require('supertest');
const app = require('../app');

describe('Medicine Tracker API', () => {
  it('GET /medicines should return empty array initially', async () => {
    const res = await request(app).get('/medicines');
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('POST /medicines should add a medicine', async () => {
    const res = await request(app).post('/medicines').send({
      name: 'Paracetamol',
      expiryDate: '2025-12-31'
    });
    expect(res.statusCode).toBe(201);
    expect(res.body.name).toBe('Paracetamol');
  });

  it('GET /health should return 200', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
  });
});
