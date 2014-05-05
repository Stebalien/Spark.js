var should = require('should');
var io = require('socket.io-client');
var server = require('../server.js');
var assert = require('assert');

var socketURL = 'http://0.0.0.0:5000';

var options = {
  'force new connection': true,
  'query': 'test=true'
};

describe('Server', function() {
  before(function() {
    server.Init();
  });

  beforeEach(function() {
    server.Run(5000);
  });

  afterEach(function() {
    server.Stop();
  });

  it('session should persist', function(done) {
    var peer = io.connect(socketURL, options);

    peer.on('connect', function() {
      peer.on('connected', function() {
        peer.emit('ping');
        peer.emit('ping');
      });

      var sessionID = null;
      peer.on('ping_received', function(id) {
        if (sessionID && sessionID == id) {
          peer.disconnect();
          done();
        } else {
          sessionID = id;
        }
      });
    });
  });

  it('peers should be saved after volunteering', function(done) {
    var peer = io.connect(socketURL, options);
    var jobID = 'testjob';

    var peerCount = 10;
    for (i = 0; i < peerCount; i++) {
      var peer = io.connect(socketURL, options);
      peer.on('connect', function() {
        this.on('connected', function() {
          this.emit('volunteer', {jobID: jobID});
        }.bind(this));

        this.on('added_to_job', function() {
          this.disconnect();

          var allPeersAdded = server.PeerCount() == peerCount;
          var allAssignedJobs = server.PeersForJob(jobID).length;
          if (allPeersAdded && allAssignedJobs) {
            done();
          }
        }.bind(this));
      }.bind(peer));
    }
  });

  it('peers should be notified when another peer volunteers', function(done) {
    var peer1 = io.connect(socketURL, options);
    var jobID = 'testjob';

    peer1.on('connect', function() {
      peer1.on('connected', function() {
        peer1.emit('volunteer', {jobID: jobID});
        var peer2 = io.connect(socketURL, options);

        peer2.on('connect', function() {
          peer2.on('connected', function() {
            peer2.emit('volunteer', {jobID: jobID});
          });
        });
      });

      peer1.on('new_peer', function() {
        done();
      });
    });
  });
});
