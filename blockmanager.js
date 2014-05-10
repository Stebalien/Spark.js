var _ = require('underscore');

function BlockManager(server, jobID) {
  this.server = server;
  this.jobID = jobID;
  this.blocks = {};
  this.pendingGets = {};
}

BlockManager.prototype = {
  // Find out which peer is working on partitionID
  Get: function(partitionID, callback) {
    if (partitionID in this.blocks) {
      return this.blocks[partitionID]; 
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

module.exports = BlockManager;
