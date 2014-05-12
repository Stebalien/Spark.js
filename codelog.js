var _ = require('underscore');

function JobCodeLog(jobID) {
  this.jobID = jobID;
  this.entries = {};
  this.minSeq = 0;
  this.pendingGets = {};
  this.results = {};
}

JobCodeLog.prototype = {
  AddEntry: function(entry) {
    if (entry.type == 'error') {
      return;
    }

    if (entry.type == 'code' || entry.type == 'result') {
      this.entries[entry.seq] = _.clone(entry);
      this.ProcessLog();
      return;
    }

    //throw new Error('Unknown entry type: ' + entry.type);
  },

  ProcessLog: function() {
    var currentMin = this.minSeq;
    var nextMin = this.GetMinSeq();

    for (var seq = currentMin; seq < nextMin; seq++) {
      var entry = this.entries[seq];
      if (entry.type == 'code') {
        this.entries[seq].value = this.ProcessCodeEntry(entry.value);
      } else if (entry.type == 'result') {
        this.entries[seq].value = this.ProcessResultEntry(entry);
        this.results[entry.id] = seq;
        this.RunCallbacks(entry.id);
      }
    }

    this.minSeq = nextMin;
  },

  ProcessCodeEntry: function(code) {
    return 'try {\n' + code + '\n} catch (__e__) {};\n'; 
  },

  ProcessResultEntry: function(entry) {
    var previousSeq = this.SeqOfPreviousResult(entry.seq); 
    var code = '';
    for (var seq = previousSeq + 1; seq < entry.seq; seq++) {
      code += this.entries[seq].value;
    }
    return code;
  },

  SeqOfPreviousResult: function(currentSeq) {
    for (var seq = currentSeq - 1; seq >= 0; seq--) {
      if (this.entries.type == 'result') {
        return seq;
      }
    }

    return seq;
  },

  // Get the seq number such that all entries with seq < it are in the log
  GetMinSeq: function() {
    for (var seq = this.minSeq; ; seq++) {
      if (!(seq in this.entries)) {
        return seq;
      } 
    }
    return seq;
  },

  RunCallbacks: function(maxId) {
    var pendingGets = this.pendingGets[maxId];
    if (_.isEmpty(pendingGets)) {
      return;
    }

    _.each(pendingGets, function(pendingGet) {
      pendingGet.callback(this._getValuesInRange(pendingGet.minId, maxId));
    }.bind(this));

    delete this.pendingGets[maxId];
  },

  GetInRange: function(minId, maxId, callback) {
    var maxSeq = this.results[maxId];
    console.log(this.results);
    console.log(minId, maxId);
    // Some seq entries are missing
    if (maxSeq === undefined || maxSeq > this.minSeq) {
      if (!(maxId in this.pendingGets)) {
        this.pendingGets[maxId] = [];
      }
      this.pendingGets[maxId].push({
        minId: minId,
        callback: callback
      });
      return;
    }
    console.log("Callback");
    callback(this._getValuesInRange(minId, maxId));
  },

  _getValuesInRange: function(minId, maxId) {
    var minSeq = this.results[minId];
    var maxSeq = this.results[maxId];
    var entries = {};
    for (var seq = minSeq; seq <= maxSeq; seq++) {
      entries[seq] = this.entries[seq];
    }
    return entries;
  }
};

function CodeLog() {
  this.jobCodeLogs = {};
}

CodeLog.prototype = {
  JobExists: function(jobID) {
    return jobID in this.jobCodeLogs;
  },

  CreateForJob: function(jobID) {
    this.jobCodeLogs[jobID] = new JobCodeLog(jobID);
    return this.jobCodeLogs[jobID];
  },

  AddEntry: function(jobID, entry) {
    if (!this.JobExists(jobID)) {
      //throw new Error('CodeLog for ' + jobID + ' does not exist. AddEntry failed.');
      return;
    }

    var codeLog = this.jobCodeLogs[jobID];
    codeLog.AddEntry(entry);
  },

  GetInRange: function(jobID, minId, maxId, callback) {
    if (!this.JobExists(jobID)) {
      //throw new Error('CodeLog for ' + jobID + ' does not exist. GetInRange failed.');
      return;
    }

    var codeLog = this.jobCodeLogs[jobID];
    codeLog.GetInRange(minId, maxId, callback);
  }
};

module.exports = CodeLog;
