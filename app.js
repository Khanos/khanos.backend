const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const app = express();
require('dotenv').config();
// APi entry points
const routesIndex = require('./api/routes');
// Configurations
const port = process.env.PORT || 3000;
const host = process.env.HOST || 'localhost';
// Middleware imports
app.use('/api/v1', routesIndex);
app.use(compression()); // compress the HTTP response sent back to a client.
app.use(helmet()); //Protect the app from well-known web vulnerabilities.
app.listen(port, () => {
    console.log('The app is running...');
    console.log(`http://${host}:${port}`);
})