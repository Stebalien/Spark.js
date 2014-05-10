// TODO: Sign up as master (not slave)
define(["peer"], function(peer) {
  var cachedCode = "";

  function submitTask(rdds, targets) {
    peer.submitTask({
      code: cachedCode,
      rdds: rdds,
      targets: targets
    });
    cachedCode = "";
  };

  function recordCode(code) {
    cachedCode += "try {\n" + code + "\n} catch (_ignore_) { };\n";
  };
  return {
    recordCode: recordCode,
    submitTask: submitTask
  };
});
