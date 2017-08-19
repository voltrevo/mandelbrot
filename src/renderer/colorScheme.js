'use strict';

const lerp = require('./lerp');
const rand = require('./rand');

const createInterpolator = nodeGenerator => r => {
  const floorOfR = Math.floor(r);
  const leftNode = nodeGenerator(floorOfR);
  const rightNode = nodeGenerator(floorOfR + 1);

  return lerp(leftNode, rightNode, r - floorOfR);
};

const createNodeGenerator = seed => {
  const randOffset = rand(seed);
  const cacheMap = [];
  return r => {
    let node = cacheMap[r + 1000000];

    if (!node) {
      node = [0, 0.333, 0.667].map(x => rand(r + randOffset + x));
      cacheMap[r + 1000000] = node;
    }

    return node;
  };
};

const createRandomInterpolator = seed => {
  const offset = rand(rand(seed));
  const baseInterpolator = createInterpolator(createNodeGenerator(seed));

  return r => baseInterpolator(r + offset);
};

module.exports = {
  createRandom: createRandomInterpolator,
  magicValue: Math.floor(966908800 * Math.sqrt(2)),
};
