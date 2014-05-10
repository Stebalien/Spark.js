define(["underscore", "worker/rpc"], function(_, rpc) {
  return function Stub(desc) {
    var that = this;
    _.each(desc, function(remote, local) {
      that[local] = function() {
        var args = Array.prototype.slice.call(arguments, 0);
        args.unshift(remote);
        rpc.call.apply(rpc, args);
      };
    });
  };
});
