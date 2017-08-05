'use strict';

module.exports = function (re, im, depth) {
  let a = re;
  let b = im;

  let iter = 0;
  let radius = 0;
  let lastRadius = 0;

  while ((radius = a * a + b * b) < 4 && iter < depth) {
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
