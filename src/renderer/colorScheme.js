'use strict'

var lerp = require('./lerp')
var rand = require('./rand')

var createInterpolator = function(nodeGenerator) {
  return function(r) {
    var floorOfR = Math.floor(r)
    var leftNode = nodeGenerator(floorOfR)
    var rightNode = nodeGenerator(floorOfR + 1)

    return lerp(leftNode, rightNode, r - floorOfR)
  }
}

var createNodeGenerator = function(seed) {
  var randOffset = rand(seed)
  var cacheMap = []
  return function(r) {
    var node = cacheMap[r + 1000000]

    if (!node) {
      node = [0, 0.333, 0.667].map(function(x) { return rand(r + randOffset + x) })
      cacheMap[r + 1000000] = node
    }

    return node
  }
}

var createRandomInterpolator = function(seed) {
  var offset = rand(rand(seed))
  var baseInterpolator = createInterpolator(createNodeGenerator(seed))

  return function(r) {
    return baseInterpolator(r + offset)
  }
}

module.exports = {
  createRandom: createRandomInterpolator,
  magicValue: Math.floor(966908800 * Math.sqrt(2))
}
