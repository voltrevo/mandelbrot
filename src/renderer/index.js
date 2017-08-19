'use strict';

const calculator = require('./calculator');
const coloriser = require('./coloriser');
const deferAndDropExcess = require('./deferAndDropExcess');
const displayBlockStore = require('./displayBlockStore');
const scheduler = require('./scheduler');

module.exports = function Renderer(canvas) {
  const self = this;

  self.depth = 500;
  self.canvas = canvas;
  self.ctx = canvas.getContext('2d');
  self.center = { x: -0.75, y: 0 };
  self.width = 8;

  self.coloriser = coloriser();

  self.calculator = calculator();
  self.displayBlockStore = null;

  self.pixelRatio = window.devicePixelRatio || 1;

  self.scheduler = scheduler(20);

  self.drawIndex = 0;
  self.drawBegin = null;
  self.drawEnd = null;

  self.updateSize = () => {
    const imgData = self.ctx.getImageData(0, 0, canvas.width, canvas.height);

    canvas.style.width = `${canvas.parentNode.clientWidth}px`;
    canvas.style.height = `${canvas.parentNode.clientHeight}px`;

    canvas.width = self.pixelRatio * canvas.parentNode.clientWidth;
    canvas.height = self.pixelRatio * canvas.parentNode.clientHeight;

    self.ctx.putImageData(imgData, 0, 0);
  };
  (() => {
    self.updateSize();

    canvas.parentNode.addEventListener('keydown', evt => {
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

    let pressSession = null;

    const pressSessionRef = () => {
      if (!pressSession) {
        return null;
      }

      if (!pressSession.secondary) {
        return pressSession.primary;
      }

      return {
        start: {
          x: 0.5 * (pressSession.primary.start.x + pressSession.secondary.start.x),
          y: 0.5 * (pressSession.primary.start.y + pressSession.secondary.start.y),
        },
        curr: {
          x: 0.5 * (pressSession.primary.curr.x + pressSession.secondary.curr.x),
          y: 0.5 * (pressSession.primary.curr.y + pressSession.secondary.curr.y),
        },
      };
    };

    const onPressStart = press => {
      if (!pressSession) {
        pressSession = (() => {
          const dragData = document.createElement('canvas');
          dragData.setAttribute('width', canvas.width);
          dragData.setAttribute('height', canvas.height);

          const ctx = dragData.getContext('2d');

          ctx.drawImage(canvas, 0, 0, 2, 2);
          const averageImgData = ctx.getImageData(0, 0, 2, 2);
          const dat = averageImgData.data;
          const a = [
            0.25 * [dat[0] + dat[4] + dat[8] + dat[12]],
            0.25 * [dat[1] + dat[5] + dat[9] + dat[13]],
            0.25 * [dat[2] + dat[6] + dat[10] + dat[14]],
            0.25 * [dat[3] + dat[7] + dat[11] + dat[15]],
          ].map(n => Math.floor(n));
          const dragColor = `rgba(${a.join(', ')})`;

          const imgData = self.ctx.getImageData(0, 0, canvas.width, canvas.height);
          ctx.putImageData(imgData, 0, 0);

          const dragDataIncomplete = self.drawBegin && !self.drawEnd;

          return { dragData, dragColor, dragDataIncomplete };
        })();

        self.drawIndex++;
      }

      const pressDetails = {
        id: press.id,
        start: { x: press.x, y: press.y },
        curr: { x: press.x, y: press.y },
      };

      if (!pressSession.primary) {
        pressSession.primary = pressDetails;
      } else if (!pressSession.secondary) {
        pressSession.secondary = pressDetails;
      }
    };

    const onPressMove = press => {
      if (!pressSession) {
        return;
      }

      let primaryPressChanged = false;
      let secondaryPressChanged = false;

      if (press.id === pressSession.primary.id) {
        pressSession.primary.curr.x = press.x;
        pressSession.primary.curr.y = press.y;

        primaryPressChanged = true;
      }

      if (press.id === (pressSession.secondary && pressSession.secondary.id)) {
        pressSession.secondary.curr.x = press.x;
        pressSession.secondary.curr.y = press.y;

        const sq = x => x * x;
        const dist = (p1, p2) => Math.sqrt(sq(p1.x - p2.x) + sq(p1.y - p2.y));

        pressSession.zoom =
          dist(pressSession.primary.curr, pressSession.secondary.curr) /
          dist(pressSession.primary.start, pressSession.secondary.start);

        secondaryPressChanged = true;
      }

      if (primaryPressChanged || secondaryPressChanged) {
        const refPress = pressSessionRef();
        const diff = {
          x: refPress.curr.x - refPress.start.x,
          y: refPress.curr.y - refPress.start.y,
        };
        self.ctx.fillStyle = pressSession.dragColor;
        self.ctx.fillRect(0, 0, canvas.width, canvas.height);

        const zoom = pressSession.zoom || 1;

        let dx = 0;
        dx += self.pixelRatio * diff.x;
        dx += self.pixelRatio * refPress.start.x * (1 - zoom);

        let dy = 0;
        dy += self.pixelRatio * diff.y;
        dy += self.pixelRatio * refPress.start.y * (1 - zoom);

        self.ctx.drawImage(
          pressSession.dragData,
          dx,
          dy,
          pressSession.dragData.width * zoom,
          pressSession.dragData.height * zoom,
        );
      }
    };

    const onPressCancel = press => {
      if (!pressSession) {
        return;
      }

      if (press.id !== pressSession.primary.id) {
        return;
      }

      pressSession = null;
      self.draw(self.center);
    };

    const onPressEnd = press => {
      if (!pressSession) {
        return;
      }

      if (press.id !== pressSession.primary.id) {
        return;
      }

      const refPress = pressSessionRef();

      const diff = { x: refPress.curr.x - refPress.start.x, y: refPress.curr.y - refPress.start.y };

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
        needsRedraw: pressSession.dragDataIncomplete || pressSession.zoom,
      };

      const pos = {
        x: self.center.x - 0.5 * self.width + refPress.start.x * self.pixelRatio * pixelSize,
        y:
          self.center.y -
          0.5 / aspectRatio * self.width +
          refPress.start.y * self.pixelRatio * pixelSize,
      };

      self.moveCenter({
        x: -diff.x * pixelSize * self.pixelRatio,
        y: -diff.y * pixelSize * self.pixelRatio,
      });

      if (pressSession.zoom) {
        self.scale(1 / pressSession.zoom, pos, alreadyDrawnRect);
      } else {
        self.draw(pos, alreadyDrawnRect);
      }

      pressSession = null;
    };

    let clickCount = 0;
    let clickInProgress = false;

    canvas.addEventListener('mousedown', e => {
      if (clickInProgress) {
        return;
      }

      clickInProgress = true;

      onPressStart({
        x: e.clientX,
        y: e.clientY,
        id: `click${clickCount}`,
      });
    });

    canvas.addEventListener('mousemove', e => {
      onPressMove({
        x: e.clientX,
        y: e.clientY,
        id: `click${clickCount}`,
      });
    });

    canvas.addEventListener('mouseup', e => {
      clickInProgress = false;

      onPressEnd({
        x: e.clientX,
        y: e.clientY,
        id: `click${clickCount}`,
      });

      clickCount++;
    });

    canvas.addEventListener('touchstart', e => {
      e.preventDefault();

      Array.from(e.changedTouches).forEach(touch => {
        onPressStart({
          x: touch.clientX,
          y: touch.clientY,
          id: `touch${touch.identifier}`,
        });
      });
    });

    canvas.addEventListener('touchmove', e => {
      e.preventDefault();

      Array.from(e.changedTouches).forEach(touch => {
        onPressMove({
          x: touch.clientX,
          y: touch.clientY,
          id: `touch${touch.identifier}`,
        });
      });
    });

    canvas.addEventListener('touchcancel', e => {
      Array.from(e.changedTouches).forEach(touch => {
        onPressCancel({
          x: touch.clientX,
          y: touch.clientY,
          id: `touch${touch.identifier}`,
        });
      });
    });

    canvas.addEventListener('touchend', e => {
      Array.from(e.changedTouches).forEach(touch => {
        onPressEnd({
          x: touch.clientX,
          y: touch.clientY,
          id: `touch${touch.identifier}`,
        });
      });
    });

    const zoom = (dz, pos) => {
      const pixelSize = self.width / canvas.width;
      const aspectRatio = canvas.width / canvas.height;

      self.scale(dz < 0 ? 2 / 3 : 3 / 2, {
        x: self.center.x - 0.5 * self.width + pos.x * self.pixelRatio * pixelSize,
        y: self.center.y - 0.5 / aspectRatio * self.width + self.pixelRatio * pixelSize * pos.y,
      });
    };

    const mousePos = {
      x: 0,
      y: 0,
    };

    canvas.addEventListener('mousemove', e => {
      mousePos.x = e.clientX;
      mousePos.y = e.clientY;
    });

    canvas.parentNode.addEventListener('keydown', e => {
      if (e.keyCode === 68) {
        self.depth = Number(window.prompt('Enter new depth', '500'));
        self.draw();
      } else if (e.keyCode === 65) {
        // a
        zoom(-1, mousePos);
      } else if (e.keyCode === 90) {
        // z
        zoom(1, mousePos);
      }
    });
  })();

  self.draw = deferAndDropExcess((pos, alreadyDrawnRect) => {
    // pos === referencePoint?
    pos = pos || self.center;
    self.scheduler.clear();
    self.drawIndex++;
    const drawIndex = self.drawIndex;

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

    self.displayBlockStore = displayBlockStore(
      self.center,
      self.canvas.width,
      self.canvas.height,
      self.width,
      self.width / self.canvas.width * self.canvas.height,
    );

    let incompleteDraw = false;

    const blocks = self.calculator.getBlocksForScreen(
      pos,
      rect,
      alreadyDrawnRect,
      pixelWidth,
      self.depth,
    );

    const jobs = [];
    const jobsLater = [];

    blocks.forEach(block => {
      if (!block.later && alreadyDrawnRect) {
        jobs.push(() =>
          block.calculateOnePoint().then(pointValue => {
            if (drawIndex !== self.drawIndex || pointValue === null) {
              return;
            }

            const scaled = self.displayBlockStore.scalePoint(pointValue, block.depth);
            const colorised = self.coloriser.colorise(scaled);

            if (!self.displayBlockStore.centralPixelPos) {
              const centralPixelPos = self.displayBlockStore.calculateCentralPixelPos(block);
              self.displayBlockStore.centralPixelPos = centralPixelPos;
            }

            const pixelPos = {
              x: self.displayBlockStore.centralPixelPos.x + block.size * block.j,
              y: self.displayBlockStore.centralPixelPos.y + block.size * block.i,
            };

            self.ctx.fillStyle = `rgba(${Math.floor(colorised.r)},${Math.floor(
              colorised.g,
            )},${Math.floor(colorised.b)},${Math.floor(colorised.a)}`;
            self.ctx.fillRect(pixelPos.x, pixelPos.y, block.size, block.size);
          }),
        );
      }

      jobsLater.push(() =>
        block.calculate().then(calc => {
          if (!calc) {
            incompleteDraw = true;
            return null;
          }

          if (drawIndex !== self.drawIndex) {
            return Promise.resolve();
          }

          const scaledBlock = self.displayBlockStore.scaleBlock(block);
          self.displayBlockStore.add(scaledBlock);

          return self.drawBlock(scaledBlock, drawIndex).then(drawn => {
            if (!drawn) {
              incompleteDraw = true;
            }

            return scaledBlock;
          });
        }),
      );
    });

    const promises = [];
    promises.push(...jobs.map(job => job()));

    const scaledBlocksPromise = Promise.all(jobsLater.map(job => job())).then(scaledBlocks => {
      if (!incompleteDraw) {
        self.drawEnd = Date.now();
        console.log(self.drawEnd - self.drawBegin);
      }

      self.coloriser.updateReferenceColor(scaledBlocks);
    });

    promises.push(scaledBlocksPromise);

    return Promise.all(promises);
  });

  self.drawBlock = self.scheduler((block, drawIndex) => {
    if (drawIndex !== self.drawIndex) {
      return true;
    }

    const pix = self.ctx.createImageData(block.size, block.size);

    // TODO: this belongs in the coloriser
    self.coloriser.blockDataToPixelData(block.data, pix);

    self.ctx.putImageData(pix, block.pixelPos.x, block.pixelPos.y);

    return true;
  });

  self.drawBlocksCached = deferAndDropExcess(() => {
    if (!self.displayBlockStore) {
      self.draw();
      return;
    }

    self.scheduler.clear();
    // self.displayBlockStore.blocks.forEach(self.scheduler(self.drawBlock))
    self.displayBlockStore.blocks.forEach(block => self.drawBlock(block, self.drawIndex));
  });

  self.scale = (factor, pos, alreadyDrawnRect) => {
    pos = pos || self.center;

    self.center = {
      x: factor * self.center.x + (1 - factor) * pos.x,
      y: factor * self.center.y + (1 - factor) * pos.y,
    };

    self.width *= factor;

    self.draw(pos, alreadyDrawnRect);
  };

  self.moveCenter = p => {
    self.center.x += p.x;
    self.center.y += p.y;
  };
};
