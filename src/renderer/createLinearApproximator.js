'use strict'

module.exports = function createLinearApproximator(f, a, b, n) {
  var nodes = []

  for (var i = 0; i !== n; i++) {
    nodes.push(f(a + i / (n - 1) * (b - a)))
  }

  return function(x) {
    var relPos = (x - a) / (b - a) * (n - 1)
    var leftNode = Math.floor(relPos)
    var rightNode = Math.ceil(relPos)
    var innerPos = relPos - leftNode

    return (1 - innerPos) * nodes[leftNode] + innerPos * nodes[rightNode]
  }
}
