const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const donorRoutes = require('./routes/donors');
const requestRoutes = require('./routes/requests');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/bloodlink';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/donors', donorRoutes);
app.use('/api/requests', requestRoutes);

mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log('MongoDB connected');
    app.listen(PORT, () => console.log(`BloodLink chal raha hai: http://localhost:${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });
