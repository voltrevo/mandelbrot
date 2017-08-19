'use strict';

require('./style.css');

const Element = require('./Element.html');

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

  return el;
};

module.exports = ControlPanel;
