'use strict'

let lerp = require('./lerp')
let rand = require('./rand')

let createInterpolator = function(nodeGenerator) {
  return function(r) {
    let floorOfR = Math.floor(r)
    let leftNode = nodeGenerator(floorOfR)
    let rightNode = nodeGenerator(floorOfR + 1)

    return lerp(leftNode, rightNode, r - floorOfR)
  }
}

let createNodeGenerator = function(seed) {
  let randOffset = rand(seed)
  let cacheMap = []
  return function(r) {
    let node = cacheMap[r + 1000000]

    if (!node) {
      node = [0, 0.333, 0.667].map(function(x) { return rand(r + randOffset + x) })
      cacheMap[r + 1000000] = node
    }

    return node
  }
}

let createRandomInterpolator = function(seed) {
  let offset = rand(rand(seed))
  let baseInterpolator = createInterpolator(createNodeGenerator(seed))

  return function(r) {
    return baseInterpolator(r + offset)
  }
}

module.exports = {
  createRandom: createRandomInterpolator,
  magicValue: Math.floor(966908800 * Math.sqrt(2))
}
