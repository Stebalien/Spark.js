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

//(function Ping() {
  //setTimeout(Ping, PING_INTERVAL);
  //socket.emit('ping');
//})();

var serverURL = 'http://localhost:5000';

function Peer() {
  this.socket = null;
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
    var connection = new P2PConnection(this.socketID, socketID);
    this.connections[socketID] = connection;
    return connection;
  },

  ConnectToServer: function(serverURL) {
    this.socket = io.connect(serverURL);
    this.socket.on('connect', this.OnConnect.bind(this));
  },

  OnConnect: function(data) {
    this.socket.on('connected', this.Init.bind(this));
  },

  Init: function(data) {
    this.socketID = data.socketID;

    for (var i = 0; i < this.eventHandlers.length; i++) {
      var handler = this.eventHandlers[i];
      this.socket.on(handler.event, handler.callback.bind(this)); 
    }

    this.socket.on('offer', this.OnOffer.bind(this));
    this.socket.on('answer', this.OnAnswer.bind(this));
    this.socket.on('icecandidate', this.OnIceCandidate.bind(this));
  },

  On: function(event, callback) {
    this.eventHandlers.push({event: event, callback: callback});
  },

  Volunteer: function(jobID) {
    this.socket.emit('volunteer', {jobID: jobID});
  },

  SendOffer: function(connection) {
    connection.SendOffer(function(sockets, description) {
      this.socket.emit('offer', {
        sockets: sockets,
        description: description
      });
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
  },

  SendAnswer: function(sockets, description) {
    this.socket.emit('answer', {
      sockets: sockets,
      description: description
    });
  },

  OnAnswer: function(data) {
    var answererSocketID = data.sockets.answererSocketID;
    var connection = this.connections[answererSocketID];
    connection.OnAnswer(data.sockets, data.description);
  },

  SendIceCandidate: function(sockets, candidate) {
    this.socket.emit('icecandidate', {
      sockets: sockets,
      candidate: candidate
    });
  },

  OnIceCandidate: function(data) {
    var offererSocketID = data.sockets.offererSocketID;
    var connection = this.connections[offererSocketID];
    if (!connection) {
      connection = this.CreatePeerConnectionForAnswerer(offererSocketID);
    }
    connection.AddIceCandidate(data.candidate);
  }
};


function P2PConnection(localSocketID, remoteSocketID) {
  this.localSocketID = localSocketID;
  this.remoteSocketID = remoteSocketID;
  this.offerSent = false;
  this.remoteDescriptionSet = false;
}

P2PConnection.prototype = {
  InitForOfferer: function(callback) {
    this.Init();
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
    this.Init();
    this.connection.ondatachannel = function(event) {
      this.channel = event.channel;
      this.channel.onmessage = function (e) {
        console.log("Got message:", e.data);
        this.channel.send("testmessagefrom " + this.localSocketID);
      }.bind(this);
    }.bind(this);
  },

  Init: function() {
    this.connection = new webkitRTCPeerConnection(servers, rtcConfig);
  },

  AddDataChannel: function() {
    this.channel = this.connection.createDataChannel(
      "sendDataChannel",
      {reliable: false}
    );

    this.channel.onmessage = function (e) {
      console.log("Got message:", e.data);
    }

    this.channel.onopen = function() {
      this.channel.send("testmessagefrom " + this.localSocketID);
    }.bind(this);
  },

  SendOffer: function(callback) {
    if (this.offerSent) {
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
peer.On('added_to_job', function(data) {
});

peer.On('new_peer', function(data) {
  var connection = peer.CreatePeerConnectionForOfferer(data.socketID);
  peer.SendOffer(connection);
});

peer.ConnectToServer(serverURL);
peer.Volunteer('testjob');
