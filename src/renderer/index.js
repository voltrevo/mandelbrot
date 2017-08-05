'use strict';

const calculator = require('./calculator');
const coloriser = require('./coloriser');
const deferAndDropExcess = require('./deferAndDropExcess');
const displayBlockStore = require('./displayBlockStore');
const scheduler = require('./scheduler');

const getDiscreteScroll = function (el, threshold, cb) {
  let excess = 0;

  el.addEventListener('wheel', (evt) => {
    excess += evt.deltaY;

    while (excess >= threshold) {
      cb(evt, threshold);
      console.log(threshold);
      excess -= threshold;
    }

    while (excess <= -threshold) {
      cb(evt, -threshold);
      console.log(-threshold);
      excess += threshold;
    }
  });
};

module.exports = function Renderer(canvas) {
  const self = this;

  self.depth = 500;
  self.canvas = canvas;
  self.ctx = canvas.getContext('2d');
  self.center = { x: -0.75, y: 0 };
  self.width = 8;

  self.coloriser = new coloriser();

  self.calculator = calculator();
  self.displayBlockStore = null;

  self.pixelRatio = window.devicePixelRatio || 1;

  self.scheduler = scheduler(20);

  self.drawBegin = null;
  self.drawEnd = null;

  self.updateSize = function () {
    canvas.style.width = `${canvas.parentNode.clientWidth}px`;
    canvas.style.height = `${canvas.parentNode.clientHeight}px`;

    canvas.width = self.pixelRatio * canvas.parentNode.clientWidth;
    canvas.height = self.pixelRatio * canvas.parentNode.clientHeight;
  }

  ;(function () {
    const lastMousedown = { x: 0, y: 0 };

    self.updateSize();

    canvas.parentNode.addEventListener('keydown', (evt) => {
      if (evt.keyCode === 67) {
        self.coloriser.randomise(!evt.shiftKey ? 1 : -1);
        self.drawBlocksCached(); // TODO: rename to redrawCurrentBlocks?
      }

      if (evt.keyCode === 187 || evt.keyCode === 189) {
        if (evt.shiftKey) {
          self.coloriser.shift(0.05 * (188 - evt.keyCode));
        } else {
          self.coloriser.multiplySpeed(Math.exp(0.05 * (188 - evt.keyCode)));
        }

        self.drawBlocksCached();
      }
    });

    let dragData = null;
    let dragDataComplete = false;

    canvas.addEventListener('mousedown', (e) => {
      lastMousedown.x = e.clientX;
      lastMousedown.y = e.clientY;
      dragData = self.ctx.getImageData(0, 0, canvas.width, canvas.height);
      const drawing = self.drawBegin && !self.drawEnd;
      dragDataComplete = !drawing;
    });

    canvas.addEventListener('mousemove', (e) => {
      if (!dragData) {
        return;
      }

      const diff = { x: e.clientX - lastMousedown.x, y: e.clientY - lastMousedown.y };
      self.ctx.clearRect(0, 0, canvas.width, canvas.height);
      self.ctx.putImageData(dragData, self.pixelRatio * diff.x, self.pixelRatio * diff.y);
    });

    canvas.addEventListener('mouseup', (e) => {
      dragData = null;
      const diff = { x: e.clientX - lastMousedown.x, y: e.clientY - lastMousedown.y };

      if (diff.x === 0 && diff.y === 0) {
        return;
      }

      const pixelSize = self.width / canvas.width;
      const aspectRatio = canvas.width / canvas.height;

      const alreadyDrawnRect = dragDataComplete && {
        topLeft: {
          x: self.center.x - 0.5 * self.width,
          y: self.center.y - 0.5 / aspectRatio * self.width,
        },
        bottomRight: {
          x: self.center.x + 0.5 * self.width,
          y: self.center.y + 0.5 / aspectRatio * self.width,
        },
      };

      const pos = {
        x: (
          self.center.x -
          0.5 * self.width +
          lastMousedown.x * self.pixelRatio * pixelSize
        ),
        y: (
          self.center.y -
          0.5 / aspectRatio *
          self.width +
          lastMousedown.y * self.pixelRatio * pixelSize
        ),
      };

      self.moveCenter({
        x: -diff.x * pixelSize * self.pixelRatio,
        y: -diff.y * pixelSize * self.pixelRatio,
      });

      self.draw(pos, alreadyDrawnRect);
    });

    const zoom = function (dz, pos) {
      const pixelSize = self.width / canvas.width;
      const aspectRatio = canvas.width / canvas.height;

      self.scale(
        dz < 0 ? 2 / 3 : 3 / 2,
        {
          x: (
            self.center.x -
            0.5 * self.width +
            pos.x * self.pixelRatio * pixelSize
          ),
          y: (
            self.center.y -
            0.5 / aspectRatio * self.width +
            self.pixelRatio * pixelSize * pos.y
          ),
        },
      );
    };

    const mousePos = {
      x: 0,
      y: 0,
    };

    canvas.addEventListener('mousemove', (e) => {
      mousePos.x = e.clientX;
      mousePos.y = e.clientY;
    });

    getDiscreteScroll(canvas, 30, (e, dy) => {
      zoom(dy > 0 ? 1 : -1, mousePos);
    });

    canvas.parentNode.addEventListener('keydown', (e) => {
      if (e.keyCode === 68) {
        self.depth = parseInt(window.prompt('Enter new depth', '500'));
        self.draw();
      } else if (e.keyCode === 65) { // a
        zoom(-1, mousePos);
      } else if (e.keyCode === 90) { // z
        zoom(1, mousePos);
      }
    });
  }());

  self.draw = deferAndDropExcess((pos, alreadyDrawnRect) => { // pos === referencePoint?
    pos = pos || self.center;
    self.scheduler.clear();

    // self.coloriser.clearCache() // TODO: was this a good idea when it used to work?

    const pixelWidth = self.width / canvas.width;
    const aspectRatio = canvas.width / canvas.height;

    const topLeft = {
      x: self.center.x - 0.5 * self.width,
      y: self.center.y - 0.5 / aspectRatio * self.width,
    };

    const bottomRight = {
      x: topLeft.x + self.width,
      y: topLeft.y + self.width / aspectRatio,
    };

    const rect = { topLeft, bottomRight };

    self.drawBegin = Date.now();
    self.drawEnd = null;

    self.displayBlockStore = new displayBlockStore(
      self.center,
      self.canvas.width,
      self.canvas.height,
      self.width,
      self.width / self.canvas.width * self.canvas.height,
    );

    let incompleteDraw = false;

    Promise.all(
      self.calculator.getBlocksForScreen(
        pos,
        rect,
        alreadyDrawnRect,
        pixelWidth,
        self.depth,
      ).map(blockPromise => blockPromise.then((block) => {
        if (!block) {
          incompleteDraw = true;
          return null;
        }

        const scaledBlock = self.displayBlockStore.scaleBlock(block);
        self.displayBlockStore.add(scaledBlock);

        return self.drawBlock(scaledBlock).then((drawn) => {
          if (!drawn) {
            incompleteDraw = true;
          }

          return scaledBlock;
        });
      })),
    ).then((scaledBlocks) => {
      if (!incompleteDraw) {
        self.drawEnd = Date.now();
        console.log(self.drawEnd - self.drawBegin);
      }

      self.coloriser.updateReferenceColor(scaledBlocks);
    });
  });

  self.drawBlock = self.scheduler((block) => {
    const pix = self.ctx.createImageData(block.size, block.size);

    // TODO: this belongs in the coloriser
    self.coloriser.blockDataToPixelData(block.data, pix);

    self.ctx.putImageData(
      pix,
      block.pixelPos.x,
      block.pixelPos.y,
    );

    return true;
  });

  self.drawBlocksCached = deferAndDropExcess(() => {
    if (!self.displayBlockStore) {
      self.draw();
      return;
    }

    self.scheduler.clear();
    // self.displayBlockStore.blocks.forEach(self.scheduler(self.drawBlock))
    self.displayBlockStore.blocks.forEach(self.drawBlock);
  });

  self.scale = function (factor, pos) {
    pos = (pos || self.center);

    self.center = {
      x: factor * self.center.x + (1 - factor) * pos.x,
      y: factor * self.center.y + (1 - factor) * pos.y,
    };

    self.width *= factor;

    self.draw(pos);
  };

  self.moveCenter = function (p) {
    self.center.x += p.x;
    self.center.y += p.y;
  };
};
