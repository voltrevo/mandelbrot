'use strict'

module.exports = function deferAndDropExcess(fn) {
    let pendingExecution = false

    return function() {
        if (pendingExecution) {
            return
        }

        let args = arguments
        pendingExecution = true

        setTimeout(function() {
            fn.apply(undefined, args)
            pendingExecution = false
        }, 0)
    }
}
