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
app.use(function(req, res, next) {
    var err = null;
    try {
        decodeURIComponent(req.path)
    }
    catch(e) {
        err = e;
    }
    if (err){
        return res.status(404).send({
            error: true,
            message: "The WORD at the end of the url should only contain letters."
        });
    }
    next();
});
// Middleware imports
app.use('/api/v1', routesIndex);
app.use(compression()); // compress the HTTP response sent back to a client.
app.use(helmet()); //Protect the app from well-known web vulnerabilities.
let server = app.listen(port, () => {
    console.log('The app is running...');
    console.log(`http://${host}:${port}`);
});
module.exports = server;