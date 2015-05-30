'use strict'

var arrayPlane = require('./arrayPlane')
var scheduler = require('./scheduler')
var coreMandelFunction = require('./coreMandelFunction')

var coordinateLimit = 10000

module.exports = function() {
    var self = {}

    self.center = null

    self.blocks = arrayPlane()
    self.pixelSize = null
    self.batchIndex = 0

    self.blockSideLength = 64

    self.scheduler = scheduler(50)

    self.calculateCoordBounds = function(topLeft, bottomRight) {
        var blockSize = self.blockSideLength * self.pixelSize

        return {
            i: {
                min: Math.floor((topLeft.y - self.center.y) / blockSize),
                max: Math.floor((bottomRight.y - self.center.y) / blockSize)
            },
            j: {
                min: Math.floor((topLeft.x - self.center.x) / blockSize),
                max: Math.floor((bottomRight.x - self.center.x) / blockSize)
            }
        }
    }

    self.checkCoordBounds = function(coordBounds) {
        return (
            coordBounds.i.min >= -coordinateLimit &&
            coordBounds.i.max <= coordinateLimit &&
            coordBounds.j.min >= -coordinateLimit &&
            coordBounds.j.max <= coordinateLimit
        )
    }

    self.coordToPos = function(coord) {
        return {
            x: self.center.x + coord.j * self.blockSideLength * self.pixelSize,
            y: self.center.y + coord.i * self.blockSideLength * self.pixelSize
        }
    }

    self.getBlocksForScreen = function(
        referencePoint,
        topLeft,
        bottomRight,
        pixelSize,
        depth
    ) {
        self.batchIndex++

        if (pixelSize !== self.pixelSize) {
            self.pixelSize = pixelSize
            self.blocks.clear()
            self.center = {
                x: referencePoint.x,
                y: referencePoint.y
            }
        }

        var coordBounds = self.calculateCoordBounds(topLeft, bottomRight)

        if (!self.checkCoordBounds(coordBounds)) {
            self.blocks.clear()
            self.center = {
                x: referencePoint.x,
                y: referencePoint.y
            }
            
            coordBounds = self.calculateCoordBounds(topLeft, bottomRight)
            if (!self.checkCoordBounds(coordBounds)) {
                throw new Error(
                    'Failed coord bounds after reset, this should not be possible for sane inputs.'
                )
            }
        }

        console.log(JSON.stringify({
            topLeft: topLeft,
            bottomRight: bottomRight,
            selfCenter: self.center,
            coordBounds: coordBounds
        }))

        var blocksToCalculate = []

        var screenWidth = bottomRight.x - topLeft.x
        var screenHeight = bottomRight.y - topLeft.y

        var sq = function(u) { return u * u }
        var dist = function(p1, p2) {
            return sq(screenHeight * (p1.x - p2.x)) + sq(screenWidth * (p1.y - p2.y))
        }

        for (var i = coordBounds.i.min; i <= coordBounds.i.max; i++) {
            for (var j = coordBounds.j.min; j <= coordBounds.j.max; j++) {
                var block = {
                    i: i,
                    j: j,
                    pos: self.coordToPos({
                        i: i,
                        j: j
                    }),
                    size: self.blockSideLength,
                    depth: depth,
                    data: [],
                    batchIndex: self.batchIndex
                }

                // TODO: re-enable feature
                //var cachedBlock = self.blocks.get(i, j)
                //block.dist = cachedBlock ? 0 : dist(block.pos, referencePoint)
                block.dist = dist(block.pos, referencePoint)

                blocksToCalculate.push(block)
            }
        }

        blocksToCalculate.sort(function(a, b) {
            return a.dist - b.dist
        })

        return blocksToCalculate.map(function(block) {
            return self.scheduler(function() {
                var cachedBlock = self.blocks.get(block.i, block.j)

                if (cachedBlock) {
                    if (cachedBlock.depth === block.depth) {
                        return cachedBlock
                    } else {
                        // TODO: recalculate only some pixels
                    }
                }

                if (block.batchIndex !== self.batchIndex) {
                    return null
                }

                self.calculateBlock(block)
                self.blocks.set(block.i, block.j, block)

                return block
            })()
        })
    }

    self.calculateBlock = function(block) {
        var pos = self.coordToPos({
            i: block.i,
            j: block.j
        })

        for (var i = 0; i !== self.blockSideLength; i++) {
            for (var j = 0; j !== self.blockSideLength; j++) {
                block.data.push(coreMandelFunction(
                    pos.x + j * self.pixelSize,
                    pos.y + i * self.pixelSize,
                    block.depth
                ))
            }
        }

        return block
    }

    return self
}
