var _ = require('underscore');

function JobBlockManager(jobID) {
  this.jobID;
  this.blocks = {};
  this.pendingGets = {};
}

JobBlockManager.prototype = {
  // Find out which peer is working on partitionID
  Get: function(partitionID, callback) {
    if (partitionID in this.blocks) {
      callback(this.blocks[partitionID]);
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
      this.blocks[partitionID] = socketID;
    }
    this.blocks[partitionID][socketID] = true;

    if (replication && replication > 1) {
      replication -= _.size(this.blocks[partitionID]);

      if (replication > 1) {
        // TODO: replicate
      }
    }

    for (var i = 0; i < this.pendingGets[partitionID].length; i++) {
      this.pendingGets[partitionID][i](socketID);
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
