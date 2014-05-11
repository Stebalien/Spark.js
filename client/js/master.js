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

require(["underscore", "jquery", "console", "spark_worker", "util", "mastertaskmanager", "peer"],
function(_,             $      ,  Console,   SparkWorker ,   util,   MasterTaskManager, Peer) {

  var peer = new Peer();
  var taskManager = new MasterTaskManager(peer);

  $(document).ready(function() {
    var c = new Console($(".repl"));
    var worker = new SparkWorker(peer, true);

    var promisedLogLines = [];
    worker.register({
      "console/promiseLog": function(id) {
        promisedLogLines[id] = c.promiseLog();
      },
      "console/fulfillLog": function(id, obj) {
        promisedLogLines[id](obj);
      },
      "submitTask": function(rdds, targets) {
        taskManager.submitTask(rdds, targets);
      }
    });
    c.on('exec', function() {
      c.lock();
      var text = c.getText();
      worker.call("exec", util.toURL(text), function(status, error) {
        c.clearError();
        switch(status) {
          case "success":
            c.displayCode(text);
            taskManager.recordCode(text);
            c.setText("");
            break;
          case "invalid_syntax":
            c.setError(error);
            break;
          case "error":
            c.displayCode(text);
            c.setText("");
            taskManager.recordCode(text);
            c.displayError(error);
        }
        c.unlock()
      });
    });
  });
});
