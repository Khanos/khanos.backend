const dns = require('dns');
const UrlModel = require('../models/UrlModel');

// Utils and stuff
let hashCode = (url) => {
    var hash = 0, i, chr;
    if (url.length === 0) return hash;
    for (i = 0; i < url.length; i++) {
        chr   = url.charCodeAt(i);
        hash  = ((hash << 5) - hash) + chr;
        hash |= 0; // Convert to 32bit integer
    }
    return Math.abs(hash);
};
let validateUrl = async (original_url) => {
    let host;
    if (original_url.indexOf('http://www') !== -1) {
        host = original_url.substring(11, original_url.length);
    } else if (original_url.indexOf('https://www') !== -1) {
        host = original_url.substring(12, original_url.length);
    } else {
        throw new Error("invalid URL");
    }
    return await dns.lookup(host);
}

module.exports = {
    createNewShortUrl: (original_url) => {
        validateUrl(original_url)
            .then((response) => {
                let urlObj = {
                    original_url: original_url,
                    creation_date: new Date()
                };
                // Find the document
                UrlModel.find(urlObj);
            })
            .then((response) => {
                if (response.length === 0) {
                    urlObj.short_url = hashCode(original_url);
                    UrlModel.create(urlObj);
                }
                else {
                    return {
                        "original_url": response[0].original_url,
                        "short_url": response[0].short_url,
                        "creation_date": response[0].creation_date
                    };
                }
            })
            .then((response) => {
                return {
                    "original_url": response.original_url,
                    "short_url": response.short_url,
                    "creation_date": response.creation_date
                };
            })
            .catch((err) => {
                return err;
            })
    }
}