define(["rdd/rdd", "underscore"], function(RDD, _) {
  var MappedRDD = RDD.implement({
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
      partition.dependencies[0].iterate(taskContext, {
        process: function(item) {
          processor.process(that.fn(item));
        },
        done: processor.done
      });
    },
  });

  RDD.extend("map", function(fn) {
    return new MappedRDD(this, fn);
  });

  return MappedRDD;
});

