const express = require('express');
const Donor = require('../models/Donor');

const router = express.Router();
const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Search donors: ?bloodGroup=O+&city=Jamnagar&available=true
router.get('/', async (req, res) => {
  try {
    const { bloodGroup, city, available, search } = req.query;
    const filter = {};
    if (bloodGroup) filter.bloodGroup = bloodGroup;
    if (city) filter.city = new RegExp(escapeRegex(city), 'i');
    if (available === 'true') filter.available = true;
    if (search) {
      const rx = new RegExp(escapeRegex(search), 'i');
      filter.$or = [{ name: rx }, { phone: rx }];
    }
    const donors = await Donor.find(filter).sort({ createdAt: -1 });
    res.json(donors);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Dashboard stats
router.get('/stats/summary', async (req, res) => {
  try {
    const total = await Donor.countDocuments();
    const available = await Donor.countDocuments({ available: true });
    const byGroup = await Donor.aggregate([
      { $group: { _id: '$bloodGroup', count: { $sum: 1 } } }
    ]);
    res.json({ total, available, byGroup });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const donor = await Donor.findById(req.params.id);
    if (!donor) return res.status(404).json({ message: 'Donor nahi mila' });
    res.json(donor);
  } catch {
    res.status(400).json({ message: 'Invalid ID' });
  }
});

router.post('/', async (req, res) => {
  try {
    const donor = await Donor.create(req.body);
    res.status(201).json(donor);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Is phone number se donor pehle se registered hai' });
    }
    res.status(400).json({ message: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const donor = await Donor.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });
    if (!donor) return res.status(404).json({ message: 'Donor nahi mila' });
    res.json(donor);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ message: 'Is phone number se donor pehle se registered hai' });
    }
    res.status(400).json({ message: err.message });
  }
});

// Availability toggle
router.patch('/:id/availability', async (req, res) => {
  try {
    const donor = await Donor.findById(req.params.id);
    if (!donor) return res.status(404).json({ message: 'Donor nahi mila' });
    donor.available = !donor.available;
    await donor.save();
    res.json(donor);
  } catch {
    res.status(400).json({ message: 'Invalid ID' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const donor = await Donor.findByIdAndDelete(req.params.id);
    if (!donor) return res.status(404).json({ message: 'Donor nahi mila' });
    res.json({ message: 'Donor delete ho gaya' });
  } catch {
    res.status(400).json({ message: 'Invalid ID' });
  }
});

module.exports = router;
