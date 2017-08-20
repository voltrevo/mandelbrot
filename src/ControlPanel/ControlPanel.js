'use strict';

const InfoOverlay = require('info-overlay');

const Element = require('./Element.html');
const InfoContent = require('./info.html');
const SpringSlider = require('./SpringSlider');

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
    // Zoom

    el.querySelector('#zoom-button .plus').addEventListener('click', () => controls.zoom(-1));
    el.querySelector('#zoom-button .minus').addEventListener('click', () => controls.zoom(1));

    window.addEventListener('keydown', e => {
      if (e.keyCode === 65) {
        // a
        controls.zoom(-1, controls.mousePos);
      } else if (e.keyCode === 90) {
        // z
        controls.zoom(1, controls.mousePos);
      }
    });
  })();

  (() => {
    // Color Change

    el.querySelector('#change-colors-button .plus').addEventListener('click', () => {
      controls.changeColors(1);
    });

    el.querySelector('#change-colors-button .minus').addEventListener('click', () => {
      controls.changeColors(-1);
    });

    window.addEventListener('keydown', e => {
      if (e.keyCode === 67) {
        // 'c'
        controls.changeColors(e.shiftKey ? -1 : 1);
      }
    });
  })();

  (() => {
    // Color Scaling

    el.querySelector('#coloring-rate-button .plus').addEventListener('click', () => {
      controls.changeColoringRate(1);
    });

    el.querySelector('#coloring-rate-button .minus').addEventListener('click', () => {
      controls.changeColoringRate(-1);
    });

    el.querySelector('#slide-colors-button .plus').addEventListener('click', () => {
      controls.slideColors(-1);
    });

    el.querySelector('#slide-colors-button .minus').addEventListener('click', () => {
      controls.slideColors(1);
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

  (() => {
    // Depth

    const formatCommas = n => {
      let res = '';

      const nStr = String(n);
      nStr.split('').forEach((digit, i) => {
        res += digit;

        const digitsRemaining = nStr.length - i - 1;

        if (digitsRemaining % 3 === 0 && digitsRemaining !== 0) {
          res += ',';
        }
      });

      return res;
    };

    const slider = SpringSlider(el.querySelector('#depth-button #depth-range'));
    const depth = () => Math.floor(500 * Math.exp(0.05 * slider.value));

    const depthDisplay = el.querySelector('#depth-display');
    const updateDepthDisplay = () => (depthDisplay.textContent = formatCommas(depth()));
    updateDepthDisplay();

    slider.oninput = () => {
      controls.stopDraw();
      updateDepthDisplay();
    };

    slider.onchange = () => controls.changeDepth(depth());
  })();

  return el;
};

module.exports = ControlPanel;
