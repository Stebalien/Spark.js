var express = require('express.io');
var Scheduler = require('./scheduler.js');
var url = require('url');
var BlockManager = require('./blockmanager.js');
var ConsoleLog = require('./consolelog.js');
var _ = require('underscore');
var crypto = require('crypto');
var CodeLog = require('./codelog.js');

var server = {
  peers: {},
  jobs: {},
  peerJobs: {},
  sockets: {},
  app: null,
  eventHandlers: {},
  blockManager: null,
  consoleLog: null,
  codeLog: null,
  schedulers: {},
  jobsByMasterID: {},
  jobsByPeerID: {},
  socketIDToPeer: {},

  //AddNewPeer: function(sessionID, jobID, socket, isMaster) {
    //var peer = new Peer(sessionID, jobID, socket, isMaster);
    //this.peers[sessionID] = peer;
    //this.sockets[socket.id] = socket;
    //if (jobID in this.jobs) {
      //if (isMaster) {
        //this.jobs[jobID].AddMaster(peer);
      //} else {
        //this.jobs[jobID].AddPeer(peer);
      //}
    //}
    //return peer;
  //},

  CreateJob: function() {
    var job = new Job(this);
    this.jobsByMasterID[job.id] = job;
    this.jobsByPeerID[job.peerJobID] = job;
    this.blockManager.CreateJob(job.id);
    return job;
  },

  CreatePeer: function(job, socket) {
    var peer = job.AddPeer();
    this.ConnectPeerWithSocket(peer, socket);
    return peer;
  },

  ConnectPeerWithSocket: function(peer, socket) {
    peer.socket = socket;
    this.socketIDToPeer[socket.id] = peer;
  },

  GetPeerFromSocketID: function(socketID) {
    return this.socketIDToPeer[socketID];
  },

  GetJobByMasterID: function(masterID) {
    return this.jobsByMasterID[masterID];
  },

  GetJobByPeerID: function(peerJobID) {
    return this.jobsByPeerID[peerJobID];
  },

  ioroute: function(name, callback) {
    this.app.io.route(name, function(req) {
      if (!this.Preprocess(req)) {
        req.io.respond('error');
        return;
      }
      callback(req);
    }.bind(this));
  },

  iomasterroute: function(name, routes) {
    var newRoutes = {};
    for (var route in routes) {
      newRoutes[route] = function(req) {
        if (this.Preprocess(req) && req.peer && req.peer.IsMaster()) {
          routes[route](req);
        }
      }.bind(this);
    }

    this.app.io.route(name, newRoutes);
  },

  Preprocess: function(req) {
    if (!req.data) {
      return false;
    }

    // Only the master knows this ID
    var masterID = req.data.masterID;
    if (masterID) {
      var job = this.GetJobByMasterID(masterID);
      if (!job) {
        return false;
      }
      req.job = job;
      req.peer = job.GetMaster();
      req.peer.socket = req.socket;
      return true;
    }

    var peerJobID = req.data.peerJobID;
    if (peerJobID) {
      var job = this.GetJobByPeerID(peerJobID);
      if (!job) {
        return false;
      }
      req.job = job;
      req.peer = this.GetPeerFromSocket(req.socket);
      return true;
    }

    return false;
  },

  GetPeerFromSocket: function(socket) {
    return socket && this.socketIDToPeer[socket.id];
  },

  AddJob: function() {
    var job = new Job(this);
    this.jobs[job.id] = job;
    this.peerJobs[job.peerJobID] = job;
    return job;
  },

  JobExists: function(jobID) {
    return jobID in this.jobs; 
  },

  JobExistsForPeer: function(peerJobID) {
    return peerJobID in this.peerJobs;
  },

  CreatePingData: function(peer) {
    if (!peer) {
      return {};
    }

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
    if (this.peers[sessionID]) {
      this.peers[sessionID].UpdatePingTime();
    }
  },

  Init: function() {
    this.app = express();
    this.app.http().io();
    this.blockManager = new BlockManager();
    this.codeLog = new CodeLog();
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
      res.sendfile(__dirname + '/client/master.html');
    }.bind(this));

    this.app.io.route('master', function(req, res) {
      var job = this.CreateJob();
      req.io.respond({masterID: job.id, peerJobID: job.peerJobID});
    }.bind(this));

    this.app.get(/^\/master#([a-z0-9]+)$/, function(req, res) {
      res.sendfile(__dirname + '/client/master.html');
    }.bind(this));

    // Peers access this route (any path with a '/' followed by letters/numbers)
    this.app.get(/^\/peer\/$/, function(req, res) {
      res.sendfile(__dirname + '/client/peer.html');
    }.bind(this));

    this.app.io.route('volunteer', function(req) {
      var peerJobID = req.data.peerJobID;
      var job = this.GetJobByPeerID(peerJobID);
      if (!job) {
        return;
      }

      var peer = this.CreatePeer(job, req.socket);

      var data = {jobID: job.id};
      req.io.join(job.id);
      this.Broadcast(req.io.room(job.id), 'new_peer', {socketID: req.socket.id});
      this.SendToPeer(peer, 'added_to_job', data);
    }.bind(this));

    this.ioroute('leave_job', function(req) {
      var jobID = req.data.jobID;
      req.io.leave(jobID);
      this.jobs[jobID].RemovePeer(this.GetPeer(req.sessionID));
    }.bind(this));

    this.ioroute('ping', function(req) {
      //server.HandlePing(req.sessionID);
      var peer = req.peer;
      this.SendToPeer(peer, 'ping', this.CreatePingData(peer));
    }.bind(this));

    this.ioroute('offer', function(req) {
      var sockets = req.data.sockets;
      var description = req.data.description;

      var peer = this.GetPeerFromSocket(sockets.answererSocketID);
      this.SendToPeer(peer, 'offer', req.data);
    }.bind(this));

    this.ioroute('answer', function(req) {
      var sockets = req.data.sockets;
      var description = req.data.description;

      var peer = this.GetPeerFromSocket(sockets.offererSocketID);
      this.SendToPeer(peer, 'answer', req.data);
    }.bind(this));

    this.ioroute('icecandidate', function(req) {
      var sockets = req.data.sockets;
      var candidate = req.data.candidate;

      var peer = this.GetPeerFromSocket(sockets.answererSocketID);
      this.SendToPeer(peer, 'icecandidate', req.data);
    }.bind(this));

    this.ioroute('report_message', function(req){
      //var jobID = req.data.jobID;

      //var master = this.GetMaster(jobID).socket;
      //this.SendToPeer(master, req.sessionID, 'report_message', req.data);
    }.bind(this));

    this.ioroute('disconnect', function(req) {
      var peer = this.GetPeer(req.sessionID);

      if (!peer) {
        return;
      }

      for (var jobID in this.jobs) {
        this.jobs[jobID].RemovePeer(peer);
      }

      delete this.peers[req.sessionID];
      delete this.sockets[peer.socketID];
    }.bind(this));

    this.iomasterroute('consolelog', {
      'record': function(req) {
        var jobID = req.job.id;
        this.consoleLog.Record(jobID, req.data.entry);
        this.AddToCodeLog(jobID, req.data.entry);
      }.bind(this),

      'replay': function(req) {
        req.io.respond(this.consoleLog.Replay(req.job.id));
      }.bind(this)
    });

    this.ioroute('blockmanager', {
      'get': function(req) {
        var id = req.data.id;
        this.blockManager.Get(req.job.id, id, function(socketIDs) {
          req.io.respond(socketIDs);
        });
      }.bind(this),

      'put': function(req) {
        var id = req.data.id;
        this.blockManager.Put(req.job.id, id, req.peer.socket.id);
      }.bind(this)
    });

    this.ioroute('codelog', {
      'get': function(req) {
        var minSeq = req.data.minSeq;
        var maxSeq = req.data.maxSeq;
        this.GetFromCodeLog(req.job.id, minSeq, maxSeq, function(entries) {
          req.io.respond(entries);
        }.bind(this));
      }.bind(this)
    });

    this.app.io.route('submit_task', function(req) {
      console.log('a');
      //if (checkMaster(req)) {
        console.log('b');
        var jobID = req.data.jobID || req.session.jobID;
        var scheduler = this.GetScheduler(jobID);
        scheduler.AppendRDDs(req.data.rdds);
        var cuts = scheduler.CutFor(req.data.targets);
        var peer = this.PeersForJob(jobID)[0];
        _.each(cuts, function(cut) {
          peer.Send('new_task', {
            id: req.data.id,
            sources: _.pluck(cut.sources, "id"),
            sinks: _.pluck(cut.sinks, "id")
          });
        });
      //}
    }.bind(this));
  },

  GetScheduler: function(jobID) {
    return (this.schedulers[jobID] || (this.schedulers[jobID] = new Scheduler()));
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

  SendToPeer: function(peer, type, data) {
    var message = {
      from: 'server',
      socketID: peer.socket.id,
      type: type
    };

    for (var key in data) {
      if (!(key in message)) {
        message[key] = data[key];
      }
    }

    peer.socket.emit('message', message);
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
  },

  GetMaster: function(jobID) {
    if (!this.JobExists(jobID)) {
      return null;
    }
    return this.jobs[jobID].GetMaster();
  },

  AddToCodeLog: function(jobID, entry) {
    this.codeLog.AddEntry(jobID, entry);
  },

  GetFromCodeLog: function(jobID, minId, maxId, callback) {
    this.codeLog.GetInRange(jobID, minId, maxId, callback);
  }
};

var peerID = 1;
function Peer(jobID, isMaster) {
  this.id = peerID++;
  this.jobID = jobID;
  this.socket = null;
  this.isMaster = isMaster;
  this.UpdatePingTime();
}

Peer.prototype = {
  UpdatePingTime: function() {
    this.mostRecentPing = new Date().getTime();
  },

  IsMaster: function() {
    return this.isMaster;
  },
  Send: function(type, data) {
    var message = {
      from: 'server',
      sessionID: this.sessionID,
      socketID: this.socket.id,
      type: type
    };

    for (var key in data) {
      if (!(key in message)) {
        message[key] = data[key];
      }
    }

    this.socket.emit('message', message);
  }
};

function Job(server) {
  var seed = crypto.randomBytes(20);
  this.id = crypto.createHash('sha1').update(seed).digest('hex');
  this.peerJobID = crypto.createHash('sha1').update(this.id).digest('hex');
  this.volunteers = [];
  this.master = new Peer(this.id, true);
  this.codeLog = server.codeLog.CreateForJob(this.id);
}

Job.prototype = {
  AddPeer: function() {
    var peer = new Peer(this.id, false);
    this.volunteers.push(peer);
    return peer;
  },

  AddMaster: function(master) {
    this.master = master;
  },

  GetMaster: function() {
    return this.master;
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
    if (this.volunteers.length === 0) {
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
