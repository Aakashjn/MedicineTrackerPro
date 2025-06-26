const express = require('express');
const helmet = require('helmet');
const bodyParser = require('body-parser');
const { medicines } = require('./data');
const { validateMedicineFields, findMedicineById } = require('./medicineService');

const app = express();
app.use(helmet());
app.use(bodyParser.json());

// Get all medicines
app.get('/medicines', (req, res) => {
  res.json(medicines);
});

// Add a new medicine
app.post('/medicines', (req, res, next) => {
  try {
    validateMedicineFields(req.body);
    const newMedicine = {
      id: Date.now().toString(),
      name: req.body.name.trim(),
      expiryDate: req.body.expiryDate,
    };
    medicines.push(newMedicine);
    res.status(201).json(newMedicine);
  } catch (err) {
    next(err);
  }
});

// Update an existing medicine
app.put('/medicines/:id', (req, res, next) => {
  try {
    validateMedicineFields(req.body);
    const medicine = findMedicineById(req.params.id);
    if (!medicine) return res.status(404).json({ error: 'Medicine not found' });

    medicine.name = req.body.name.trim();
    medicine.expiryDate = req.body.expiryDate;
    res.json(medicine);
  } catch (err) {
    next(err);
  }
});

// Delete a medicine
app.delete('/medicines/:id', (req, res) => {
  const index = medicines.findIndex(med => med.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Medicine not found' });

  medicines.splice(index, 1);
  res.status(204).send();
});

// Health check route
app.get('/health', (req, res) => res.status(200).send('OK'));

// Error handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message });
});

module.exports = app;
