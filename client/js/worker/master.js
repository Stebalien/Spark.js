define(["worker/rpc", "worker/rddmanager", "underscore"], function(rpc, RDDManager, _) {
  var nextRDD = 0;

  function submit(partitions) {
    var targets = _.pluck(partitions, "id")
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
    rpc.call("submitTask", rdds, targets);
  };
  return {
    submit: submit
  };
});
