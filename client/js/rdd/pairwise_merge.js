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
        return new RDD.Partition(that, index, pair);
      });
    },
    compute: function(partition, processor) {
      var values = [];
      var done = _.after(2, function () {
        _.each(fn(values[0], values[1]), function(i) {
          processor.process(i);
        });
        processor.done();
      });
      _.each([0, 1], function(i) {
        partition.dependencies[i].collect(i, function(values) {
          values[i] = values;
          done();
        });
      });
    },
  });
});

