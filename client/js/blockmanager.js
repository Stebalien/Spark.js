define(['EventEmitter'], function(EventEmitter) {

  function BlockManager(peer) {
    this.peer = peer;
    this.localBlocks = {};
    this.remoteBlocks = {};
  }

  BlockManager.prototype = Object.create(EventEmitter.prototype);
  BlockManager.prototype.constructor = BlockManager;

  BlockManager.prototype.get = function(id) {
    // Cached locally
    if (id in this.localBlocks) {
      return this.localBlocks[id];
    }

    // Fetch from another peer
    if (id in this.remoteBlocks) {

    }

    // Don't know where it is; ask the server
  };

  BlockManager.prototype.put = function(id, value, replication) {

  };

  BlockManager.prototype.delete = function(id) {

  };

  return BlockManager;
});
