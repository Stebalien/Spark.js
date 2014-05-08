define(["blockmanager"], function(bm) {
  var partitionCache = [];
  var rddCache = []; // It's sparse anyways...

  var CacheManager = {
    getRDD: function(id) {
      return rddCache[id];
    },
    registerRDD: function(rdd) {
      rddCache[rdd.id] = rdd;
    },
    registerPartitions: function(rdd, partitions) {
      partitionCache[rdd.id] = partitions;
    },
    getOrCompute: function(taskContext, partition, processor) {
      var partId = partition.getId()
      bm.get(partId, function(values) {
        if (!values) {
          values = [];
          partition.rdd.compute(taskContext, partition, {
            process: function(item) {
              values.push(item);
            },
            done: function() {
              bm.put(partId, values);
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
    },
    getOrComputePartitions: function(rdd) {
      var result = partitionCache[rdd.id];
      if (!result) {
        result = rdd.__description__.getPartitions();
        CacheManager.registerPartitions(rdd, result);
      }
      return result;
    }
  };
  return CacheManager;
});
