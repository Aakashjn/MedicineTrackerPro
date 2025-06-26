const request = require('supertest');
const app = require('./app');
const { medicines } = require('./data');

beforeEach(() => {
  medicines.length = 0;
  medicines.push({ id: '100', name: 'Aspirin', expiryDate: '2025-12-31' });
});

test('GET /medicines', async () => {
  const res = await request(app).get('/medicines');
  expect(res.statusCode).toBe(200);
  expect(res.body).toHaveLength(1);
});

test('POST /medicines without fields fails', async () => {
  const res = await request(app).post('/medicines').send({});
  expect(res.statusCode).toBe(400);
  expect(res.body.error).toBe('Missing name or expiryDate');
});

test('POST valid medicine succeeds', async () => {
  const res = await request(app).post('/medicines')
    .send({ name: 'Tylenol', expiryDate: '2026-04-01' });
  expect(res.statusCode).toBe(201);
  expect(res.body.name).toBe('Tylenol');
});

test('PUT updates existing medicine', async () => {
  const res = await request(app).put('/medicines/100')
    .send({ name: 'AspirinX', expiryDate: '2026-05-05' });
  expect(res.statusCode).toBe(200);
  expect(res.body.name).toBe('AspirinX');
});

test('PUT non-existent returns 404', async () => {
  const res = await request(app).put('/medicines/999')
    .send({ name: 'X', expiryDate: '2026-05-05' });
  expect(res.statusCode).toBe(404);
});

test('DELETE medicine works', async () => {
  const res = await request(app).delete('/medicines/100');
  expect(res.statusCode).toBe(204);
  expect(medicines).toHaveLength(0);
});
