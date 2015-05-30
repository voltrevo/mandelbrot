'use strict'

module.exports = function deferAndDropExcess(fn) {
    var pendingExecution = false

    return function() {
        if (pendingExecution) {
            return
        }

        var args = arguments
        pendingExecution = true

        setTimeout(function() {
            fn.apply(undefined, args)
            pendingExecution = false
        }, 0)
    }
}
