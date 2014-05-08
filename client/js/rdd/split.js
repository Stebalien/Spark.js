define(["cachingpartition", "rdd/rdd", "underscore"], function(CachingPartition, RDD, _) {
  return RDD.implement({
    init: function(parent, ways) {
      this.parent = parent;
      this.ways = ways;
      this._cachingPartitions = {};
    },
    getPartitions: function() {
      var that = this;
      return _.flatten(_.map(this.parent.partitions, function(part, index) {
        return _.map(_.range(index*that.ways, (index+1)*that.ways), function(i) {
          return new RDD.Partition(that, i, part);
        });
      }));
    },
    compute: function(partition, processor) {
      var i = partition.index % this.ways;
      var that = this;

      // Multiple partitions will read this dependency. Cache it!
      var depId = partition.dependencies[0].getId()
      var cachingPartition = this._cachingPartitions[depId];
      if (!cachingPartition) {
        cachingPartition = this._cachingPartitions[depId] = new CachingPartition(partition.dependencies[0], this.ways);
      }

      cachingPartition.iterate({
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

