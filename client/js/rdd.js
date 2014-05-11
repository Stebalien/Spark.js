define([
  "rdd/rdd",
  "worker/console",
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
function(RDD, WorkerConsole, util, _) {

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

  /*
  RDD.extend("sort", function(fn) {
    // TODO...
    var that = new SampledNRDD(this, 20).coalesce().
    that.
    this.count()._collect(function(values) {
      var size = values[0];
      var frac = Math.min(that.partitions.length*20 / Math.max(size, 1), 1.0);
      var sampled = new SampledRDD(frac);
    });
  });
  */

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


  if (self.isMaster) {
    function display(rdd, type) {
      // Wait
      _.defer(function() {
        var id = rdd._collect(function(values) {
          WorkerConsole.fulfillResult(id, values, type);
        });
        WorkerConsole.promiseResult(id, type);
      });
    }

    RDD.extend("print", function() {
      display(this, 'json');
    });
    RDD.extend("plotLine", function() {
      display(this, 'plotLine');
    });

    RDD.extend("save", function() {
      var that = this;
      this._collect(function(values) {
        var blob = new Blob(JSON.stringify(values), {type: "text/json"});
        saveAs(blob, "rdd-" + "-" + that.id + ".json");
      });
    });
  } else {
    RDD.extend("print", function() {});
    RDD.extend("save", function() {});
  }

  return RDD;
});
