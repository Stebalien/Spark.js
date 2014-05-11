define(["underscore", "rpc", "port"],
function(_,             RPC,   Port) {
  function Worker(url) {
    var that = this;
    this._ready = false;
    this._worker = new window.Worker(url);
    this._port = new Port(this._worker);
    this._rpc = new RPC(this._port);
    this._port.once('ready', function() {
      that._ready = true;
    });
  }
  Worker.prototype.send = function() {
    var that = this;
    if (!this._ready) {
      this.ready(function() {
        that._port.send.apply(that._port, arguments);
      });
    } else {
      this._port.send.apply(that._port, arguments);
    }
  };
  Worker.prototype.on = function() {
    this._port.on.apply(this._port, arguments);
  };
  Worker.prototype.off = function() {
    this._port.off.apply(this._port, arguments);
  };
  Worker.prototype.call = function() {
    this._rpc.call.apply(this._rpc, arguments);
  };
  Worker.prototype.register = function() {
    this._rpc.register.apply(this._rpc, arguments);
  };
  Worker.prototype.ready = function(cb) {
    var that = this;
    if (this._ready) {
      cb(this);
    } else {
      this._port.once('ready', function() {
        cb(that);
      });
    }
  };
  return Worker;
});
