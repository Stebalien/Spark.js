importScripts("/js/lib/require.js");
importScripts("/js/lib/underscore.js");
importScripts("/js/require.config-worker.js");

self.isMaster = false;

require(["worker/goalmanager", "underscore", "worker/rpc", "worker/port", "rdd"], function(GoalManager, _, rpc, port, RDD) {
  self.RDD = RDD;
  rpc.register("exec", function(script) {
    // Can't throw an exception.
    importScripts(script);
  });
  rpc.register("schedule", function(task) {
    GoalManager.submitTask(task);
  });
  rpc.register("remove_sources", function(source) {
    _.each(sources, function(source) {
      GoalManager.removeSource(source);
    });
  });
  rpc.register("remove_sinks", function(sinks) {
    _.each(sinks, function(sink) {
      GoalManager.removeSink(sink);
    });
  });
  port.send("ready");
});
