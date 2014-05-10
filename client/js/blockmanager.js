define(['EventEmitter'], function(EventEmitter) {

  function BlockManager(peer) {
    this.peer = peer;
    this.localBlocks = {};
    this.remoteBlockSocketIDs = {};
  }

  BlockManager.prototype = Object.create(EventEmitter.prototype);
  BlockManager.prototype.constructor = BlockManager;

  BlockManager.prototype.get = function(id, callback) {
    // Cached locally
    if (id in this.localBlocks) {
      callback(true, this.localBlocks[id]);
      return;
    }

    // Fetch from another peer
    if (id in this.remoteBlockSocketIDs) {
      this.peer.ConnectToPeer(this.remoteBlockSocketIDs[id], function() {

        //callback(true, );
      });
      return;
    }

    // Don't know where it is; ask the server
    this.peer.socket.emit('blockmanager/get', function() {

    });
  };

  BlockManager.prototype.put = function(id, value, replication) {

  };

  BlockManager.prototype.delete = function(id) {

  };

  return BlockManager;
});
