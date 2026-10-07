const mongoose = require('mongoose');

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const donorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    age: { type: Number, required: true, min: 18, max: 65 },
    gender: { type: String, enum: ['Male', 'Female', 'Other'], required: true },
    bloodGroup: { type: String, enum: BLOOD_GROUPS, required: true },
    phone: { type: String, required: true, match: /^\d{10}$/, unique: true },
    city: { type: String, required: true, trim: true },
    lastDonation: { type: Date, default: null },
    available: { type: Boolean, default: true }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Donor', donorSchema);
module.exports.BLOOD_GROUPS = BLOOD_GROUPS;
