'use strict';

module.exports = function deferAndDropExcess(fn) {
  let pendingExecution = false;

  return (...args) => {
    if (pendingExecution) {
      return;
    }

    pendingExecution = true;

    setTimeout(() => {
      fn(...args);
      pendingExecution = false;
    }, 0);
  };
};
