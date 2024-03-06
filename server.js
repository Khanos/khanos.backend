require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const session = require('express-session')
const { 
  static: expressStatic, 
  json: jsonParser,
  urlencoded: urlencodedParser,
} = require('express');
const compression = require('compression');
const helmet = require('helmet');
const cors = require('cors');
const markdownit = require('markdown-it');
const mongoDB = require('./db.js');
const routesIndex = require('./api/routes/index.js');
const errorHandler = require('./api/middlewares/errorHandler.js');
const port = process.env.TEST === 'true' ? 0 : process.env.PORT || 3000;
const host = process.env.HOST || 'localhost';
const md = markdownit();
const app = express();

// Connect to MongoDB
if (process.env.TEST !== 'true') mongoDB.connect();

// Middlewares
app.use(expressStatic(path.join(__dirname, 'public'))); // Serve static files
app.use(jsonParser()); // Parse JSON bodies
app.use(urlencodedParser({ extended: true })); // Parse URL-encoded bodies
app.use(compression()); // compress the HTTP response sent back to a client.
app.use(helmet()); //Protect the app from well-known web vulnerabilities.
app.use(cors()); // Enable CORS
app.use(errorHandler); // Error handler
app.use(session({
  secret: 'mykittycat',  // a secret string used to sign the session ID cookie
  resave: false,  // don't save session if unmodified
  saveUninitialized: false  // don't create session until something stored
}))

// Routes
app.use('/api/', routesIndex);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// Main routes
app.get('/', async (req, res) => {
  const textReadme = fs.readFileSync(path.join(__dirname, 'README.md'), 'utf-8');
  const result = md.render(textReadme);
  return res.render('index.ejs', {md: result});
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
  if ( process.env.TEST === 'true' ) return; // Don't show the message when testing
  console.log('The app is running...');
  console.log(`http://${host}:${port}`);
});
// Disconnect from the database when the server is closed
server.on('close', () => {
  mongoDB.disconnect();
});
module.exports = server;
