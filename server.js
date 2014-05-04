/*
 * Setup:
 * 1. Install node.js
 * 2. npm install express.io
 * 
 * Run server:
 * 1. node server.js (might need sudo)
 */

var express = require('express.io');
var url = require('url');

var server = {
  peers: {},
  jobs: {},
  app: null,

  AddNewPeer: function(sessionID, jobID) {
    var peer = new Peer(sessionID, jobID);
    this.peers[sessionID] = peer;
    if (!(jobID in this.jobs)) {
      this.jobs[jobID] = [];
    }
    this.jobs[jobID].push(peer);
  },

  HandlePing: function(sessionID) {
    this.peers[sessionID] && this.peers[sessionID].UpdatePingTime();
  },

  Init: function() {
    this.app = express();
    this.app.http().io();

    this.app.use(express.cookieParser());
    var store = new express.session.MemoryStore();
    this.app.use(express.session({secret: '9zfjn2zf7Jf', store: store}));

    this.app.use(function(req, res, next) {
      next();
    });

    var auth = this.app.io.get('authorization');
    this.app.io.set('authorization', function(data, next) {
      if (data.query.test) {
        var parsedURL = url.parse(data.url, true);
        delete parsedURL.query['test'];
        delete parsedURL.search;
        data.url = url.format(parsedURL);
        data.query.test = false;

        var req = {
          sessionStore: store
        };
        store.generate(req);
        store.set(req.sessionID, req.session);
        data.cookies = {
          'connect.sid': req.sessionID
        };
        data.sessionID = req.sessionID;
      }

      auth(data, next);
    }.bind(this));

    this.app.io.sockets.on('connection', function(socket) {
      socket.emit('connected');
    }.bind(this));

    this.app.use('/static', express.static(__dirname + '/'));
 
    // Client should access this route to submit a new RDD
    this.app.get('/', function(req, res) {
      req.session.start = new Date().toString();
      res.sendfile(__dirname + '/index.html');
    });

    // Peers access this route (any path with a '/' followed by letters)
    this.app.get(/^(\/)([a-z]+)$/, function(req, res) {
      var jobName = req.params[1];
      req.session.room = jobName;
      server.AddNewPeer(req.sessionID, jobName);
      res.sendfile(__dirname + '/index.html');
    });

    this.app.io.route('volunteer', function(req) {
      this.AddNewPeer(req.sessionID, req.data.jobID);
      req.io.emit('added_to_job');
    }.bind(this));

    this.app.io.route('ping', function(req) {
      server.HandlePing(req.sessionID);
      req.io.emit('ping_received', req.sessionID);
    });
  },

  Run: function(port) {
    this.app.listen(port);
  },

  PeerCount: function() {
    var count = 0;
    for (peer in this.peers) {
      count++;
    }
    return count;
  },

  PeersForJob: function(jobID) {
    return this.jobs[jobID] || [];
  }
};

function Peer(sessionID, jobID) {
  this.sessionID = sessionID;
  this.jobID = jobID
  this.UpdatePingTime();
}

Peer.prototype = {
  UpdatePingTime: function() {
    this.mostRecentPing = new Date().getTime();
  }
};

module.exports = server;
