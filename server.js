var express = require('express.io');
var url = require('url');

var server = {
  peers: {},
  jobs: {},
  sockets: {},
  app: null,

  AddNewPeer: function(sessionID, jobID, socket) {
    var peer = new Peer(sessionID, jobID, socket);
    this.peers[sessionID] = peer;
    if (!(jobID in this.jobs)) {
      this.jobs[jobID] = [];
    }
    this.jobs[jobID].push(peer);
    this.sockets[socket.id] = socket;
  },

  GetSocket: function(socketID) {
    return this.sockets[socketID];
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
      socket.emit('connected', {socketID: socket.id});
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
      if (!req.data || !req.data.jobID) {
        return;
      }

      var room = req.data.jobID;
      var socketID = req.socket.id;
      this.AddNewPeer(req.sessionID, room, req.socket);
      req.io.join(room);
      req.io.room(room).broadcast('new_peer', {socketID: socketID});
      req.io.emit('added_to_job');
    }.bind(this));

    this.app.io.route('ping', function(req) {
      server.HandlePing(req.sessionID);
      req.io.emit('ping_received', req.sessionID);
    });

    this.app.io.route('offer', function(req) {
      var sockets = req.data.sockets;
      var description = req.data.description;

      var socket = this.GetSocket(sockets.answererSocketID);
      socket.emit('offer', req.data);
    }.bind(this));

    this.app.io.route('answer', function(req) {
      var sockets = req.data.sockets;
      var description = req.data.description;

      var socket = this.GetSocket(sockets.offererSocketID);
      socket.emit('answer', req.data);
    }.bind(this));

    this.app.io.route('icecandidate', function(req) {
      var sockets = req.data.sockets;
      var candidate = req.data.candidate;

      var socket = this.GetSocket(sockets.answererSocketID);
      socket.emit('icecandidate', req.data);
    }.bind(this));
  },

  Run: function(port) {
    this.serverHandle = this.app.listen(port);
  },

  Stop: function() {
    this.serverHandle.close();
    this.Reset();
  },

  Reset: function() {
    this.peers = {};
    this.jobs = {};
    this.sockets = {};
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

function Peer(sessionID, jobID, socket) {
  this.sessionID = sessionID;
  this.jobID = jobID
  this.socket = socket;
  this.UpdatePingTime();
}

Peer.prototype = {
  UpdatePingTime: function() {
    this.mostRecentPing = new Date().getTime();
  }
};

module.exports = server;
