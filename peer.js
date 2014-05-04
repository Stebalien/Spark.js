var PING_INTERVAL = 1000;

var socket = io.connect('http://localhost', {'force new connection': true});

(function Ping() {
  setTimeout(Ping, PING_INTERVAL);
  socket.emit('ping');
})();

//socket.on('announce', function(data) {
  //console.log(data);
//});
