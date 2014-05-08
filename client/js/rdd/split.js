define(["rdd/rdd", "underscore"], function(RDD, _) {
  return RDD.implement({
    init: function(parent, ways) {
      this.parent = parent;
      this.ways = ways;
    },
    getPartitions: function() {
      var that = this;
      return _.flatten(_.map(this.parent.partitions, function(part, index) {
        return _.map(_.range(index*that.ways, (index+1)*that.ways), function(i) {
          return new RDD.Partition(that, i, part);
        });
      }));
    },
    compute: function(taskContext, partition, processor) {
      var i = partition.index % this.ways;
      var that = this;
      partition.dependencies[0].iterate(taskContext, {
        process: function(item) {
          if ((i % that.ways) == 0) {
            processor.process(item);
          }
          i++;
        },
        done: function() {
          processor.done();
        }
      });
    },
  });
});

