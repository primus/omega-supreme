'use strict';

var mapLimit = require('async/mapLimit')
  , request = require('request')
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

  options.concurrently = 'concurrently' in options ? options.concurrently : 20;
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
  var index = primus.indexOfLayer('authorization');
  options = supreme.options(options);

  //
  // Load the middleware so we can intercept messages.
  //
  primus.use('omega-supreme', require('./omega'), options, index);

  /**
   * Forward a message to a given server set.
   *
   * @param {Array} servers A server address or addresses.
   * @param {Mixed} msg The messages to send.
   * @param {Mixed} sparks ids to send.
   * @param {Function} fn Callback.
   * @returns {Primus}
   * @api public
   */
  primus.forward = function forward(servers, msg, sparks, fn) {
    servers = (!Array.isArray(servers) ? [servers] : servers).filter(Boolean);

    var type = 'broadcast'
      , calls = 0
      , spark
      , local = false;

    if ('function' === typeof sparks) {
      fn = sparks;
      sparks = '';
    }

    //
    // Start off with local execution to see if we could hopefully save
    // a broadcast to the set of servers because the connection is hosted
    // locally on the primus server.
    //
    if (Array.isArray(sparks)) {
      sparks = sparks.filter(function (id) {
        spark = primus.spark(id);

        if (spark) {
          spark.write(msg);
          calls++;
        }

        return !spark;
      });

      //
      // if no more sparks are left, then we finished with just local sparks
      //
      local = !sparks.length;
      type = 'sparks';
    } else if (sparks) {
      spark = primus.spark(sparks);

      if (spark) {
        spark.write(msg);
        sparks = '';
        //
        // just one local spark was given
        //
        local = true;
        calls++;
      }

      type = 'spark';
    } else {
      primus.forEach(function each(spark) {
        spark.write(msg);
        calls++;
      });
      //
      // since there are no sparks, having no servers means
      // *local* broadcast only
      //
      local = !servers.length;
    }

    //
    // Everything was broad casted locally, we can bail out early, which is
    // naaaais <-- say out loud with Borat's voice.
    //
    if (local) return fn(undefined, {
      ok: true,
      send: calls,
      local: true
    });

    if (!servers.length) return fn(new Error('No servers provided'), {
      ok: false,
      send: calls,
      local: false
    });

    mapLimit(servers, options.concurrently, function contact(server, next) {
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
          err.body = body;
          err.type = type;
          err.packet = {
            sparks: sparks,
            msg: msg
          };

          return next(err);
        }

        next(undefined, body);
      });
    }, function calculate(err, reached) {
      if (err) return fn(err, reached);

      fn(err, reached.reduce(function reduce(memo, reach) {
        memo.send += reach.send || 0;
        return memo;
      }, { ok: true, send: calls }));
    });

    return primus;
  };
};
