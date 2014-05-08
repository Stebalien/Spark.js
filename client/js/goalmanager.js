define(["context", "underscore"], function(ctx, _) {
  var sinks = {}; // Drain data to these.
  var sources = {}; // Pull data from these (don't compute).

  var waiting = {};

  return {
    addSource: function(id) {
        sources[id] = true;
    },
    removeSource: function(id) {
      var waitingList = waiting[id];
      delete sources[id];
      delete waiting[id];
      _.each(waitingList, function(fn) { fn(); }); // No longer a source. Just compute it.
    },
    addSink: function (id) {
      // TODO We need to drive our sinks and make them into sources.
      // Once done, we need to report to the server.
    },
    removeSink: function (id) {
        // TODO: remove sink data from BlockManager
    },
    isSource: function(partition) {
      return sources[partition.getId()];
    },
    getOrCompute: function(taskContext, partition, processor) {
      var partId = partition.getId();
      var waitingList = waiting[partId];
      var cancel = false;
      if (!waitingList) {
        waitingList = waiting[partId] = [];
      }
      waitingList.push(function() {
        cancel = true;
        // I shouln't find it but I might need to cache it!
        if (rdd.persistLevel > 0) {
          // Try to get it from the cache.
          ctx.cm.getOrCompute(taskContext, partition, processor);
        } else {
          partition.rdd.compute(taskContext, partition, processor);
        }
      });
      ctx.bm.get(partId, function(values) {
        if (cancel) return; // I just went ahead an computed it...

        // TODO: Cleanup intermediates.
        _.each(values, function(item) {
          processor.process(item);
        });
        processor.done();
      }, true); // wait 
    }
  }
});
