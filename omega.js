'use strict';

var Route = require('routable');

/**
 * Broadcast messages using HTTP.
 *
 * Options:
 *
 * - method: HTTP method we should respond to, defaults to PUT.
 * - password: Password for basic auth, defaults to supreme.
 * - username: Username for basic auth, defaults to omega.
 * - url: Access path, defaults to /primus/omega/supreme.
 *
 * @param {Object} options Middleware configuration.
 * @returns {Function} The configured middleware function.
 * @api public
 */
module.exports = function omega(options) {
  //
  // Compile an identical header as we expect to be send from the client so we
  // can easily validate the request.
  //
  var authorization = 'Basic '+ (
    new Buffer(options.username +':'+ options.password)
  ).toString('base64');

  //
  // Create an URL that we can test against.
  //
  var route = new Route(options.url);

  /**
   * The actual middleware layer.
   *
   * @param {Request} req Incoming HTTP request.
   * @param {Response} res Outgoing HTTP response.
   * @param {Function} next Middleware continuation.
   * @api private
   */
  function intercept(req, res, next) {
    if (
         !route.test(req.url)           // Incorrect URL.
      || !req.headers.authorization     // Missing authorization.
      || options.method !== req.method  // Invalid method.
    ) return next();

    //
    // Handle unauthorized requests.
    //
    if (authorization !== req.headers.authorization) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');

      return res.end(JSON.stringify({
        ok: false,
        reason: [
          'I am programmed to protect, and sacrifice if necessary.',
          'Feel the power of my lazers! Pew pew!'
        ].join(' ')
      }));
    }

    var primus = this
      , buff = '';

    //
    // Receive the data from the socket. The `setEncoding` ensures that Unicode
    // chars are correctly buffered and parsed before the `data` event is
    // emitted.
    //
    req.setEncoding('utf8');
    req.on('data', function data(chunk) {
      buff += chunk;
    }).once('end', function end() {
      parse(primus, buff, res);
    });
  }

  //
  // Don't run on HTTP upgrades as we only process POST requests.
  //
  intercept.upgrade = false;

  return intercept;
};

/**
 * Parse the incoming so we can hand it off to the correct spark for further
 * processing.
 *
 * @param {String} raw Raw text data.
 * @param {Response} res HTTP response.
 * @api private
 */
function parse(primus, raw, res) {
  var called = 0
    , data
    , err;

  try {
    data = JSON.parse(raw);
  } catch (e) {
    err = e;
  }

  res.setHeader('Content-Type', 'application/json'); // set response content type

  if (
       err                              // No error..
    || 'object' !== typeof data         // Should be an object.
    || Array.isArray(data)              // A real object, not array.
    || !data.msg                        // The data we send should be defined.
  ) {
    res.statusCode = 500;
    return res.end('{ "ok": false, "reason": "invalid data structure" }');
  }

  var callingRooms = primus.$ && primus.$.rooms && (Array.isArray(data.rooms) || typeof data.rooms === 'string');
  //
  // Process the incoming messages in four different modes:
  //
  // Rooms:  If primus-rooms is being used. Takes in rooms array or a string for
  //         the room to broadcast to. Also an optional except array or a string of
  //         sparkIDs to exclude.
  // Sparks: The data.sparks is an array with spark id's which we should write
  //         the data to.
  // Spark:  The data.sparks is the id of one single individual spark which
  //         should receive the data.
  // All:    Broadcast the message to every single connected spark if no
  //         `data.sparks` has been provided.
  //
  if (callingRooms) {
    // initialize except array
    data.except = data.except || [];
    if (typeof data.except === 'string') {
      data.except = [data.except];
    }
    //get the sparks in the rooms
    primus.room(data.rooms).clients(function(err, sparks) {
      if (err) {
        res.statusCode = 400;
        return res.end(JSON.stringify(err));
      }

      // check if the return is multiple rooms with array of sparks for each room
      if (!Array.isArray(sparks)) {
        var rooms = sparks;
        sparks = []; // reset sparks array
        var uniqueSparks = {}; // set up hash table to prevent multiple msgs sent to the same spark if in multiple rooms
        Object.keys(rooms).forEach(function(room) {
          rooms[room].forEach(function(spark) {
            if (!uniqueSparks.hasOwnProperty(spark)) { // if the spark is not in the hash add it to sparks array
              if (data.except.indexOf(spark) === -1) { // filter while checking for unique
                sparks.push(spark);
              }
              uniqueSparks[spark] = true;
            }
          })
        })
      } else if (Array.isArray(data.except)) {  // exclude sparks in except array
        sparks = sparks.filter(function(id) {
          return data.except.indexOf(id) === -1;
        });
      }

      if (sparks.length === 0) {
        res.statusCode = 200;
        return res.end('{ "ok": true, "send":'+ called +' }')
      }

      // call forward method to transmit the message
      if (primus.forward.sparks) { // support multiple servers through multiplex 
        primus.forward.sparks(sparks, data.msg, function (err, status) {
          if (err) {
            res.statusCode = 400;
            return res.end(JSON.stringify(err));
          }
          res.statusCode = 200;
          return res.end(JSON.stringify(status));
        })
      } else {
        sparks.forEach(function(sparkID) {
          var spark = primus.spark(sparkID);

          if (spark) {
            spark.write(data.msg);
            called++;
          }
        });
        res.statusCode = 200;
        res.end('{ "ok": true, "send":'+ called +' }');
      }
    });
  } else if (Array.isArray(data.sparks)) {
    data.sparks.forEach(function each(id) {
      var spark = primus.spark(id);

      if (spark) {
        spark.write(data.msg);
        called++;
      }
    });
  } else if ('string' === typeof data.sparks && data.sparks) {
    var spark = primus.spark(data.sparks);

    if (spark) {
      spark.write(data.msg);
      called++;
    }
  } else {
    primus.forEach(function each(spark) {
      spark.write(data.msg);
      called++;
    });
  }

  if (!callingRooms) {
    res.statusCode = 200;
    res.end('{ "ok": true, "send":'+ called +' }');
  }
}
