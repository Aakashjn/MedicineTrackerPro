function validateMedicineFields(data) {
  if (!data.name || typeof data.name !== 'string' || data.name.trim() === '') {
    const err = new Error('Invalid name');
    err.status = 400;
    throw err;
  }

  if (!data.expiryDate || isNaN(Date.parse(data.expiryDate))) {
    const err = new Error('Invalid expiry date');
    err.status = 400;
    throw err;
  }
}

function findMedicineById(id) {
  const { medicines } = require('./data');
  return medicines.find(med => med.id === id);
}

module.exports = {
  validateMedicineFields,
  findMedicineById
};
