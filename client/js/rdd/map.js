define(["rdd/rdd", "underscore"], function(RDD, _) {
  return RDD.implement({
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
        done: function() { processor.done() }
      });
    },
  });
});

