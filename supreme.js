'use strict';

var request = require('request')
  , url = require('url').format;

var supreme = module.exports;

/**
 * Ensure that all default options have been set.
 *
 * @param {Object} options Supplied options.
 * @returns {Object} options
 * @api private
 */
supreme.options = function optional(options) {
  //
  // Options is provided by default by the Primus middleware but I'll rather be
  // save then sorry here.
  //
  options = options || {};

  options.method = 'method' in options ? options.method.toUpperCase() : 'PUT';
  options.password = 'password' in options ? options.password : 'supreme';
  options.username = 'username' in options ? options.username : 'omega';
  options.url = 'url' in options ? options.url : '/primus/omega/supreme';

  return options;
};

/**
 * Extend the Primus with additional methods which will do the actual
 * broadcasting.
 *
 * @param {Primus} primus
 * @param {Object} options The options supplied to Primus.
 * @api public
 */
supreme.server = function server(primus, options) {
  options = supreme.options(options);

  //
  // Load the middleware so we can intercept messages.
  //
  primus.before('omega-supreme', require('./omega')(options));

  /**
   * Forward a message to a given server
   *
   * @param {String} server A server address.
   * @param {Mixed} msg The messages to send.
   * @param {Mixed} sparks ids to send.
   * @param {Function} fn Callback.
   * @returns {Primus}
   * @api public
   */
  primus.forward = function forward(server, msg, sparks, fn) {
    if ('function' === typeof sparks) {
      fn = sparks;
      sparks = '';
    }

    var spark;

    if (Array.isArray(sparks)) {
      sparks = sparks.filter(function (id) {
        spark = primus.spark(id);

        if (spark) spark.write(msg);

        return !spark;
      });
    } else if (sparks) {
      spark = primus.spark(sparks);

      if (spark) {
        spark.write(msg);
        sparks.length = '';
      }
    } else {
      primus.forEach(function each(spark) {
        spark.write(msg);
      });
    }

    //
    // Everything was broad casted locally, we can bail out early
    //
    if (!sparks.length) return fn();

    request({
      method: options.method,               // Set the correct method.
      uri: url(server, options.url),        // Compile the correct URL
      json: {                               // The actual JSON payload
        msg: msg,                           // - The message we write
        sparks: sparks                      // - Who the message should receive
      },                                    //
      auth: {                               // Set authentication headers
        user: options.username,             // With this user name.
        pass: options.password,             // And password.
        sendImmediately: true               // Send the header, don't wait for 401.
      }
    }, function requested(err, response, body) {
      var status = (response || {}).statusCode
        , reason = (body || {}).reason;

      //
      // Handle errors that are produced by our own library.
      //
      if (!err) {
        if (200 !== status) {
          err = new Error(reason || 'Invalid status code ('+ status +') returned');
        } else if (!body.ok) {
          err = new Error(reason || 'Unable to process the request');
        }
      }

      if (err) {
        err.status = status;
        err.body = body;

        return fn(err);
      }

      fn(undefined, body);
    });

    return primus;
  };
};

//
// Expose the Primus plugin.
//
module.exports = supreme;
