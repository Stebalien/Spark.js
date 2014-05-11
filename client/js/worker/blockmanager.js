define(["underscore", "worker/stub"], function(_, Stub) {
  return new Stub({
    "Put": "blockmanager/Put",
    "Get": "blockmanager/Get",
    "GetNow": "blockmanager/GetNow",
    "Delete": "blockmanager/Dekete"
  });
});
