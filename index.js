var express = require('express');
var fs = require('fs')

const DEFAULT_PORT = 8080;
const DEFAULT_ROOT = '/api'
var routeMap = {}

exports.start = (directory, app, port=DEFAULT_PORT) => {
    console.log('😛 Your API is starting...')

    // DO STUFF HERE
    try {
        fs.statSync(directory + '/api')
    } catch (e) {
        console.log(e)
        console.error(directory + '/api does not exist')
        return
    }
    var apiPath = directory + '/api'
    buildRouteMap(apiPath)
    app.listen(port, () => [
        console.log("You're good to go on " + port)
    ])

}

// function recursively travels through a directory and returns the list of all files
var getFiles = (dir, _files=[]) => {
    var files = fs.readdirSync(dir) 
    for (var i in files) {
        path = dir + '/' + files[i]
        if (fs.statSync(path).isDirectory()) {
            getFiles(path, _files)
        }
        else {
            _files.push(path)
        }
    }
    return _files
}

var buildRouteMap = (path) => {
    f = getFiles(path)
    // cleaning things up a bit...
    for (var i in f) {
        routeName = f[i].replace(path, '')

        // process route.js for each route

        // empty directories without a routes.js

        // files that don't match (ignored files)
    }
}

// TODO: functions that 1. process the route.js

// TODO: function to create route map json

// TODO: docs builder