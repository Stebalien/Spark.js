var _ = require('underscore');

function JobBlockManager(job) {
  this.job = job;
  this.blocks = {};
  this.pendingGets = {};
  this.job.On("leave", function(peer) {
    _.each(this.blocks, function(peers, id) {
      this.blocks[id] = _.without(peers, peer.socket.id)
      var newPeers = _.without(peers, peer.socket.id);
      if (newPeers.length !== 0) {
        this.blocks[id] = newPeers;
      } else {
        delete this.blocks[id];
      }
    }, this);
  }.bind(this));
}

JobBlockManager.prototype = {
  // Find out which peer is working on partitionID
  GetNow: function(partitionID) {
    if (partitionID in this.blocks) {
      return this.blocks[partitionID];
    }
    return null;
  },

  Get: function(partitionID, callback) {
    var value = this.GetNow(partitionID);
    if (value) {
      callback(value);
      return;
    }

    if (!(partitionID in this.pendingGets)) {
      this.pendingGets[partitionID] = [];
    }

    this.pendingGets[partitionID].push(callback);
  },

  // partitionID is being worked on by peer with socketID
  Put: function(partitionID, socketID, replication) {
    if (!(partitionID in this.blocks)) {
      this.blocks[partitionID] = [];
    }
    this.blocks[partitionID].push(socketID);

    if (replication && replication > 1) {
      replication -= this.blocks[partitionID].length;

      if (replication > 1) {
        // TODO: replicate
      }
    }

    if (partitionID in this.pendingGets) {
      for (var i = 0; i < this.pendingGets[partitionID].length; i++) {
        this.pendingGets[partitionID][i](this.blocks[partitionID]);
      }
    }

    this.pendingGets[partitionID] = [];
  },

  Delete: function(partitionID) {
    this.deleted[partitionID] = true;
  }
};

function BlockManager() {
  this.jobBlockManagers = {};
}

BlockManager.prototype = {
  JobExists: function(jobID) {
    return jobID in this.jobBlockManagers;
  },

  CreateJob: function(job) {
    this.jobBlockManagers[job.id] = new JobBlockManager(job);
  },

  Get: function(jobID, partitionID, callback) {
    if (!this.JobExists(jobID)) {
      throw new Error('BlockManager for ' + jobID + ' does not exist. Get failed.');
    }

    var blockManager = this.jobBlockManagers[jobID];
    blockManager.Get(partitionID, callback);
  },

  Put: function(jobID, partitionID, socketID, replication) {
    if (!this.JobExists(jobID)) {
      throw new Error('BlockManager for ' + jobID + ' does not exist. Put failed.');
    }

    var blockManager = this.jobBlockManagers[jobID];
    blockManager.Put(partitionID, socketID, replication);
  },

  Delete: function(jobID, partitionID) {
    if (!this.JobExists(jobID)) {
      throw new Error('BlockManager for ' + jobID + ' does not exist. Delete failed.');
    }
    var blockManager = this.jobBlockManagers[jobID];
    blockManager.Delete(partitionID);
  }
};

module.exports = BlockManager;
