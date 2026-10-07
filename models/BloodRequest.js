const mongoose = require('mongoose');

const requestSchema = new mongoose.Schema(
  {
    patientName: { type: String, required: true, trim: true },
    bloodGroup: {
      type: String,
      enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
      required: true
    },
    units: { type: Number, required: true, min: 1, max: 10 },
    hospital: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    contactPhone: { type: String, required: true, match: /^\d{10}$/ },
    urgency: { type: String, enum: ['Normal', 'Urgent', 'Critical'], default: 'Normal' },
    status: { type: String, enum: ['Open', 'Fulfilled'], default: 'Open' }
  },
  { timestamps: true }
);

module.exports = mongoose.model('BloodRequest', requestSchema);
