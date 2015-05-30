'use strict'

var offset = 1024 * 1024 * 1024

module.exports = function() {
    var data = []

    return {
        get: function(i, j) {
            var slice = data[i + offset]
            return slice && slice[j + offset]
        },
        set: function(i, j, value) {
            i += offset
            j += offset

            var slice = data[i] || (data[i] = [])
            
            return (slice[j] = value)
        },
        clear: function() {
            data = []
        }
    }
}
