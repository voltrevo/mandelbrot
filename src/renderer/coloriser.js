'use strict'

var colorScheme = require('./colorScheme')

module.exports = function coloriser() {
  var self = {}

  self.colorScheme = colorScheme.createRandom(colorScheme.magicValue)
  self.colorSchemeSeedOffset = 0
  self.coloringMultiplier = 1
  self.coloringOffset = 0
  self.currReferenceColor = 0

  self.colorise = function(pointValue) {
    if (pointValue !== -1) {
      var interpolant = self.colorScheme(self.coloringMultiplier * pointValue + self.coloringOffset)

      return {
        r: 255 * interpolant[0],
        g: 255 * interpolant[1],
        b: 255 * interpolant[2],
        a: 255
      }
    }

    return {
      r: 0,
      g: 0,
      b: 0,
      a: 255
    }
  }

  self.blockDataToPixelData = function(blockData, pix) {
    var limit = blockData.length

    var inc = 0

    for (var i = 0; i < limit; i++) {
      var c = self.colorise(blockData[i])
      pix.data[inc++] = c.r
      pix.data[inc++] = c.g
      pix.data[inc++] = c.b
      pix.data[inc++] = c.a
    }
  }

  self.updateReferenceColor = function(blocks) {
    var sampleVals = []
    for (var i = 0; i !== blocks.length; i++) {
      var block = blocks[i]

      if (!block) {
        continue
      }

      var val = block.data[0]

      if (val === -1) {
        continue
      }

      sampleVals.push(val)
    }

    sampleVals.sort()
    self.currReferenceColor = sampleVals[Math.floor(0.9 * sampleVals.length)]
  }

  self.randomise = function(seedOffset) {
    self.colorSchemeSeedOffset += seedOffset || Math.random()
    
    self.colorScheme = colorScheme.createRandom(
      colorScheme.magicValue + self.colorSchemeSeedOffset
    )
  }

  self.shift = function(offset) {
    self.coloringOffset += offset
  }

  self.multiplySpeed = function(k) {
    self.coloringOffset += (1 - k) * self.coloringMultiplier * self.currReferenceColor
    self.coloringMultiplier *= k
  }

  return self
}
