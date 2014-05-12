define(["peer", "blockmanager", "jquery", "bootstrap", "underscore"], function(Peer, BlockManager, $, Bootstrap, _, console) {
  function MasterDashboard(peer) {
    this.peer = peer;
    this.peerList = {};
    this.nextID = 1;
  }

  MasterDashboard.prototype = {
    Init: function() {
      var peer = this.peer;

      var me = this;
      peer.On('ondatachannel', function(sockets) {
        var socketID = sockets.remoteSocketID;
        var row = $('<tr></tr>');
        var peerIDCol = $('<td></td>');
        var socketIDCol = $('<td></td>');

        var peerID = me.nextID++;
        peerIDCol.text(peerID);
        socketIDCol.text(socketID);

        row.append($('<td></td>'));
        row.append(peerIDCol);
        row.append(socketIDCol);
        row.append($('<td><span class="label label-success">Connected</span></td>'));

        this.peerList[peerID] = row;
        $('#peer-list').append(row);
      }.bind(this));
    }
  };

  return MasterDashboard;
});


