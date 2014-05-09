define([
  "rdd/rdd",
  "util",
  "underscore",
  "rdd/coalesce",
  "rdd/mixed",
  "rdd/map" ,
  "rdd/mappartitions",
  "rdd/flatmap",
  "rdd/filter",
  "rdd/multiget",
  "rdd/split"
],
function(RDD, util, _, CoalescedRDD, MixedRDD, MappedRDD, MappedPartitionRDD, FlatMapRDD, FilterRDD, MultigetRDD, SplitRDD) {

  RDD.extend("mix", function(ways) {
    return new MixedRDD(this, ways);
  });

  RDD.extend("fold", function(zero, fn, coalesceRate) {
    var that = this;
    if (!coalesceRate) {
      // "magic"
      coalesceRate = 1000000;
    }
    while (true) {
      // Map
      that = new MappedPartitionRDD(that, function(values) {
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

  RDD.extend("coalesce", function(width) {
    return new CoalescedRDD(this, width);
  });

  RDD.extend("map", function(fn) {
    return new MappedRDD(this, fn);
  });

  RDD.extend("mapPartitions", function(fn) {
    return new MappedPartitionRDD(this, fn);
  });

  RDD.extend("split", function(n) {
    return new SplitRDD(this, n);
  });

  RDD.extend("flatMap", function(fn) {
    return new FlatMapRDD(this, fn);
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

  RDD.extend("filter", function(fn) {
    return new FilterRDD(this, fn);
  });

  RDD.extend("count", function() {
    return (new MappedPartitionRDD(this, function(values) {
      return [values.length];
    })).sum();
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

  RDD.extendStatic("http", function(urls) {
    if (!_.isArray(urls)) {
      urls = [urls];
    }
    return new MultigetRDD(urls);
  });

  return RDD;
});
