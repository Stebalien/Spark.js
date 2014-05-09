
define([
  "jquery", "EventEmitter",

  "cm/lib/codemirror",
  "cm/mode/javascript/javascript",
  "cm/addon/edit/matchbrackets",
  "cm/addon/edit/closebrackets",
  "cm/addon/runmode/runmode",
  "cm/addon/runmode/colorize",
  "cm/addon/hint/show-hint",
  "cm/addon/hint/javascript-hint",
  "cm/addon/lint/lint",
  "cm/addon/lint/javascript-lint"
], function($, EventEmitter, CodeMirror) {
  function Console(element) {
    var that = this;
    this._display = element.find(".display");
    this._error = element.find(".error");
    this._entry = CodeMirror.fromTextArea(
      element.find(".entry")[0],
      {
        mode: "javascript",
        matchBrackets: true,
        autoCloseBrackets: true,
        viewportMargin: Infinity,
        lint: true,
        lineNumbers: true,
        gutters: ["CodeMirror-lint-markers"],
        extraKeys: {
          "Ctrl-Space": "autocomplete",
          "Ctrl-Enter": function() {
            that.emit("exec");
          }
        }
      }
    );
    element.find(".run-btn").on("click", function() {
      that.emit("exec");
    });
  };

  Console.prototype = Object.create(EventEmitter.prototype);
  Console.prototype.constructor = Console;

  Console.prototype.lock = function() {
    this._entry.setOption("readOnly", true);
  };
  Console.prototype.unlock = function() {
    this._entry.setOption("readOnly", false);
  };
  Console.prototype.setError = function(status) {
    this._error.text(status);
    this._error.show();
  };
  Console.prototype.clearError = function() {
    this._error.hide();
  };
  Console.prototype.getText = function() {
    return this._entry.getValue();
  };
  Console.prototype.setText = function(text) {
    return this._entry.setValue("");
  };

  function isAtBottom() {
   return $(window).scrollTop() + $(window).height() == $(document).height();
  }
  function scroll() {
    $("html, body").animate({ scrollTop: $(document).height() }, "slow");
  }

  Console.prototype.displayCode = function(text) {
    var doScroll = isAtBottom();
    var node = $("<pre class='cm-s-default code'></pre>").appendTo(this._display);
    CodeMirror.runMode(text, {name: "javascript"}, node[0]);
    if (doScroll) scroll();
  };

  Console.prototype.displayError = function(err) {
    var doScroll = isAtBottom();
    var node = $('<div class="alert alert-danger"></div>');
    node.text(err);
    node.appendTo(this._display);
    if (doScroll) scroll();
  };

  Console.prototype.log = function log(object) {
    var doScroll = isAtBottom();
    var text = JSON.stringify(object, null, 2);
    var node = $("<pre class='cm-s-default result'></pre>").appendTo(this._display);
    CodeMirror.runMode(text, {name: "javascript", json: true}, node[0]);
    if (doScroll) scroll();
  };

  Console.prototype.promiseLog = function() {
    var doScroll = isAtBottom();
    var node = $("<pre class='cm-s-default result'></pre>").appendTo(this._display);
    node.text("Calculating...");
    if (doScroll) scroll();
    return function(value) {
      var doScroll = isAtBottom();
      CodeMirror.runMode(JSON.stringify(value, null, 2), {name: "javascript", json: true}, node[0]);
      if (doScroll) scroll();
    };
  };

  return Console;
});
