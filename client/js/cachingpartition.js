define(["rdd/rdd", "underscore"], function(RDD, _) {
  function CachingPartition(parent, times) {
    if (!(this instanceof RDD.Partition)) {
      return new CachingPartition(parent);
    }
    this.parent = parent;
    this._cache = null;
    this._processors = null;
    this.times = times;
  }

  CachingPartition.prototype = Object.create(RDD.Partition.prototype);
  CachingPartition.prototype.constructor = CachingPartition;

  Object.defineProperty(CachingPartition.prototype, "index", {
    __proto__: null,
    get: function() { return this.parent.index; },
    set: function(value) { return this.parent.index = value; }
  });

  Object.defineProperty(CachingPartition.prototype, "rdd", {
    __proto__: null,
    get: function() { return this.parent.rdd; },
    set: function(value) { return this.parent.rdd = value; }
  });

  Object.defineProperty(CachingPartition.prototype, "dependencies", {
    __proto__: null,
    get: function() { return this.parent.dependencies; },
    set: function(value) { return this.parent.dependencies = value; }
  });

  CachingPartition.prototype.iterate = function(processor) {
    var that = this;
    // TODO: Not quite working with sort!

    // We're first!
    if (!that._cache) {
      that._cache = [];
      that._processors = [processor];
      var idx = 0;
      that.parent.iterate({
        process: function(item) {
          var i;
          for (i = 0; i < that._processors.length; i++) {
            that._processors[i].process(item);
          }
          // cache it.
          if (i < that.times) {
            that._cache[idx] = {value: item, times: that.times - i};
          }
          idx++;
        },
        done: function() {
          var procs = that._processors;
          that._processors = null;
          _.each(procs, function(proc) {
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
        that.times--;
        if (that.times == 0) {
          that._cache = null;
        }
        processor.done();
      }
    }
  };
  return CachingPartition;
});

