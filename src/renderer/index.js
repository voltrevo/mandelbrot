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

    let touchSession = null;

    const touchSessionRef = () => {
      if (!touchSession) {
        return null;
      }

      if (!touchSession.secondary) {
        return touchSession.primary;
      }

      return {
        start: {
          x: 0.5 * (touchSession.primary.start.x + touchSession.secondary.start.x),
          y: 0.5 * (touchSession.primary.start.y + touchSession.secondary.start.y),
        },
        curr: {
          x: 0.5 * (touchSession.primary.curr.x + touchSession.secondary.curr.x),
          y: 0.5 * (touchSession.primary.curr.y + touchSession.secondary.curr.y),
        },
      };
    };

    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();

      if (!touchSession) {
        touchSession = {
          dragData: (() => {
            const cvs = document.createElement('canvas');
            cvs.setAttribute('width', canvas.width);
            cvs.setAttribute('height', canvas.height);

            const ctx = cvs.getContext('2d');
            const imgData = self.ctx.getImageData(0, 0, canvas.width, canvas.height);
            ctx.putImageData(imgData, 0, 0);

            return cvs;
          })(),
          dragDataIncomplete: self.drawBegin && !self.drawEnd,
        };
      }

      Array.from(e.changedTouches).forEach((touch) => {
        const touchDetails = {
          id: touch.identifier,
          start: {
            x: touch.clientX,
            y: touch.clientY,
          },
          curr: {
            x: touch.clientX,
            y: touch.clientY,
          },
        };

        if (!touchSession.primary) {
          touchSession.primary = touchDetails;
        } else if (!touchSession.secondary) {
          touchSession.secondary = touchDetails;
        }
      });
    });

    canvas.addEventListener('touchmove', (e) => {
      if (!touchSession) {
        return;
      }

      let primaryTouchChanged = false;
      let secondaryTouchChanged = false;

      const primaryTouch = Array.from(e.changedTouches).filter(t => t.identifier === touchSession.primary.id)[0];

      if (primaryTouch) {
        e.preventDefault();

        touchSession.primary.curr.x = primaryTouch.clientX;
        touchSession.primary.curr.y = primaryTouch.clientY;

        primaryTouchChanged = true;
      }

      if (touchSession.secondary) {
        const secondaryTouch = Array.from(e.changedTouches).filter(t => t.identifier === touchSession.secondary.id)[0];

        if (secondaryTouch) {
          touchSession.secondary.curr.x = secondaryTouch.clientX;
          touchSession.secondary.curr.y = secondaryTouch.clientY;

          const sq = x => x * x;
          const dist = (p1, p2) => Math.sqrt(sq(p1.x - p2.x) + sq(p1.y - p2.y));

          touchSession.zoom = (
            dist(touchSession.primary.curr, touchSession.secondary.curr) /
            dist(touchSession.primary.start, touchSession.secondary.start)
          );

          secondaryTouchChanged = true;
        }
      }

      if (primaryTouchChanged || secondaryTouchChanged) {
        const refTouch = touchSessionRef();
        const diff = { x: refTouch.curr.x - refTouch.start.x, y: refTouch.curr.y - refTouch.start.y };
        self.ctx.clearRect(0, 0, canvas.width, canvas.height);

        const zoom = touchSession.zoom || 1;

        let dx = 0;
        dx += self.pixelRatio * diff.x;
        dx += self.pixelRatio * refTouch.start.x * (1 - zoom);

        let dy = 0;
        dy += self.pixelRatio * diff.y;
        dy += self.pixelRatio * refTouch.start.y * (1 - zoom);

        self.ctx.drawImage(
          touchSession.dragData,
          dx,
          dy,
          touchSession.dragData.width * zoom,
          touchSession.dragData.height * zoom,
        );
      }
    });

    canvas.addEventListener('touchcancel', (e) => {
      if (!touchSession) {
        return;
      }

      const primaryTouch = Array.from(e.changedTouches).filter(t => t.identifier === touchSession.primary.id)[0];

      if (!primaryTouch) {
        return;
      }

      touchSession = null;
      self.draw(self.center);
    });

    canvas.addEventListener('touchend', (e) => {
      if (!touchSession) {
        return;
      }

      const primaryTouch = Array.from(e.changedTouches).filter(t => t.identifier === touchSession.primary.id)[0];

      if (!primaryTouch) {
        return;
      }

      const refTouch = touchSessionRef();

      const diff = { x: refTouch.curr.x - refTouch.start.x, y: refTouch.curr.y - refTouch.start.y };

      if (diff.x === 0 && diff.y === 0) {
        return;
      }

      const pixelSize = self.width / canvas.width;
      const aspectRatio = canvas.width / canvas.height;

      const alreadyDrawnRect = {
        topLeft: {
          x: self.center.x - 0.5 * self.width,
          y: self.center.y - 0.5 / aspectRatio * self.width,
        },
        bottomRight: {
          x: self.center.x + 0.5 * self.width,
          y: self.center.y + 0.5 / aspectRatio * self.width,
        },
        needsRedraw: touchSession.dragDataIncomplete || touchSession.zoom,
      };

      const pos = {
        x: (
          self.center.x -
          0.5 * self.width +
          refTouch.start.x * self.pixelRatio * pixelSize
        ),
        y: (
          self.center.y -
          0.5 / aspectRatio *
          self.width +
          refTouch.start.y * self.pixelRatio * pixelSize
        ),
      };

      self.moveCenter({
        x: -diff.x * pixelSize * self.pixelRatio,
        y: -diff.y * pixelSize * self.pixelRatio,
      });

      if (touchSession.zoom) {
        self.scale(1 / touchSession.zoom, pos, alreadyDrawnRect);
      } else {
        self.draw(pos, alreadyDrawnRect);
      }

      touchSession = null;
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

  self.scale = function (factor, pos, alreadyDrawnRect) {
    pos = (pos || self.center);

    self.center = {
      x: factor * self.center.x + (1 - factor) * pos.x,
      y: factor * self.center.y + (1 - factor) * pos.y,
    };

    self.width *= factor;

    self.draw(pos, alreadyDrawnRect);
  };

  self.moveCenter = function (p) {
    self.center.x += p.x;
    self.center.y += p.y;
  };
};
