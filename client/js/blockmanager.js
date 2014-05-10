define([], function() {

  function JobBlockManager(jobID, peer) {
    this.jobID = jobID;
    this.peer = peer;
    this.localBlocks = {};
    this.remoteBlockSocketIDs = {};
    this.pendingGets = {};
  }

  JobBlockManager.prototype.Get = function(id, callback) {
    // Cached locally
    if (id in this.localBlocks) {
      callback(this.localBlocks[id]);
      return;
    }

    if (!(id in this.pendingGets)) {
      this.pendingGets[id] = [];
    }
    this.pendingGets[id].push(callback);

    // Fetch from another peer
    if (id in this.remoteBlockSocketIDs) {
      this.GetFromPeer(id, this.remoteBlockSocketIDs[id]);
      return;
    }

    var message = {
      id: id,
      jobID: this.jobID
    };

    // Don't know where it is; ask the server
    this.peer.socket.emit('blockmanager:get', message, function(socketIDs) {
      for (var socketID in socketIDs) {
        this.GetFromPeer(id, socketID);
      }
    }.bind(this));
  };

  JobBlockManager.prototype.GetFromPeer = function(id, socketID) {
    this.peer.SendMessageToPeer(socketID, {
      type: 'get',
      id: id,
      jobID: this.jobID
    });
  };

  JobBlockManager.prototype.Put = function(id, value, replication) {
    // If doing a put after fetching from another peer, should possibly notify 
    // server that this peer has this block
    this.localBlocks[id] = value;

    if (replication && replication > 1) {
      // TODO: replicate
    }

    for (var i = 0; i < this.pendingGets[id].length; i++) {
      this.pendingGets[id][i](value);
    }

    this.pendingGets[id] = [];
  };

  JobBlockManager.prototype.Delete = function(id) {
    if (id in this.localBlocks) {
      delete this.localBlocks[id];
    }
  };

  function BlockManager(peer) {
    this.peer = peer;
    this.jobBlockManagers = {};
  }

  BlockManager.prototype = {
    JobExists: function(jobID) {
      return jobID in this.jobBlockManagers;
    },

    CreateJob: function(jobID) {
      this.jobBlockManagers[jobID] = new JobBlockManager(jobID, this.peer);
    },

    Get: function(jobID, partitionID, callback) {
      if (!this.JobExists(jobID)) {
        throw new Error('BlockManager for ' + jobID + ' does not exist. Get failed.');
      }

      var blockManager = this.jobBlockManagers[jobID];
      blockManager.Get(partitionID, callback);
    },

    Put: function(jobID, partitionID, value, replication) {
      if (!this.JobExists(jobID)) {
        throw new Error('BlockManager for ' + jobID + ' does not exist. Put failed.');
      }

      var blockManager = this.jobBlockManagers[jobID];
      blockManager.Put(partitionID, value, replication);
    },

    Delete: function(jobID, partitionID) {
      if (!this.JobExists(jobID)) {
        throw new Error('BlockManager for ' + jobID + ' does not exist. Delete failed.');
      }
      var blockManager = this.jobBlockManagers[jobID];
      blockManager.Delete(partitionID);
    }
  };

  return BlockManager;
});
