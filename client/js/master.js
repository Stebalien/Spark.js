"use strict";
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
    underscore: '/js/lib/underscore',
    jquery: '/js/lib/jquery-2.1.0.min',
    bootstrap: '/js/lib/bootstrap.min',
    EventEmitter: '/js/lib/EventEmitter'
  }
});

require(["underscore", "jquery", "console", "spark_worker", "util", "mastertaskmanager", "peer", "master_dashboard"],
function(_,             $      ,  Console,   SparkWorker ,   util,   MasterTaskManager, Peer, MasterDashboard) {

  var peer = Peer.CreateMaster();
  var taskManager = new MasterTaskManager(peer);
  peer.On('master_ready', function() {
    peer.Call('consolelogreplay', {}, function(logItems) {
      $(document).ready(function() {
        // Add peer url.
        var peerURL = location.origin + '/peer/#' + peer.GetPeerJobID();
        $("#peerUrl").replaceWith($("<a>", {text: peerURL, href: peerURL}));

        var dashboard = new MasterDashboard(peer);
        dashboard.Init();

        // Setup console.
        var c = new Console($(".repl"), logItems);
        $(".loading").remove();
        $(".loaded").css("visibility", "visible");
        var worker = new SparkWorker(peer, true);
        _.each(_.sortBy(logItems, "seq"), function(item) {
          //console.log(item);
          if (item.type === "code") {
              worker.call("exec", util.toURL(item.value));
          }
        });
        worker.register({
          "console/promiseResult": function(id, type) {
            c.promiseResult(id, type);
          },
          "console/fulfillResult": function(id, obj, type) {
            c.fulfillResult(id, obj, type);
          },
          "submitTask": function(id, rdds, targets) {
            taskManager.submitTask(id, rdds, targets);
          }
        });
        c.on('append', function(item) {
          peer.Call('consolelogrecord', { entry: item });
        });
        c.on('exec', function() {
          c.lock();
          var text = c.getText();
          worker.call("exec", util.toURL(text), function(status, error) {
            c.clearError();
            switch(status) {
              case "success":
                c.displayCode(text);
                c.setText("");
                break;
              case "invalid_syntax":
                c.setError(error);
                break;
              case "error":
                c.displayCode(text);
                c.setText("");
                c.displayError(error);
            }
            c.unlock();
          });
        });
      });
    });
  });
});
