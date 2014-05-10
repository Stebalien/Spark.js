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
    EventEmitter: 'lib/EventEmitter',
    underscore: 'lib/underscore'
  }
});

require(["peer", "blockmanager", "jquery", "bootstrap", "underscore"], function(Peer, BlockManager, $, Bootstrap, _, console) {
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

    peer.On('newjobs', function(newJobs) {
      var jobs = newJobs.jobs;
      for (var jobID in jobs) {
        var item = $('<li></li>');
        var a = $('<a></a>');
        a.text(jobs[jobID].name);
        a.attr('data-job-id', jobID);
        a.attr('href', '#');
        a.attr('class', 'job-list-link');
        var badge = $('<span></span>');
        badge.attr('class', 'badge pull-right');
        badge.text(1);
        a.append(badge);
        item.append(a);

        jobs[jobID].job_list_item = item;
        jobList[jobID] = jobs[jobID];
        $('#job_list').append(item);
      }
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


