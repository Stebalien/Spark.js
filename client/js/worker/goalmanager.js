define(["underscore", "worker/blockmanager", "worker/rddmanager"], function(_, BlockManager, RDDManager) {
  var waiting = {};
  var sinks = {};

  return {
    submitTask: function(task) {
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
    // Garbage Collection
    removeSink: function (id) {
      delete sinks[id];
      if (RDDManager.getPartition(id).persistLevel === 0) {
        BlockManager.Delete(id);
      }
    },
    getOrCompute: function(taskContext, partition, processor) {
      BlockManager.Get(partition.id, function(values) {
        if (values instanceof Error) throw values;

        // TODO: Cleanup intermediates.
        _.each(values, function(item) {
          processor.process(item);
        });
        processor.done();
      }); // wait 
    }
  };
});
