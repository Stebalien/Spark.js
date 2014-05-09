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
