require('dotenv').config();
const mongoose = require('mongoose');
const process = require('process');

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.CONNECTION_URL);
    console.log('MongoDB connection successful');
  } catch (err) {
    console.error(err.message);
    process.exit(1); // Exit process with failure
  }
};

module.exports = connectDB;