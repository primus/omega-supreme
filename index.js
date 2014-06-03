'use strict';

/**
 * Broadcast messages using HTTP.
 *
 * Options:
 *
 * - method: HTTP method we should respond to, defaults to PUT.
 * - password: Password for basic auth, defaults to supreme.
 * - username: Username for basic auth, defaults to omega.
 *
 * @param {Object} options Middleware configuration.
 * @returns {Function} The configured middleware function.
 * @api public
 */
function omegasupreme(options) {
  options.method = (options.method || 'PUT').toUpperCase();
  options.password = options.password || 'supreme';
  options.username = options.username || 'omega';
  options.authorization = 'Basic '+ (
    new Buffer(options.username +':'+ options.password)
  ).toString('base64');

  var primus = this;

  /**
   * Parse the incoming so we can hand it off to the correct spark for further
   * processing.
   *
   * @param {String} raw Raw text data.
   * @param {Response} res HTTP response.
   * @param {Function} next Middleware continuation.
   * @api private
   */
  function parse(raw, res, next) {
    primus.decoder.call(primus, raw, function decoded(err, data) {
      if (err) return next(err);

      res.statusCode = 200;

      switch (data.type) {
        case 'broadcast':
          primus.forEach(function each(spark) {
            spark.emit('incoming::data', data.msg);
          });
        break;

        case 'spark':
          var spark = primus.spark(data.id);

          if (spark) spark.emit('incoming::data', data.msg);
        break;

        case 'sparks':
          primus.forEach(function each(spark) {
            if (!~data.ids.indexOf(spark.id)) return;

            spark.emit('incoming::data', data.msg);
          });
        break;
      }

      res.end('broadcasted');
    });
  }

  /**
   * The actual middleware layer.
   *
   * @param {Request} req Incoming HTTP request.
   * @param {Response} res Outgoing HTTP response.
   * @param {Function} next Middleware continuation.
   * @api private
   */
  function intercept(req, res, next) {
    if (!req.headers.authorization) return next();
    if (options.method !== req.method) return next();

    //
    // Handle unauthorized requests.
    //
    if (options.authorization !== req.headers.authorization) {
      res.statusCode = 401;
      return res.end('I am programmed to protect, and sacrifice if necessary');
    }

    var buff = '';

    //
    // Receive the data from the socket. The `setEncoding` ensures that Unicode
    // chars are correctly buffered and parsed before the `data` event is
    // emitted.
    //
    req.setEncoding('utf8');
    req.on('data', function data(chunk) { buff += chunk; });
    req.once('end', function end() {
      parse(buff, res, next);
    });
  }

  //
  // Don't run on HTTP upgrades as we only process POST requests.
  //
  intercept.upgrade = false;

  return intercept;
}

//
// Expose the module
//
module.exports = omegasupreme;
