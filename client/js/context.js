define([ "manager", "goalmanager", "cachemanager", "blockmanager"],
function( Manager ,  GoalManager,   CacheManager ,  BlockManager ) {
  return {
    manager: Manager,
    gm: GoalManager,
    cm: CacheManager,
    bm: BlockManager,
    isMaster: self.isMaster // TODO!
  };
});
