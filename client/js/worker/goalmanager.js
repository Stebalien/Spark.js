define(["underscore", "worker/cachemanager", "worker/blockmanager", "worker/rddmanager"], function(_, CacheManager, BlockManager, RDDManager) {
  var waiting = {};
  var sinks = {};

  return {
    submitTask: function(id) {
      var taskContext = { sources: _.object(task.sources, _.map(task.sources, _.constant(true))) }; 
      _.chain(task.sinks)
       .map(function(sinkId) {
         var sink = RDDManager.getPartition(sinkId);
         if (!sink) throw new Error("WTF!");
         sinks[sink] = true;
         return sink;
       })
       .sortBy(function(sink) {
         // Earliest RDD's first (so that early dependencies show up first).
         return sink.rdd.id;
       }).each(function(sink) {
         sink.collect(taskContext, function(values) {
           // Check if canceled.
           if (sinks[sink]) {
             BlockManager.Put(sink.id, values, sink.persistLevel||1);
           }
         });
       });
    },
    // Used to punch through a source on this slave when another slave dies.
    removeSource: function(id) {
      var waitingList = waiting[id];
      delete waiting[id];
      _.each(waitingList, function(fn) { fn(); }); // No longer a source. Just compute it.
    },
    // Garbage Collection
    removeSink: function (id) {
      delete sinks[id];
      if (RDDManager.getPartition(id).persistLevel === 0) {
        BlockManager.Delete(id);
      }
    },
    getOrCompute: function(taskContext, partition, processor) {
      var partId = partition.id;
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
          CacheManager.getOrCompute(taskContext, partition, processor);
        } else {
          partition.rdd.compute(taskContext, partition, processor);
        }
      });
      BlockManager.Get(partId, function(values) {
        if (values instanceof Error) throw values;
        if (cancel) return; // I just went ahead an computed it...

        // TODO: Cleanup intermediates.
        _.each(values, function(item) {
          processor.process(item);
        });
        processor.done();
      }); // wait 
    }
  };
});
