import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import express, { static as expressStatic, json as jsonParser, urlencoded as urlencodedParser } from 'express';
import session from 'express-session';
import compression from 'compression';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import markdownit from 'markdown-it';
import mongoDB from './db.js';
import routesIndex from './api/routes/index.js';
import errorHandler from './api/middlewares/errorHandler.js';

dotenv.config();

const port = process.env.TEST === 'true' ? 0 : process.env.PORT || 3000;
const host = process.env.HOST || 'localhost';
const md = markdownit();
const app = express();

// Connect to MongoDB
if (process.env.TEST !== 'true') mongoDB.connect();

// Middlewares
app.use(expressStatic(path.join('public'))); // Serve static files
app.use(jsonParser()); // Parse JSON bodies
app.use(urlencodedParser({ extended: true })); // Parse URL-encoded bodies
app.use(compression()); // compress the HTTP response sent back to a client.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
    },
  },
})); //Protect the app from well-known web vulnerabilities.
app.use(cors()); // Enable CORS
// Rate limiting (disabled in test mode)
if (process.env.TEST !== 'true') {
  const limiter = rateLimit({
    windowMs: process.env.RATE_LIMIT_WINDOW_MS || 60 * 1000, // 15 minutes
    max: process.env.RATE_LIMIT_MAX || 10, // limit each IP to 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: { error: 'Too many requests, please try again later.' }
  });
  app.use(limiter);
}
app.use(errorHandler); // Error handler middleware
app.use(session({
  secret: 'mykittycat',  // a secret string used to sign the session ID cookie
  resave: false,  // don't save session if unmodified
  saveUninitialized: false  // don't create session until something stored
}))

// Routes
app.use('/api/', routesIndex);
app.set('views', path.join('views'));
app.set('view engine', 'ejs');

// Main routes
app.get('/', async (req, res) => {
  const textReadme = fs.readFileSync(path.join('README.md'), 'utf-8');
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

export default server;