"use strict";
define(["worker/blockmanager"], function(BlockManager) {
  var CacheManager = {
    getOrCompute: function(taskContext, partition, processor) {
      BlockManager.GetNow(partition.id, function(values) {
        if (values instanceof Error) throw values;
        if (!values) {
          values = [];
          partition.rdd.compute(taskContext, partition, {
            process: function(item) {
              values.push(item);
            },
            done: function() {
              // persist locally
              BlockManager.Put(partition.id, values, partition.persistLevel || 1);
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
