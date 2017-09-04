var express = require('express');
var fs = require('fs')
var Promise = require('bluebird')
var Ajv = require('ajv')
var ajv = new Ajv({allErrors: true})

const DEFAULT_PORT = 8080;
const DEFAULT_ROOT = '/api'
var routeMap = {}

exports.start = (directory, app, port=DEFAULT_PORT) => {
    console.log('😛 Your API is starting...')

    try {
        fs.statSync(directory + '/api')
    } catch (e) {
        console.log(e)
        console.error(directory + '/api does not exist')
        console.error('Usage: You must keep all api files in /api')
        return
    }
    
    var apiPath = directory + '/api'
    buildRouteMap(apiPath, app)
    // catch 404 and forward to error handler
    app.use(function (req, res, next) {
        var err = new Error('Not Found');
        err.status = 404;
        next(err);
    });
    // error handler
    app.use(function (err, req, res, next) {
        // set locals, only providing error in development
        res.locals.message = err.message;
        res.locals.error = req.app.get('env') === 'development' ? err : {};

        // render the error page
        res.status(err.status || 500);
        res.send('Error: ' + err)
    });

    app.listen(port, () => [
        console.log("You're good to go on " + port)
    ])

}

// function recursively travels through a directory and returns the list of all files
var getFiles = (dir, _files=[dir]) => {
    var files = fs.readdirSync(dir) 
    for (var i in files) {
        path = dir + '/' + files[i]
        if (fs.statSync(path).isDirectory()) {
            _files.push(path)
            getFiles(path, _files)
        }
        // else {
        //     _files.push(path)
        // }
    }
    return _files
}

var buildRouteMap = (dir, app) => {
    f = getFiles(dir)
    // cleaning things up a bit...
    for (var i in f) {
        var base = f[i]
        try {
            routes = require(base + '/routes.js')
            try {
                schemas = require(base + '/schemas.js')
            }
            catch (error) {
                schemas = {}
            }
        }
        catch (error) {
            console.error(error)
            throw "Missing a routes or schema file at " + base
        }
        routePath = base.replace(dir, '')

        // process route.js for each route
        Object.keys(routes).forEach(method => {
            var methodDefinition = routes[method]
            var schemaDefinition = schemas[method] || {}

            app[method](routePath, (req, res, next) => {
                handleMethod(methodDefinition, schemaDefinition, req)
                    .then(response => {
                        return res.json({response})
                    })
                    .catch(error => {
                        return next(error)
                    })
            })
        })

        // empty directories without a routes.js

        // files that don't match (ignored files)
    }
}

var handleMethod = (methodDefinition, schemaDefinition, req) => {
    var params = collectParams(req)
    var valid = ajv.validate(schemaDefinition.in, params)
    if (!valid) {
        return Promise.reject(ajv.errors[0].message)
    }
    return Promise.resolve()   
            .then(() => methodDefinition(params, req))
            .then(result => {
                var valid = ajv.validate(schemaDefinition.out, result)
                if (!valid) {
                    throw ajv.errors[0].message
                }
                return result
            })
}

var collectParams = (req) => {
    return Object.assign({}, req.query, req.parms, req.body)
}

// TODO: functions that 1. process the route.js

// TODO: function to create route map json

// TODO: docs builder