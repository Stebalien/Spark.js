require.config({
  shim: {
    bootstrap: {
      deps: ['jquery'],
      exports: '$.fn.button'
    }
  },

  paths: {
    jquery: '/js/lib/jquery-2.1.0.min',
    bootstrap: '/js/lib/bootstrap.min',
    EventEmitter: '/js/lib/EventEmitter',
    underscore: '/js/lib/underscore',
    peer: '/js/peer',
    blockmanager: '/js/blockmanager'
  }
});

require(["peer", "blockmanager", "jquery", "bootstrap", "underscore"], function(Peer, BlockManager, $, Bootstrap, _, console) {
  $(document).ready(function() {
    var peer = new Peer();
    
    $('.btn').button();
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

      $('.peer-list').addClass('hidden');

      $('#disconnect_button')
        .prop('disabled', true);
    });

    peer.On('added_to_job', function() {
      $('#volunteer_button')
        .prop('disabled', true)
        .text('Connected');

      $('.peer-list').removeClass('hidden');

      $('#disconnect_button')
        .prop('disabled', false);
    });
  });
});


