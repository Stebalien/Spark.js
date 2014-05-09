define(["blockmanager"], function(bm) {
  var rddCache = []; // It's sparse anyways...

  var CacheManager = {
    getRDD: function(id) {
      return rddCache[id];
    },
    getPartition: function(id) {
      var pieces = id.split("/");
      return this.getRDD(parseInt(pieces[0], 10)).partitions[parseInt(pieces[1], 10)];
    },
    registerRDD: function(rdd) {
      rddCache[rdd.id] = rdd;
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
    }
  };
  return CacheManager;
});
