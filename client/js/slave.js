define(function() {

  function replay(update) {
    rdds
  }

  var manager = {};

  var committedRdds = [];
  var cachedCode = ""
  var nextRDD = 0;

  function submitCode(code) {
    cachedCode += code;
  }

  function submit(rdd) {
    var toPush = {
      code: cachedCode,
      rdds: [],
      drive: rdd.id
    };
    cachedCode = "";
    while (rdd = CacheManager.getRDD(nextRDD)) {
      nextRDD++;
      toPush.rdds.push(rdd)
    }
  }
});
