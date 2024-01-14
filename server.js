const path = require('path');
const process = require('process');
const express = require('express');
const { static: expressStatic } = require('express');
const compression = require('compression');
const helmet = require('helmet');
const cors = require('cors');
const mongoDB = require('./db.js');
const routesIndex = require('./api/routes/index.js');
const decodeUri = require('./api/middlewares/decodeUri.js');
const errorHandler = require('./api/middlewares/errorHandler.js');
const port = process.env.PORT || 3000;
const host = process.env.HOST || 'localhost';
const app = express();

// Connect to MongoDB
mongoDB.connect();

// Middlewares
app.use(expressStatic(path.join(__dirname, 'public'))); // Serve static files
app.use(compression()); // compress the HTTP response sent back to a client.
app.use(helmet()); //Protect the app from well-known web vulnerabilities.
app.use(cors()); // Enable CORS
app.use(decodeUri); // Decode URI
app.use(errorHandler); // Error handler

// Routes
app.use('/api/', routesIndex);
app.set('views', path.join(__dirname, 'views'));
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
  if ( process.env.TEST === 'true' ) return;
  console.log('The app is running...');
  console.log(`http://${host}:${port}`);
});
// Disconnect from the database when the server is closed
server.on('close', () => {
  mongoDB.disconnect();
});
module.exports = server;
