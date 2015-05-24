'use strict'

var Renderer = require('./renderer')

window.addEventListener('load', function() {
  var canvas = document.createElement('canvas')
  document.body.appendChild(canvas)

  var renderer = new Renderer(canvas)

  var resizeTimeout = null
  window.addEventListener('resize', function() {
    clearTimeout(resizeTimeout)

    resizeTimeout = setTimeout(function() {
      renderer.updateSize()
      renderer.draw()
    }, 300)
  })

  renderer.draw()
})
