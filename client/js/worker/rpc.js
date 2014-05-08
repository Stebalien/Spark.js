define(["rpc", "worker/port"], function(RPC, port) {
  return new RPC(port);
});
