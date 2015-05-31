'use strict'

var calculator = require('./calculator')
var coloriser = require('./coloriser')
var deferAndDropExcess = require('./deferAndDropExcess')
var displayBlockStore = require('./displayBlockStore')

module.exports = function Renderer(canvas) {
  var self = this

  self.depth = 500
  self.canvas = canvas
  self.ctx = canvas.getContext('2d')
  self.center = {x: -0.75, y: 0}
  self.width = 4

  self.coloriser = new coloriser()

  self.calculator = calculator()
  self.displayBlockStore = null

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
      if (evt.keyCode === 67) {
        self.coloriser.randomise(!evt.shiftKey ? 1 : -1)
        self.drawBlocksCached() // TODO: rename to redrawCurrentBlocks?
      }

      if (evt.keyCode === 187 || evt.keyCode === 189) {
        if (evt.shiftKey) {
          self.coloriser.shift(0.05 * (188 - evt.keyCode))
        } else {
          self.coloriser.multiplySpeed(Math.exp(0.05 * (188 - evt.keyCode)))
        }

        self.drawBlocksCached()
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
        x: (
          self.center.x -
          0.5 * self.width +
          lastMousedown.x * self.pixelRatio * pixelSize
        ),
        y: (
          self.center.y -
          0.5 / aspectRatio *
          self.width +
          lastMousedown.y * self.pixelRatio * pixelSize
        )
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

  self.draw = function(pos) { // pos === referencePoint?
    pos = pos || self.center

    // self.coloriser.clearCache() // TODO: was this a good idea when it used to work?

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

    self.displayBlockStore = new displayBlockStore(
      self.center,
      self.canvas.width,
      self.canvas.height,
      self.width,
      self.width / self.canvas.width * self.canvas.height
    )

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

          var scaledBlock = self.displayBlockStore.scaleBlock(block)
          self.displayBlockStore.add(scaledBlock)

          self.drawBlock(scaledBlock)

          return scaledBlock
        })
      })
    ).then(function(scaledBlocks) {
      var end = Date.now()
      console.log(end - begin)

      self.coloriser.updateReferenceColor(scaledBlocks)
    })
  }

  self.drawBlock = function(block) {
    var pix = self.ctx.createImageData(block.size, block.size)
    
    // TODO: this belongs in the coloriser
    self.coloriser.blockDataToPixelData(block.data, pix)

    self.ctx.putImageData(
      pix,
      block.pixelPos.x,
      block.pixelPos.y
    )
  }

  self.drawBlocksCached = function() {
    if (!self.displayBlockStore) {
      self.draw()
      return
    }

    self.displayBlockStore.blocks.forEach(self.drawBlock)
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
