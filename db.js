import dotenv from 'dotenv';
import mongoose from 'mongoose';
import process from 'process';

dotenv.config();

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

export default mongoDB;