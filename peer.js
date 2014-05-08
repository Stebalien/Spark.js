var PING_INTERVAL = 1000;

var servers = {
  iceServers: [{
    url: 'turn:http://localhost:5000'
  }]
};

var rtcConfig = {
  optional: [{
    RptDataChannels: true
  }]
};


var serverURL = 'http://localhost:5000';

function Peer(socket) {
  socket && this.SetSocket(socket);
  this.connections = {};
  this.eventHandlers = [];
  this.socketID = null;
}

Peer.prototype = {
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

  ConnectToServer: function(serverURL) {
    if (!this.socket) {
      this.SetSocket(io.connect(serverURL));
    }
  },

  SetSocket: function(socket) {
    this.socket = socket;
    this.socket.on('connected', this.Init.bind(this));
  },

  OnConnect: function(data) {
    this.socket.on('connected', this.Init.bind(this));
    this.afterInitConnectedCallback && this.afterInitConnectedCallback();
  },

  Init: function(data, ack) {
    // Notify server that message has been received
    ack();

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

    this.Ping();
  },

  OnMessage: function(message) {
    if (message.type == 'offer') {
      this.OnOffer(message);
    } else if (message.type == 'answer') {
      this.OnAnswer(message);
    } else if (message.type == 'icecandidate') {
      this.OnIceCandidate(message);
    } else if (message.type == 'new_peer') {
      this.SendOffer(message);
    } else if (message.type == 'added_to_job') {
      this.Emit('added_to_job', message);
    } else if (message.type == 'ping') {
      this.Emit('ping', message);
    }
  },

  Ping: function() {
    setTimeout(this.Ping.bind(this), PING_INTERVAL);
    this.socket.emit('ping');
  },

  Emit: function(event, data) {
    data.type = event;
    console.log(data);
    //this.eventHandler && this.eventHandler.call(null, data);
  },

  AfterInit: function(callback) {
    this.afterInitConnectedCallback = callback;
  },

  On: function(callback) {
    this.eventHandler = callback;
  },

  Volunteer: function(jobID) {
    this.socket.emit('volunteer', {jobID: jobID});
    this.Emit('volunteer', {jobID: jobID});
  },

  SendOffer: function(data) {
    var connection = this.CreatePeerConnectionForOfferer(data.socketID);
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
  }
};


function P2PConnection(localPeer, remoteSocketID) {
  this.localPeer = localPeer;
  this.localSocketID = localPeer.socketID;
  this.remoteSocketID = remoteSocketID;
  this.offerSent = false;
  this.remoteDescriptionSet = false;
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
      this.channel.onmessage = function (e) {
        console.log("Got message: " + e.data);
        this.channel.send("testmessagefrom " + this.localSocketID);
      }.bind(this);
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

    this.channel.onmessage = function (e) {
      console.log("Got message: " + e.data);
    }

    this.channel.onopen = function() {
      this.channel.send("testmessagefrom " + this.localSocketID);
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
    this.candidate && this.AddIceCandidate(this.candidate);
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
    this.candidate && this.AddIceCandidate(this.candidate);
  },

  AddIceCandidate: function(candidate) {
    if (this.remoteDescriptionSet) {
      this.connection.addIceCandidate(new RTCIceCandidate(candidate));
      this.candidate = null;
    } else {
      this.candidate = candidate;
    }
  }
};

var peer = new Peer();
peer.ConnectToServer(serverURL);
