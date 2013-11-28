require('events').EventEmitter.prototype._maxListeners = 100;

var fs = require("fs");
var request = require("request");

var harFile = fs.readFileSync("./test/delfi.ee.har", "utf8");
var har = JSON.parse(harFile);
var startTime = new Date(har.log.entries[0].startedDateTime);

function performRequest(req) {
  request(req, function(err, response, body) {
    if (err) {
      process.send({type: "error", data: {message: err, method: req.method, url: req.url}})
    }
    else {
      process.send({
        type: "hit",
        data: {
          url: req.url,
          method: req.method,
          size: response.body.length,
          responseStatusCode: response.statusCode,
        },
      });
    }
  });
}

for (var i in har.log.entries) {
  var entry = har.log.entries[i];
  setTimeout(performRequest, new Date(entry.startedDateTime) - startTime, {method: entry.request.method, url: entry.request.url});
}
