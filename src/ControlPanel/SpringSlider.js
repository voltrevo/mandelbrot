'use strict';

require('./slider.css');

const SpringSlider = (
  range = (() => {
    const res = document.createElement('input');
    res.setAttribute('type', 'range');
    return res;
  })(),
) => {
  const slider = {};
  slider.value = 0;
  slider.oninput = null;
  slider.onchange = null;
  slider.range = range;

  range.min = -1;
  range.max = 1;
  range.value = 0;
  range.step = 'any';

  let active = false;

  range.addEventListener('input', () => {
    if (!active) {
      active = true;

      const outChangerId = setInterval(() => {
        const rawValue = parseFloat(range.value);
        slider.value += rawValue ** 3;

        if (slider.oninput) {
          slider.oninput();
        }
      }, 17);

      const resetRange = () => {
        window.removeEventListener('mouseup', resetRange);
        window.removeEventListener('touchend', resetRange);

        let value = range.value;

        const id = setInterval(() => {
          value *= 0.85;
          range.value = value;

          if (Math.abs(value) / (range.max - range.min) * range.getBoundingClientRect().width < 1) {
            range.value = 0;
            clearInterval(id);
            clearInterval(outChangerId);

            if (slider.onchange) {
              slider.onchange();
            }
          }
        }, 17);

        active = false;
      };

      window.addEventListener('mouseup', resetRange);
      window.addEventListener('touchend', resetRange);
    }
  });

  return slider;
};

module.exports = SpringSlider;
