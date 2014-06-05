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
  // Options is provided by default by the Primus middleware but I'll rather be
  // save then sorry here.
  //
  options = options || {};

  options.method = 'method' in options ? options.method.toUpperCase() : 'PUT';
  options.password = 'password' in options ? options.password : 'supreme';
  options.username = 'username' in options ? options.username : 'omega';
  options.url = 'url' in options ? options.url : '/primus/omega/supreme';

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
         route.test(req.url)            // Incorrect URL.
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
      parse(primus, buff, res, next);
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
 * @param {Function} next Middleware continuation.
 * @api private
 */
function parse(primus, raw, res, next) {
  primus.decoder.call(primus, raw, function decoded(err, data) {
    if (
         err                              // No error..
      || 'object' !== typeof data         // Should be an object.
      || Array.isArray(data)              // A real object, not array.
      || 'string' !== typeof data.type    // Type is used for filtering.
      || !data.msg                        // The data we send should be defined.
    ) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      return res.end('{ "ok": false }');
    }

    switch (data.type) {
      //
      // Broadcast: send the message to every connected client in this Primus
      // server.
      //
      case 'broadcast':
        primus.forEach(function each(spark) {
          spark.emit('incoming::data', data.msg);
        });
      break;

      //
      // Spark: only send the message to the spark for the given id.
      //
      case 'spark':
        var spark = primus.spark(data.id);

        if (spark) spark.emit('incoming::data', data.msg);
      break;

      //
      // Sparks: send the message to all of our supplied spark ids.
      //
      case 'sparks':
        data.ids.forEach(function each(id) {
          var spark = primus.spark(id);

          if (spark) spark.emit('incoming::data', data.msg);
        });
      break;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end('{ "ok": true }');
  });
}
