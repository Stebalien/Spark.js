define([], function() {

  function BlockManager(peer) {
    this.peer = peer;
    this.localBlocks = {};
    this.remoteBlockSocketIDs = {};
    this.pendingGets = {};
  }

  BlockManager.prototype.GetNow = function(id, callback) {
    if (id in this.localBlocks) {
      callback(this.localBlocks[id]);
      return;
    }

    if (!(id in this.pendingGets)) {
      this.pendingGets[id] = [];
    }
    this.pendingGets[id].push(callback);

    if (id in this.remoteBlockSocketIDs) {
      this.GetFromPeer(id, this.remoteBlockSocketIDs[id], true);
      return;
    }
    callback(null);
  };

  BlockManager.prototype.Get = function(id, callback) {
    // Cached locally
    if (id in this.localBlocks) {
      return this.localBlocks[id];
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
      jobID: this.peer.jobID
    };

    // Don't know where it is; ask the server
    this.peer.socket.emit('blockmanager:get', message, function(socketIDs) {
      for (var socketID in socketIDs) {
        this.GetFromPeer(id, socketID);
      }
    }.bind(this));
  };

  BlockManager.prototype.GetFromPeer = function(id, socketID, getNow) {
    this.peer.SendMessageToPeer(socketID, {
      type: getNow ? 'getnow' : 'get',
      id: id
    });
  };

  BlockManager.prototype.Put = function(id, value, replication) {
    // If doing a put after fetching from another peer, should possibly notify 
    // server that this peer has this block
    if (value) {
      this.localBlocks[id] = value;
    }

    if (replication && replication > 1) {
      // TODO: replicate
    }

    for (var i = 0; i < this.pendingGets[id].length; i++) {
      this.pendingGets[id][i](value);
    }

    this.pendingGets[id] = [];

    var message = {
      id: id,
      jobID: this.peer.jobID
    };
    this.peer.socket.emit('blockmanager:put', message);
  };

  BlockManager.prototype.Delete = function(id) {
    if (id in this.localBlocks) {
      delete this.localBlocks[id];
    }
  };

  return BlockManager;
});
