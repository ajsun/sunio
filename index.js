var express = require('express');
var fs = require('fs')
var Promise = require('bluebird')
var bodyParser = require('body-parser')
var Ajv = require('ajv')
var ajv = new Ajv({allErrors: true})

const DEFAULT_PORT = 8080;
const DEFAULT_ROOT = '/api'
const DEFAULT_DOCS = '/docs'
const DEFAULT_TOKEN_HEADER = 'sunio-token'
var routeMap = {}

var authMethod = null

exports.start = (directory, app, port=DEFAULT_PORT) => {
    console.log('Your API is starting... ☀️')

    try {
        fs.statSync(directory + '/api')
    } catch (e) {
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
        console.log(error)
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

exports.setAuthMethod = (method) => {
    authMethod = method
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

    }
    return _files
}

var buildRouteMap = (dir, app) => {
    f = getFiles(dir)
    // cleaning things up a bit...
    for (var i in f) {
        var basePath = f[i]
        if (fs.existsSync(basePath + '/routes.js')) {
            routes = require(basePath + '/routes.js')
            try {
                schemas = require(basePath + '/schemas.js')
            }
            catch (error) {
                schemas = {}
            }
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
    var auth = getTokenFromHeaders(req)

    return Promise.resolve()
            .then(() => {
                var valid = ajv.validate(schemaDefinition.in, params)
                if (!valid) {
                    throw ajv.errors[0].message
                }
            
                if (schemaDefinition.auth_required && !auth) {
                    res.status(401).send('You must be authenticated to use this service')
                }

            })
            .then(() => methodDefinition(params, auth, req))
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

var getTokenFromHeaders = (req) => {
    var userToken = req.get(DEFAULT_TOKEN_HEADER)
    if (userToken) {
        if (authMethod) {
            try {
                var auth = authMethod(userToken)
                return auth
            }
            catch (e) {
                return null
            }
        }
    }
    return null
}

var addToRouteMap = (route, method, schema) => {
    if (!routeMap[route]) {
        routeMap[route] = {}
    }
    routeMap[route][method] = {in: schema.in, out: schema.out}
}

// TODO: docs builde