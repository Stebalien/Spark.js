importScripts("lib/require.js");
importScripts("lib/underscore.js");
importScripts("require.config-worker.js");

self.isMaster = true;

require(["underscore", "worker/rpc", "worker/port", "rdd"], function(_, rpc, port, RDD) {
  self.RDD = RDD;
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
