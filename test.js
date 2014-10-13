/* istanbul ignore next */
describe('omega supreme', function () {
  'use strict';

  var assume = require('assume')
    , Primus = require('primus')
    , async = require('async')
    , omega = require('./');

  var port = 1024
    , server2
    , server
    , http2
    , http;

  beforeEach(function each(next) {
    http = require('http').createServer();
    http2 = require('http').createServer();

    server = new Primus(http, {
      transformer: 'websockets'
    });

    server2 = new Primus(http2, {
      transformer: 'websockets'
    });

    http.port = port++;
    http2.port = port++;

    http.url = 'http://localhost:'+ http.port;
    http2.url = 'http://localhost:'+ http2.port;

    http.listen(http.port, function () {
      http2.listen(http2.port, next);
    });
  });

  afterEach(function each(next) {
    server.destroy(function () {
      server2.destroy(next);
    });
  });

  it('is exposed as function', function () {
    assume(omega).to.be.a('function');
  });

  it('exposes a plugin interface', function () {
    assume(omega.server).to.be.a('function');
    server.use('omega-supreme', omega);
  });

  it('adds a middleware layer', function () {
    assume(!~server.indexOfLayer('omega-supreme')).to.be.true();
    server.use('omega-supreme', omega);
    assume(!!~server.indexOfLayer('omega-supreme')).to.be.true();
  });

  describe('.options', function () {
    it('returns a object with our defaults', function () {
      assume(omega.options()).to.be.a('object');
      assume(omega.options().method).to.be.a('string');
    });

    it('uppercases methods', function () {
      var options = omega.options({ method: 'get' });

      assume(options.method).to.equal('GET');
      assume(omega.options().method).to.equal('PUT');
    });
  });

  describe('.forward', function () {
    it('adds a .forward method', function () {
      assume(server.forward).to.be.undefined();
      server.use('omega-supreme', omega);
      assume(server.forward).to.be.a('function');
    });

    it('returns the count of sparks matching (which is 0)', function (next) {
      server.use('omega', omega);
      server2.use('omega', omega);

      server.forward(http2.url, 'foo', 'unkown', function (err, data) {
        if (err) return next(err);

        assume(data.send).to.equal(0);
        next();
      });
    });

    it('returns the count of sparks matching (which is 1)', function (next) {
      server.use('omega', omega);
      server2.use('omega', omega);

      var client = server2.Socket(http2.url);
      client.id(function get(id) {
        server.forward(http2.url, 'foo', id, function (err, data) {
          if (err) return next(err);

          assume(data.send).to.equal(1);
          next();
        });
      });
    });

    it('does not request server if sparks are all local', function (next) {
      server2.use('omega', omega);

      var client = server2.Socket(http2.url);
      client.id(function get(id) {
        server2.forward(http2.url, 'foo', id, function (err, data) {
          if (err) return next(err);

          assume(data.send).to.equal(1);
          assume(data.local).to.equal(true);

          next();
        });
      });
    });

    it('merges local and server send counts', function (next) {
      server.use('omega', omega);
      server2.use('omega', omega);

      var connections = [
        server.Socket(http2.url), server2.Socket(http2.url),
        server.Socket(http2.url), server2.Socket(http2.url),
        server.Socket(http2.url), server2.Socket(http2.url),
        server.Socket(http2.url), server2.Socket(http2.url),
        server.Socket(http2.url), server2.Socket(http2.url),
        server.Socket(http2.url), server2.Socket(http2.url),
        server.Socket(http2.url), server2.Socket(http2.url)
      ];

      async.each(connections, function (client, next) {
        client.on('open', next);
      }, function (err) {
        if (err) return next(err);

        async.each(connections, function (client, next) {
          client.on('data', function (msg) {
            assume(msg).to.equal('bar');
            next();
          });
        }, next);

        server.forward(http2.url, 'bar', function (err, data) {
          if (err) return next(err);

          assume(data.send).to.equal(connections.length);
        });
      });
    });

    it('sends the data to one connected client', function (next) {
      server.use('omega', omega);
      server2.use('omega', omega);

      var client = server2.Socket(http2.url);

      client.id(function get(id) {
        server.forward(http2.url, 'foo', id, function (err, data) {
          if (err) return next(err);
        });
      });

      client.on('data', function (msg) {
        assume(msg).to.equal('foo');
        next();
      });
    });

    it('does not error when given an empty url', function (next) {
      server.use('omega', omega);
      server2.use('omega', omega);

      var client = server2.Socket(http2.url);

      client.id(function get(id) {
        server.forward(null, 'foo', id, function (err, data) {
          assume(err.message).to.equal('No servers provided');
          assume(data.send).to.equal(0);
          assume(data.ok).to.be.false();
          next();
        });
      });

    });

    it('broadcasts if no spark id is provided', function (next) {
      server.use('omega', omega);
      server2.use('omega', omega);

      var connections = [
        server2.Socket(http2.url), server2.Socket(http2.url),
        server2.Socket(http2.url), server2.Socket(http2.url),
        server2.Socket(http2.url), server2.Socket(http2.url),
        server2.Socket(http2.url), server2.Socket(http2.url),
        server2.Socket(http2.url), server2.Socket(http2.url),
        server2.Socket(http2.url), server2.Socket(http2.url),
        server2.Socket(http2.url), server2.Socket(http2.url)
      ], donish = 1;

      async.each(connections, function (client, next) {
        client.on('open', next);
      }, function (err) {
        if (err) return next(err);

        async.each(connections, function (client, next) {
          client.on('data', function (msg) {
            assume(msg).to.equal('bar');
            next();
          });
        }, next);

        server.forward(http2.url, 'bar', function (err, data) {
          if (err) return next(err);

          assume(data.send).to.equal(connections.length);
        });
      });
    });
  });
});
