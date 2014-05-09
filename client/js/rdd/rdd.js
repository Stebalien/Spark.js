define(["underscore", "util", "context"], function(_, util, ctx) {
  var idCounter = 0;

  function setattr(obj, name, fn) {
    Object.defineProperty(obj, name, {
      __proto__: null,
      writable: false,
      enumerable: false,
      configurable: false,
      value: fn
    });
  }

  function setattrLazy(cls, name, fn) {
    var computed = false;
    var value = null;
    Object.defineProperty(cls.prototype, name, {
      __proto__: null,
      writable: false,
      enumerable: enumerable || false,
      configurable: false,
      get: function() {
        if (!computed) {
          value = fn();
          computed = true;
        }
        return value;
      }
    }, enumerable);
  }

  /* Partition */

  function Partition(rdd, index, dependencies) {
    if (!(this instanceof Partition)) {
      return new Partition(rdd, index, dependencies);
    }
    this.index = index;
    if (!(rdd instanceof RDD)) {
      // Use the real rdd if passed an rdd context.
      rdd = rdd.__rdd__;
    }
    this.rdd = rdd;
    if (!_.isArray(dependencies)) {
      dependencies = [dependencies];
    }
    this.dependencies = Object.freeze(dependencies || []);
    Object.freeze(this);
  }


  Partition.prototype.iterate = function(taskContext, processor) {
    return this.rdd.iterate(taskContext, this, processor);
  };

  Partition.prototype.getId = function() {
    return this.rdd.id + "/" + this.index;
  };

  Partition.prototype.collect = function(taskContext, cb) {
    var values = [];
    return this.iterate(taskContext, {
      process: function(item) {
        values.push(item);
      },
      done: function() {
        cb(values);
      }
    });
  };

  /* RDD */

  function RDD() {
    throw new Error("Abstract RDD cannot be instantiated.");
  }

  setattr(RDD, "extend", function(name, fn) {
    return setattr(RDD.prototype, name, fn, true);
  });

  setattr(RDD, "extendStatic", function(name, fn) {
    return setattr(RDD, name, fn, true);
  });

  RDD.extendStatic("Partition", Partition);

  RDD.extendStatic("implement", function(description) {
    function RDDContext(args) {
      this.init.apply(this, args);
    }

    RDDContext.prototype = description;
    RDDContext.prototype.constructor = RDDContext;

    function RDDImpl() {
      if (!(this instanceof RDD)) {
        var rdd = Object.create(RDDImpl.prototype);
        RDDImpl.apply(rdd, args);
        return rdd;
      }
      this.id = idCounter++; // Predictable, unique ID.
      ctx.cm.registerRDD(this);
      this.__description__ = new RDDContext(arguments);
      this.__description__.__rdd__ = this;
      // Immutable (to make it deterministic and to avoid interference).
      util.deepFreeze(this);
    };

    RDDImpl.prototype = Object.create(RDD.prototype);
    RDDImpl.constructor = RDDImpl;

    return RDDImpl;
  });

  function splatProcess(processors) {
    return {
        process: function(item) {
          var i;
          for (i = 0; i < processors.length; i++) {
            processors[i].process(item);
          }
        },
        done: function() {
          while (processors.length > 0) {
            // cleanup references.
            processors.shift().done();
          }
        }
    };
  };

  RDD.extend("iterate", function(taskContext, partition, processor) {
    if (partition.rdd.id !== this.id) {
      throw new Error("Cannot compute another RDD's partition");
    }

    if (!taskContext.processorsFor) {
      taskContext.processorsFor = {};
    }

    var partId = partition.getId();
    var processors = taskContext.processorsFor[partId];

    if (!taskContext.processorsFor[partId]) {
      processors = taskContext.processorsFor[partId] = [processor];
      var intermediate = splatProcess(processors);
      if (ctx.gm.isSource(partition)) {
        // Someone elses problem (probably!).
        ctx.gm.getOrCompute(taskContext, partition, intermediate);
      } else if (this.persistLevel > 0) {
        // Try to get it from the cache.
        ctx.cm.getOrCompute(taskContext, partition, intermediate);
      } else {
        // Just compute it.
        this.__description__.compute(taskContext, partition, intermediate);
      }
    } else {
      processors.push(processor);
    }
  });

  RDD.extend("persist", function(n) {
    this.persistLevel = n || 1;
    return this;
  });

  if (ctx.isMaster) {
    RDD.extend("_submit", function() {
      /* TODO: NOPPED until we get the scheduler working (compute locally for now).
      ctx.master.submit(this.partitions);
      */
     return this;
    });
    RDD.extend("_collect", function(callback) {
      // Do the actual coalesce on this node (submit the parent).
      // XXX: Cyclic dependency. Not a real problem but still grrr...
      this._submit().coalesce(1).partitions[0].collect({}, function(values) {
        callback(values);
      });
    });
  } else {
    // Nop these on the client.
    RDD.extend("_collect", function(callback) {});
    RDD.extend("_submit", function(callback) {});
  }

  var partitionCache = [];
  Object.defineProperty(RDD.prototype, "partitions", {
    __proto__: null,
    enumerable: true,
    get: function() {
      var partitions = partitionCache[this.id];
      if (!partitions) {
        partitions = partitionCache[this.id] = this.__description__.getPartitions();
      }
      return partitions;
    }
  });

  return RDD;
});
