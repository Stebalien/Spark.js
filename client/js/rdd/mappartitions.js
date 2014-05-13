"use strict";
define(["rdd/rdd", "underscore"], function(RDD, _) {
  var MappedPartitionRDD = RDD.implement({
    init: function(parent, fn) {
      this.parent = parent;
      this.fn = fn;
    },
    getPartitions: function() {
      var that = this;
      return _.map(this.parent.partitions, function(parent, index)  {
        return new RDD.Partition(that, index, parent);
      });
    },
    compute: function(taskContext, partition, processor) {
      var that = this;
      partition.dependencies[0].collect(taskContext, function(values) {
        _.each(that.fn(values, partition.index), function(item) {
          processor.process(item);
        });
        processor.done();
      });
    },
  });

  RDD.extend("mapPartitions", function(fn) {
    return new MappedPartitionRDD(this, fn);
  });

  return MappedPartitionRDD;
});


