// TODO: Split into separate file.
require.config({
  shim: {
    underscore: {
      exports: '_'
    },
    'bootstrap/affix':      { deps: ['jquery'], exports: '$.fn.affix' }, 
    'bootstrap/alert':      { deps: ['jquery'], exports: '$.fn.alert' },
    'bootstrap/button':     { deps: ['jquery'], exports: '$.fn.button' },
    'bootstrap/carousel':   { deps: ['jquery'], exports: '$.fn.carousel' },
    'bootstrap/collapse':   { deps: ['jquery'], exports: '$.fn.collapse' },
    'bootstrap/dropdown':   { deps: ['jquery'], exports: '$.fn.dropdown' },
    'bootstrap/modal':      { deps: ['jquery'], exports: '$.fn.modal' },
    'bootstrap/popover':    { deps: ['jquery'], exports: '$.fn.popover' },
    'bootstrap/scrollspy':  { deps: ['jquery'], exports: '$.fn.scrollspy' },
    'bootstrap/tab':        { deps: ['jquery'], exports: '$.fn.tab'        },
    'bootstrap/tooltip':    { deps: ['jquery'], exports: '$.fn.tooltip' },
    'bootstrap/transition': { deps: ['jquery'], exports: '$.fn.transition' }
  },
  paths: {
    underscore: 'lib/underscore',
    jquery: 'lib/jquery-2.1.0.min',
    bootstrap: 'lib/bootstrap.min',
    EventEmitter: 'lib/EventEmitter'
  }
});

require(["underscore", "jquery", "console", "spark_worker", "util", "peer", "dashboard"],
function(_,             $      ,  Console,   SparkWorker ,   util,   Peer, Dashboard) {
  // TODO: Multiple workers.
  var peer = new Peer();
  var dashboard = new Dashboard(peer);
  $(document).ready(function() {
    dashboard.Init();
  });
  var w = new SparkWorker(peer, false); // Slave
  peer.On("connected", function(){
    peer.On("new_task", function(task) {
      w.call("schedule", task);

      peer.codeLog.GetCodeSinceLast(task.id, function(code) {
        for (var i = 0; i < code.length; i++) {
          w.call('exec', code[i]);
        }
      });
    });
    peer.On("remove_sources", function(sources) {
      //
      w.call("remove_sources", sources);
    });
    peer.On("remove_sinks", function(sinks) {
      // TODO: Garbage Collection
    });
  });
});
