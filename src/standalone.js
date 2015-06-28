'use strict'

let InfoOverlay = require('info-overlay')
let InfoContent = require('./info.html')
let Renderer = require('./renderer/index')

require('./style.css')

window.addEventListener('load', function() {
  document.title = 'js mandelbrot'

  let canvas = document.createElement('canvas')
  document.body.appendChild(canvas)

  let infoOverlay = InfoOverlay()
  infoOverlay.overlay.innerHTML = InfoContent().innerHTML

  document.body.appendChild(infoOverlay.icon)

  let renderer = new Renderer(canvas)

  let resizeTimeout = null
  window.addEventListener('resize', function() {
    clearTimeout(resizeTimeout)

    resizeTimeout = setTimeout(function() {
      renderer.updateSize()
      renderer.draw()
    }, 300)
  })

  renderer.draw()
})
