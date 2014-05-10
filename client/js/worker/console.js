define(["worker/stub"], function(Stub) {
  return new Stub({
    "promiseLog": "console/promiseLog",
    "fulfillLog": "console/fulfillLog"
  });
});
