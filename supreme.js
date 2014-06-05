'use strict';

var request = require('request')
  , url = require('url').format;

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
   * Broadcast a message to a given server
   *
   * @param {String} server A server address.
   * @param {String} type Message type.
   * @param {Mixed} msg The messages to send.
   * @param {Mixed} sparks ids to send.
   * @param {Function} fn Callback.
   * @returns {Primus}
   * @api public
   */
  primus.broadcast = function broadcast(server, type, msg, sparks, fn) {
    if ('function' === typeof sparks) {
      fn = sparks;
      sparks = undefined;
    }

    request({
      method: options.method || 'PUT',
      uri: url(server, options.url),
      json: { type: type, msg: msg, ids: sparks }
    }, function requested(err, response, body) {
      var status = (response || {}).statusCode;

      if (err || status !== 200) {
        err = err || new Error('Invalid status code ('+ status +') returned');
        err.status = status;
        err.body = body;

        return fn(err);
      }

      //
      // We only have successfully send the message when we received
      // a statusCode 200 from the targeted server.
      //
      fn(undefined, body);
    });

    return primus;
  };
};

//
// Expose the Primus plugin.
//
module.exports = supreme;
