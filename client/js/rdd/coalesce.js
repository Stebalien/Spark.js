define(["rdd/rdd", "underscore"], function(RDD, _) {
  return RDD.implement({
    init: function(parent, partitions) {
      this.parent = parent;
      this.requestedPartitions = partitions;
    },
    getPartitions: function() {
      var that = this;
      var parentPartitions = that.parent.partitions;
      if (this.requestedPartitions > parentPartitions.length) {
        return _.map(parentPartitions, function(part, i) {
          return new RDD.Partition(that, i, [part]);
        });
      }
      var size = parentPartitions.length/this.requestedPartitions;
      var minSize = Math.floor(size);
      var remainder = size-minSize;

      var idx = 0;
      var slack = 0;
      return _.map(_.range(0, this.requestedPartitions), function(i) {
        var oldIdx = idx;
        idx += minSize;
        slack += remainder;
        if (slack >= 1) {
          // take up the slack.
          slack -= 1;
          idx++;
        }
        return new RDD.Partition(that, i, parentPartitions.slice(oldIdx, idx));
      });
    },
    compute: function(partition, processor) {
      function next(i) {
        if (i == partition.dependencies.length) {
          processor.done();
        } else {
          partition.dependencies[i].iterate({
            process: function(item) {
              processor.process(item);
            },
            done: function() {
              next(i+1);
            }
          });
        }
      }
      next(0);
    }
  });
});

