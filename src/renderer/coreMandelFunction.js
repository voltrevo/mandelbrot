'use strict'

module.exports = function(re, im, depth) {
  var a = re
  var b = im

  var iter = 0
  var radius = 0
  var lastRadius = 0

  while ((radius = a * a + b * b) < 4 && iter < depth) {
    lastRadius = radius
    var a2 = a
    var b2 = b
    a = a2 * a2 - b2 * b2 + re
    b = 2 * a2 * b2 + im

    iter++
  }

  if (iter === depth) {
    return iter
  }

  return iter + (4 - lastRadius) / (radius - lastRadius)
}
