require.config({
  shim: {
    bootstrap: {
      deps: ['jquery'],
      exports: '$.fn.button'
    }
  },

  paths: {
    jquery: 'lib/jquery-2.1.0.min',
    bootstrap: 'lib/bootstrap.min',
    EventEmitter: 'lib/EventEmitter'
  }
});

require(["peer", "blockmanager", "jquery", "bootstrap"], function(Peer, BlockManager, $, Bootstrap, console) {
  $(document).ready(function() {
    var peer = new Peer();
    var jobList = {};
    
    $('.btn').button();
    $('#volunteer_button').click(function() {
      var btn = $(this);
      btn.button('loading');
      peer.Volunteer(btn.data('job-id'));
    });

    $('#disconnect_button').click(function() {
      var btn = $(this);
      peer.DisconnectFromJob(btn.data('job-id'));
      $('#volunteer_button')
        .prop('disabled', false)
        .button('reset');

      $('.peer-list').addClass('hidden');

      $('#disconnect_button')
        .prop('disabled', true);
    });

    peer.On('new_job', function(jobID, jobName) {
      var item = $('<li></li>');
      var a = $('<a></a>');
      a.text(jobName);
      a.attr('data-job-id', jobID);
      a.attr('href', '#');
      a.attr('class', 'job-list-link');
      var badge = $('<span></span>');
      badge.attr('class', 'badge pull-right');
      badge.text(1);
      a.append(badge);
      item.append(a);

      jobList[jobID] = {
        job_list_item: item
      };
      $('#job_list').append(item);
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


