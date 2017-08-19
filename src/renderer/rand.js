'use strict';

module.exports = seed => {
  for (let i = 0; i !== 10; ++i) {
    seed -= (seed * seed + 1) / (2 * seed);
  }

  seed *= 10000;

  return seed - Math.floor(seed);
};
