'use strict';

const InfoOverlay = require('info-overlay');

const Element = require('./Element.html');
const InfoContent = require('./info.html');

require('./style.css');

const ControlPanel = controls => {
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

  (() => {
    const randomise = e => {
      controls.randomiseColors(e.shiftKey ? -1 : 1);
    };

    el.querySelector('#randomise-colors-button').addEventListener('click', randomise);

    el.querySelector('#randomise-colors-button .previous').addEventListener('click', e => {
      controls.randomiseColors(e.shiftKey ? 1 : -1);
      e.stopPropagation();
    });

    window.addEventListener('keydown', e => {
      if (e.keyCode === 67) {
        // 'c'
        randomise(e);
      }
    });
  })();

  (() => {
    el.querySelector('#increase-coloring-rate-button').addEventListener('click', e => {
      controls.changeColoringRate(e.shiftKey ? -1 : 1);
    });

    el.querySelector('#decrease-coloring-rate-button').addEventListener('click', e => {
      controls.changeColoringRate(e.shiftKey ? 1 : -1);
    });

    window.addEventListener('keydown', e => {
      if (e.keyCode === 187 || e.keyCode === 189) {
        // + or - keys
        if (e.shiftKey) {
          // self.coloriser.shift(0.05 * (188 - evt.keyCode));
        } else {
          controls.changeColoringRate(188 - e.keyCode);
        }

        self.drawBlocksCached();
      }
    });
  })();

  return el;
};

module.exports = ControlPanel;
