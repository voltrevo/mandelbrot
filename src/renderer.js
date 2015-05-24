'use strict'

var colorScheme = require('./colorScheme')

module.exports = function Renderer(canvas) {
  this.depth = 255
  this.canvas = canvas
  this.ctx = canvas.getContext('2d')
  this.centre = {x: -0.75, y: 0}
  this.width = 4

  this.iterCount = 0
  this.itersPerDraw = 7 * 1000 * 1000
  this.drawIndex = 0

  this.colorScheme = colorScheme.createRandom(colorScheme.magicValue)

  // TODO: separate class
  this.blockSize = 64
  this.blockPixelSize = 1
  this.blocks = []
  this.firstBlockPos = {x: 0, y: 0}
  this.blockTableWidth = 1
  this.blockTableHeight = 0

  this.calculateBlock = function(p) {
    var result = []
    var counter = 0

    for (var i = 0; i !== this.blockSize; i++) {
      for (var j = 0; j !== this.blockSize; j++) {
        result[counter] = this.calculatePoint({
          x: p.x + j * this.blockPixelSize,
          y: p.y - i * this.blockPixelSize
        })

        counter++
      }
    }

    return result
  }

  this.blockToPixelData = function(block, pix) {
    var limit = this.blockSize * this.blockSize

    var inc = 0

    for (var i = 0; i < limit; i++) {
      var c = this.colorise(block[i])
      pix.data[inc++] = c.r
      pix.data[inc++] = c.g
      pix.data[inc++] = c.b
      pix.data[inc++] = c.a
    }
  }

  this.calculatePoint = function(p) {
    var a = p.x
    var b = p.y
    var iter = 0
    var radius = 0
    var lastRadius = 0

    while (iter < this.depth && (radius = a * a + b * b) < 4) {
      lastRadius = radius
      var a2 = a
      var b2 = b
      a = a2 * a2 - b2 * b2 + p.x
      b = 2 * a2 * b2 + p.y

      iter++
    }

    this.iterCount += iter

    if (iter === this.depth && a * a + b * b < 4) {
      iter++
    }

    return iter + (4 - lastRadius) / (radius - lastRadius)
  }

  this.colorise = function(pointValue) {
    if (pointValue <= this.depth) {
      var interpolant = this.colorScheme(Math.log(pointValue + 1))
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

  this.draw = function(cached) {
    cached = (cached !== undefined ? cached : false)
    this.drawIndex++

    var pixelWidth = this.width / parseInt(this.canvas.width)
    var aspectRatio = parseInt(this.canvas.width) / parseInt(this.canvas.height)

    this.firstBlockPos.x = this.centre.x - 0.5 * this.width
    this.firstBlockPos.y = this.centre.y + 0.5 / aspectRatio * this.width

    this.blockPixelSize = pixelWidth
    this.blockTableWidth = Math.ceil(this.width / (this.blockSize * this.blockPixelSize))

    this.blockTableHeight = Math.ceil(
      (this.width / aspectRatio) /
      (this.blockSize * this.blockPixelSize)
    )

    this.drawBlocks({
      drawIndex: this.drawIndex,
      i: 0,
      j: 0,
      blockIndex: 0,
      cached: cached
    })
  }

  this.drawBlocks = function(drawState) {
    if (drawState.drawIndex !== this.drawIndex) {
      return
    }

    var iterTarget = Math.ceil((this.iterCount + 1) / this.itersPerDraw) * this.itersPerDraw

    while (this.iterCount < iterTarget) {
      var pix = this.ctx.createImageData(this.blockSize, this.blockSize)

      if (!drawState.cached) {
        this.blocks[drawState.blockIndex] = this.calculateBlock({
          x: this.firstBlockPos.x + drawState.j * this.blockSize * this.blockPixelSize,
          y: this.firstBlockPos.y - drawState.i * this.blockSize * this.blockPixelSize
        })
      }

      this.blockToPixelData(this.blocks[drawState.blockIndex], pix)

      this.ctx.putImageData(
        pix, this.firstBlockPos.x + drawState.j * this.blockSize,
        this.firstBlockPos.y + drawState.i * this.blockSize
      )

      drawState.blockIndex++

      drawState.j++

      if (drawState.j >= this.blockTableWidth) {
        drawState.j = 0
        drawState.i++

        if (drawState.i >= this.blockTableHeight) {
          return
        }
      }
    }

    var that = this

    if (drawState.cached) {
      that.drawBlocks(drawState)
    } else {
      setTimeout(function() {
        that.drawBlocks(drawState)
      }, 0)
    }
  }

  this.scale = function(factor, pos) {
    pos = (pos || this.centre)
    this.centre = {
      x: factor * this.centre.x + (1 - factor) * pos.x,
      y: factor * this.centre.y + (1 - factor) * pos.y
    }

    this.width *= factor

    this.draw()
  }

  this.moveCentre = function(p) {
    this.centre.x += p.x
    this.centre.y += p.y
  }
}
