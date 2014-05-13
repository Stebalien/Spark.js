var Heap = require("heap");
var _ = require("underscore");

//http://stackoverflow.com/a/3955096
Array.prototype.remove = function() {
    var what, a = arguments, L = a.length, ax;
    while (L && this.length) {
        what = a[--L];
        while ((ax = this.indexOf(what)) !== -1) {
            this.splice(ax, 1);
        }
    }
    return this;
};

function Scheduler(server, job) {
  this.rdds = [];
  this.partitions = [];
  this.peersToTasks = {};
  this.dataToPeers = {};
  this.job = job;
  this.server = server;
  this.latestId = -1;
  this.pendingTasks = [];
  this.toSchedule = [];
  this.job.On('join', function(peer) {
    this.OnAddPeer(peer);
  }.bind(this));
  this.job.On('leave', function(peer) {
    this.OnRemovePeer(peer);
  }.bind(this));
}

Scheduler.prototype = {
  OnAddPeer: function(peer) {
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
    // TODO: Steal work?
  },

  UpdateCodeVersion: function(id) {
    if (id > this.latestId) {
      this.latestId = id;
    }
  },

  GetPeerData: function(peer) {
    return this.peersToTasks[peer.id] || (this.peersToTasks[peer.id] = { tasks: [], load: 0 });
  },
  OnRemovePeer: function(peer) {
    var data = this.GetPeerData(peer);
    if (!data) {
      return;
    }
    delete this.peersToTasks[peer.id];
    _.each(data.tasks, function(task) {
      _.each(task.sinks, function(sink) {
        delete this.dataToPeers[sink.id];
      }, this);
      this.AssignTask(task);
    }, this);
  },
  AssignTask: function(task) {
    if (this.job.volunteers.length < 2) {
      this.pendingTasks.push(task);
      return;
    }

    var peer = _.min(_.rest(this.job.volunteers), function(p) {
      return p.load;
    });
    if (!peer) {
      this.pendingTasks.push(task);
      return;
    }
    peer.load += task.size;
    this.GetPeerData(peer).tasks.push(task);
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
      sinks: _.pluck(task.sinks, "id"),
      id: this.latestId
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
      if (sink.refcount === 1) {
        sinks.push(sink);
      } // else: Someone elses problem.
    });

    var cuts = [];

    while (!sinks.empty()) {
      var sink = sinks.pop();
      if (assignments[sink.id]) continue; // assigned
      if (sink.reduced) {
        var assigned = assignments[sink.children[0].id]; // There must be only 1.
        if (assigned) {
          assigned.sinks.push(sink);
          continue;
        }
      }
      var cut = {
        sinks: [sink],
        sources: [],
        size: 0
      };
      cuts.push(cut);
      var node = sink;
      while (node.children.length > 0) {
        _.each(_.rest(node.children), function(s) {
          s.refcount++;
          if (s.refcount === 1) {
            // Doesn't already exist
            var assigned = assignments[s.id];
            if (!assigned) {
              sinks.push(s);
            } else {
              assigned.sinks.push(s);
            }
          }
          cut.sources.push(s);
        });
        node = node.children[0]; // Guarenteed by loop condition.

        if (node.refcount > 0) {
          node.refcount++;
          cut.sources.push(node);
          break;
        } else {
          var assigned = assignments[node.id];
          if (assigned) {
            node.refcount++;
            assigned.sinks.push(node);
            cut.sources.push(node);
            break;
          } else {
            if (node.reduced) {
              var child = node.children[0]; // there can only be one.
              var assigned = assignments[child.id];
              if (assigned) {
                assigned.sinks.push(node);
                cut.sources.push(node);
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
    /*
    console.log(_.map(schedule, function(cut) {
      return {
        sources: _.pluck(cut.sources, "id"),
        sinks: _.pluck(cut.sinks, "id")
      };
    }));
    */
    _.each(schedule, function(task) {
      this.AssignTask(task);
    }, this);
  },
  GetSchedule: function(targets, n) {
    //console.log("scheduling...", n, targets);
    var cuts = this.CutFor(targets);
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
      var dependencies = _.values(_.pick(sourceToCut, _.pluck(smallCut.sources, "id")));
      if (dependencies.length === 0) {
        leftovers.push(smallCut);
        continue;
      }
      var minSourceCut = _.min(dependencies, function(v) {
        return v.size;
      });
      minSourceCut.size += smallCut.size;
      // merge sources.
      _.each(smallCut.sources, function(s) {
        if (_.contains(minSourceCut.sources, s)) {
          s.refcount--;
        } else {
          minSourceCut.sources.push(s);
        }
      });
      // Merge sinks.
      Array.prototype.push.apply(minSourceCut.sinks, smallCut.sinks); // Overlap impossible.
      // Get rid of sourc-sink pairs.
      minSourceCut.sources = _.filter(minSourceCut.sources, function(s) {
        // It's my sink!
        if (_.contains(minSourceCut.sinks, s)) {
          s.refcount--;
          if (s.refcount === 0) {
            minSourceCut.sinks.remove(s);
          }
          return false;
        } else {
          return true;
        }
      });
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
