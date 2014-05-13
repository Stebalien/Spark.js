"use strict";
// TODO: Sign up as master (not slave)
define(function() {
  function MasterTaskManager(peer) {
    this.peer = peer;
  }

  MasterTaskManager.prototype.submitTask = function submitTask(id, rdds, targets) {
    this.peer.Call('submit_task', {
      id: id,
      rdds: rdds,
      targets: targets
    });
  };
  return MasterTaskManager;
});
