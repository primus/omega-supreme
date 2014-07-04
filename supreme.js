'use strict';

var request = require('request')
  , url = require('url').resolve;

//
// Expose the Primus plugin.
//
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
    var type = 'broadcast'
      , calls = 0
      , spark;

    if ('function' === typeof sparks) {
      fn = sparks;
      sparks = '';
    }

    if (Array.isArray(sparks)) {
      sparks = sparks.filter(function (id) {
        spark = primus.spark(id);

        if (spark) {
          spark.write(msg);
          calls++;
        }

        return !spark;
      });

      type = 'sparks';
    } else if (sparks) {
      spark = primus.spark(sparks);

      if (spark) {
        spark.write(msg);
        sparks = '';
        calls++;
      }

      type = 'spark';
    } else {
      primus.forEach(function each(spark) {
        spark.write(msg);
        calls++;
      });
    }

    //
    // Everything was broad casted locally, we can bail out early
    //
    if (type !== 'broadcast' && !sparks.length) return fn(undefined, {
      ok: true,
      send: calls,
      local: true
    });

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
      response = response || {};
      body = body || {};

      var status = response.statusCode
        , reason = body.reason;

      //
      // Handle errors that are produced by our own library.
      //
      if (!err) {
        if (200 !== status) {
          err = new Error(reason || 'Invalid status code ('+ status +') returned');
        } else if (body.ok !== true) {
          err = new Error(reason || 'Unable to process the request');
        }
      }

      if (err) {
        err.url = url(server, options.url);
        err.status = status || 500;
        err.body = body || '';
        err.type = type;
        err.packet = {
          sparks: sparks,
          msg: msg
        };

        return fn(err);
      }

      //
      // We did local broadcasting AND broadcasting on the other server, so
      // we're going to correct the `send` property with our own local count.
      //
      if (calls && body.send) {
        body.send = calls + body.send;
      }

      fn(undefined, body);
    });

    return primus;
  };
};
