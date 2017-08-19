'use strict';

require('./style.css');

const Element = require('./Element.html');

const ControlPanel = () => {
  const el = Element();

  el.querySelector('.icon').addEventListener('click', () => {
    el.classList.toggle('expanded');
  });

  return el;
};

module.exports = ControlPanel;
