'use strict'

let offset = 1024 * 1024 * 1024

module.exports = function() {
    let data = []

    return {
        get: function(i, j) {
            let slice = data[i + offset]
            return slice && slice[j + offset]
        },
        set: function(i, j, value) {
            i += offset
            j += offset

            let slice = data[i] || (data[i] = [])

            return (slice[j] = value)
        },
        clear: function() {
            data = []
        }
    }
}
