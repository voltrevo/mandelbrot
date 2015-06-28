'use strict'

module.exports = function createLinearApproximator(f, a, b, n) {
  let nodes = []

  for (let i = 0; i !== n; i++) {
    nodes.push(f(a + i / (n - 1) * (b - a)))
  }

  return function(x) {
    let relPos = (x - a) / (b - a) * (n - 1)
    let leftNode = Math.floor(relPos)
    let rightNode = Math.ceil(relPos)
    let innerPos = relPos - leftNode

    return (1 - innerPos) * nodes[leftNode] + innerPos * nodes[rightNode]
  }
}
