'use strict';

const ControlPanel = require('./ControlPanel');
const InfoOverlay = require('info-overlay');
const InfoContent = require('./info.html');
const Renderer = require('./renderer/index');

require('./style.css');

window.addEventListener('load', () => {
  document.title = 'js mandelbrot';

  document.body.appendChild(ControlPanel());

  const disableScaleMeta = document.createElement('meta');
  disableScaleMeta.setAttribute('name', 'viewport');
  disableScaleMeta.setAttribute('content', 'user-scalable=no');
  document.head.appendChild(disableScaleMeta);

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
