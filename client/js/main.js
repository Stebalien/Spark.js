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

require(["underscore", "jquery", "console", "worker"],
function(_,             $      ,  Console,   Worker) {
  function toURL(text) {
    var blob = new Blob([text]);
    return URL.createObjectURL(blob);
  };
  $(document).ready(function() {
    var c = new Console($(".repl"));
    var w = new Worker('js/spark_worker.js#master');
    c.on('exec', function() {
      c.lock();
      var text = c.getText();
      w.call("exec", toURL(text), function(result) {
        c.clearError();
        switch(result.status) {
          case "success":
            c.displayCode(text, "javascript");
            c.setText("");
            break;
          case "invalid_syntax":
            c.setError(result.error);
            break;
          case "error":
            c.displayCode(text, "javascript");
            c.setText("");
            c.displayError(result.error);
        }
        c.unlock()
      });
    });
  });
});
