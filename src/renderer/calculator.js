'use strict';

const arrayPlane = require('./arrayPlane');
const scheduler = require('./scheduler');
const coreMandelFunction = require('./coreMandelFunction');

const coordinateLimit = 10000;

module.exports = () => {
  const self = {};

  self.center = null;

  self.blocks = arrayPlane();
  self.pixelSize = null;
  self.batchIndex = 0;

  self.blockSideLength = 64;

  self.scheduler = scheduler(30);

  self.calculateCoordBounds = (topLeft, bottomRight) => {
    const blockSize = self.blockSideLength * self.pixelSize;

    return {
      i: {
        min: Math.floor((topLeft.y - self.center.y) / blockSize),
        max: Math.floor((bottomRight.y - self.center.y) / blockSize),
      },
      j: {
        min: Math.floor((topLeft.x - self.center.x) / blockSize),
        max: Math.floor((bottomRight.x - self.center.x) / blockSize),
      },
    };
  };

  self.checkCoordBounds = coordBounds =>
    coordBounds.i.min >= -coordinateLimit &&
    coordBounds.i.max <= coordinateLimit &&
    coordBounds.j.min >= -coordinateLimit &&
    coordBounds.j.max <= coordinateLimit;

  self.coordToPos = coord => ({
    x: self.center.x + coord.j * self.blockSideLength * self.pixelSize,
    y: self.center.y + coord.i * self.blockSideLength * self.pixelSize,
  });

  self.getBlocksForScreen = (referencePoint, rect, alreadyDrawnRect, pixelSize, depth) => {
    self.batchIndex++;

    if (pixelSize !== self.pixelSize) {
      self.pixelSize = pixelSize;
      self.blocks.clear();
      self.center = {
        x: referencePoint.x,
        y: referencePoint.y,
      };
    }

    let coordBounds = self.calculateCoordBounds(rect.topLeft, rect.bottomRight);

    if (!self.checkCoordBounds(coordBounds)) {
      self.blocks.clear();
      self.center = {
        x: referencePoint.x,
        y: referencePoint.y,
      };

      coordBounds = self.calculateCoordBounds(rect.topLeft, rect.bottomRight);
      if (!self.checkCoordBounds(coordBounds)) {
        throw new Error(
          'Failed coord bounds after reset, this should not be possible for sane inputs.',
        );
      }
    }

    let blocksToCalculate = [];
    const blocksToCalculateLater = [];

    const screenWidth = rect.bottomRight.x - rect.topLeft.x;
    const screenHeight = rect.bottomRight.y - rect.topLeft.y;

    const sq = u => u * u;
    const dist = (p1, p2) => sq(screenHeight * (p1.x - p2.x)) + sq(screenWidth * (p1.y - p2.y));

    const isPosInsideDrawnRect = pos =>
      pos.x >= alreadyDrawnRect.topLeft.x &&
      pos.x < alreadyDrawnRect.bottomRight.x &&
      pos.y >= alreadyDrawnRect.topLeft.y &&
      pos.y < alreadyDrawnRect.bottomRight.y;

    for (let i = coordBounds.i.min; i <= coordBounds.i.max; i++) {
      for (let j = coordBounds.j.min; j <= coordBounds.j.max; j++) {
        const block = {
          i,
          j,
          pos: self.coordToPos({
            i,
            j,
          }),
          size: self.blockSideLength,
          depth,
          data: [],
          batchIndex: self.batchIndex,
          calculate: self.scheduler(() => {
            const cachedBlock = self.blocks.get(block.i, block.j);

            if (cachedBlock) {
              if (cachedBlock.depth === block.depth) {
                block.data = cachedBlock.data;
                return block;
              }
              // TODO: recalculate only some pixels
            }

            if (block.batchIndex !== self.batchIndex) {
              return null;
            }

            self.calculateBlock(block);
            self.blocks.set(block.i, block.j, block);

            return block;
          }),
          calculateOnePoint: self.scheduler(() => {
            const pos = self.coordToPos({ i: i + 0.5, j: j + 0.5 });
            return coreMandelFunction(pos.x, pos.y, depth);
          }),
          later: false,
        };

        // TODO: re-enable feature
        // let cachedBlock = self.blocks.get(i, j)
        // block.dist = cachedBlock ? 0 : dist(block.pos, referencePoint)
        block.dist = dist(block.pos, referencePoint);

        if (alreadyDrawnRect) {
          const lastPixelPos = {
            x: block.pos.x + (self.blockSideLength - 1) * pixelSize,
            y: block.pos.y + (self.blockSideLength - 1) * pixelSize,
          };

          if (isPosInsideDrawnRect(block.pos) && isPosInsideDrawnRect(lastPixelPos)) {
            blocksToCalculateLater.push(block);
            block.later = true;
            continue;
          }
        }

        blocksToCalculate.push(block);
      }
    }

    blocksToCalculate.sort((a, b) => a.dist - b.dist);
    blocksToCalculateLater.sort((a, b) => a.dist - b.dist);

    blocksToCalculate = [...blocksToCalculate, ...blocksToCalculateLater];

    return blocksToCalculate;
  };

  self.calculateRawBlock = (pos, depth) => {
    const result = [];

    for (let i = 0; i !== self.blockSideLength; i++) {
      for (let j = 0; j !== self.blockSideLength; j++) {
        result.push(
          coreMandelFunction(pos.x + j * self.pixelSize, pos.y + i * self.pixelSize, depth),
        );
      }
    }

    return result;
  };

  self.calculateBlock = block => {
    block.data = self.calculateRawBlock(
      self.coordToPos({
        i: block.i,
        j: block.j,
      }),
      block.depth,
    );

    return block;
  };

  return self;
};
