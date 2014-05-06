define(["context", "underscore"], function(ctx, _) {
  function applyUpdate(update) {
    _.each(update["newSources"], function(id) {
      ctx.gm.addSource(id);
    });
    _.each(update["removedSources"], function(id) {
      ctx.gm.removeSource(id);
    });
    _.each(update["newSinks"], function(id) {
      ctx.gm.addSink(id);
    });
    _.each(update["removeSinks"], function(id) {
      ctx.gm.removeSink(id);
    });
  }
  return {
    // Stuff
  };
});
