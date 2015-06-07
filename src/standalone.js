'use strict'

var InfoOverlay = require('info-overlay')
var InfoContent = require('./info.html')
var Renderer = require('./renderer/index')

require('./style.css')

window.addEventListener('load', function() {
  document.title = 'js mandelbrot'

  var canvas = document.createElement('canvas')
  document.body.appendChild(canvas)

  var infoOverlay = InfoOverlay()
  infoOverlay.overlay.innerHTML = InfoContent().innerHTML

  document.body.appendChild(infoOverlay.icon)

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
