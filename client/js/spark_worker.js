define(["worker"], function(Worker) {
  function SparkWorker(peer, isMaster) {
    Worker.prototype.constructor.call(this, isMaster ? "/js/master_worker.js" : "/js/slave_worker.js");
    // Block Manager
    this.register({
      "blockmanager/GetNow": function(key, cb) {
        peer.blockManager.GetNow(key, cb);
      },
      "blockmanager/Get": function(key, cb) {
        peer.blockManager.Get(key, cb);
      },
      "blockmanager/Delete": function(key) {
        peer.blockManager.Delete(key);
      },
      "blockmanager/Put": function(key, value, persist) {
        peer.blockManager.Put(key, value, persist);
      }
    });
  };

  SparkWorker.prototype = Object.create(Worker.prototype);
  SparkWorker.prototype.constructor = SparkWorker;

  return SparkWorker;
});
