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
    underscore: 'lib/underscore',
    "underscore.string": 'lib/underscore.string',
    EventEmitter: 'lib/EventEmitter'
  }
});
