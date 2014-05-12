define(['blockmanager', 'underscore'], function(BlockManager, _) {

  var PING_INTERVAL = 1000;

  var servers = {
    iceServers: [{
      url: 'turn:'+location.origin
    }]
  };

  var rtcConfig = {
    optional: [{
      RptDataChannels: true
    }]
  };

  var serverURL = location.origin;

  function Peer() {
    this.socket = null;
    this.connections = {};
    this.eventHandlers = {};
    this.socketID = null;
    this.ConnectToServer(serverURL);
    this.blockManager = new BlockManager(this);
    this.jobs = {};
    this.activeOnJob = false;
  }

  Peer.prototype = {
    Call: function(method, data, callback) {
      data.jobID = this.jobID;
      this.socket.emit(method, data, callback);
    },

    CreatePeerConnectionForOfferer: function(socketID) {
      var connection = this.CreatePeerConnection(socketID);
      connection.InitForOfferer(this.SendIceCandidate.bind(this));
      return connection;
    },

    CreatePeerConnectionForAnswerer: function(socketID) {
      var connection = this.CreatePeerConnection(socketID);
      connection.InitForAnswerer();
      return connection;
    },

    CreatePeerConnection: function(socketID) {
      var connection = new P2PConnection(this, socketID);
      this.connections[socketID] = connection;
      return connection;
    },

    ConnectToServer: function() {
      if (!this.socket) {
        this.SetSocket(io.connect(serverURL, {force_new_connection: true}));
      } else {
        this.socket.socket.reconnect();
      }
    },

    SetSocket: function(socket) {
      this.socket = socket;
      this.socket.on('connected', this.Init.bind(this));
    },

    Init: function(data, ack) {
      // Notify server that message has been received
      if (ack) {
        ack();
      }

      this.Volunteer();
      if (this.init) {
        return;
      }
      this.init = true;
      this.socketID = data.socketID;
      this.Emit('connected', data);

      for (var i = 0; i < this.eventHandlers.length; i++) {
        var handler = this.eventHandlers[i];
        this.socket.on(handler.event, handler.callback.bind(this)); 
      }

      this.socket.on('message', this.OnMessage.bind(this));
    },

    OnMessage: function(message) {
      switch (message.type) {
        case 'offer':
          this.OnOffer(message);
          break;
        case 'answer':
          this.OnAnswer(message);
          break;
        case 'icecandidate':
          this.OnIceCandidate(message);
          break;
        case 'new_peer':
          this.ConnectToPeer(message.socketID);
          //this.SendOffer(message);
          this.Emit('new_peer', message.socketID);
          break;
        case 'added_to_job':
          this.Emit('added_to_job', message);
          this.HandleAddedToJob(message);
          this.ReportMessage(this.socketID + " added to job @ " + String(new Date()));
          this.Ping();
          break;
        case 'ping':
          this.Emit('ping', message);
          this.HandlePing(message);
          break;
        case 'report_message':
          console.log(message);
          this.HandleMessage(message);
          break;
        case 'new_task':
          this.Emit('new_task', message);
        break;
      }
    },

    HandleAddedToJob: function(message) {
      this.jobID = message.jobID;
      if (message.peerJobID) {
        this.peerJobID = message.peerJobID;
      }
      this.activeOnJob = true;
    },

    GetPeerID: function() {
      return this.peerJobID;
    },

    IsMaster: function() {
      return this.jobID && this.peerJobID;
    },

    HandlePing: function(message) {
      if (!this.jobID && message.jobID) {
        this.jobID = message.jobID;
      }
      var jobs = message.alljobs;
      var existingJobIDs = _.keys(this.jobs);

      var newJobs = _.omit(jobs, existingJobIDs);
      this.Emit('newjobs', {jobs: newJobs});

      var existingJobs = _.pick(jobs, existingJobIDs);

      var newPeers = _.pick(jobs, existingJobIDs); 
      for (var jobID in existingJobs) {
        newPeers[jobID].peers = _.difference(existingJobs[jobID].peers, this.jobs[jobID].peers);
      }

      this.Emit('newpeers', {peers: newPeers});
      this.jobs = jobs;
    },

    Ping: function() {
      this.PingTimeout = setTimeout(this.Ping.bind(this), PING_INTERVAL);
      this.socket.emit('ping');
    },

    On: function(type, handler, once) {
      if (!(type in this.eventHandlers)) {
        this.eventHandlers[type] = [];
      }

      if (typeof(handler) === 'function') {
        handler = {
          data: {},
          handler: handler,
          once: once
        };
      }
      this.eventHandlers[type].push(handler);
    },

    Once: function(type, handler) {
      this.On(type, handler, true);
    },

    Emit: function(type, data) {
      if (!data) {
        data = {};
      }
      data.type = type;
      //console.log(data);

      if (!(type in this.eventHandlers)) {
        return;
      }

      var toBeRemoved = {};
      for (var i = 0; i < this.eventHandlers[type].length; i++) {
        var handlerData = this.eventHandlers[type][i].data;
        var handler = this.eventHandlers[type][i].handler;
        var runHandler = true;

        for (var key in handlerData) {
          if (handlerData[key] != data[key]) {
            runHandler = false;
            break;
          }
        }

        if (runHandler) {
          handler(data);
          if (this.eventHandlers[type][i].once) {
            toBeRemoved[i] = true;
          }
        }
      }

      var handlers = [];
      for (var i = 0; i < this.eventHandlers[type].length; i++) {
        if (!(i in toBeRemoved)) {
          handlers.push(this.eventHandlers[type][i]);
        }
      }
      this.eventHandlers[type] = handlers;
    },

    AfterInit: function(callback) {
      this.afterInitConnectedCallback = callback;
    },

    Volunteer: function() {
      if (this.activeOnJob) {
        return;
      }

      if (!this.socket.socket.connected) {
        this.ConnectToServer(serverURL);
      }
      this.socket.emit('volunteer');
      this.Emit('volunteer');
    },

    SendOffer: function(socketID) {
      var connection = this.CreatePeerConnectionForOfferer(socketID);
      connection.SendOffer(function(sockets, description) {
        var data = {
          sockets: sockets,
          description: description
        };
        this.socket.emit('offer', data);
        this.Emit('send_offer', data);
      }.bind(this));
    },

    OnOffer: function(data) {
      var offererSocketID = data.sockets.offererSocketID;
      var connection = this.connections[offererSocketID];
      if (!connection) {
        connection = this.CreatePeerConnectionForAnswerer(offererSocketID);
      }
      connection.OnOffer(data.sockets, data.description, function(sockets, description) {
        this.SendAnswer(sockets, description);
      }.bind(this));
      this.Emit('receive_offer', data);
    },

    SendAnswer: function(sockets, description) {
      var data = {
        sockets: sockets,
        description: description
      };
      this.socket.emit('answer', data);
      this.Emit('send_answer', data);
    },

    OnAnswer: function(data) {
      var answererSocketID = data.sockets.answererSocketID;
      var connection = this.connections[answererSocketID];
      connection.OnAnswer(data.sockets, data.description);
      this.Emit('received_answer', data);
    },

    SendIceCandidate: function(sockets, candidate) {
      var data = {
        sockets: sockets,
        candidate: candidate
      };
      this.socket.emit('icecandidate', data);
      this.Emit('send_icecandidate', data);
    },

    OnIceCandidate: function(data) {
      var offererSocketID = data.sockets.offererSocketID;
      var connection = this.connections[offererSocketID];
      if (!connection) {
        connection = this.CreatePeerConnectionForAnswerer(offererSocketID);
      }
      connection.AddIceCandidate(data.candidate);
      this.Emit('receive_icecandidate', data);
    },

    Disconnect: function() {
      this.socket.disconnect();
      if (this.PingTimeout) {
        clearTimeout(this.PingTimeout);
      }
    },

    DisconnectFromJob: function() {
      this.socket.emit('leave_job', {jobID: this.jobID});
      this.activeOnJob = false;
    },

    ConnectToPeer: function(socketID, callback) {
      if (!this.connections[socketID]) {
        this.SendOffer(socketID);

        if (callback){
          this.Once('channel_opened', {
            handler: callback,
            data: {
              localSocketID: this.socketID,
              remoteSocketID: socketID
            }
          });
        }
      } else if (this.connection[socketID].ChannelOpened()) {
        callback();
      }
    },

    SendMessageToPeer: function(socketID, message, callback) {
      if (!this.connection[socketID] || !this.connection[socketID].ChannelOpened()) {
        this.ConnectToPeer(socketID, callback);
        return;
      } 

      this.connection[socketID].SendMessage(message, callback);
    },

    HandleMessageFromPeer: function(remoteSocketID, message) {
      switch (message.type) {
        case 'get':
          this.blockManager.Get(message.id, function(value) {
            this.SendMessageToPeer(remoteSocketID, {
              seqID: message.seqID,
              originalSender: message.senderSocketID,
              type: 'put',
              value: value
            });
          }.bind(this));
          break;
        case 'put':
          this.blockManager.put(message.id, message.value, message.replication);
          break;
        case 'delete':
          this.blockManager.delete(message.id);
          break;
        case 'getnow':
          this.blockManager.GetNow(message.id, function(value) {
            this.SendMessageToPeer(remoteSocketID, {
              seqID: message.seqID,
              originalSender: message.senderSocketID,
              type: 'put',
              value: value
            });
          }.bind(this));
          break;
      }
    },

    ReportMessage: function(err){
      console.log("report message", this.jobID);
      var data = {
        jobID: this.jobID,
        error: err
      };
      this.socket.emit('report_message', data) 
      this.Emit('report_message', data)
    }, 

    HandleMessage: function(data) {
      if (this.IsMaster()){
        var error = data.error;
        $("#error_log").append("<br>" + error);
      }
    }
  };


  function P2PConnection(localPeer, remoteSocketID) {
    this.localPeer = localPeer;
    this.localSocketID = localPeer.socketID;
    this.remoteSocketID = remoteSocketID;
    this.offerSent = false;
    this.remoteDescriptionSet = false;
    this.channelOpened = false;
    this.messageQueue = [];
    this.inFlight = {};
    this.seqID = 1;
  }

  P2PConnection.prototype = {
    InitForOfferer: function(callback) {
      if (!this.Init()) {
        return;
      }

      this.connection.onicecandidate = function(event) {
        var sockets = {
          offererSocketID: this.localSocketID,
          answererSocketID: this.remoteSocketID
        };
        this.AddIceCandidate(event.candidate);
        callback(sockets, event.candidate);
        this.connection.onicecandidate = null;
      }.bind(this);

      this.connection.onopen = function() {
      };
    },

    InitForAnswerer: function() {
      if (!this.Init()) {
        return;
      }

      this.connection.ondatachannel = function(event) {
        this.localPeer.Emit('ondatachannel', {
          localSocketID: this.localSocketID,
          remoteSocketID: this.remoteSocketID
        });

        this.channel = event.channel;
        this.channelOpened = true;
        this.channel.onmessage = this.HandleIncomingMessage.bind(this);
      }.bind(this);
    },

    Init: function() {
      if (!!window.webkitRTCPeerConnection) {
        this.connection = new webkitRTCPeerConnection(servers, rtcConfig);
        return true;
      }
      return false;
    },

    AddDataChannel: function() {
      this.channel = this.connection.createDataChannel(
        "sendDataChannel",
        {reliable: false}
      );

      this.channel.onmessage = this.HandleIncomingMessage.bind(this);

      this.channel.onopen = function() {
        this.channelOpened = true;
        //this.SendMessage({type: 'get', id: 1, jobID: 1});
      }.bind(this);
    },

    SendOffer: function(callback) {
      if (this.offerSent || !this.connection) {
        return;
      }

      var sockets = {
        offererSocketID: this.localSocketID,
        answererSocketID: this.remoteSocketID
      };

      this.AddDataChannel();
      this.connection.createOffer(function(description) {
        this.connection.setLocalDescription(description);
        callback(sockets, description);
      }.bind(this));
      this.offerSent = true;
    },

    OnOffer: function(sockets, remoteDescription, callback) {
      this.connection.setRemoteDescription(
        new RTCSessionDescription(remoteDescription)
      );
      this.remoteDescriptionSet = true;
      if (this.candidate) {
        this.AddIceCandidate(this.candidate);
      }
      this.SendAnswer(sockets, callback);
    },

    SendAnswer: function(sockets, callback) {
      this.connection.createAnswer(function(description) {
        this.connection.setLocalDescription(description);
        callback(sockets, description);
      }.bind(this));
    },

    OnAnswer: function(sockets, description) {
      this.connection.setRemoteDescription(
        new RTCSessionDescription(description)
      );
      this.remoteDescriptionSet = true;
      if (this.candidate) {
        this.AddIceCandidate(this.candidate);
      }
    },

    AddIceCandidate: function(candidate) {
      if (this.remoteDescriptionSet) {
        this.connection.addIceCandidate(new RTCIceCandidate(candidate));
        this.candidate = null;
      } else {
        this.candidate = candidate;
      }
    },

    ChannelOpened: function() {
      return this.channelOpened;
    },

    GetChannel: function() {
      return this.channel;
    },

    SendMessage: function(message, callback, isResponse) {
      if (callback) {
        this.inFlight[this.seqID] = callback;
      }
      if (!isResponse) {
        message.originalSender = this.localSocketID;
      }
      message.seqID = this.seqID;
      if (this.channelOpened) {
        this.channel.send(JSON.stringify(message));
      }
      this.seqID++;
    },

    HandleIncomingMessage: function(event) {
      //console.log(event.data);
      var message = JSON.parse(event.data);
      var seqID = message.seqID;

      // The message is a response to a message this peer sent
      if (seqID in this.inFlight && message.originalSender == this.localSocketID) {
        this.inFlight[seqID].callback(message);
        delete this.inFlight[seqID];
        return;
      }

      this.localPeer.HandleMessageFromPeer(this.remoteSocketID, message);
    }
  };

  return Peer;
});
