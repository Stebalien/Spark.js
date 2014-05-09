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
      var that = this;
      partition.dependencies[0].collect(taskContext, function(values) {
        var width = values.length/that.ways;
        var index = partition.index % that.ways;
        var start = Math.floor(index*width);
        var end;
        if (index === (that.parent.partitions.length*that.ways-1)) {
          // Make sure rounding errors don't cause us to drop values (yay floats).
          end = values.length;
        } else {
          end = Math.floor((index+1)*width);
        }
        _.each(values.slice(start, end), function(item) {
          processor.process(item);
        });
        processor.done();
      });
    },
  });
});

