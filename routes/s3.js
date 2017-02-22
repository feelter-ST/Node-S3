
require('epipebomb')();

//var AWS = require('aws-sdk');
var request = require('request');

var MYSQLS_URL = 'http://54.187.35.9';
var S3_PATH = 'https://s3-us-west-2.amazonaws.com/stat-json/';

var cb = function(res, req, data, status) {
    if (status || data[0].no_cache) {
        res.setHeader('Cache-Control', 'no-cache');
        delete data[0].no_cache;
    }
    var callback = req.query.callback || req.body.callback;
    var pre = '';
    var suf = '';
    if (callback) {
        pre = callback + '(';
        suf = ');';
    }
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(status || 200).end(pre + JSON.stringify(data) + suf);
};
var fixData = function(phrase, data, src) {
    var j = {};
    j[phrase] = data;
    j[phrase].sourcedb = src;
    j[phrase].servertime = getServerTime();
	if (data.no_data) {
		j.no_cache = true;
	}
    return [j];
};
var getServerTime = function() {
    return new Date().toISOString().replace(/T/, ' ').replace(/\..+/, '');
};
var getFromMySQLs = function(req, res, phrase) {
    var qs = {
        'q': phrase,
        'ref': req.headers.refid || req.query.ref || req.headers.referer || req.headers['x-forwarded-for'] || req.connection.remoteAddress
    };
    request({
        'url': MYSQLS_URL,
        'qs': qs
    }, function(mysqls_err, mysqls_response, mysqls_body) {
        try {
            if (mysqls_err) {
                return cb(res, req, {'mysqls_err': mysqls_err}, 500);
            }
            // handle new phrase
            var j = JSON.parse(mysqls_body);
            return cb(res, req, fixData(phrase, j[Object.keys(j)[0]], 'MySQLs'));
        }
        catch (mysqls_ex) {
            return cb(res, req, {'mysqls_ex': mysqls_ex.message}, 500);
        }
    });
};
var getFromS3 = function(req, res, phrase, phrase64) {
    request(S3_PATH + phrase64, function(s3_err, s3_response, s3_body) {
        try {
            if (s3_err) {
                return cb(res, req, {'s3_err': s3_err}, 500);
            }
            if (s3_response.statusCode == 200) {
                return cb(res, req, fixData(phrase, JSON.parse(s3_body).data, 'AWS.S3'));
            }
            if (s3_response.statusCode == 404) {
                return getFromMySQLs(req, res, phrase);
            }
            return cb(res, req, {'s3_bad': s3_body}, s3_response.statusCode);
        }
        catch (s3_ex) {
            return cb(res, req, {'s3_ex': s3_ex.message}, 500);
        }
    });
};
/*var getFromS3_Auth = function(req, res, phrase, phrase64) {
    AWS.config.loadFromPath('./config.json');
    var S3 = new AWS.S3();
    S3.getObject({Bucket: 'stat-json', Key: phrase64}, function(s3_err, s3_response) {
        try {
            if (s3_err != null) {
                if (s3_err.code == "NoSuchKey") {
                    return getFromMySQLs(req, res, phrase);
                }
                return cb(res, req, {'s3_err': s3_err.message}, 500);
            }
            return cb(res, req, fixData(phrase, JSON.parse('' + s3_response.Body).data, 'AWS.S3'));
        }
        catch (s3_ex) {
            return cb(res, req, {'s3_ex': s3_ex.message}, 500);
        }
    });
};*/

exports.query = function(req, res) {
    try {
        var phrase = (req.query.q || req.body.q || '').toLowerCase();
        if (!phrase) {
            return cb(res, req, {'in_err': 'q variable missing'}, 400);
        }
        var phrase64 = new Buffer(phrase).toString('base64');
	    return getFromS3(req, res, phrase, phrase64);
    }
    catch (gen_ex) {
        return cb(res, req, {'gen_ex': gen_ex.message}, 500);
    }
};
