define(["rdd/rdd", "underscore"], function(RDD, _) {
  var MultigetRDD = RDD.implement({
    init: function(urls) {
      this.urls = urls;
    },
    getPartitions: function() {
      var that = this;
      return _.map(this.urls, function(url, index) {
        return new RDD.Partition(that, index, []);
      });
    },
    compute: function(taskContext, partition, processor) {
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

  RDD.extendStatic("http", function(urls) {
    if (!_.isArray(urls)) {
      urls = [urls];
    }
    return new MultigetRDD(urls);
  });

  return MultigetRDD;
});
