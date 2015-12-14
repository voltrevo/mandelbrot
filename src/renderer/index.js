'use strict'

let calculator = require('./calculator')
let coloriser = require('./coloriser')
let deferAndDropExcess = require('./deferAndDropExcess')
let displayBlockStore = require('./displayBlockStore')
let scheduler = require('./scheduler')

var getDiscreteScroll = function(el, threshold, cb) {
  var excess = 0;

  el.addEventListener('wheel', function(evt) {
    excess += evt.deltaY;

    while (excess >= threshold) {
      cb(evt, threshold);
      console.log(threshold);
      excess -= threshold;
    }

    while (excess <= -threshold) {
      cb(evt, -threshold);
      console.log(-threshold);
      excess += threshold;
    }
  });
};

module.exports = function Renderer(canvas) {
  let self = this

  self.depth = 500
  self.canvas = canvas
  self.ctx = canvas.getContext('2d')
  self.center = {x: -0.75, y: 0}
  self.width = 8

  self.coloriser = new coloriser()

  self.calculator = calculator()
  self.displayBlockStore = null

  self.pixelRatio = window.devicePixelRatio || 1

  self.scheduler = scheduler(20)

  self.updateSize = function() {
    canvas.style.width = canvas.parentNode.clientWidth + 'px'
    canvas.style.height = canvas.parentNode.clientHeight + 'px'

    canvas.width = self.pixelRatio * canvas.parentNode.clientWidth
    canvas.height = self.pixelRatio * canvas.parentNode.clientHeight
  }

  ;(function() {
    let lastMousedown = {x: 0, y: 0}

    self.updateSize()

    canvas.parentNode.addEventListener('keydown', function(evt) {
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
    })

    canvas.addEventListener('mousedown', function(e) {
      lastMousedown.x = e.clientX
      lastMousedown.y = e.clientY
    })

    canvas.addEventListener('mouseup', function(e) {
      let diff = {x: e.clientX - lastMousedown.x, y: e.clientY - lastMousedown.y}

      if (diff.x === 0 && diff.y === 0) {
        return;
      }

      let pixelSize = self.width / canvas.width
      let aspectRatio = canvas.width / canvas.height

      let pos = {
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

    var zoom = function(dz, pos) {
      let pixelSize = self.width / canvas.width
      let aspectRatio = canvas.width / canvas.height

      self.scale(
        dz < 0 ? 2/3 : 3/2,
        {
          x: (
            self.center.x -
            0.5 * self.width +
            pos.x * self.pixelRatio * pixelSize
          ),
          y: (
            self.center.y -
            0.5 / aspectRatio * self.width +
            self.pixelRatio * pixelSize * pos.y
          )
        }
      )
    };

    var mousePos = {
      x: 0,
      y: 0
    };

    canvas.addEventListener('mousemove', function(e) {
      mousePos.x = e.clientX;
      mousePos.y = e.clientY;
    });

    getDiscreteScroll(canvas, 30, function(e, dy) {
      zoom(dy > 0 ? 1 : -1, mousePos);
    });

    canvas.parentNode.addEventListener('keydown', function(e) {
      if (e.keyCode === 68) {
        self.depth = parseInt(window.prompt('Enter new depth', '500'))
        self.draw()
      } else if (e.keyCode === 65) { // a
        zoom(-1, mousePos);
      } else if (e.keyCode === 90) { // z
        zoom(1, mousePos);
      }
    })
  })()

  self.draw = deferAndDropExcess(function(pos) { // pos === referencePoint?
    pos = pos || self.center
    self.scheduler.clear()

    // self.coloriser.clearCache() // TODO: was this a good idea when it used to work?

    let pixelWidth = self.width / canvas.width
    let aspectRatio = canvas.width / canvas.height

    let topLeft = {
      x: self.center.x - 0.5 * self.width,
      y: self.center.y - 0.5 / aspectRatio * self.width
    }

    let bottomRight = {
      x: topLeft.x + self.width,
      y: topLeft.y + self.width / aspectRatio
    }

    let begin = Date.now()

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

          let scaledBlock = self.displayBlockStore.scaleBlock(block)
          self.displayBlockStore.add(scaledBlock)

          self.drawBlock(scaledBlock)

          return scaledBlock
        })
      })
    ).then(function(scaledBlocks) {
      let end = Date.now()
      console.log(end - begin)

      self.coloriser.updateReferenceColor(scaledBlocks)
    })
  })

  self.drawBlock = self.scheduler(function(block) {
    let pix = self.ctx.createImageData(block.size, block.size)

    // TODO: this belongs in the coloriser
    self.coloriser.blockDataToPixelData(block.data, pix)

    self.ctx.putImageData(
      pix,
      block.pixelPos.x,
      block.pixelPos.y
    )
  })

  self.drawBlocksCached = deferAndDropExcess(function() {
    if (!self.displayBlockStore) {
      self.draw()
      return
    }

    self.scheduler.clear()
    //self.displayBlockStore.blocks.forEach(self.scheduler(self.drawBlock))
    self.displayBlockStore.blocks.forEach(self.drawBlock)
  })

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
