var Heap = require("heap");
var _ = require("underscore");

function Scheduler(server, job) {
  this.rdds = [];
  this.partitions = [];
  this.peersToTasks = {};
  this.dataToPeers = {};
  this.job = job;
  this.server = server;
  this.pendingTasks = [];
  this.toSchedule = [];
  this.job.On('join', function(peer) {
    this.OnAddPeer(peer);
    var pending = this.pendingTasks;
    this.pendingTasks = [];
    _.each(pending, function(task) {
      this.AssignTask(task);
    }, this);
    if (this.toSchedule.length) {
      var toSchedule = this.toSchedule;
      this.toSchedule = [];
      this.DriveTasks(toSchedule);
    }
    // TODO: Steal work.
  }.bind(this));
  this.job.On('leave', function(peer) {
    this.OnRemovePeer(peer);
  }.bind(this));
}

Scheduler.prototype = {
  OnAddPeer: function(peer) {
    this.peersToTasks[peer.id] = {
      tasks: [],
      load: 0
    };
  },
  OnRemovePeer: function(task) {
    var tasks = this.peersToTasks[peer.id];
    delete this.peersToTasks[peer.id];
    _.each(function(task) {
      _.each(task.sinks, function(sink) {
        delete this.dataToPeers[sink.id];
      }, this);
      this.AssignTask(task);
    }, this);
  },
  AssignTask: function(task) {
    var peer = _.min(_.rest(this.job.volunteers), function(p) {
      return p.load;
    });
    if (!peer) {
      this.pendingTasks.push(task);
      return;
    }
    peer.load += task.size;
    this.peersToTasks[peer.id].tasks.push(task);
    var todo = {};
    _.each(task.sinks, function(s) {
      this.dataToPeers[s.id] = peer;
      todo[s.id] = true;
      // Reduce load.
      this.server.blockManager.Get(this.job.id, s.id, function() {
        delete todo[s.id];
        if (_.size(todo) === 0) {
          peer.load -= task.size;
        }
      });
    }, this);
    this.server.SendToPeer(peer, 'new_task', {
      sources: _.pluck(task.sources, "id"),
      sinks: _.pluck(task.sinks, "id")
    });
  },
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
        sources: [],
        size: 0
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
    _.each(assignments, function(cut) {
      cut.size++;
    });
    return cuts;
  },
  DriveTasks: function(targets) {
    var npeers = this.job.volunteers.length-1;
    if (npeers < 1) {
      Array.prototype.push.apply(this.toSchedule, targets);
      return;
    }
    var schedule = this.GetSchedule(targets, this.job.volunteers.length-1)
    console.log(_.map(schedule, function(cut) {
      return {
        sources: _.pluck(cut.sources, "id"),
        sinks: _.pluck(cut.sinks, "id")
      };
    }));
    _.each(schedule, function(task) {
      this.AssignTask(task);
    }, this);
  },
  GetSchedule: function(targets, n) {
    console.log("scheduling...", n, targets);
    var cuts = this.CutFor(targets);
    /*
    console.log(_.map(cuts, function(cut) {
      return {
        sources: _.pluck(cut.sources, "id"),
        sinks: _.pluck(cut.sinks, "id")
      };
    }));
    */
    var heap = new Heap(function(c) { return -c.size; });
    var sourceToCut = {};
    var sinkToCut = {};

    _.each(cuts, function(cut) {
      _.each(cut.sinks, function(sinks) {
        sourceToCut[sinks.id] = cut;
      });
      heap.push(cut);
    });
    var leftovers = [];
    while (heap.size() > 0 && (heap.size()+leftovers) > n) {
      var smallCut = heap.pop();
      var minSourceCut = _.min(_.values(_.pick(sourceToCut, _.pluck(smallCut.sources, "id"))), function(v) {
        return v.size;
      });
      if (!minSourceCut) {
        leftovers.push(smallCut);
        continue;
      }
      minSourceCut.size += smallCut.size;
      // Dumb but should work.
      minSourceCut.sources = _.union(minSourceCut.sources, smallCut.sources);
      minSourceCut.sinks = _.union(minSourceCut.sinks, smallCut.sinks);
      minSourceCut.sources = _.difference(minSourceCut.sources, minSourceCut.sinks);
      heap.updateItem(minSourceCut);
    }
    cuts = leftovers.concat(heap.toArray());
    var dests  = _.object(targets, _.map(targets, _.constant(true)));
    _.each(cuts, function(cut) {
      _.each(cut.sources, function(s) {
        dests[s.id] = true;
      });
    });
    var matcher = _.matches(dests);
    _.each(cuts, function(cut) {
      cut.sinks = _.filter(cut.sinks, function(s) {
        return dests[s.id];
      });
    });
    return _.sortBy(cuts, function(cut) {
      return _.min(_.pluck(cut.sinks, "level"));
    });
  }
};

function Cut() {
  this.sources = [];
  this.sinks = [];
}

module.exports = Scheduler;
