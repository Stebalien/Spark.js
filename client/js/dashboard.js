define(["peer", "blockmanager", "jquery", "bootstrap", "underscore"], function(Peer, BlockManager, $, Bootstrap, _, console) {
  function Dashboard(peer) {
    this.peer = peer;
  }

  Dashboard.prototype = {
    Init: function() {
      var peer = this.peer;

      $('.btn').button();
      $('#volunteer_button').button('loading');

      $('#volunteer_button').click(function() {
        var btn = $(this);
        btn.button('loading');
        peer.Volunteer();
      });

      $('#disconnect_button').click(function() {
        var btn = $(this);
        peer.DisconnectFromJob();
        $('#volunteer_button')
          .prop('disabled', false)
          .button('reset');

      $('#disconnect_button')
        .prop('disabled', true);
      });

      peer.On('added_to_job', function() {
        $('#volunteer_button')
          .prop('disabled', true)
          .text('Connected');

        $('#disconnect_button')
          .prop('disabled', false);
      });
    }
  };

  return Dashboard;
});


