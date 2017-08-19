'use strict';

const ControlPanel = require('./ControlPanel');
const Renderer = require('./renderer/index');

require('./style.css');

window.addEventListener('load', () => {
  document.title = 'js mandelbrot';

  const disableScaleMeta = document.createElement('meta');
  disableScaleMeta.setAttribute('name', 'viewport');
  disableScaleMeta.setAttribute('content', 'user-scalable=no');
  document.head.appendChild(disableScaleMeta);

  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);

  const renderer = new Renderer(canvas);

  document.body.appendChild(ControlPanel(renderer.controls));

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
