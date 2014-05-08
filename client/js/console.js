
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
  Console.prototype.displayCode = function(text, mode) {
    var node = $("<pre class='cm-s-default'></pre>").appendTo(this._display);
    CodeMirror.runMode(text, mode, node[0]);
  };

  Console.prototype.displayError = function(err) {
    var node = $('<div class="alert alert-danger"></div>');
    node.text(err);
    node.appendTo(this._display);
  };

  Console.prototype.log = function log(object) {
    var text = JSON.stringify(object, null, 2);
    this.displayCode(text, {name: "javascript", json: true});
  };
  return Console;
});
