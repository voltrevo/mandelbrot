'use strict';

module.exports = (re, im, depth) => {
  let a = re;
  let b = im;

  let iter = 0;
  let radius = 0;
  let lastRadius = 0;

  while (true) {
    radius = a * a + b * b;

    if (radius >= 4 || iter >= depth) {
      break;
    }

    lastRadius = radius;
    const a2 = a;
    const b2 = b;
    a = a2 * a2 - b2 * b2 + re;
    b = 2 * a2 * b2 + im;

    iter++;
  }

  if (iter === depth) {
    return iter;
  }

  return iter + (4 - lastRadius) / (radius - lastRadius);
};
