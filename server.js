var express = require('express.io');
var url = require('url');
var BlockManager = require('./blockmanager.js');

var server = {
  peers: {},
  jobs: {},
  sockets: {},
  app: null,
  eventHandlers: {},
  blockManager: null,

  AddNewPeer: function(sessionID, jobID, socket) {
    var peer = new Peer(sessionID, jobID, socket);
    this.peers[sessionID] = peer;
    if (!(jobID in this.jobs)) {
      this.jobs[jobID] = [];
    }
    this.jobs[jobID].push(peer);
    this.sockets[socket.id] = socket;
  },

  GetPeer: function(sessionID) {
    return this.peers[sessionID];
  },

  GetSocket: function(socketID) {
    return this.sockets[socketID];
  },

  HandlePing: function(sessionID) {
    this.peers[sessionID] && this.peers[sessionID].UpdatePingTime();
  },

  Init: function() {
    this.blockManager = new BlockManager(this);
    this.app = express();
    this.app.http().io();

    this.app.use(express.cookieParser());
    var store = new express.session.MemoryStore();
    this.app.use(express.session({secret: '9zfjn2zf7Jf', store: store}));

    this.app.use(function(req, res, next) {
      next();
    });

    this.app.io.sockets.on('connection', function(socket) {
      this.sockets[socket.id] = socket;
      this.SendReliable(socket, {type: 'connected', socketID: socket.id});
    }.bind(this));

    this.app.use('/', express.static(__dirname + '/client/js'));
    this.app.use('/client', express.static(__dirname + '/client'));
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

      var roomID = req.data.jobID;
      var socketID = req.socket.id;
      this.AddNewPeer(req.sessionID, roomID, req.socket);
      req.io.join(roomID);
      this.Broadcast(req.io.room(roomID), 'new_peer', {socketID: socketID});
      this.SendToPeer(req.socket, req.sessionID, 'added_to_job', {jobID: roomID});
    }.bind(this));

    this.app.io.route('ping', function(req) {
      server.HandlePing(req.sessionID);
      this.SendToPeer(req.socket, req.sessionID, 'ping');
    }.bind(this));

    this.app.io.route('offer', function(req) {
      var sockets = req.data.sockets;
      var description = req.data.description;

      var socket = this.GetSocket(sockets.answererSocketID);
      this.SendToPeer(socket, req.sessionID, 'offer', req.data);
    }.bind(this));

    this.app.io.route('answer', function(req) {
      var sockets = req.data.sockets;
      var description = req.data.description;

      var socket = this.GetSocket(sockets.offererSocketID);
      this.SendToPeer(socket, req.sessionID, 'answer', req.data);
    }.bind(this));

    this.app.io.route('icecandidate', function(req) {
      var sockets = req.data.sockets;
      var candidate = req.data.candidate;

      var socket = this.GetSocket(sockets.answererSocketID);
      this.SendToPeer(socket, req.sessionID, 'icecandidate', req.data);
    }.bind(this));

    this.app.io.route('partitionrequest', function(req) {
      this.blockManager.Get(req.data.partitionID, req.socket.id);
    }.bind(this));

    this.app.io.route('partitiondone', function(req) {
      this.blockManager.Put(req.data.partitionID, req.socket.id);
    }.bind(this));

    this.app.io.route('disconnect', function(req) {
      var peer = this.GetPeer(req.sessionID);

      if (!peer) {
        return;
      }

      for (var jobID in this.jobs) {
        this.jobs[jobID] = this.jobs[jobID].filter(function(jobPeer) {
          return jobPeer.id != peer.id;
        });
      }

      delete this.peers[req.sessionID];
      delete this.sockets[peer.socketID];
      delete peer;
    }.bind(this));

    this.app.io.route('blockmanager', {
      'get': function(req) {
      },
      'put': function(req) {
      }
    }.bind(this));

    this.app.io.route('submit_rdd', function(req) {

    });
  },

  Broadcast: function(room, type, data) {
    var message = {
      from: 'server',
      type: type
    };

    for (var key in data) {
      if (!(key in message)) {
        message[key] = data[key];
      }
    }

    room.broadcast('message', message);
  },

  SendToPeer: function(socket, sessionID, type, data) {
    var message = {
      from: 'server',
      sessionID: sessionID,
      socketID: socket.id,
      type: type
    };

    for (var key in data) {
      if (!(key in message)) {
        message[key] = data[key];
      }
    }

    socket.emit('message', message);
  },

  SendReliable: function(socket, data) {
    var timeout = setTimeout(function() {
      this.SendReliable(socket, data);
    }.bind(this), 2000);
    var type = data.type == 'connected' ? 'connected' : 'message';
    socket.emit(type, data, function(response) {
      clearTimeout(timeout);
    });
  },

  Run: function(port, callback) {
    this.serverHandle = this.app.listen(port, callback);
  },

  Stop: function(callback) {
    this.serverHandle.close(callback);
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
  },

  On: function(type, handler) {
    if (!(type in this.eventHandlers)) {
      this.eventHandlers[type] = [];
    }
    this.eventHandlers[type].push(handler);
  },

  Emit: function(type, data) {
    if (!(type in this.eventHandlers)) {
      return;
    }

    for (var i = 0; i < this.eventHandlers[type].length; i++) {
      this.eventHandlers[type][i](data);
    }
  }
};

var peerID = 1;
function Peer(sessionID, jobID, socket) {
  this.id = peerID++;
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
