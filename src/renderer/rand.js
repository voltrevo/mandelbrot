'use strict'

module.exports = function rand(seed) {
  for (var i = 0; i !== 10; ++i) {
    seed -= (seed * seed + 1) / (2 * seed)
  }

  seed *= 10000
  return seed - Math.floor(seed)
}