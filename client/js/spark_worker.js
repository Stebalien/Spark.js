define(["worker"], function(Worker) {
  function SparkWorker(peer, isMaster) {
    Worker.prototype.constructor.call(this, isMaster ? "js/master_worker.js" : "js/slave_worker.js");
    // Block Manager
    this.register({
      "blockmanager/get": function(key, wait, cb) {
        peer.blockManager.get(key, wait, cb);
      },
      "blockmanager/put": function(key, value, persist) {
        peer.blockManager.put(key, value, persist);
      }
    });

    //
  };

  SparkWorker.prototype = Object.create(Worker.prototype);
  SparkWorker.prototype.constructor = SparkWorker;

  return SparkWorker;
});
