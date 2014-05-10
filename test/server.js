var io = require('socket.io-client');
var server = require('../server.js');
var harness = require('browser-harness');
var assert = require('assert');
var _ = require('underscore');
var asyncblock = require('asyncblock');

var serverURL = 'http://localhost:5000/';
var harnessURL = 'http://localhost:5000/static/node_modules/browser-harness/client/harness.html';

function TestClient(id, browser, driver) {
  this.id = id;
  this.browser = browser;
  this.driver = driver;
  this.eventHandlers = {};
}

TestClient.prototype = {
  ResetHandlers: function() {
    for (var key in this.eventHandlers) {
      if (key != 'message') {
        delete this.eventHandlers[key];
      }
    }
  },

  Init: function() {
    //this.driver.exec(function() {
      //return peer;
    //}, function(err, result) {
      //console.log(err);
      //console.log("peer" + result.socketID);
    //});
  },

  On: function(type, handler) {
    if (!(type in this.eventHandlers)) {
      this.eventHandlers[type] = [];
    }
    this.eventHandlers[type].push(handler);
  },

  Fire: function(type, data) {
    if (!(type in this.eventHandlers)) {
      return;
    }

    var toBeRemoved = {};
    for (var i = 0; i < this.eventHandlers[type].length; i++) {
      this.eventHandlers[type][i](data);

      if (this.eventHandlers[type][i].once) {
        toBeRemoved[i] = true;
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

  Open: function(cb) {
    var callback;
    if (cb) {
      callback = function() {
        this.Init();
        cb();
      }.bind(this);
    } else {
      callback = this.Init.bind(this);
    }

    this.driver.setUrl(serverURL, callback);
  },

  Volunteer: function(jobID) {
    this.driver.exec('function() { peer.Volunteer("testjob"); }');
  },

  SetSocketID: function(socketID) {
    this.socketID = socketID;
  },

  HandlePing: function(message) {
    this.Fire('ping', message.sessionID);
  }
}

function TestHarness() {
  this.id = 1;
  this.browsers = [];
  this.clients = [];
  this.numClients = 1;
  this.socketIDtoClientID = {};
}

TestHarness.prototype = {
  Init: function() {
    harness.listen(4500, function() {
      harness.events.on('ready', function(driver) {
        this.StoreClient(driver);
      }.bind(this));
    }.bind(this));
  },

  StoreClient: function(driver) {
    var client = new TestClient(this.id++, this.browsers.shift(), driver);
    this.clients.push(client);

    driver.events.on('console.log', function(message) {
      client.Fire('message', message);
    });

    client.Init();

    if (this.clients.length == this.numClients) {
      this.onReadyCallback && this.onReadyCallback();
    }
  },

  CreateClient: function() {
    var browser = new harness.Browser({type: 'chrome'});
    browser.open(harnessURL);
    this.browsers.push(browser);
  },

  Create: function(numClients) {
    this.numClients = numClients;
    for (var i = 0; i < numClients; i++) {
      this.CreateClient();
    }
  },

  GetClients: function() {
    return this.clients;
  },

  GetNumClients: function() {
    return this.numClients;
  },

  Reset: function(callback) {
    var count = 0;
    var numClients = this.clients.length;
    for (var i = 0; i < numClients; i++) {
      this.clients[i].browser.close(function() {
        count++;
        if (count == numClients) {
          callback();
          delete this.clients[i];
        }
      }.bind(this));
    }

    this.browsers = [];
    this.clients = [];
    this.id = 1;
    this.numClients = 1;
    this.onReadyCallback = null;
  },

  OnReady: function(onReadyCallback) {
    this.onReadyCallback = onReadyCallback;
  },

  UpdateSocketID: function(clientID, socketID) {
    this.socketIDtoClientID[socketID] = clientID;
  },

  GetClientID: function(socketID) {
    return this.socketIDtoClientID[socketID];
  }
};

var testHarness;

function MessageHandler(clients) {
  this.clients = clients;
  this.offersSent = {};
  this.answersSent = {};
  this.icecandidatesSent = {};
  this.offersReceived = {};
  this.answersReceived = {};
  this.icecandidatesReceived = {};
  this.channels = {};
  this.socketToClient = {};
  this.eventHandlers = {};

  this.Init();
}

MessageHandler.prototype = {
  Init: function() {
    for (var i = 0; i < this.clients.length; i++) {
      this.clients[i].On('message', this.Handle.bind(this, this.clients[i]));
      this.offersSent[i] = {};
      this.answersSent[i] = {};
      this.icecandidatesSent[i] = {};
      this.offersReceived[i] = {};
      this.answersReceived[i] = {};
      this.icecandidatesReceived[i] = {};
      this.channels[i] = {};
    }
  },

  Handle: function(client, message) {
    if (!message) {
      return;
    }

    message.socketID && testHarness.UpdateSocketID(client.id, message.socketID);

    var answererID;
    var offererID;
    if (message.sockets) {
      answererID = testHarness.GetClientID(message.sockets.answererSocketID);
      offererID = testHarness.GetClientID(message.sockets.offererSocketID);
    }

    if (message.type == 'connected') {
      client.SetSocketID(message.socketID);
    } else if (message.type == 'send_offer') {
      this.offersSent[client.id] = answererID; 
    } else if (message.type == 'receive_offer') {
      this.offersReceived[client.id] = offererID;
    } else if (message.type == 'send_answer') {
      this.answersReceived[client.id] = offererID;
    } else if (message.type == 'receive_answer') {
      this.answersReceived[client.id] = answererID;
    } else if (message.type == 'send_icecandidate') {
      this.icecandidatesSent[client.id] = answererID;
    } else if (message.type == 'receive_icecandidate') {
      this.icecandidatesReceived[client.id] = offererID;
    } else if (message.type == 'ondatachannel') {
      this.HandleDataChannel(
        testHarness.GetClientID(message.localSocketID),
        testHarness.GetClientID(message.remoteSocketID)
      );
    } else if (message.type == 'added_to_job') {
    } else if (message.type == 'ping') {
      client.HandlePing(message);
    }

    //this.CheckIfChannelEstablished(client);
  },

  HandleDataChannel: function(clientID1, clientID2) {
    this.channels[clientID1] = clientID2;
    this.channels[clientID2] = clientID1;
    var data = {};
    data[clientID1] = true;
    data[clientID2] = true;
    this.Fire('datachannel', data);
  },

  On: function(type, data, handler) {
    if (!(type in this.eventHandlers)) {
      this.eventHandlers[type] = [];
    }
    this.eventHandlers[type].push({data: data, handler: handler});
  },

  Once: function(type, data, handler) {
    if (!(type in this.eventHandlers)) {
      this.eventHandlers[type] = [];
    }
    this.eventHandlers[type].push({data: data, handler: handler, once: true});
  },

  Fire: function(type, data) {
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
        handler();
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

  CheckIfChannelEstablished: function(client) {
    for (var i = 0; i < this.clients.length; i++) {
      if (this.clients[i].id != client.id) {
        this.CheckIfChannelEstablishedBetween(client, this.clients[i]);
      }
    }
  },

  CheckIfChannelEstablishedBetween: function(client1, client2) {
    var offererTasks = [
      this.offersSent,
      this.answersReceived,
      this.icecandidatesSent
    ];

    var answererTasks = [
      this.offersReceived,
      this.answersSent,
      this.icecandidatesReceived
    ];
  }
};

var MessageHandler;

describe('Peer', function() {
  this.timeout(8000);

  before(function(done) {
    server.Init();
    testHarness = new TestHarness();
    testHarness.Init();
    server.Run(5000, function() {
      testHarness.OnReady(function() {
        messageHandler = new MessageHandler(testHarness.GetClients());  
        done();
      });
      testHarness.Create(2);
    });
  });

  afterEach(function() {
    var clients = testHarness.GetClients();
    for (var i = 0; i < clients.length; i++) {
      clients[i].ResetHandlers();
    }
  });

  after(function(done) {
    testHarness.Reset(function() {
      server.Stop(done);
    });
  });

  it('should persist sessions', function(done) {
    var clients = testHarness.GetClients();
    var numClients = testHarness.GetNumClients();
    var client = clients[0];
    var sessionID = null

    client.On('ping', function(incomingSessionID) {
      if (!sessionID) {
        sessionID = incomingSessionID;
      } else if (sessionID == incomingSessionID) {
        done();
      }
    });

    client.Open(function() {});
  });

  it('should create peer-to-peer connection', function(done) {
    var clients = testHarness.GetClients();
    var numClients = 2;
    var client1 = clients[0];
    var client2 = clients[1];
    var count = 0;
    var testJob = 'testjob';

    messageHandler.Once('datachannel', {1: true, 2: true}, done);

    //client1.Open(function() {
      client1.Volunteer(testJob);
    //});
    client2.Open(function() {
      client2.Volunteer(testJob);
    });
  });

  //it('should save peers that have volunteered', function(done) {
    //var jobID = 'testjob';

    //var clients = testHarness.GetClients();
    //var numClients = testHarness.GetNumClients();

    //var checkCount = function() {
    //console.log('check');
      //var allPeersAdded = server.PeerCount() == numClients;
      //var allAssignedJobs = server.PeersForJob(jobID).length == numClients;
      //if (allPeersAdded && allAssignedJobs) {
        //done();
      //}
    //}

    //for (i = 0; i < clients.length; i++) {
      //clients[i].On('message', function(message) {
        //console.log('test :', message);
        //if (message.type == 'added_to_job') {
          //checkCount();
        //}
      //});
      //clients[i].Open();
    //}
  //});

  //it('should notify peers when another peer volunteers', function(done) {
    //var jobID = 'testjob';

    //var clients = testHarness.GetClients();
    //var numClients = testHarness.GetNumClients();
    //var doneCalled = false;

    //var checkCount = function() {
      //var allPeersAdded = server.PeerCount() == numClients;
      //var allAssignedJobs = server.PeersForJob(jobID).length == numClients;
      //if (allPeersAdded && allAssignedJobs) {
        //!doneCalled && done();
        //doneCalled = true;
      //}
    //}

    //for (i = 0; i < clients.length; i++) {
      //clients[i].On('message', function(message) {
        //if (message.type == 'new_peer') {
          //checkCount();
        //}
      //});
      //clients[i].Open();
    //}
  //});
});
