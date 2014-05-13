define([], function() {

  function BlockManager(peer) {
    this.peer = peer;
    this.localBlocks = {};
    this.remoteBlockSocketIDs = {};
    this.pendingGets = {};
  }

  /*
  BlockManager.prototype.GetNow = function(id, callback) {
    if (id in this.localBlocks) {
      callback(this.localBlocks[id].value);
      return;
    }

    if (!(id in this.pendingGets)) {
      this.pendingGets[id] = [];
    }
    this.pendingGets[id].push(callback);

    if (id in this.remoteBlockSocketIDs) {
      this.GetFromPeer(id, this.remoteBlockSocketIDs[id]);
      return;
    }
    callback(null);
  };
  */

  BlockManager.prototype.Get = function(id, callback) {
    // Cached locally
    if (id in this.localBlocks) {
      callback(this.localBlocks[id].value);
    }

    if (id in this.pendingGets) {
      this.pendingGets[id].push(callback);
      return;
    }

    this.pendingGets[id] = [callback];
    this._doGet(id);
  };
  BlockManager.prototype._doGet = function(id) {
    var socketIDs = this.remoteBlockSocketIDs[id];
    if (!socketIDs || socketIDs.length === 0) {
      this.peer.Call('blockmanager-get', {id: id}, function(socketIDs) {
        this.remoteBlockSocketIDs[id] = socketIDs;
        if (!(id in this.pendingGets)) {
          // We actually have it now
          return;
        }
        this._doGet(id);
      }.bind(this));
    } else {
      var socketID = socketIDs[_.random(0, socketIDs.length-1)];
      this.GetFromPeer(id, socketID);
      _.delay(function() {
        if (!(id in this.pendingGets)) {
          return;
        }
        var i = this.remoteBlockSocketIDs[id].indexOf(socketID);
        if (i >= 0) {
          // Remove from peers.
          this.remoteBlockSocketIDs[id].splice(i, 1);
        }
        this._doGet(id);
      }.bind(this), 1000); // timeout
    }
  }

  BlockManager.prototype.GetFromPeer = function(id, socketID, cb) {
    this.peer.SendMessageToPeer(socketID, {
      type: 'get',
      id: id
    }, cb);
  };

  BlockManager.prototype.Put = function(id, value, replication) {
    // If doing a put after fetching from another peer, should possibly notify 
    // server that this peer has this block
    if (value && replication > 0) {
      if (this.localBlocks[id]) {
        replication += this.localBlocks[id].replication;
      }
      this.localBlocks[id] = {
        value: value,
        replication: replication
      };
      var message = {
        id: id
      };
      this.peer.Call('blockmanager-put', message);
    }

    if (id in this.pendingGets) {
      for (var i = 0; i < this.pendingGets[id].length; i++) {
        this.pendingGets[id][i](value);
      }
    }

    delete this.pendingGets[id];
  };

  BlockManager.prototype.Delete = function(id) {
    if (id in this.localBlocks) {
      delete this.localBlocks[id];
    }
  };

  return BlockManager;
});
