"use strict";
define(["rdd/rdd", "underscore"], function(RDD, _) {
  var CoalescedRDD = RDD.implement({
    init: function(parent, partitions) {
      this.parent = parent;
      this.requestedPartitions = partitions || 1;
    },
    getPartitions: function() {
      var that = this;
      var parentPartitions = that.parent.partitions;
      if (this.requestedPartitions >= parentPartitions.length) {
        return _.map(parentPartitions, function(part, i) {
          return new RDD.Partition(that, i, [part]);
        });
      }
      var size = parentPartitions.length/this.requestedPartitions;
      var minSize = Math.floor(size);
      var remainder = size-minSize;

      var idx = 0;
      var slack = 0;
      return _.map(_.range(0, this.requestedPartitions), function(i) {
        var oldIdx = idx;
        idx += minSize;
        slack += remainder;
        if (slack >= 1) {
          // take up the slack.
          slack -= 1;
          idx++;
        }
        return new RDD.Partition(that, i, parentPartitions.slice(oldIdx, idx));
      });
    },
    compute: function(taskContext, partition, processor) {
      // Launch sub partitions in parallel but return results in-order.
      // Where possible, avoid caching intermediates.
      var victim = 0;
      var cache = [];
      _.each(partition.dependencies, function(part, i) {
        var lcache = null;
        part.iterate(taskContext, {
          process: function(item) {
            if (victim === i) {
              if (lcache && lcache.length > 0) {
                _.each(lcache, function(item) {
                  processor.process(item);
                });
                lcache = null;
              }
              processor.process(item);
            } else {
              if (!lcache) {
                lcache = [];
              }
              lcache.push(item);
            }
          },
          done: function() {
            if (victim === i) {
              // I'm the victim.

              // Empty my cache first if it has any items.
              if (lcache && lcache.length) {
                _.each(lcache, function(item) {
                  processor.process(item);
                });
                lcache = null;
              }
              // Empty other caches (but maintian control of the victim pointer).
              var localVictim = victim;
              while (cache[++localVictim]) {
                _.each(cache[localVictim], processor.process);
                cache[localVictim] = null;
              }
              // now we can give up control.
              victim = localVictim;
              if (victim === partition.dependencies.length) {
                // All done.
                processor.done();
              }
            } else {
              // Not the victim. Store my cache.
              cache[i] = lcache || [];
            }
          }
        });
      });
    }
  });

  RDD.extend("coalesce", function(width) {
    return new CoalescedRDD(this, width);
  });

  return CoalescedRDD;
});

