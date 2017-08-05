'use strict';

module.exports = function deferAndDropExcess(fn) {
  let pendingExecution = false;

  return function () {
    if (pendingExecution) {
      return;
    }

    const args = arguments;
    pendingExecution = true;

    setTimeout(() => {
      fn(...args);
      pendingExecution = false;
    }, 0);
  };
};
