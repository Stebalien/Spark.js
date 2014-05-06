define(["context", "underscore"], function(ctx, _) {
  var cachedCode = "";
  var nextRDD = 0;
  var nextSeq = 0;

  function submitCode(code) {
    cachedCode += code;
  };

  function submit(partitions) {
    var msg = {
      seq: nextSeq++,
      code: cachedCode,
      targets: _.map(partitions, function(p) { p.getId() }),
      rdds: [],
    };
    cachedCode = "";
    // TODO: Could be more efficient...
    var rdd;
    while (rdd = ctx.cm.getRDD(nextRDD)) {
      nextRDD++;
      msg.rdds.push(_.map(rdd.partitions, function(part) {
        return {
          id: part.getId(),
          persist: rdd.persist,
          dependencies: _.map(part.dependencies, function(p) {
            p.getId();
          })
        };
      }));
    }
  };
  return {
    submitCode: submitCode,
    submit: submit
  };
});
