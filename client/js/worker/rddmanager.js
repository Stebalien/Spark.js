define(function() {
  var rddCache = []; // It's sparse anyways...
  var idCounter = 0;
  var RDDManager = {
    getNextId: function() {
      return idCounter++;
    },
    skipIds: function(n) {
      idCounter += n;
    },
    getRDD: function(id) {
      return rddCache[id];
    },
    getPartition: function(id) {
      var pieces = id.split("/");
      var rdd = this.getRDD(parseInt(pieces[0], 10));
      return rdd && rdd.partitions[parseInt(pieces[1], 10)];
    },
    registerRDD: function(rdd) {
      rddCache[rdd.id] = rdd;
    },
  };
  return RDDManager;
});
