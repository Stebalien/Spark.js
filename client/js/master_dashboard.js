"use strict";
define(["peer", "blockmanager", "jquery", "bootstrap", "underscore"], function(Peer, BlockManager, $, Bootstrap, _, console) {
  function MasterDashboard(peer) {
    this.peer = peer;
  }

  MasterDashboard.prototype = {
    Init: function() {
      var peer = this.peer;

      var me = this;
      peer.On('peer_join', function(other) {
        var socketID = other.remoteSocketID;
        var row = $('<tr></tr>').attr('id', 'peer-'+socketID);
        var socketIDCol = $('<td></td>');
        socketIDCol.text(socketID);
        row.append(socketIDCol);
        $('#peer-list').append(row);
      }.bind(this));
      peer.On('peer_leave', function(other) {
        var socketID = other.remoteSocketID;
        $('#peer-list #peer-' + socketID).remove();
      }.bind(this));
    }
  };

  return MasterDashboard;
});


