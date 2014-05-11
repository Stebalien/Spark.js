var _ = require('underscore');

function JobCodeLog(jobID) {
  this.jobID = jobID;
  this.entries = {};
  this.minSeq = 0;
  this.pendingGets = {};
}

JobCodeLog.prototype = {
  AddEntry: function(entry) {
    if (entry.type == 'error') {
      return;
    }

    if (entry.type == 'code' || entry.type == 'result') {
      this.entries[entry.seq] = entry;
      this.ProcessLog();
      return;
    }

    throw new Error('Unknown entry type: ' + entry.type);
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
      }
      this.RunCallbacks(seq);
    }

    this.minSeq = nextMin;
  },

  ProcessCodeEntry: function(code) {
    return 'try {\n' + code + '\n} catch () {};\n'; 
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

  RunCallbacks: function(maxSeq) {
    var pendingGets = this.pendingGets[maxSeq];
    if (_.isEmpty(pendingGets)) {
      return;
    }

    _.each(pendingGets, function(pendingGet) {
      pendingGet.callback(this.GetValuesInRange(pendingGet.minSeq, maxSeq));
    }.bind(this));

    delete this.pendingGets[maxSeq];
  },

  GetInRange: function(minSeq, maxSeq, callback) {
    // Some seq entries are missing
    if (maxSeq <= this.minSeq) {
      if (!(maxSeq in this.pendingGets)) {
        this.pendingGets[maxSeq] = [];
      }
      this.pendingGets[maxSeq].push({
        minSeq: minSeq,
        callback: callback
      });
      return;
    }

    callback(this.GetValuesInRange(minSeq, maxSeq));
  },

  GetValuesInRange: function(minSeq, maxSeq) {
    var entries = [];
    for (var seq = minSeq; seq <= maxSeq; seq++) {
      entries.push(this.entries[seq].value);
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
      throw new Error('CodeLog for ' + jobID + ' does not exist. AddEntry failed.');
    }

    var codeLog = this.jobCodeLogs[jobID];
    codeLog.AddEntry(entry);
  },

  GetInRange: function(jobID, minSeq, maxSeq, callback) {
    if (!this.JobExists(jobID)) {
      throw new Error('CodeLog for ' + jobID + ' does not exist. GetInRange failed.');
    }

    var codeLog = this.jobCodeLogs[jobID];
    codeLog.GetInRange(minSeq, maxSeq, callback);
  }
};

module.exports = CodeLog;
