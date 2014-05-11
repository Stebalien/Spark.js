define(["underscore", "worker/rpc", "worker/rddmanager"], function(_, rpc, RDDManager) {
  var nextTaskId = 0;
  var nextRDD = 0;

  function Task(rdd) {
    this.rdd = rdd;
    this.submitted = false;
    this.id = nextTaskId++;
    this.expired = self.initializing && !self.outstandingTasks[taskId];
  }

  Task.prototype.collect = function collect(cb) {
    var taskContext = {
      sources: _.object(_.pluck(this.rdd.partitions, "id"), _.map(this.rdd.partitions, _.constant(true)))
    };
    this.rdd.coalesce(1).partitions[0].collect(taskContext, function(values) {
      cb(values);
    });
  };

  Task.prototype.submit = function submit() {
    if (this.submitted) return;
    this.submitted = true;

    var targets = _.pluck(this.rdd.partitions, "id");
    var rdds = [];
    var rdd;
    while (rdd = RDDManager.getRDD(nextRDD)) {
      nextRDD++;
      rdds.push(_.map(rdd.partitions, function(part) {
        return {
          id: part.id,
          persist: rdd.persistLevel,
          reduced: rdd.reducing,
          dependencies: _.pluck(part.dependencies, "id")
        };
      }));
    }

    rpc.call("submitTask", this.id, rdds, targets);
  };
  return Task;
});
