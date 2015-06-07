'use strict'

module.exports = function Scheduler(batchTimerThreshold) {
  var _ = {}

  _.queue = []
  _.calculationScheduled = false

  _.clear = function() {
    _.queue = []
  }

  _.scheduleCalculation = function() {
    if (_.calculationScheduled) {
      return
    }

    setTimeout(_.calculation, 0)

    _.calculationScheduled = true
  }

  _.calculation = function() {
    var start = Date.now()
    var threshold = start + batchTimerThreshold

    while (_.queue.length > 0 && Date.now() < threshold) {
      var job = _.queue.shift()
      job.resolve(job.fn.apply(undefined, job.args))
    }

    _.calculationScheduled = false

    if (_.queue.length > 0) {
      _.scheduleCalculation()
    }
  }

  var wrapper = function(fn) {
    return function() {
      var args = arguments

      var ret = new Promise(function(resolve) {
        _.queue.push({
          fn: fn,
          args: args,
          resolve: resolve
        })
      })

      _.scheduleCalculation()

      return ret
    }
  }
  
  wrapper.clear = _.clear

  wrapper._ = _

  return wrapper
}
