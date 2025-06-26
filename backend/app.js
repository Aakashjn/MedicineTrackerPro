// app.js
const express = require('express');
const bodyParser = require('body-parser');
const {
  validateMedicineFields,
  findMedicineById,
  sanitizeString
} = require('./medicineService');

const app = express();
app.use(bodyParser.json());

// List all medicines
app.get('/medicines', (req, res, next) => {
  try {
    res.json(require('./data').medicines);
  } catch (err) { next(err); }
});

// Create a new medicine
app.post('/medicines', (req, res, next) => {
  try {
    const body = req.body;
    validateMedicineFields(body);

    const newMed = {
      id: String(Date.now()), // Unique ID
      name: sanitizeString(body.name),
      expiryDate: new Date(body.expiryDate).toISOString()
    };

    require('./data').medicines.push(newMed);
    res.status(201).json(newMed);
  } catch (err) { next(err); }
});

// Update existing medicine
app.put('/medicines/:id', (req, res, next) => {
  try {
    const id = sanitizeString(req.params.id);
    validateMedicineFields(req.body);
    const existingMed = findMedicineById(id);

    existingMed.name = sanitizeString(req.body.name);
    existingMed.expiryDate = new Date(req.body.expiryDate).toISOString();

    res.json(existingMed);
  } catch (err) { next(err); }
});

// Delete a medicine
app.delete('/medicines/:id', (req, res, next) => {
  try {
    const id = sanitizeString(req.params.id);
    findMedicineById(id); // Throws 404 if not found
    const index = require('./data').medicines.findIndex(m => m.id === id);
    require('./data').medicines.splice(index, 1);
    res.sendStatus(204);
  } catch (err) { next(err); }
});

// Global error handler for reliability
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({
    error: err.message || 'An unexpected error occurred'
  });
});

module.exports = app;
