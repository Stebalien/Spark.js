define(["underscore", "worker/stub"], function(_, Stub) {
  return new Stub({
    "put": "blockmanager/put",
    "get": "blockmanager/get"
  });
});
