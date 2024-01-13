import path from 'path';
import process from 'process';
import express, { static as expressStatic } from 'express';
import compression from 'compression';
import helmet from 'helmet';
import cors from 'cors';
import connectDB from './db.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { join } from 'path';
import routesIndex from './api/routes/index.js';
import decodeUri from './api/middlewares/decodeUri.js';
import errorHandler from './api/middlewares/errorHandler.js';
const port = process.env.PORT || 3000;
const host = process.env.HOST || 'localhost';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const app = express();

// Connect to MongoDB
connectDB();

// Middlewares
app.use(expressStatic(path.join(__dirname, 'public'))); // Serve static files
app.use(compression()); // compress the HTTP response sent back to a client.
app.use(helmet()); //Protect the app from well-known web vulnerabilities.
app.use(cors()); // Enable CORS
app.use(decodeUri); // Decode URI
app.use(errorHandler); // Error handler

// Routes
app.use('/api/', routesIndex);
app.set('views', join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Main routes
app.get('/', (req, res) => {
  return res.render('index.ejs');
});
app.get('/*', (req, res) => {
  let response = {
    status: 404,
    message: `It seems that you are lost in the woods 🌲🌲🌲`,
    error: null,
  };
  if (process.env.ENV !== 'development') {
    response.status = '500';
    response.message = `🤦‍♂️, something bad happened`
  }
  res.render('error.ejs', response);
});

// Start the server
const server = app.listen(port, () => {
  console.log('The app is running...');
  console.log(`http://${host}:${port}`);
});
export default server;