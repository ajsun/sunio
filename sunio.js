var express = require('express')
var sunio = require('./index')


var app = express()

sunio.start(__dirname, app)