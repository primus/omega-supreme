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

  if (
       err                              // No error..
    || 'object' !== typeof data         // Should be an object.
    || Array.isArray(data)              // A real object, not array.
    || !data.msg                        // The data we send should be defined.
  ) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    return res.end('{ "ok": false, "reason": "invalid data structure" }');
  }

  //
  // Process the incoming messages in three different modes:
  //
  // Sparks: The data.sparks is an array with spark id's which we should write
  //         the data to.
  // Spark:  The data.sparks is the id of one single individual spark which
  //         should receive the data.
  // All:    Broadcast the message to every single connected spark if no
  //         `data.sparks` has been provided.
  //
  if (Array.isArray(data.sparks)) {
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

  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json');
  res.end('{ "ok": true, "send":'+ called +' }');
}
