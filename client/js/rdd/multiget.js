define(["manager", "rdd/rdd", "jquery", "underscore"], function(Manager, RDD, $, _) {
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
      $.get(this.urls[partition.index])
       .done(function(data) {
         processor.process(data);
         processor.done();
       })
       .fail(function(xhr) {
         // TODO: Better failure handling...
         Manager.reportFailure(that, partition, xhr);
       });
    }
  });
});
