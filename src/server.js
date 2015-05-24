'use strict'

var express = require('express')
var browserify = require('browserify-middleware')

var app = express()

app.use('/index.js', browserify(__dirname + '/index.js'))
app.use(express.static(__dirname + '/public'))

app.listen(8888)
