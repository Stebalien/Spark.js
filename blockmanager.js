function BlockManager(server) {
  this.server = server;
  this.blocks = {};
  this.pendingGets = {};
}

BlockManager.prototype = {
  // Find out which peer is working on partitionID
  Get: function(partitionID, socketID) {
    var block = this.blocks[partitionID]; 
    // Work is complete

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

var statusConsts = {
  DONE: 'done',
  INPROGRESS: 'inprogress',
  ASSIGNED: 'assigned',
  UNASSIGNED: 'unassigned'
};

function Block(partitionID) {
  this.partitionID = partitionID;
  this.peers = {};
}

Block.prototype = {
  AddPeer: function(socketID) {
    this.peers[socketID] = statusConsts.ASSIGNED;
  },

  GetStatus: function() {
    var donePeers = [];

    for (var socketID in this.peers) {
      if (this.peers[socketID] == statusConsts.DONE) {
        donePeers.push(socketID);
      }
    }

    return donePeers;
  }
};

module.exports = BlockManager;
