require('dotenv').config();
require('app-module-path').addPath(__dirname);
const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const path = require('path');
const cors = require('cors');
const favicon = require('serve-favicon');
const routesIndex = require('./api/routes');
const mongoose = require('mongoose');
const port = process.env.PORT || 3000;
const host = process.env.HOST || 'localhost';
const app = express();
mongoose.connect(process.env.CONNECTION_URL, {
  dbName: 'khanos',
  useNewUrlParser: true,
  useUnifiedTopology: true
}).catch(err => {throw err});
// Imports
app.use(favicon(__dirname + '/public/img/favicon.ico'));
app.use(express.static('./public'));
app.use(compression()); // compress the HTTP response sent back to a client.
app.use(helmet()); //Protect the app from well-known web vulnerabilities.
app.use(cors());
app.use((req, res, next) => {
  try {
    decodeURIComponent(req.path)
    next();
  } catch (error) {
    throw error;
  }
});
// error handler middleware
app.use((error, req, res, next) => {
  if(error) {
    let response = {
      status: error.status || 500,
      message: `Ups, something bad happened: ${error.message}` || 'Ups, something bad happened: Internal Server Error',
      error: error
    };
    if (process.env.ENV !== 'development') {
      response.status = '500';
      response.message = `🤦‍♂️, something bad happened`
    }
    res.render('error.ejs', response);
  } else {
    next();
  }
});
app.use('/api/v1', routesIndex);

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.get('/', (req, res) => {
  return res.render('index.ejs');
});

app.get('/*', (req, res) => {
  let response = {
    status: 404,
    message: `🤦‍♂️ Ups, something bad happened: ${404}. This page doesn't exist`,
    error: null,
  };
  if (process.env.ENV !== 'development') {
    response.status = '500';
    response.message = `🤦‍♂️, something bad happened`
  }
  res.render('error.ejs', response);
});

let server = app.listen(port, () => {
  console.log('The app is running...');
  console.log(`http://${host}:${port}`);
});
module.exports = server;