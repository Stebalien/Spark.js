require.config({
  shim: {
    underscore: {
      exports: '_'
    },
  },
  paths: {
    types: 'lib/types',
    underscore: 'lib/underscore',
    jquery: 'lib/jquery-2.1.0.min'
  }
});

require(["underscore", "jquery"],
function(_,             $) {
  $(document).ready(function() {
    alert("READY!");
  });
});
