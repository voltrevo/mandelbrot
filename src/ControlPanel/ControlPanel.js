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
    // Color Randomization
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
    // Color Scaling

    el.querySelector('#increase-coloring-rate-button').addEventListener('click', e => {
      controls.changeColoringRate(e.shiftKey ? -1 : 1);
    });

    el.querySelector('#decrease-coloring-rate-button').addEventListener('click', e => {
      controls.changeColoringRate(e.shiftKey ? 1 : -1);
    });

    el.querySelector('#slide-colors-in-button').addEventListener('click', e => {
      controls.slideColors(e.shiftKey ? 1 : -1);
    });

    el.querySelector('#slide-colors-out-button').addEventListener('click', e => {
      controls.slideColors(e.shiftKey ? -1 : 1);
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
