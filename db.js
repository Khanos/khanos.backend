import 'dotenv/config'
import process from 'process';
import { connect } from 'mongoose';

const connectDB = async () => {
  try {
    await connect(process.env.CONNECTION_URL);
  } catch (err) {
    console.error(err.message);
    process.exit(1); // Exit process with failure
  }
};

export default connectDB;