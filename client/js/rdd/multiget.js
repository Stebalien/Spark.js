define(["manager", "rdd/rdd", "underscore"], function(Manager, RDD, _) {
  return RDD.implement({
    init: function(urls) {
      this.urls = urls;
    },
    getPartitions: function() {
      var that = this;
      return _.map(this.urls, function(url, index) {
        return new RDD.Partition(that, index, []);
      });
    },
    compute: function(partition, processor) {
      var that = this;
      var req = new XMLHttpRequest();
      req.onreadystatechange = function() {
        if (req.readyState === 4) {
          if (req.status === 200) {
            processor.process(req.responseText);
            processor.done();
          } else {
            // TODO: Better failure handling...
            //Manager.reportFailure(that, partition, xhr);
          }
        }
      };
      req.open('GET', this.urls[partition.index]);
      req.send(null);
    }
  });
});
