describe('omega supreme', function () {
  'use strict';

  var assume = require('assume')
    , Primus = require('primus')
    , omega = require('../');

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
  });
});
