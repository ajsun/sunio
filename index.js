var express = require('express');
var fs = require('fs')
var Promise = require('bluebird')
var bodyParser = require('body-parser')
var Ajv = require('ajv')
var ajv = new Ajv({allErrors: true})

const DEFAULT_PORT = 8080;
const DEFAULT_ROOT = '/api'
const DEFAULT_DOCS = '/docs'
var routeMap = {}

exports.start = (directory, app, port=DEFAULT_PORT) => {
    console.log('Your API is starting... ☀️')

    try {
        fs.statSync(directory + '/api')
    } catch (e) {
        console.log(e)
        console.error(directory + '/api does not exist')
        console.error('Usage: You must keep all api files in /api')
        return
    }
    
    app.use(bodyParser.json()); // support json encoded bodies
    app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies

    var apiPath = directory + '/api'
    buildRouteMap(apiPath, app)
    
    // boring docs here
    app.get(DEFAULT_DOCS, (req, res) => {
        res.header("Content-Type", 'application/json');
        res.send(JSON.stringify(routeMap, null, 4))
    })

    app.get('/docs/refresh', (req, res) => {
        buildRouteMap(apiPath, app)
    })

    // catch 404 and forward to error handler
    app.use(function (req, res, next) {
        var err = new Error('Not Found');
        err.status = 404;
        next(err);
    });
    
    // error handler
    app.use(function (error, req, res, next) {
        // set locals, only providing error in development
        res.locals.message = error.message;
        res.locals.error = req.app.get('env') === 'development' ? error : {};

        // render the error page
        res.status(error.status || 500);
        res.json({error})
    });

    // TODO: have this listen on other ip addresses
    app.listen(port, () => {
        console.log("You're good to go on " + port)
    })

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
        var basePath = f[i]
        try {
            routes = require(basePath + '/routes.js')
            try {
                schemas = require(basePath + '/schemas.js')
            }
            catch (error) {
                schemas = {}
            }
        }
        catch (error) {
            console.error(error)
            throw "Missing a routes file at " + basePath
        }
        routePath = basePath.replace(dir, '')

        if (routePath == '') routePath = '/';
        // process route.js for each route
        Object.keys(routes).forEach(method => {
            var methodDefinition = routes[method]
            var schemaDefinition = schemas[method] || {}
            
            // setting the schema to be empty otherwise
            schemaDefinition.in = schemaDefinition.in || {}
            schemaDefinition.out = schemaDefinition.out || {}
            
            addToRouteMap(routePath, method, schemaDefinition)

            app[method](routePath, (req, res, next) => {
                handleMethod(methodDefinition, schemaDefinition, req)
                    .then(response => {
                        return res.json({response})
                    })
                    .catch(next)
            })
        })
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
    return Object.assign({}, req.query, req.params, req.body)
}

var addToRouteMap = (route, method, schema) => {
    if (!routeMap[route]) {
        routeMap[route] = {}
    }
    routeMap[route][method] = {in: schema.in, out: schema.out}
}

// TODO: docs builde