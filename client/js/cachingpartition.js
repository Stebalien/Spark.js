define(["rdd/rdd", "underscore"], function(RDD, _) {
  function CachingPartition(parent, times) {
    if (!(this instanceof Partition)) {
      return new CachingPartition(parent);
    }
    this.parent = parent;
    this._cache = null;
    this._processors = null;
  }

  CachingPartition.prototype = RDD.Partition.prototype;
  CachingPartition.prototype.constructor = CachingPartition;

  Object.defineProperty(CachingPartition.prototype, "index", {
    __proto__: null,
    get: function() { this.parent.index; },
    set: function(value) { this.parent.index = value; }
  });

  Object.defineProperty(CachingPartition.prototype, "rdd", {
    __proto__: null,
    get: function() { this.parent.rdd; },
    set: function(value) { this.parent.rdd = value; }
  });

  Object.defineProperty(CachingPartition.prototype, "rdd", {
    __proto__: null,
    get: function() { this.parent.rdd; },
    set: function(value) { this.parent.rdd = value; }
  });

  Object.defineProperty(CachingPartition.prototype, "dependencies", {
    __proto__: null,
    get: function() { this.parent.dependencies; },
    set: function(value) { this.parent.dependencies = value; }
  });

  CachingPartition.prototype.iterate = function(processor) {
    var that = this;

    // We're first!
    if (!that._cache) {
      that._cache = [];
      that._processors = [processor];
      that.rdd.iterate(that, {
        processor: function(item) {
          var i;
          for (i = 0; i < that._processors.length; i++) {
            proc.process(item);
          }
          // cache it.
          if (i < this.times) {
            that._cache[i] = {value: item, times: that.times - i};
          }
        },
        done: function() {
          var procs = that._processors;
          that._processors = null;
          _.each(that._processors, function(proc) {
            proc.done();
            that.times--;
          });
        }
      });
    } else {
      for (var i = 0; i < that._cache.length; i++) {
        processor.process(that._cache[i].value);
        if (--that._cache[i].times === 0) {
          that._cache[i] = null;
        }
      }
      if (that._processors) {
        // Currently processing.
        that._processors.push(processor);
      } else {
        processor.done();
        that.times--;
        if (that.times == 0) {
          that._cache = null;
        }
      }
    }
  };
  return CachingPartition;
});

