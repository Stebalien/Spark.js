define(["EventEmitter"], function(EventEmitter) {
  function Port(worker) {
    var that = this;
    this._port = new EventEmitter();
    this._worker = worker;
    this._worker.addEventListener("message", function(event) {
      var data = event.data;
      that._port.emitEvent(data.event, [data.value]);
    });
  };

  Port.prototype.on = function(name, cb) {
    return this._port.on(name, cb);
  };

  Port.prototype.once = function(name, cb) {
    return this._port.once(name, cb);
  };

  Port.prototype.off = function(name, cb) {
    return this._port.off(name, cb);
  };

  Port.prototype.send = function(name, data) {
    this._worker.postMessage({
      event: name,
      value: data
    });
  };
  return Port;
});
