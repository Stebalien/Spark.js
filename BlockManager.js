function BlockManager() {
  this.blocks = {};
  this.pendingGets = {};
}

BlockManager.prototype = {
  // Find out which peer is working on partitionID
  Get: function(partitionID) {
    // Work is complete
    return this.blocks[partitionID]; 

    // Work is in progress; save request and notify when the work is complete
    //this.pendingGets
  },

  // partitionID is being worked on by peer with socketID
  Put: function(partitionID, socketID) {
    //this.Emit('put', {partitionID: partitionID, ownerSocketID: socketID});
  },

  Delete: function(partitionID) {

  }
};

module.exports = BlockManager;
