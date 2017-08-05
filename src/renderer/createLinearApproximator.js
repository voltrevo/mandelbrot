'use strict';

module.exports = function createLinearApproximator(f, a, b, n) {
  const nodes = [];

  for (let i = 0; i !== n; i++) {
    nodes.push(f(a + i / (n - 1) * (b - a)));
  }

  return function (x) {
    const relPos = (x - a) / (b - a) * (n - 1);
    const leftNode = Math.floor(relPos);
    const rightNode = Math.ceil(relPos);
    const innerPos = relPos - leftNode;

    return (1 - innerPos) * nodes[leftNode] + innerPos * nodes[rightNode];
  };
};
