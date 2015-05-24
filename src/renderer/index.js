'use strict'

var colorScheme = require('./colorScheme')
var coreMandelFunction = require('./coreMandelFunction')

module.exports = function Renderer(canvas) {
  var self = this

  self.depth = 500
  self.canvas = canvas
  self.ctx = canvas.getContext('2d')
  self.centre = {x: -0.75, y: 0}
  self.width = 4

  self.iterCount = 0
  self.itersPerDraw = 7 * 1000 * 1000
  self.drawIndex = 0

  self.colorScheme = colorScheme.createRandom(colorScheme.magicValue)

  // TODO: separate class
  self.blockSize = 64
  self.blockPixelSize = 1
  self.blocks = []
  self.firstBlockPos = {x: 0, y: 0}
  self.blockTableWidth = 1
  self.blockTableHeight = 0

  self.updateSize = function() {
    canvas.width = canvas.parentNode.clientWidth
    canvas.height = canvas.parentNode.clientHeight
  }

  ;(function() {
    var lastMousedown = {x: 0, y: 0}
    var colorSchemeSeedOffset = 0

    self.updateSize()

    canvas.parentNode.addEventListener('keydown', function(evt) {
      if (evt.keyCode === 67) {
        var start = new Date()

        colorSchemeSeedOffset += (!evt.shiftKey ? 1 : -1)

        self.colorScheme = colorScheme.createRandom(
          colorScheme.magicValue + colorSchemeSeedOffset
        )

        self.draw(true)
        var end = new Date()
        console.log(end - start)
      }
    })

    canvas.addEventListener('mousedown', function(e) {
      lastMousedown.x = e.clientX
      lastMousedown.y = e.clientY
    })

    canvas.addEventListener('mouseup', function(e) {
      var diff = {x: e.clientX - lastMousedown.x, y: e.clientY - lastMousedown.y}
      var pixelSize = self.width / parseInt(window.innerWidth)
      self.moveCentre({x: -diff.x * pixelSize, y: diff.y * pixelSize})
      self.draw()
    })

    canvas.addEventListener('wheel', function(e) {
      var pixelSize = self.width / parseInt(window.innerWidth)
      var aspectRatio = parseInt(window.innerWidth) / parseInt(window.innerHeight)

      self.scale(
        e.deltaY < 0 ? 2/3 : 3/2,
        {
          x: self.centre.x + -0.5 * self.width + e.clientX * pixelSize,
          y: self.centre.y + 0.5 / aspectRatio * self.width - pixelSize * e.clientY
        }
      )
    })

    canvas.parentNode.addEventListener('keydown', function(e) {
      if (e.keyCode === 68) {
        self.depth = parseInt(window.prompt('Enter new depth', '500'))
        self.draw()
      }
    })
  })()

  self.calculateBlock = function(p) {
    var result = []
    var counter = 0

    for (var i = 0; i !== self.blockSize; i++) {
      for (var j = 0; j !== self.blockSize; j++) {
        result[counter] = self.calculatePoint({
          x: p.x + j * self.blockPixelSize,
          y: p.y - i * self.blockPixelSize
        })

        counter++
      }
    }

    return result
  }

  self.blockToPixelData = function(block, pix) {
    var limit = self.blockSize * self.blockSize

    var inc = 0

    for (var i = 0; i < limit; i++) {
      var c = self.colorise(block[i])
      pix.data[inc++] = c.r
      pix.data[inc++] = c.g
      pix.data[inc++] = c.b
      pix.data[inc++] = c.a
    }
  }

  self.calculatePoint = function(p) {
    var ret = coreMandelFunction(p.x, p.y, self.depth)
    self.iterCount += Math.floor(ret[0])

    return ret[0] + ret[1]
  }

  self.colorise = function(pointValue) {
    if (pointValue <= self.depth) {
      var interpolant = self.colorScheme(Math.log(pointValue + 1))
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

  self.debugStart = null
  self.debugStop = null

  self.draw = function(cached, pos) {
    pos = pos || self.centre
    self.debugStart = new Date()
    cached = (cached !== undefined ? cached : false)
    self.drawIndex += (!cached ? 1 : 0)

    var pixelWidth = self.width / parseInt(self.canvas.width)
    var aspectRatio = parseInt(self.canvas.width) / parseInt(self.canvas.height)

    self.firstBlockPos.x = self.centre.x - 0.5 * self.width
    self.firstBlockPos.y = self.centre.y + 0.5 / aspectRatio * self.width

    self.blockPixelSize = pixelWidth
    self.blockTableWidth = Math.ceil(self.width / (self.blockSize * self.blockPixelSize))

    self.blockTableHeight = Math.ceil(
      (self.width / aspectRatio) /
      (self.blockSize * self.blockPixelSize)
    )

    var indexMap = []
    for (var i = 0; i !== self.blockTableWidth * self.blockTableHeight; i++) {
      indexMap.push(i)
    }

    var indexToDist = function(index) {
      var i = Math.floor(index / self.blockTableWidth)
      var j = index % self.blockTableWidth

      var indexPos = {
        x: self.firstBlockPos.x + j * self.blockSize * self.blockPixelSize,
        y: self.firstBlockPos.y - i * self.blockSize * self.blockPixelSize
      }

      var dx = indexPos.x - pos.x
      var dy = indexPos.y - pos.y

      return dx * dx + aspectRatio * dy * dy
    }

    indexMap.sort(function(a, b) { return indexToDist(a) - indexToDist(b) })

    self.drawBlocks({
      drawIndex: self.drawIndex,
      blockIndex: 0,
      indexMap: indexMap,
      cached: cached
    })
  }

  self.drawBlocks = function(drawState) {
    if (drawState.drawIndex !== self.drawIndex) {
      return
    }

    var iterTarget = Math.ceil((self.iterCount + 1) / self.itersPerDraw) * self.itersPerDraw

    while (self.iterCount < iterTarget) {
      var pix = self.ctx.createImageData(self.blockSize, self.blockSize)

      var mappedIndex = drawState.indexMap[drawState.blockIndex]
      var i = Math.floor(mappedIndex / self.blockTableWidth)
      var j = mappedIndex % self.blockTableWidth

      if (!drawState.cached) {
        self.blocks[mappedIndex] = self.calculateBlock({
          x: self.firstBlockPos.x + j * self.blockSize * self.blockPixelSize,
          y: self.firstBlockPos.y - i * self.blockSize * self.blockPixelSize
        })
      }

      self.blockToPixelData(self.blocks[mappedIndex], pix)

      self.ctx.putImageData(
        pix, self.firstBlockPos.x + j * self.blockSize,
        self.firstBlockPos.y + i * self.blockSize
      )

      drawState.blockIndex++

      if (drawState.blockIndex === drawState.indexMap.length) {
        self.debugStop = new Date()
        console.log(self.debugStop - self.debugStart)
        return
      }
    }

    if (drawState.cached) {
      self.drawBlocks(drawState)
    } else {
      setTimeout(function() {
        self.drawBlocks(drawState)
      }, 0)
    }
  }

  self.scale = function(factor, pos) {
    pos = (pos || self.centre)

    self.centre = {
      x: factor * self.centre.x + (1 - factor) * pos.x,
      y: factor * self.centre.y + (1 - factor) * pos.y
    }

    self.width *= factor

    self.draw(false, pos)
  }

  self.moveCentre = function(p) {
    self.centre.x += p.x
    self.centre.y += p.y
  }
}