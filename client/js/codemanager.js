define(['underscore', "util"], function(_, util) {
  function CodeManager(peer, worker) {
    this.peer = peer;
    this.worker = worker;
    this.nextToApply = 0;
    this.nextToGet = 0;
    this.code = [];
    this.waiting = [];
  }

  CodeManager.prototype = {
    ApplyUpdate: function(id, callback) {
      if (id < this.nextToApply) {
        callback();
      }

      var waiting = this.waiting[id];
      if (!waiting) {
        waiting = this.waiting[id] = [];
        var message = {
          jobID: this.peer.jobID,
          minId: this.nextToGet,
          maxId: id
        };
        this.nextToGet = id+1;

        this.peer.socket.emit('codelog:get', message, function(entries) {
          _.each(entries, function(entry) {
            this.code[entry.id] = entry.value;
          }, this);
          this._advance();
        }.bind(this));
      }
      waiting.push(callback)
    },
    _advance: function() {
      var update;
      while (update = this.code[this.nextToApply]) {
        this.worker.call("exec", util.toURL(update));
        _.each(this.waiting[this.nextToApply++], function(cb) { cb(); });
      }
    }
  };

  return CodeManager;
});
