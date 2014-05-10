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

  BlockManager.prototype.put = function(id, value, replication) {
    this.localBlocks[id] = value;

    if (replication && replication > 1) {
      // TODO: replicate
    }
  };

  BlockManager.prototype.delete = function(id) {
    if (id in this.localBlocks) {
      delete this.localBlocks[id];
    }
  };

  return BlockManager;
});
