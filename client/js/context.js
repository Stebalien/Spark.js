define(["worker/rpc", "manager", "goalmanager", "cachemanager", "blockmanager"],
function(rpc,          Manager ,  GoalManager,   CacheManager ,  BlockManager ) {
  var ctx = {
    manager: Manager,
    gm: GoalManager,
    cm: CacheManager,
    bm: BlockManager,
    isMaster: location.hash === "#master"
  };
  if (ctx.isMaster) {
    ctx.console = {
      promiseLog: function(id) {
        rpc.call("promiseLog", id);
      },
      fulfillLog: function(id, obj) {
        rpc.call("fulfillLog", id, obj);
      }
    };
  }
  return ctx;
});
