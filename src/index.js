'use strict'

var Renderer = require('./renderer/index')

window.addEventListener('load', function() {
  document.body.style.overflow = 'hidden'

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
