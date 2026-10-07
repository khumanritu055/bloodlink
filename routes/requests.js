const express = require('express');
const BloodRequest = require('../models/BloodRequest');
const Donor = require('../models/Donor');

const router = express.Router();
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// List requests: ?status=Open&bloodGroup=B+
router.get('/', async (req, res) => {
  try {
    const { status, bloodGroup } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (bloodGroup) filter.bloodGroup = bloodGroup;
    const urgencyOrder = { Critical: 0, Urgent: 1, Normal: 2 };
    const list = await BloodRequest.find(filter).sort({ createdAt: -1 });
    // Open + critical pehle dikhao
    list.sort((a, b) => {
      if (a.status !== b.status) return a.status === 'Open' ? -1 : 1;
      return urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
    });
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/stats/summary', async (req, res) => {
  try {
    const open = await BloodRequest.countDocuments({ status: 'Open' });
    const fulfilled = await BloodRequest.countDocuments({ status: 'Fulfilled' });
    res.json({ open, fulfilled });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Matching donors for a request (same blood group + same city + available)
router.get('/:id/matches', async (req, res) => {
  try {
    const request = await BloodRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Request nahi mili' });
    const donors = await Donor.find({
      bloodGroup: request.bloodGroup,
      city: new RegExp('^' + escapeRegex(request.city) + '$', 'i'),
      available: true
    });
    res.json(donors);
  } catch {
    res.status(400).json({ message: 'Invalid ID' });
  }
});

router.post('/', async (req, res) => {
  try {
    const request = await BloodRequest.create(req.body);
    res.status(201).json(request);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});

router.patch('/:id/fulfill', async (req, res) => {
  try {
    const request = await BloodRequest.findByIdAndUpdate(
      req.params.id,
      { status: 'Fulfilled' },
      { new: true }
    );
    if (!request) return res.status(404).json({ message: 'Request nahi mili' });
    res.json(request);
  } catch {
    res.status(400).json({ message: 'Invalid ID' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const request = await BloodRequest.findByIdAndDelete(req.params.id);
    if (!request) return res.status(404).json({ message: 'Request nahi mili' });
    res.json({ message: 'Request delete ho gayi' });
  } catch {
    res.status(400).json({ message: 'Invalid ID' });
  }
});

module.exports = router;
