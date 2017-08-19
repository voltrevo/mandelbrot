'use strict';

const InfoOverlay = require('info-overlay');

const Element = require('./Element.html');
const InfoContent = require('./info.html');

require('./style.css');

const ControlPanel = () => {
  const el = Element();
  const icon = el.querySelector('.icon');

  el.querySelector('.icon').addEventListener('click', () => {
    el.classList.toggle('expanded');
    icon.classList.add('disable-hover');

    let handler;
    window.addEventListener(
      'mousemove',
      (handler = () => {
        window.removeEventListener('mousemove', handler);
        icon.classList.remove('disable-hover');
      }),
    );
  });

  const infoOverlay = InfoOverlay();
  infoOverlay.overlay.innerHTML = InfoContent().innerHTML;

  el.querySelector('#information-button').addEventListener('click', () => infoOverlay.icon.click());

  return el;
};

module.exports = ControlPanel;
