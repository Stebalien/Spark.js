"use strict";
define(["underscore"], function(_) {
  function RPC(port) {
    var that = this;
    this._port = port;
    this._nextId = 0;
    this._waiting = [];
    this._functions = {};

    port.on("call", function(event) {
      var error;
      var called = false;
      if (!_.has(that._functions, event.fn)) {
        error = 'Undefined RPC: ' + event.fn;
      } else {
        try {
          event.args.push(function() {
            called = true;
            that._port.send("call-reply", {
              id: event.id,
              value: Array.prototype.slice.call(arguments, 0)
            });
          });
          that._functions[event.fn].apply(null, event.args);
        } catch (e) {
          error = e.toString();
        }
      }
      if (!called && error) {
        that._port.send("call-reply", {
          id: event.id,
          error: error
        });
      }
    });
    port.on('call-reply', function(reply) {
      var fn = that._waiting[reply.id];
      if (fn) {
        delete that._waiting[reply.id];
        if (reply.error) {
          // errors can't be serialized...
          fn(new Error(reply.error));
        } else {
          fn.apply(null, reply.value);
        }
      }
    });
  }

  RPC.prototype.call = function(name) {
    var id = this._nextId++;
    var args = _.rest(arguments);
    var cb = _.last(args);
    if (_.isFunction(cb)) {
      args = _.initial(args);
    } else {
      cb = undefined;
    }
    this._waiting[id] = cb;
    this._port.send("call", {
      id: id,
      fn: name,
      args: args
    });
  };

  RPC.prototype._registerFunction = function(name, fn) {
    if (Object.hasOwnProperty(this._functions, name)) {
      throw new Error("Can't redefine RPC: " + name);
    }
    if (fn) {
      this._functions[name] = fn;
    }
  };

  /*
   * Register an rpc function or a set thereof:
   *
   * register(name, function() {});
   * -- or --
   * register({name: function() {}, ...});
   */
  RPC.prototype.register = function() {
    var that = this;
    if (arguments.length == 1) {
      _.each(arguments[0], function(fn, name) {
        that._registerFunction(name, fn);
      });
    } else {
      that._registerFunction.apply(that, arguments);
    }
  };

  return RPC;
});
