'use strict'

let createLinearApproximator = require('./createLinearApproximator')

let postLogScaling = createLinearApproximator(function(x) {
  return 0.5 * Math.pow(x, 1.3)
}, 0, 25, 101)

module.exports = function(
  mandelCenter,
  pixelWidth,
  pixelHeight,
  mandelWidth,
  mandelHeight
) {
  let self = {}

  self.empty = true
  self.blocks = []
  self.mandelCenter = mandelCenter

  self.centralPixelPos = null

  self.pixelWidth = pixelWidth
  self.pixelHeight = pixelHeight
  self.mandelWidth = mandelWidth
  self.mandelHeight = mandelHeight

  self.pixelSize = self.mandelWidth / self.pixelWidth

  self.add = function(scaledBlock) {
    self.blocks.push(scaledBlock)
    self.empty = false
  }

  self.scaleBlockData = function(data, depth) {
    let scaledData = []

    for (let i = 0; i !== data.length; i++) {
      let pointValue = data[i]
      scaledData.push(pointValue === depth ? -1 : postLogScaling(Math.log(1 + pointValue)))
    }

    return scaledData
  }

  self.scaleBlock = function(block) {
    let scaledBlock = {
      size: block.size,
      pos: block.pos,
      data: self.scaleBlockData(block.data, block.depth)
    }

    if (!self.centralPixelPos) {
      self.centralPixelPos = self.calculateCentralPixelPos(block)
    }

    scaledBlock.pixelPos = {
      x: self.centralPixelPos.x + block.size * block.j,
      y: self.centralPixelPos.y + block.size * block.i
    }

    return scaledBlock
  }

  self.calculateCentralPixelPos = function(sampleBlock) {
    let mandelTopLeft = {
      x: self.mandelCenter.x - 0.5 * self.mandelWidth,
      y: self.mandelCenter.y - 0.5 * self.mandelHeight
    }

    let pixelPos = {
      x: (sampleBlock.pos.x - mandelTopLeft.x) / self.pixelSize,
      y: (sampleBlock.pos.y - mandelTopLeft.y) / self.pixelSize
    }

    return {
      x: Math.round(pixelPos.x - sampleBlock.size * sampleBlock.j),
      y: Math.round(pixelPos.y - sampleBlock.size * sampleBlock.i)
    }
  }

  return self
}