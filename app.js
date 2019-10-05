require('dotenv').config();
require('app-module-path').addPath(__dirname);
const express = require('express');
const compression = require('compression');
const helmet = require('helmet');
const path = require('path');
const favicon = require('serve-favicon');
const routesIndex = require('./api/routes');
const port = process.env.PORT || 3000;
const host = process.env.HOST || 'localhost';
const mongoose = require('mongoose');
const app = express();
mongoose.connect(process.env.CONNECTION_URL, {
    dbName: 'test',
    useNewUrlParser: true,
    useUnifiedTopology: true
}).catch(err => console.log('Something goes wrong with mongoose', err));
app.use(favicon(__dirname + '/public/img/favicon.ico'));
app.use(express.static('public'));
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
app.get('/', (req, res) => {
    return res.sendFile(path.join(__dirname+'/views/index.html'));
});
app.use('/api/v1', routesIndex);
app.use(compression()); // compress the HTTP response sent back to a client.
app.use(helmet()); //Protect the app from well-known web vulnerabilities.
let server = app.listen(port, () => {
    console.log('The app is running...');
    console.log(`http://${host}:${port}`);
});
module.exports = server;