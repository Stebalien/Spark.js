define(["underscore", "util", "context"] function(_, util, ctx) {
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
      enumerable: false,
      configurable: false,
      get: function() {
        if (!computed) {
          value = fn();
          computed = true;
        }
        return value;
      }
    });
  }

  /* Partition */

  function Partition(rdd, index, dependencies) {
    if (!(this instanceof Partition)) {
      return new Partition(rdd, index, dependencies);
    }
    this.index = index;
    this.rdd = rdd;
    this.dependencies = Object.freeze(dependencies || []);
    Object.freeze(this);
  }


  Partition.prototype.iterate = function(processor) {
    this.rdd.iterate(this, processor);
  };

  Partition.prototype.getId = function() {
    this.rdd.id + "/" + this.index;
  };

  Partition.prototype.collect = function(cb) {
    var values = [];
    this.iterate(this, {
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
    setattr(RDD.prototype, name, fn);
  });

  setattr(RDD, "extend", function(name, fn) {
    setattr(RDD.prototype, name, fn);
  });

  setattr(RDD, "extendStatic", function(name, fn) {
    setattr(RDD, name, fn);
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
      //Object.freeze(this);
    };

    RDDImpl.prototype = Object.create(RDD.prototype);
    RDDImpl.constructor = RDDImpl;

    return RDDImpl;
  });

  RDD.extend("iterate", function(partition, processor) {
    if (partition.rdd.id !== this.id) {
      throw new Error("Cannot compute another RDD's partition");
    }
    if (ctx.gm.isSource(partition.getId())) {
      // Someone elses problem (probably!).
      ctx.gm.getOrCompute(partition, processor);
    } else if (rdd.persistLevel > 0) {
      // Try to get it from the cache.
      ctx.cm.getOrCompute(partition, processor);
    } else {
      // Just compute it.
      rdd.compute(partition, processor);
    }
  });

  RDD.extend("persist", function(n) {
    this.persistLevel = n || 1;
    return this;
  });

  RDD.extend("drive", function() {
    this.persist();
  });

  if (ctx.isMaster) {
    RDD.extend("_submit", function() {
      ctx.master.submit(this.partitions);
    });
    RDD.extend("_collect", function(callback) {
      ctx.console.status("Collecting data...");
      // Do the actual coalesce on this node (submit the parent).
      // XXX: Cyclic dependency. Not a real problem but still grrr...
      this._submit().coalesce(1).partitions[0].collect(function(values) {
        ctx.console.clearStatus();
        callback(values);
      });
    });
  } else {
    // Nop these on the client.
    RDD.extend("_collect", function(callback) {});
    RDD.extend("_submit", function(callback) {});
  }

  Object.defineProperty(RDD.prototype, "partitions", {
    __proto__: null,
    writable: false,
    enumerable: true,
    configurable: false,
    get: function() {
      return ctx.cm.getOrComputePartitions(this);
    }
  });

  return RDD;
});
