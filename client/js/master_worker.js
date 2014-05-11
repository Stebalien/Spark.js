importScripts("/js/lib/require.js");
importScripts("/js/lib/underscore.js");
importScripts("require.config-worker.js");

self.isMaster = true;

require(["underscore", "worker/rpc", "worker/port", "rdd"], function(_, rpc, port, RDD) {
  self.RDD = RDD;
  // TODO: Expire
  rpc.register("init", function(script, cb) {
    self.initializing = true;
    importScripts(script);
    self.initializing = false;
  });
  rpc.register("exec", function(script, cb) {
    try {
      importScripts(script);
    } catch (e) {
      var status;
      if (e instanceof SyntaxError || e.message.match(/^Uncaught SyntaxError: /)) {
        status = "invalid_syntax";
      } else {
        status = "error";
      }
      cb(status, e.toString());
      return;
    }
    cb("success")
  });
  port.send("ready");
});
