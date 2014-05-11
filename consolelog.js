var _ = require('underscore');

function ConsoleLog() {
  this.logs = {};
}

ConsoleLog.prototype = {
  Record: function(jobID, entry) {
    (this.logs[jobID] || (this.logs[jobID] = [])).push(entry);
  },
  Replay: function(jobID) {
    return this.logs[jobID];
  }
};

module.exports = ConsoleLog;
