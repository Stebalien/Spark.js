var Heap = require("heap");
var _ = require("underscore");

function Scheduler() {
  this.rdds = [];
  this.partitions = [];
  this.server = {
    blockManager: {
      blocks: {} // TODO
    }
  };
}

Scheduler.prototype = {
  AppendRDDs: function(rdds) {
    var that = this;
    var level = this.rdds.length;
    Array.prototype.push.apply(this.rdds, rdds);
    _.each(rdds, function(rdd) {
      _.each(rdd, function(partitionDesc) {
        var partition = {
          id: partitionDesc.id,
          level: level,
          isSink: false,
          refcount: 0,
          reduced: partitionDesc.reduced,
          children: _.values(_.pick(that.partitions, partitionDesc.dependencies)),
          parents: []
        };
        that.partitions[partition.id] = partition;
        _.each(partition.parents, function(part) {
          part.parents.push(partition);
        });
      });
      level++;
    });
  },
  CutFor: function(targets) {
    var assignments = {};
    var sourceAssignments = {};
    var that = this;
    var sinks = new Heap(function(a, b) {
      return b.level - a.level;
    });
    _.each(targets, function(id) {
      var sink = that.partitions[id];
      sink.refcount++;
      if (!sink.isSink) {
        sink.isSink = true;
        sinks.push(sink);
      } // else: Someone elses problem.
    });

    var cuts = [];

    while (!sinks.empty()) {
      var sink = sinks.pop();
      if (assignments[sink.id]) continue; // assigned
      if (sink.reduced) {
        var assigned = sink.children[0];
        if (assigned) {
          assigned.sinks.push(sink);
          continue;
        }
      }
      sink.isSink = true;
      var cut = {
        sinks: [sink],
        sources: []
      };
      cuts.push(cut);
      var node = sink;
      while (node.children.length > 0) {
        _.each(_.rest(node.children), function(s) {
          if (!s.isSink) {
            s.isSink = true;
            var assigned = assignments[s.id];
            if (!assigned) {
              sinks.push(s);
            } else {
              assigned.sinks.push(s);
            }
          }
          s.refcount++;
          cut.sources.push(s);
        });
        node = node.children[0]; // Guarenteed by loop condition.

        if (node.isSink) {
          node.refcount++;
          cut.sources.push(node);
          break;
        } else {
          var assigned = assignments[node.id];
          if (assigned) {
            node.isSink = true;
            assigned.sinks.push(node);
            node.refcount++;
            cut.sources.push(node);
            break;
          } else {
            if (node.reduced) {
              var child = node.children[0]; // there can only be one.
              var assigned = assignments[child.id];
              if (assigned) {
                assigned.sinks.push(node);
                cut.sources.push(node);
                node.isSink = true;
                node.refcount++;
                break;
              }
            }
            assignments[node.id] = cut;
          }
        }
      }
    }
    return cuts;
  }
};

function Cut() {
  this.sources = [];
  this.sinks = [];
}

(function test() {
  var schedule = require("./example-submission.json");
  var scheduler = new Scheduler();
  scheduler.AppendRDDs(schedule.rdds);
  var cuts = scheduler.CutFor(schedule.targets);
  _.each(cuts, function(cut) {
    console.log({
      sources: _.pluck(cut.sources, "id"),
      sinks: _.map(cut.sinks, function(s) { return _.pick(s, "id", "refcount"); })
    });
  });
})()
