"use strict"

// What's the correct way to do this?
// Under load a lot of listeners are bound to each eventemitter based connections/sockets
require('events').EventEmitter.prototype._maxListeners = 1000000;

var async = require("async");
var fs = require("fs");
var request = require("request");
var jar = request.jar();

var nextUserId = 0;
var users = {};
var activeUserCount = 0;
var maxUserCount = 50;
var stats = {
  hitCount: 0,
  failedRequestCount: 0,
  responsesByStatusCode: {},
  bytesDownloaded: 0,
  queueSize: 0,
  schedulerSize: 0,
};

var harFile = fs.readFileSync("./test/delfi.ee.har", "utf8");
var har = JSON.parse(harFile);
var startTime = new Date(har.log.entries[0].startedDateTime);
var endTime = new Date(har.log.entries[har.log.entries.length - 1].startedDateTime);

/**
 * Print simulation stats to console.
 */
function printStats() {
  console.log('Active users: ' + activeUserCount);
  console.log('Hit count: ' + stats.hitCount);
  console.log('Failed request count: ' + stats.failedRequestCount);
  console.log("Megabytes downloaded: " + stats.bytesDownloaded / 1000000);
  console.log("Queue size: " + stats.queueSize);
  console.log("Scheduler size: " + stats.schedulerSize);
  console.log('Target scheduler size: ', activeUserCount * har.log.entries.length);
  console.log('HAR total requests: ', har.log.entries.length);
  console.dir(stats.responsesByStatusCode);
  console.log("---");
  if (users.length == 0) clearInterval(statsInterval);
}

/**
 * Spawns a new virtual user that simulates all the requests in HAR with the same timings.
 */
function spawnUser() {
  if (activeUserCount >= maxUserCount) return;

  var userId = nextUserId++;

  activeUserCount++;
  users[userId] = {activeRequestCount: 0};

  async.each(har.log.entries, function(entry, callback) {
    // Make a request only if the browser actually did (wait == 0 == served from browser cache).
    if (entry.timings.wait != 0) {
      users[userId].activeRequestCount++;
      stats.schedulerSize++;
      setTimeout(performRequest, new Date(entry.startedDateTime) - startTime, {method: entry.request.method, url: entry.request.url}, userId);
    }
    callback();
  });
}

/**
 * Perform a single HTTP request and gather stats.
 */
function performRequest(req, userId) {
  stats.queueSize++;

  req.jar = jar;
  req.timeout = 60000;

  request(req, function(err, response, body) {
    stats.queueSize--;
    stats.schedulerSize--;

    if (err) {
      console.dir(err);
      stats.failedRequestCount++;
    }
    else {
      stats.hitCount++
      stats.bytesDownloaded += response.body.length;
      stats.responsesByStatusCode[response.statusCode] = ++stats.responsesByStatusCode[response.statusCode] || 0;
    }

    users[userId].activeRequestCount--;

    if (users[userId].activeRequestCount <= 0) {
      delete users[userId];
      activeUserCount--;
      spawnUser();
    }

  });
}

// Start spawning virutal users until maxUserCount is hit.
setInterval(spawnUser, 1000);

// Print some stats every second.
var statsInterval = setInterval(printStats, 1000);
