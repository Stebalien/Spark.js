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
    compute: function(partition, processor) {
      partition.dependencies[0].iterate({
        process: function(item) {
          processor.process(this.fn(item));
        },
        done: function() { processor.done() };
      });
    },
  });
});

