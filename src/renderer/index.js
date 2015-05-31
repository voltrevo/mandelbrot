'use strict'

var calculator = require('./calculator')
var colorScheme = require('./colorScheme')
var createLinearApproximator = require('./createLinearApproximator')
var deferAndDropExcess = require('./deferAndDropExcess')

var postLogScaling = createLinearApproximator(function(x) {
  return 0.5 * Math.pow(x, 1.3)
}, 0, 25, 101)

module.exports = function Renderer(canvas) {
  var self = this

  self.depth = 500
  self.canvas = canvas
  self.ctx = canvas.getContext('2d')
  self.center = {x: -0.75, y: 0}
  self.width = 4

  self.colorScheme = colorScheme.createRandom(colorScheme.magicValue)
  self.colorSchemeSeedOffset = 0
  self.coloringMultiplier = 1
  self.coloringOffset = 0

  self.calculator = calculator()
  self.currBlocks = null
  self.centralPixelPos = null

  self.pixelRatio = window.devicePixelRatio || 1

  self.updateSize = function() {
    canvas.style.width = canvas.parentNode.clientWidth + 'px'
    canvas.style.height = canvas.parentNode.clientHeight + 'px'

    canvas.width = self.pixelRatio * canvas.parentNode.clientWidth
    canvas.height = self.pixelRatio * canvas.parentNode.clientHeight
  }

  ;(function() {
    var lastMousedown = {x: 0, y: 0}

    self.updateSize()

    canvas.parentNode.addEventListener('keydown', deferAndDropExcess(function(evt) {
      var start
      var end

      if (evt.keyCode === 67) {
        start = Date.now()
        self.colorSchemeSeedOffset += (!evt.shiftKey ? 1 : -1)
        
        self.colorScheme = colorScheme.createRandom(
          colorScheme.magicValue + self.colorSchemeSeedOffset
        )

        self.drawBlocksCached()
        end = Date.now()
        console.log(end - start)
      }

      if (evt.keyCode === 187 || evt.keyCode === 189) {
        start = Date.now()
        if (evt.shiftKey) {
          self.coloringOffset += 0.05 * (188 - evt.keyCode)
        } else {
          self.coloringMultiplier *= Math.exp(0.05 * (188 - evt.keyCode))
        }

        self.drawBlocksCached()
        end = Date.now()
        console.log(end - start)
      }
    }))

    canvas.addEventListener('mousedown', function(e) {
      lastMousedown.x = e.clientX
      lastMousedown.y = e.clientY
    })

    canvas.addEventListener('mouseup', function(e) {
      var diff = {x: e.clientX - lastMousedown.x, y: e.clientY - lastMousedown.y}
      var pixelSize = self.width / canvas.width
      var aspectRatio = canvas.width / canvas.height

      var pos = {
        x: self.center.x - 0.5 * self.width + lastMousedown.x * pixelSize,
        y: self.center.y - 0.5 / aspectRatio * self.width + pixelSize * lastMousedown.y
      }

      self.moveCenter({
        x: -diff.x * pixelSize * self.pixelRatio,
        y: -diff.y * pixelSize * self.pixelRatio
      })

      self.draw(pos)
    })

    canvas.addEventListener('wheel', function(e) {
      var pixelSize = self.width / canvas.width
      var aspectRatio = canvas.width / canvas.height

      self.scale(
        e.deltaY < 0 ? 2/3 : 3/2,
        {
          x: (
            self.center.x -
            0.5 * self.width +
            e.clientX * self.pixelRatio * pixelSize
          ),
          y: (
            self.center.y -
            0.5 / aspectRatio * self.width +
            self.pixelRatio * pixelSize * e.clientY
          )
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

  self.applyColorScalingToBlock = function(block) {
    var scaledBlock = {
      size: block.size,
      pos: block.pos,
      data: []
    }

    for (var i = 0; i !== block.data.length; i++) {
      var pointValue = block.data[i]

      scaledBlock.data.push(
        pointValue === block.depth ? -1 : postLogScaling(Math.log(1 + pointValue))
      )
    }

    scaledBlock.pixelPos = {
      x: self.centralPixelPos.x + block.size * block.j,
      y: self.centralPixelPos.y + block.size * block.i
    }

    return scaledBlock
  }

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

  self.draw = function(pos) { // pos === referencePoint?
    pos = pos || self.center

    self.colorScheme = colorScheme.createRandom(
      colorScheme.magicValue + self.colorSchemeSeedOffset
    )

    var pixelWidth = self.width / canvas.width
    var aspectRatio = canvas.width / canvas.height

    var topLeft = {
      x: self.center.x - 0.5 * self.width,
      y: self.center.y - 0.5 / aspectRatio * self.width
    }

    var bottomRight = {
      x: topLeft.x + self.width,
      y: topLeft.y + self.width / aspectRatio
    }

    var begin = Date.now()

    self.centralPixelPos = null

    Promise.all(
      self.calculator.getBlocksForScreen(
        pos,
        topLeft,
        bottomRight,
        pixelWidth,
        self.depth
      ).map(function(blockPromise) {
        return blockPromise.then(function(block) {
          if (!block) {
            return null
          }

          if (!self.centralPixelPos) {
            self.centralPixelPos = self.calculateCentralPixelPos(block)
          }

          var colorReadyBlock = self.applyColorScalingToBlock(block)
          self.drawBlock(colorReadyBlock)

          return colorReadyBlock
        })
      })
    ).then(function(blocks) {
      var end = Date.now()
      console.log(end - begin)

      self.currBlocks = blocks
    })
  }

  self.calculateCentralPixelPos = function(sampleBlock) {
    // TODO: This is awful
    var aspectRatio = self.canvas.width / self.canvas.height
    var pixelWidth = self.width / self.canvas.width

    var canvasTopLeft = {
      x: self.center.x - 0.5 * self.width,
      y: self.center.y - 0.5 * self.width / aspectRatio
    }

    var pixelPos = {
      x: (sampleBlock.pos.x - canvasTopLeft.x) / pixelWidth,
      y: (sampleBlock.pos.y - canvasTopLeft.y) / pixelWidth
    }

    return {
      x: Math.round(pixelPos.x - sampleBlock.size * sampleBlock.j),
      y: Math.round(pixelPos.y - sampleBlock.size * sampleBlock.i)
    }
  }

  self.drawBlock = function(block) {
    var pix = self.ctx.createImageData(block.size, block.size)
    self.blockDataToPixelData(block.data, pix)

    self.ctx.putImageData(
      pix,
      block.pixelPos.x,
      block.pixelPos.y
    )
  }

  self.drawBlocksCached = function() {
    if (!self.currBlocks) {
      self.draw()
      return
    }

    self.currBlocks.forEach(function(block) {
      if (block) {
        self.drawBlock(block)
      }
    })
  }

  self.scale = function(factor, pos) {
    pos = (pos || self.center)

    self.center = {
      x: factor * self.center.x + (1 - factor) * pos.x,
      y: factor * self.center.y + (1 - factor) * pos.y
    }

    self.width *= factor

    self.draw(pos)
  }

  self.moveCenter = function(p) {
    self.center.x += p.x
    self.center.y += p.y
  }
}
