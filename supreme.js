'use strict';

var request = require('request')
  , url = require('url').format;

//
// Expose the Primus plugin.
//
var supreme = module.exports;

/**
 * Extend the Primus with additional methods which will do the actual
 * broadcasting.
 *
 * @param {Primus} primus
 * @param {Object} options The options supplied to Primus.
 * @api public
 */
supreme.server = function server(primus, options) {
  primus.before('omega-supreme', require('./omega')(options));

  /**
   * Forward a message to a given server
   *
   * @param {String} server A server address.
   * @param {String} type Message type.
   * @param {Mixed} msg The messages to send.
   * @param {Mixed} sparks ids to send.
   * @param {Function} fn Callback.
   * @returns {Primus}
   * @api public
   */
  primus.forward = function forward(server, type, msg, sparks, fn) {
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
      method: options.method || 'PUT',
      uri: url(server, options.url),
      json: { type: type, msg: msg, ids: sparks }
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
