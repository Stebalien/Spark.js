importScripts("lib/require.js");
importScripts("lib/underscore.js");

require.config({
  shim: {
    underscore: {
      exports: '_',
      deps: ['underscore.string'],
      init: function(UnderscoreString) {
        _.mixin(UnderscoreString);
      }
    },
  },
  paths: {
    underscore: 'lib/underscore',
    "underscore.string": 'lib/underscore.string',
    EventEmitter: 'lib/EventEmitter'
  }
});

require(["underscore", "worker/rpc", "worker/port", "rdd"], function(_, rpc, port, RDD) {
  self.RDD = RDD;
  rpc.register("exec", function(script) {
    try {
      importScripts(script);
    } catch (e) {
      var status;
      if (e instanceof SyntaxError || e.message.match(/^Uncaught SyntaxError: /)) {
        status = "invalid_syntax";
      } else {
        status = "error";
      }
      return {
        status: status,
        error:  e.toString()
      };
    }
    return {
      status: "success"
    }
  });
  port.send("ready");
});
