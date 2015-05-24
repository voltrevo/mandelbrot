'use strict'

var colorScheme = require('./colorScheme')
var Renderer = require('./renderer')

var renderer = null
var lastMousedown = {x: 0, y: 0}
var resizeTimeout = null
var colorSchemeSeedOffset = 0

window.addEventListener('load', function() {
  var canvas = document.getElementById('mandelDisplay')

  canvas.width = window.innerWidth
  canvas.height = window.innerHeight

  renderer = new Renderer(canvas)
  renderer.draw()
})

window.addEventListener('keydown', function(evt) {
  if (evt.keyCode === 67) {
    var start = new Date()

    colorSchemeSeedOffset += (!evt.shiftKey ? 1 : -1)
    renderer.colorScheme = colorScheme.createRandom(colorScheme.magicValue + colorSchemeSeedOffset)

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

document.addEventListener('mousedown', function(e) {
  lastMousedown.x = e.clientX
  lastMousedown.y = e.clientY
})

document.addEventListener('mouseup', function(e) {
  var diff = {x: e.clientX - lastMousedown.x, y: e.clientY - lastMousedown.y}
  var pixelSize = renderer.width / parseInt(window.innerWidth)
  renderer.moveCentre({x: -diff.x * pixelSize, y: diff.y * pixelSize})
  renderer.draw()
})

document.addEventListener('wheel', function(e) {
  var pixelSize = renderer.width / parseInt(window.innerWidth)
  var aspectRatio = parseInt(window.innerWidth) / parseInt(window.innerHeight)

  renderer.scale(
    e.deltaY < 0 ? 2/3 : 3/2,
    {
      x: renderer.centre.x + -0.5 * renderer.width + e.clientX * pixelSize,
      y: renderer.centre.y + 0.5 / aspectRatio * renderer.width - pixelSize * e.clientY
    }
  )
})

document.addEventListener('keydown', function(e) {
  if (e.keyCode === 68) {
    renderer.depth = parseInt(window.prompt('Enter new depth', '255'))
    renderer.draw()
  }
})
