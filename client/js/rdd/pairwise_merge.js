define(["rdd/rdd", "underscore"], function(RDD, _) {
  return RDD.implement({
    init: function(parent, inner, fn) {
      this.parent = parent;
      this.fn = fn;
      this.inner = inner;
    },
    getPartitions: function() {
      var that = this;
      var partitioned = _.partition(this.parent.partitions, function(item, index) { return this.inner != ((index % 2) == 0); });
      var zipped = _.zip.apply(_, partitioned);
      return _.map(zipped, function(pair, index) {
        return new RDD.Partition(that, index, _.compact(pair));
      });
    },
    compute: function(taskContext, partition, processor) {
      var that = this;
      var values = [];
      var done = _.after(partition.dependencies.length, function () {
        _.each(that.fn(values[0], values[1]), function(i) {
          processor.process(i);
        });
        processor.done();
      });
      _.each(partition.dependencies, function(part, i) {
        part.collect(taskContext, function(v) {
          values[i] = v;
          done();
        });
      });
    },
  });
});

