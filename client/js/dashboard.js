require.config({
  paths: {
    jquery: 'lib/jquery-2.1.0.min',
    bootstrap: 'lib/bootstrap.min',
    EventEmitter: 'lib/EventEmitter'
  }
});

require(["peer", "blockmanager", "jquery", "bootstrap"], function(Peer, BlockManager, $, Bootstrap, console) {
  $(document).ready(function() {
    var peer = new Peer();
 
    $('.btn').button();
    $('#volunteer_button').click(function() {
      var btn = $(this);
      btn.button('loading');
      peer.Volunteer(btn.data('job-id'));
    });

    $('#disconnect_button').click(function() {
      peer.Disconnect();
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
  });
});

    //<script src="/client/js/peer.js"></script>
    //<script src="/client/js/blockmanager.js"></script>

