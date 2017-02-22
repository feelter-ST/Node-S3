
/**
 * Module dependencies.
 */

var express = require('express')
  , s3 = require('./routes/s3')
  , http = require('http')
  , path = require('path')
  , fs = require('fs')
  , logrotate = require('logrotator')
  , compression = require('compression')
;

var app = express();

// all environments
app.set('port', process.env.PORT || 80);
app.use(express.favicon());

app.use(express.logger({
    format: 'dev', 
    stream: fs.createWriteStream('app.log', {'flags': 'a'}),
}));

app.use(compression());
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only v2
if ('development' == app.get('env')) {
    app.use(express.errorHandler());
}

// log rotation
var rotator = logrotate.rotator;
rotator.register('app.log', {schedule: '1h', size: '100m', compress: true, count: 10});
// handle errors
rotator.on('error', function(err) {
    console.log('logrotator: oops, an error occured!\n' + err);
});
// handle rotations
rotator.on('rotate', function(file) {
    //console.log('logrotator: file ' + file + ' was rotated!');
});

// define routes
app.post('/', s3.query);
app.get('/', s3.query);

http.createServer(app).listen(app.get('port'), function() {
    console.log('[' + new Date() + ']');
    console.log('Express server listening on port ' + app.get('port'));
});
