define(["underscore"], function(_) {
  function RPC(port) {
    var that = this;
    this._port = port;
    this._nextId = 0;
    this._waiting = [];
    this._functions = {};

    port.on("call", function(event) {
      var error;
      var value;
      if (!_.has(that._functions, event.fn)) {
        error = 'Undefined RPC';
      } else {
        try {
          value = that._functions[event.fn].apply(self, event.args);
        } catch (e) {
          error = e.toString();
        }
      }
      that._port.send("call-reply", {
        id: event.id,
        value: value,
        error: error
      });
    });
    port.on('call-reply', function(value) {
      var fn = that._waiting[value.id];
      delete that._waiting[value.id];
      if (value.error) {
        // errors can't be serialized...
        fn(new Error(value.error));
      } else {
        fn(value.value);
      }
    });
  };

  RPC.prototype.call = function(name) {
    var id = this._nextId++;
    var args = _.rest(arguments);
    var cb = _.last(args);
    if (_.isFunction(cb)) {
      args = _.initial(args);
    } else {
      cb = function() {};
    }
    this._waiting[id] = cb
    this._port.send("call", {
      id: id,
      fn: name,
      args: args
    });
  };

  RPC.prototype.register = function(name, fn) {
    if (Object.hasOwnProperty(this._functions, name)) {
      throw new Error("Can't redefine RPC: " + name);
    }
    this._functions[name] = fn;
  }
  return RPC;
});
