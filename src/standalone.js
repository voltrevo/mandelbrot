'use strict';

const InfoOverlay = require('info-overlay');
const InfoContent = require('./info.html');
const Renderer = require('./renderer/index');

require('./style.css');

window.addEventListener('load', () => {
  document.title = 'js mandelbrot';

  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);

  const infoOverlay = InfoOverlay();
  infoOverlay.overlay.innerHTML = InfoContent().innerHTML;

  document.body.appendChild(infoOverlay.icon);

  const renderer = new Renderer(canvas);

  let resizeTimeout = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);

    resizeTimeout = setTimeout(() => {
      renderer.updateSize();
      renderer.draw();
    }, 300);
  });

  renderer.draw();
});
