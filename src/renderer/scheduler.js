'use strict';

module.exports = function Scheduler(batchTimerThreshold) {
  const _ = {};

  _.queue = [];
  _.calculationScheduled = false;

  _.clear = () => (_.queue = []);

  _.scheduleCalculation = () => {
    if (_.calculationScheduled) {
      return;
    }

    setTimeout(_.calculation, 0);

    _.calculationScheduled = true;
  };

  _.calculation = () => {
    const start = Date.now();
    const threshold = start + batchTimerThreshold;

    while (_.queue.length > 0 && Date.now() < threshold) {
      const job = _.queue.shift();
      job.resolve(job.fn.apply(undefined, job.args));
    }

    _.calculationScheduled = false;

    if (_.queue.length > 0) {
      _.scheduleCalculation();
    }
  };

  const wrapper = fn => (...args) => {
    const ret = new Promise(resolve => {
      _.queue.push({
        fn,
        args,
        resolve,
      });
    });

    _.scheduleCalculation();

    return ret;
  };

  wrapper.clear = _.clear;

  wrapper._ = _;

  return wrapper;
};
