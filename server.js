var express = require('express.io');
var url = require('url');
var BlockManager = require('./blockmanager.js');
var ConsoleLog = require('./consolelog.js');
var _ = require('underscore');
var crypto = require('crypto');

var server = {
  peers: {},
  jobs: {},
  peerJobs: {},
  sockets: {},
  app: null,
  eventHandlers: {},
  blockManager: null,
  consoleLog: null,

  AddNewPeer: function(sessionID, jobID, socket) {
    var peer = new Peer(sessionID, jobID, socket);
    this.peers[sessionID] = peer;
    this.sockets[socket.id] = socket;
    return peer;
  },

  AddJob: function() {
    var job = new Job();
    this.jobs[job.id] = job;
    this.peerJobs[job.peerID] = job;
    return job;
  },

  JobExists: function(jobID) {
    return jobID in this.jobs; 
  },

  JobExistsForPeer: function(peerJobID) {
    return peerJobID in this.peerJobs;
  },

  CreatePingData: function(peer) {
    return {
      jobID: peer.jobID
    };
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
    this.app = express();
    this.app.http().io();
    this.blockManager = new BlockManager();
    this.consoleLog = new ConsoleLog();

    this.app.use(express.cookieParser());
    var store = new express.session.MemoryStore();
    this.app.use(express.session({secret: '9zfjn2zf7Jf', store: store}));

    this.app.use(function(req, res, next) {
      next();
    });

    this.app.io.sockets.on('connection', function(socket, data) {
      this.sockets[socket.id] = socket;
      this.SendReliable(socket, {type: 'connected', socketID: socket.id});
    }.bind(this));

    this.app.use('/js', express.static(__dirname + '/client/js'));
    this.app.use('/css', express.static(__dirname + '/client/css'));
    this.app.use('/fonts', express.static(__dirname + '/client/fonts'));
    this.app.use('/client', express.static(__dirname + '/client'));
    this.app.use('/static', express.static(__dirname + '/'));
 
    // Client should access this route to submit a new RDD
    this.app.get('/', function(req, res) {
      req.session.start = new Date().toString();
      var job = this.AddJob();
      req.session.jobID = job.id;
      // TODO: display peer id somewhere
      this.blockManager.CreateJob(job.id);
      res.redirect('/master/' + job.id);
    }.bind(this));

    this.app.get(/^\/master\/([a-z0-9]+)$/, function(req, res) {
      var jobID = req.params[0];
      if (!this.JobExists(jobID)) {
        // TODO: an error might be better here; seems kind of weird to redirect
        // to / and then back to /master/{id}
        res.redirect('/');
        return;
      }
      req.session.sessionID = jobID;
      res.sendfile(__dirname + '/client/master.html');
    }.bind(this));

    // Peers access this route (any path with a '/' followed by letters/numbers)
    this.app.get(/^\/peer\/([a-z0-9]+)$/, function(req, res) {
      var peerJobID = req.params[0];
      if (!this.JobExistsForPeer(peerJobID)) {
        // TODO: display some kind of error 
        return;
      }

      req.session.peerJobID = peerJobID;

      res.sendfile(__dirname + '/client/slave.html');
    }.bind(this));

    this.app.io.route('volunteer', function(req) {
      var job;
      var data = {};
      if (req.session.jobID) {
        job = this.jobs[req.session.jobID];
        data.peerJobID = job.peerID;
      } else if (req.session.peerJobID) {
        job = this.peerJobs[req.session.peerJobID];
      }

      data.jobID = job.id;

      var socketID = req.socket.id;
      this.AddNewPeer(req.sessionID, job.id, req.socket);
      req.io.join(job.id);
      this.Broadcast(req.io.room(job.id), 'new_peer', {socketID: socketID});
      this.SendToPeer(req.socket, req.sessionID, 'added_to_job', data);
    }.bind(this));

    this.app.io.route('leave_job', function(req) {
      var jobID = req.data.jobID;
      req.io.leave(jobID);
      this.jobs[jobID].RemovePeer(this.GetPeer(req.sessionID));
    }.bind(this));

    this.app.io.route('ping', function(req) {
      server.HandlePing(req.sessionID);
      var peer = this.GetPeer(req.sessionID);
      if (!peer) {
        peer = this.AddNewPeer(req.sessionID, req.session.jobID, req.socket);
      }
      this.SendToPeer(req.socket, req.sessionID, 'ping', this.CreatePingData(peer));
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

    this.app.io.route('disconnect', function(req) {
      var peer = this.GetPeer(req.sessionID);

      if (!peer) {
        return;
      }

      for (var jobID in this.jobs) {
        this.jobs[jobID] = this.jobs[jobID].RemovePeer(peer);
      }

      delete this.peers[req.sessionID];
      delete this.sockets[peer.socketID];
      delete peer;
    }.bind(this));

    this.app.io.route('consolelog', {
      'record': function(req) {
        var jobID = req.data.jobID || req.session.jobID;
        this.consoleLog.Record(jobID, req.data.entry);
      }.bind(this),

      'replay': function(req) {
        var jobID = req.data.jobID || req.session.jobID;
        req.io.respond(this.consoleLog.Replay(jobID));
      }.bind(this)
    });

    this.app.io.route('blockmanager', {
      'get': function(req) {
        var id = req.data.id;
        var jobID = req.data.jobID || req.session.jobID;
        this.blockManager.Get(jobID, id, function(socketIDs) {
          req.io.respond(socketIDs);
        });
      }.bind(this),

      'put': function(req) {
        var id = req.data.id;
        var jobID = req.data.jobID || req.session.jobID;
        var socketID = req.socket.id;
        this.blockManager.Put(jobID, id, socketID);
      }.bind(this)
    });

    this.app.io.route('submit_rdd', function(req) {
      // TODO: this.blockManager.CreateJob(req.data.jobID);
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
    return this.jobs[jobID].GetPeers();
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
  this.jobID = jobID;
  this.socket = socket;
  this.UpdatePingTime();
}

Peer.prototype = {
  UpdatePingTime: function() {
    this.mostRecentPing = new Date().getTime();
  }
};

function Job() {
  var seed = crypto.randomBytes(20);
  this.id = crypto.createHash('sha1').update(seed).digest('hex');
  this.peerID = crypto.createHash('sha1').update(this.id).digest('hex');
  this.volunteers = [];
}

Job.prototype = {
  AddPeer: function(peer) {
    this.volunteers.push(peer);
  },

  RemovePeer: function(peer) {
    this.volunteers = this.volunteers.filter(function(jobPeer) {
      return peer.id != jobPeer.id;
    });
  },

  GetPeers: function() {
    return this.volunteers;
  },

  GetPeerIds: function() {
    if (this.volunteers.length == 0) {
      return [];
    }
    return _.pluck(this.volunteers, 'id');
  },

  Serialize: function() {
    return {
      id: this.id,
      peers: this.GetPeerIds()
    };
  }
};

module.exports = server;
