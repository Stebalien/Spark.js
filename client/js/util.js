"use strict";
define(["underscore"], function(_) {
  return {
    toURL: function toURL(text) {
      var blob = new Blob([text]);
      return URL.createObjectURL(blob);
    },
    deepFreeze: function deepFreeze(o) {
      Object.freeze(o);
      if (!_.isFunction(o)) {
        Object.getOwnPropertyNames(o).forEach(function (prop) {
          if (o.hasOwnProperty(prop) &&
              o[prop] !== null &&
              (typeof o[prop] === "object" || typeof o[prop] === "function") &&
              !Object.isFrozen(o[prop])) {
              deepFreeze(o[prop]);
            }
        });
      }
      return o;
    },
    sum: function sum(list) {
      return _.reduce(list, function(memo, v) { return memo + v; }, 0);
    }
  };
});
