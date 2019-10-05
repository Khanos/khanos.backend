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
let validateUrl = (original_url, next) => {
    let host;
    if (original_url.indexOf('http://www') !== -1) {
        host = original_url.substring(11, original_url.length);
    } else if (original_url.indexOf('https://www') !== -1) {
        host = original_url.substring(12, original_url.length);
    } else {
        return next(new Error("invalid URL"));
    }
    dns.lookup(host, (err, response) => {
        if(err) return next(err);
        return next(null, response);
    });
}

module.exports = {
    createNewShortUrl: (original_url, next) => {
        validateUrl(original_url, (err, response) => {
            if(!err) {
                let urlObj = {original_url: original_url};
                // Find the document
                UrlModel.findOne(urlObj, (err, result) => {
                    if(!err) {
                        if (result.length === 0) {
                            urlObj.short_url = hashCode(original_url);
                            urlObj.creation_date = new Date();
                            UrlModel.create(urlObj, (err, result) => {
                                if (err) return next(err);
                                return next(null, {
                                    "original_url": result.original_url,
                                    "short_url": result.short_url,
                                    "creation_date": result.creation_date
                                })
                            });
                        } else {
                            return next(null, {
                                "original_url": result.original_url,
                                "short_url": result.short_url,
                                "creation_date": result.creation_date
                            })
                        }
                    } else {
                        return next(err);
                    }
                })
            } else {
                return next(err);
            }
        })
    }
}