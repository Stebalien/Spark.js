"use strict";
require.config({
  shim: {
    underscore: {
      exports: '_',
      deps: ['underscore.string'],
      init: function(UnderscoreString) {
        _.mixin(UnderscoreString);
      }
    },
  },
  paths: {
    underscore: '/js/lib/underscore',
    "underscore.string": '/js/lib/underscore.string',
    EventEmitter: '/js/lib/EventEmitter'
  }
});
