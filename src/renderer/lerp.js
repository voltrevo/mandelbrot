'use strict'

module.exports = function lerp(a, b, r) {
  if (!a || !b) {
    return a || b
  }

  var ret = new Array(a.length)
  for (var i = 0; i !== ret.length; i++) {
    ret[i] = a[i] + (b[i] - a[i]) * r
  }

  return ret
}
