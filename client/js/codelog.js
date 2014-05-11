define(['underscore'], function(_) {

  function CodeLog(peer) {
    this.peer = peer;
    this.entries = {};
    this.minSeq = 0;
    this.pendingGets = {};
  }

  CodeLog.prototype = {
    AddEntries: function(entries) {
      _.each(entries, 'AddEntry', this);
      this.ProcessLog();
    },

    AddEntry: function(entry) {
      this.entries[entry.seq] = entry;
    },

    ProcessLog: function() {
      var currentMin = this.minSeq;
      var nextMin = this.GetMinSeq();

      for (var seq = currentMin; seq < nextMin; seq++) {
        this.RunCallbacks(seq);
      }

      this.minSeq = nextMin;
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
        this.GetFromServer(minSeq, maxSeq);
        return;
      }

      callback(this.GetValuesInRange(minSeq, maxSeq));
    },

    GetValuesInRange: function(minSeq, maxSeq) {
      var entries = {};
      for (var seq = minSeq; seq <= maxSeq; seq++) {
        entries[seq] = this.entries[seq];
      }
      return entries;
    },

    GetFromServer: function(minSeq, maxSeq) {
      var message = {
        jobID: this.peer.jobID,
        minSeq: minSeq,
        maxSeq: maxSeq
      };

      this.peer.socket.emit('codelog:get', message, function(entries) {
        this.AddEntries(entries);
      }.bind(this));
    }
  };

  return CodeLog;
});
