'use strict'

var point = function(x, y) {
  return {
    x: x,
    y: y
  }
}

var color = function(r, g, b, a) {
  return {
    r: r,
    g: g,
    b: b,
    a: a
  }
}

var seedRand = function(seed) {
  for (var i = 0; i !== 10; ++i) {
    seed -= (seed * seed + 1) / (2 * seed)
  }

  seed *= 10000
  return seed - Math.floor(seed)
}

var lerp = function(a, b, r) {
  if (!a || !b) {
    return a || b
  }

  var ret = new Array(a.length)
  for (var i = 0; i !== ret.length; i++) {
    ret[i] = a[i] + (b[i] - a[i]) * r
  }

  return ret
}

var createInterpolator = function(nodes) {
  return function(r) {
    var i = 0

    while (i < nodes.length && r > nodes[i][0]) {
      i++
    }

    return lerp(
      nodes[i - 1] && nodes[i - 1][1],
      nodes[i] && nodes[i][1],
      nodes[i] && nodes[i - 1] && ((r - nodes[i - 1][0]) / (nodes[i][0] - nodes[i - 1][0]))
    )
  }
}

var interpolator = createInterpolator([
  [0, [1, 1, 1]],
  [3, [0, 0, 1]],
  [4, [0, 1, 0]],
  [7, [0, 0, 0]]
])

var createGeneratedInterpolator = function(nodeGenerator) {
  return function(r) {
    var floorOfR = Math.floor(r)
    var leftNode = nodeGenerator(floorOfR)
    var rightNode = nodeGenerator(floorOfR + 1)

    return lerp(leftNode, rightNode, r - floorOfR)
  }
}

var createNodeGenerator = function() {
  var rand = Math.random()
  var cacheMap = {}
  return function(r) {
    var node = cacheMap[r]

    if (!node) {
      node = [seedRand(r + rand), seedRand(r + rand + 0.333), seedRand(r + rand + 0.667)]
      cacheMap[r] = node
    }

    return node
  }
}

var createRandomInterpolator = function() {
  return createGeneratedInterpolator(createNodeGenerator())
}

var mandelRenderer = function(canvas) {
  this.depth = 255
  this.canvas = canvas
  this.ctx = canvas.getContext('2d')
  this.centre = new point(-0.75, 0)
  this.width = 4

  this.iterCount = 0
  this.itersPerDraw = 7 * 1000 * 1000
  this.drawIndex = 0

  // TODO: separate class
  this.blockSize = 64
  this.blockPixelSize = 1
  this.blocks = []
  this.firstBlockPos = new point(0, 0)
  this.blockTableWidth = 1
  this.blockTableHeight = 0

  this.calculateBlock = function(p) {
    var result = []
    var counter = 0

    for (var i = 0; i !== this.blockSize; i++) {
      for (var j = 0; j !== this.blockSize; j++) {
        result[counter] = this.calculatePoint(new point(
          p.x + j * this.blockPixelSize,
          p.y - i * this.blockPixelSize
        ))

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
      var interpolant = interpolator(Math.log(pointValue + 1))
      return new color(
        255 * interpolant[0],
        255 * interpolant[1],
        255 * interpolant[2],
        255
      )
    }

    return new color(0, 0, 0, 255)
  }

  this.draw = function(cached) {
    cached = (cached !== undefined ? cached : false)
    this.drawIndex++

    var pixelWidth = this.width / parseInt(this.canvas.width)
    var aspectRatio = parseInt(this.canvas.width) / parseInt(this.canvas.height)

    this.firstBlockPos.x = this.centre.x - 0.5 * this.width
    this.firstBlockPos.y = this.centre.y + 0.5 / aspectRatio * this.width

    this.blockPixelSize = pixelWidth
    //this.blocks = []
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
        this.blocks[drawState.blockIndex] = this.calculateBlock(
          new point(
            this.firstBlockPos.x + drawState.j * this.blockSize * this.blockPixelSize,
            this.firstBlockPos.y - drawState.i * this.blockSize * this.blockPixelSize))
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

var renderer = null
var lastMousedown = new point(0, 0)
var resizeTimeout = null

window.onload = function() {
  var canvas = document.getElementById('mandelDisplay')

  canvas.width = window.innerWidth
  canvas.height = window.innerHeight

  renderer = new mandelRenderer(canvas)
  renderer.draw()
}

window.addEventListener('keydown', function(evt) {
  if (evt.keyCode === 67) {
    var start = new Date()
    interpolator = createRandomInterpolator()
    renderer.draw(true)
    var end = new Date()
    console.log(end - start)
  }
})

window.addEventListener('resize', function() {
  clearTimeout(resizeTimeout)

  resizeTimeout = setTimeout(function() {
    var canvas = document.getElementById('mandelDisplay')

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    renderer.draw()
  }, 300)
})

document.onmousedown = function(e) {
  lastMousedown.x = e.clientX
  lastMousedown.y = e.clientY
}

document.onmouseup = function(e) {
  var diff = new point(e.clientX - lastMousedown.x, e.clientY - lastMousedown.y)
  var pixelSize = renderer.width / parseInt(window.innerWidth)
  renderer.moveCentre(new point(-diff.x * pixelSize, diff.y * pixelSize))
  renderer.draw()
}

document.onmousewheel = function(e) {
  var pixelSize = renderer.width / parseInt(window.innerWidth)
  var aspectRatio = parseInt(window.innerWidth) / parseInt(window.innerHeight)

  renderer.scale(
    e.wheelDelta > 0 ? 2/3 : 3/2,
    new point(
      renderer.centre.x + -0.5 * renderer.width + e.clientX * pixelSize,
      renderer.centre.y + 0.5 / aspectRatio * renderer.width - pixelSize * e.clientY
    )
  )
}

// Firefox seriously bazzed up mouse scrolling.
if (/Firefox/i.test(navigator.userAgent)) {
  document.addEventListener('DOMMouseScroll', function(e) {
    e.wheelDelta = -120 * e.detail
    document.onmousewheel(e)
  })
}

document.addEventListener('keydown', function(e) {
  if (e.keyCode === 68) {
    renderer.depth = parseInt(window.prompt('Enter new depth', '255'))
    renderer.draw()
  }
})
