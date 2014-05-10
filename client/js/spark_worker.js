define(["blockmanager", "worker"], function(BlockManager, Worker) {
  function SparkWorker(isMaster) {
    Worker.prototype.constructor.call(this, isMaster ? "js/master_worker.js" : "js/slave_worker.js");
    // Block Manager
    this.register({
      "blockmanager/get": function(key, wait, cb) {
        BlockManager.get(key, wait, cb);
      },
      "blockmanager/put": function(key, value, persist) {
        BlockManager.put(key, value, persist);
      }
    });

    //
  };

  SparkWorker.prototype = Object.create(Worker.prototype);
  SparkWorker.prototype.constructor = SparkWorker;

  return SparkWorker;
});
