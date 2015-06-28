'use strict'

module.exports = function lerp(a, b, r) {
  if (!a || !b) {
    return a || b
  }

  let ret = new Array(a.length)
  for (let i = 0; i !== ret.length; i++) {
    ret[i] = a[i] + (b[i] - a[i]) * r
  }

  return ret
}
