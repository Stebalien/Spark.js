require(["rdd"], function(RDD) {
  var errors = RDD.get("http://google.com/")
     .lines()
     .repartition(100)
     .cache()
     .filter(function(line) {
       return _.contains(line, "ERROR");
     });
  if (errors.count() > 3) {
    errors.groupBy(function() {
});
