
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
  function Console(element, initial) {
    var that = this;
    this._nextSequenceNumber = 0;
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
            if (that.getText() !== "") {
              that.emit("exec");
            }
          }
        }
      }
    );

    // Replay
    initial = _.sortBy(initial, "seq");
    _.each(initial, function(item) {
      switch (item.type) {
        case "error":
          that._displayError(item.value);
          break;
        case "code":
          that._displayCode(item.value);
          break;
        case "result":
          that._promiseResult(item.id, item.resultType);
          break;
      }
    });
    var last = _.last(initial);
    if (last) {
      this._nextSequenceNumber = last.seq+1;
    }

    element.find(".run-btn").on("click", function() {
      if (that.getText() !== "") {
        that.emit("exec");
      }
    });
  }

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
    return this._entry.getValue().trim();
  };
  Console.prototype.setText = function(text) {
    return this._entry.setValue("");
  };

  function isAtBottom() {
    return $(window).scrollTop() + $(window).height() === $(document).height();
  }
  function scroll() {
    $("html, body").animate({ scrollTop: $(document).height() }, "slow");
  }

  Console.prototype._displayCode = function(text) {
    var doScroll = isAtBottom();
    var node = $('<pre class="cm-s-default code"></div>').appendTo(this._display);
    CodeMirror.runMode(text, {name: "javascript"}, node[0]);
    if (doScroll) scroll();
  };

  Console.prototype.displayCode = function(text) {
    this._displayCode(text);
    this.emit('append', {
      type: 'code',
      value: text,
      seq: this._nextSequenceNumber++
    });
  };


  Console.prototype._displayError = function(err) {
    var doScroll = isAtBottom();
    var node = $('<div class="alert alert-danger"></div>');
    node.text(err);
    node.appendTo(this._display);
    if (doScroll) scroll();
  };

  Console.prototype.displayError = function(err) {
    this._displayError(err);
    this.emit('append', {
      type: 'error',
      value: err,
      seq: this._nextSequenceNumber++
    });
  };

  function drawText(ctx, text) {
    var x = (ctx.canvas.width - ctx.measureText(text).width)/2;
    var y = ctx.canvas.height/2;
    ctx.font = '30pt Sans Serif';
    ctx.fillText(text, x, y);
  }

  Console.prototype._promiseResult = function(id, type) {
    var that = this;
    var doScroll = isAtBottom();
    var node;
    switch (type) {
      case "json":
        node = $("<pre class='cm-s-default result' id='result-"+id+"'>Calculating...</pre>");
      break;
      case "plotLine":
        node = $("<canvas width='600' height='400' class='result' id='result-"+id+"'></canvas>");
        _.defer(function() {
          drawText(node.get(0).getContext('2d'), "Calculating...");
        });
        break;
    }
    node.data('type', type);
    node.appendTo(this._display);
    if (doScroll) scroll();
  };

  Console.prototype.promiseResult = function(id, type) {
    if (this._display.find("#result-"+id).empty()) {
      this._promiseResult(id, type);
      this.emit('append', {
        type: 'result',
        resultType: type,
        id: id,
        seq: this._nextSequenceNumber++
      });
    }
  };

  Console.prototype.fulfillResult = function(id, value, type) {
    var doScroll = isAtBottom();
    var node = this._display.find("#result-"+id);
    switch (type) {
      case 'json':
        CodeMirror.runMode(JSON.stringify(value, null, 2), {name: "javascript", json: true}, node[0]);
        break;
      case 'plotLine':
        var data = {
          labels: _.map(value, function(v, i) { return ''+i; }),
          datasets: [ { data: value } ]
        };
        new Chart(node.get(0).getContext('2d')).Line(data, {datasetFill: false});
        break;
    }
    if (doScroll) scroll();
  };

  return Console;
});
