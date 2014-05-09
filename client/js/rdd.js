define([
  "rdd/rdd",
  "util",
  "underscore",
  "rdd/coalesce",
  "rdd/map" ,
  "rdd/mappartitions",
  "rdd/flatmap",
  "rdd/filter",
  "rdd/multiget",
  "rdd/split"
],
function(RDD, util, _) {

  RDD.extend("fold", function(zero, fn, coalesceRate) {
    var that = this;
    if (!coalesceRate) {
      // "magic"
      coalesceRate = 1000000;
    }
    while (true) {
      // Map
      that = that.mapPartitions(function(values) {
        return [_.reduce(values, fn, zero)];
      });
      // Check if done...
      if (that.partitions.length == 1) {
        break;
      }
      // Coalesc and map again.
      that = that.coalesce(Math.ceil(that.partitions.length/coalesceRate));
    }
    return that;
  });

  RDD.extend("sum", function() {
    return this.fold(0, function(a, b) {
      return a + b;
    });
  });

  RDD.extend("lines", function() {
    return this.flatMap(function(item) {
      return item.split('\n');
    });
  });

  RDD.extend("count", function() {
    return this.mapPartitions(function(values) {
      return [values.length];
    }).sum();
  });

  RDD.extend("print", function() {
    this._collect(function(values) {
      console.log(values);
      //ctx.console.log(values);
    });
  });

  RDD.extend("save", function() {
    var that = this;
    this._collect(function(values) {
      var blob = new Blob(JSON.stringify(values), {type: "text/json"});
      saveAs(blob, "rdd-" + "-" + that.id + ".json");
    });
  });

  return RDD;
});
