define(["worker/blockmanager"], function(BlockManager) {
  var CacheManager = {
    getOrCompute: function(taskContext, partition, processor) {
      BlockManager.get(partition.id, false, function(values) {
        if (values instanceof Error) throw values;
        if (!values) {
          values = [];
          partition.rdd.compute(taskContext, partition, {
            process: function(item) {
              values.push(item);
            },
            done: function() {
              BlockManager.put(partition.id, values, partition.persistLevel);
              _.each(values, function(item) {
                processor.process(item);
              });
              processor.done();
            }
          });
        } else {
          _.each(values, function(item) {
            processor.process(item);
          });
          processor.done();
        }
      });
    }
  };
  return CacheManager;
});
