define([], function() {

  function JobBlockManager(peer) {
    this.peer = peer;
    this.localBlocks = {};
    this.remoteBlockSocketIDs = {};
  }

  JobBlockManager.prototype.Get = function(id, callback) {
    // Cached locally
    if (id in this.localBlocks) {
      callback(this.localBlocks[id]);
      return;
    }

    // Fetch from another peer
    if (id in this.remoteBlockSocketIDs) {
      this.peer.SendMessageToPeer(this.remoteBlockSocketIDs[id], {
        type: 'get',
        id: id
      }, callback);
      return;
    }

    // Don't know where it is; ask the server
    this.peer.socket.emit('blockmanager/get', function() {
      // TODO: server blockmanager
    });
  };

  JobBlockManager.prototype.Put = function(id, value, replication) {
    // If doing a put after fetching from another peer, should possibly notify 
    // server that this peer has this block
    this.localBlocks[id] = value;

    if (replication && replication > 1) {
      // TODO: replicate
    }
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
      this.jobBlockManagers[jobID] = new JobBlockManager(jobID);
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
