// medicineService.js
const { medicines } = require('./data'); // In-memory or DB stub

function validateMedicineFields({ name, expiryDate }) {
  if (!name || !expiryDate) {
    const err = new Error('Missing name or expiryDate');
    err.status = 400;
    throw err;
  }
}

function findMedicineById(id) {
  const med = medicines.find(m => m.id === id);
  if (!med) {
    const err = new Error('Medicine not found');
    err.status = 404;
    throw err;
  }
  return med;
}

function sanitizeString(str) {
  return String(str).trim(); // Basic example of input sanitation
}

module.exports = {
  validateMedicineFields,
  findMedicineById,
  sanitizeString,
};
