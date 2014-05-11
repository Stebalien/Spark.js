importScripts("lib/require.js");
importScripts("lib/underscore.js");
importScripts("require.config-worker.js");

self.isMaster = false;

require(["worker/goalmanager", "worker/cachemanager", "underscore", "worker/rpc", "worker/port", "rdd"], function(GoalManager, CacheManager, _, rpc, port, RDD) {
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