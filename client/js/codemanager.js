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
          minId: this.nextToGet,
          maxId: id
        };
        this.nextToGet = id+1;

        this.peer.Call('codelog:get', message, function(entries) {
          _.each(entries, function(entry) {
            this.code[entry.id] = entry.value;
          }, this);
          this._advance();
        }.bind(this));
      }
      waiting.push(callback)
    },
    _advance: function() {
      var that = this;
      function applyUpdate(n) {
        var update = that.code[n];
        that.worker.call("exec", util.toURL(update), function() {
          _.each(that.waiting[n], function(cb) { cb(); });
          that.waiting[n] = null;
        });
      }
      while (this.code[this.nextToApply]) {
        applyUpdate(this.nextToApply);
        this.nextToApply++;
      }
    }
  };

  return CodeManager;
});
