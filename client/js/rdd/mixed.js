define(["rdd/rdd", "underscore"], function(RDD, _) {
  return RDD.implement({
    init: function(parent, ways) {
      this.parent = parent;
      this.ways = ways || 2;
    },
    getPartitions: function() {
      var that = this;
      var stride = Math.ceil(this.parent.partitions.length / this.ways);
      return _.flatten(_.map(_.range(0, stride), function(offset) {
        var deps = [];
        while (offset < this.parent.partitions.length) {
          deps.push(this.parent.partitions[offset]);
          offset += stride;
        }
        var base = offset*this.ways;
        return _.map(_.range(base, base+this.ways), function(i) {
          new RDD.Partition(that, i, deps);
        });
      }), true);
    },
    compute: function(partition, processor) {
      function next(parent) {
        if (i == partition.dependencies.length) {
          processor.done();
        } else {
          var ctr = partition.index % partition.dependencies.length;
          partition.depenencies[parent].iterate({
            process: function(item) {
              if (ctr == 0) {
                processor.process(item);
              }
              ctr++;
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
