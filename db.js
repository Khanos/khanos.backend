require('dotenv').config();
const mongoose = require('mongoose');
const process = require('process');

const mongoDB = {
  connect: async () => {
    try {
      await mongoose.connect(process.env.CONNECTION_URL, {
        dbName: process.env.ENV === 'development' ? process.env.TEST_DB_NAME : process.env.DB_NAME,
      });
    } catch (error) {
      process.exit(1);
    }
  },
  disconnect: async () => {
    try {
      await mongoose.connection.close();
    } catch (error) {
      process.exit(1);
    }
  }
};

module.exports = mongoDB;