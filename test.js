/* istanbul ignore next */
describe('omega supreme', function () {
  'use strict';

  var url = require('url').resolve
    , request = require('request')
    , assume = require('assume')
    , Primus = require('primus')
    , async = require('async')
    , http = require('http')
    , omega = require('./')
    , metroplex = require('metroplex')
    , Rooms = require('primus-rooms')
    , ioredis = new require('ioredis')()
    , roomsAdapter = new (require('primus-rooms-redis-adapter'))(ioredis, {omegaSupreme: true, metroplex: true});

  var port = 1024
    , primus2
    , server2
    , primus
    , server;

  beforeEach(function each(next) {
    server = http.createServer();
    server2 = http.createServer();

    primus = new Primus(server, {
      transformer: 'websockets'
    });

    primus2 = new Primus(server2, {
      transformer: 'websockets'
    });

    server.port = port++;
    server2.port = port++;

    server.url = 'http://localhost:'+ server.port;
    server2.url = 'http://localhost:'+ server2.port;

    server.listen(server.port, function () {
      server2.listen(server2.port, next);
    });
  });

  afterEach(function each(next) {
    primus.destroy(function () {
      primus2.destroy(next);
    });
  });

  it('is exposed as function', function () {
    assume(omega).to.be.a('function');
  });

  it('exposes a plugin interface', function () {
    assume(omega.server).to.be.a('function');
    primus.plugin('omega', omega);
  });

  describe('.options', function () {
    it('returns an object with our defaults', function () {
      assume(omega.options()).to.be.a('object');
      assume(omega.options().method).to.be.a('string');
    });

    it('uppercases methods', function () {
      var options = omega.options({
        url: '/primus/supreme/omega',
        concurrently: 10,
        password: 'foo',
        username: 'bar',
        method: 'get'
      });

      assume(options.method).to.equal('GET');
      assume(omega.options().method).to.equal('PUT');
    });
  });

  describe('middleware', function () {
    it('adds a middleware layer', function () {
      assume(primus.indexOfLayer('omega-supreme')).equals(-1);
      primus.plugin('omega', omega);
      assume(primus.indexOfLayer('omega-supreme')).is.above(-1);
    });

    it('adds the middleware layer before the authorization layer', function () {
      var i, j;

      assume(primus.indexOfLayer('authorization')).is.above(-1);

      primus.plugin('omega', omega);
      i = primus.indexOfLayer('omega-supreme');
      j = primus.indexOfLayer('authorization');
      assume(i).is.below(j);
    });

    it('does not handle invalid requests (wrong path)', function (next) {
      primus.plugin('omega', omega);

      request({
        url: url(server.url, '/primus/wrong/path'),
        auth: { user: 'omega', pass: 'supreme' },
        method: 'PUT'
      }, function (err, res, body) {
        if (err) return next(err);

        assume(res.statusCode).to.equal(426);
        assume(body).to.equal(http.STATUS_CODES[426]);
        next();
      });
    });

    it('does not handle invalid requests (wrong method)', function (next) {
      primus.plugin('omega', omega);

      request({
        url: url(server.url, '/primus/omega/supreme'),
        auth: { user: 'omega', pass: 'supreme' }
      }, function (err, res, body) {
        if (err) return next(err);

        assume(res.statusCode).to.equal(426);
        assume(body).to.equal(http.STATUS_CODES[426]);
        next();
      });
    });

    it('does not handle invalid requests (missing headers)', function (next) {
      primus.plugin('omega', omega);

      request({
        url: url(server.url, '/primus/omega/supreme'),
        method: 'PUT'
      }, function (err, res, body) {
        if (err) return next(err);

        assume(res.statusCode).to.equal(426);
        assume(body).to.equal(http.STATUS_CODES[426]);
        next();
      });
    });

    it('handles unauthorized requests', function (next) {
      primus.plugin('omega', omega);

      request({
        url: url(server.url, '/primus/omega/supreme'),
        auth: { user: 'foo', pass: 'bar' },
        method: 'PUT'
      }, function (err, res, body) {
        if (err) return next(err);

        assume(res.statusCode).to.equal(401);
        assume(body).to.contain('Feel the power of my lazers!');
        next();
      });
    });

    it('handles requests with an invalid body', function (next) {
      primus.plugin('omega', omega);

      request({
        url: url(server.url, '/primus/omega/supreme'),
        auth: { user: 'omega', pass: 'supreme' },
        method: 'PUT',
        body: 'foo'
      }, function (err, res, body) {
        if (err) return next(err);

        assume(res.statusCode).to.equal(500);
        assume(body).to.contain('invalid data structure');
        next();
      });
    });

    it('works when using a custom parser', function (next) {
      primus.destroy({ close: false }, function () {
        primus =  new Primus(server, { parser: 'binary' });
        primus.plugin('omega', omega);

        request({
          url: url(server.url, '/primus/omega/supreme'),
          auth: { user: 'omega', pass: 'supreme' },
          method: 'PUT',
          json: { msg: 'foo' }
        }, function (err, res, body) {
          if (err) return next(err);

          assume(res.statusCode).to.equal(200);
          assume(body.ok).to.equal(true);
          next();
        });
      });
    });
  });

  describe('forward', function () {
    it('adds a forward method', function () {
      assume(primus.forward).to.be.undefined();
      primus.plugin('omega', omega);
      assume(primus.forward).to.be.a('function');
    });

    it('returns the count of sparks matching (which is 0)', function (next) {
      primus.plugin('omega', omega);
      primus2.plugin('omega', omega);

      primus.forward(server2.url, 'foo', 'unknown', function (err, data) {
        if (err) return next(err);

        assume(data.send).to.equal(0);
        next();
      });
    });

    it('returns the count of sparks matching (which is 1)', function (next) {
      primus.plugin('omega', omega);
      primus2.plugin('omega', omega);

      var client = primus2.Socket(server2.url);
      client.id(function get(id) {
        primus.forward(server2.url, 'foo', id, function (err, data) {
          if (err) return next(err);

          assume(data.send).to.equal(1);
          next();
        });
      });
    });

    it('does not send a request when the sparks are all local', function (next) {
      primus2.plugin('omega', omega);

      var client = primus2.Socket(server2.url);
      client.id(function get(id) {
        primus2.forward(server2.url, 'foo', id, function (err, data) {
          if (err) return next(err);

          assume(data.send).to.equal(1);
          assume(data.local).to.equal(true);

          next();
        });
      });
    });

    it('broadcasts if no spark id is provided', function (next) {
      primus.plugin('omega', omega);
      primus2.plugin('omega', omega);

      var connections = [
        primus2.Socket(server2.url), primus2.Socket(server2.url),
        primus2.Socket(server2.url), primus2.Socket(server2.url),
        primus2.Socket(server2.url), primus2.Socket(server2.url),
        primus2.Socket(server2.url), primus2.Socket(server2.url),
        primus2.Socket(server2.url), primus2.Socket(server2.url),
        primus2.Socket(server2.url), primus2.Socket(server2.url),
        primus2.Socket(server2.url), primus2.Socket(server2.url)
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

        primus.forward(server2.url, 'bar', function (err, data) {
          if (err) return next(err);

          assume(data.send).to.equal(connections.length);
        });
      });
    });

    it('merges local and server sent counts', function (next) {
      primus.plugin('omega', omega);
      primus2.plugin('omega', omega);

      var connections = [
        primus.Socket(server.url), primus2.Socket(server2.url),
        primus.Socket(server.url), primus2.Socket(server2.url),
        primus.Socket(server.url), primus2.Socket(server2.url),
        primus.Socket(server.url), primus2.Socket(server2.url),
        primus.Socket(server.url), primus2.Socket(server2.url),
        primus.Socket(server.url), primus2.Socket(server2.url),
        primus.Socket(server.url), primus2.Socket(server2.url)
      ];

      async.each(connections, function (client, next) {
        client.on('open', next);
      }, function (err) {
        if (err) return next(err);

        assume(primus.connected).to.equal(7);
        assume(primus2.connected).to.equal(7);

        async.each(connections, function (client, next) {
          client.on('data', function (msg) {
            assume(msg).to.equal('bar');
            next();
          });
        }, next);

        primus.forward(server2.url, 'bar', function (err, data) {
          if (err) return next(err);

          assume(data.send).to.equal(connections.length);
        });
      });
    });

    it('sends the data to one connected client', function (next) {
      primus.plugin('omega', omega);
      primus2.plugin('omega', omega);

      var client = primus2.Socket(server2.url);

      client.id(function get(id) {
        primus.forward(server2.url, 'foo', id, function (err) {
          if (err) return next(err);
        });
      });

      client.on('data', function (msg) {
        assume(msg).to.equal('foo');
        next();
      });
    });

    it('sends the data to some connected clients', function (next) {
      primus.plugin('omega', omega);
      primus2.plugin('omega', omega);

      var connections = [
        primus.Socket(server.url), primus2.Socket(server2.url),
        primus.Socket(server.url), primus2.Socket(server2.url)
      ], received = 0;

      connections.forEach(function (client, index) {
        client.on('data', function (msg) {
          if (index < 2) throw new Error('This client should be excluded');

          assume(msg).to.equal('foo');
          if (++received === 2) next();
        });
      });

      async.each(connections, function (client, next) {
        client.on('open', next);
      }, function (err) {
        if (err) return next(err);

        async.map(connections, function (client, next) {
          client.id(function (id) {
            next(undefined, id);
          });
        }, function (err, ids) {
          if (err) return next (err);

          //
          // Fake id to simulate an additional client on a third server.
          //
          ids.push('id');
          primus.forward([server2.url], 'foo', ids.slice(2), function (err) {
            if (err) return next(err);
          });
        });
      });
    });

    it('bails out when forwarding to an empty url', function (next) {
      primus.plugin('omega', omega);
      primus2.plugin('omega', omega);

      var client = primus2.Socket(server2.url);

      client.id(function get(id) {
        primus.forward(null, 'foo', id, function (err, data) {
          assume(err.message).to.equal('No servers provided');
          assume(data.send).to.equal(0);
          assume(data.ok).to.be.false();
          next();
        });
      });
    });

    it('receives an error when forwarding to a dead server', function (next) {
      primus.plugin('omega', omega);

      primus.forward('http://localhost:1024', 'foo', function (err) {
        assume(err).to.be.instanceOf(Error);
        assume(err.packet).to.be.a('object');
        assume(err.packet.msg).to.equal('foo');
        next();
      });
    });

    it('receives an error when the request is not successful', function (next) {
      primus2.options.url = '/primus/supreme/omega';
      primus2.plugin('omega', omega);
      primus.plugin('omega', omega);

      primus.forward(server2.url, 'foo', function (err) {
        assume(err).to.be.instanceOf(Error);
        assume(err.status).to.equal(426);
        assume(err.message).to.contain('Invalid status code');
        next();
      });
    });

    it('receives an error when the response body is malformed', function (next) {
      primus.options.url = '/primus/spec';
      primus.plugin('omega', omega);
      primus2.plugin('omega', omega);

      primus.forward(server2.url, 'foo', function (err) {
        assume(err).to.be.instanceOf(Error);
        assume(err.message).to.equal('Unable to process the request');
        next();
      });
    });
  });

  describe('rooms-integration', function () {
    var rooms = ["test1", "test2"];
    var connections = [];

    beforeEach(function (done) {
      primus.plugin('rooms', Rooms);
      primus.plugin('omega', omega);
      for (var i = 0; i < 15; i++) {
        connections.push(primus.Socket(server.url));
      }
      done();
    });

    afterEach(function (done) {
      connections = [];
      done();
    });

    it('should broadcast to all users in a room', function (done) {
      async.each(connections, function (client, next) {
        client.on('open', next);
      }, function (err) {
        if (err) return done(err);
        async.map(connections, function (client, next) {
          client.id(function (id) {
            primus.join(id, rooms[0], next);
          });
        }, function (err, ids) {
          if (err) return done(err);
          request({
            url: url(server.url, '/primus/omega/supreme'),
            auth: {user: 'omega', pass: 'supreme'},
            method: 'PUT',
            json: {msg: 'foo', rooms: rooms[0]}
          }, function (err, res, body) {
            if (err) return next(err);
            assume(res.statusCode).to.equal(200);
            assume(body.ok).to.equal(true);
            assume(body.send).to.equal(connections.length);
            done();
          });
        });
      });
    });
    it('should broadcast to all users in a room except one', function (done) {
      var excluded;
      async.each(connections, function (client, next) {
        client.on('open', next);
      }, function (err) {
        if (err) return done(err);
        async.map(connections, function (client, next) {
          client.id(function (id) {
            excluded = id;
            primus.join(id, rooms[0], next);
          });
        }, function (err, ids) {
          if (err) return done(err);
          request({
            url: url(server.url, '/primus/omega/supreme'),
            auth: {user: 'omega', pass: 'supreme'},
            method: 'PUT',
            json: {msg: 'foo', rooms: rooms[0], except: excluded}
          }, function (err, res, body) {
            if (err) return next(err);
            assume(res.statusCode).to.equal(200);
            assume(body.ok).to.equal(true);
            assume(body.send).to.equal(connections.length - 1);
            done();
          });
        });
      });
    });
    it('should not broadcast to any users in an empty room', function (done) {
      async.each(connections, function (client, next) {
        client.on('open', next);
      }, function (err) {
        if (err) return done(err);
        async.map(connections, function (client, next) {
          client.id(function (id) {
            primus.join(id, rooms[0], next);
          });
        }, function (err, ids) {
          if (err) return done(err);
          request({
            url: url(server.url, '/primus/omega/supreme'),
            auth: {user: 'omega', pass: 'supreme'},
            method: 'PUT',
            json: {msg: 'foo', rooms: rooms[1]}
          }, function (err, res, body) {
            if (err) return next(err);
            assume(res.statusCode).to.equal(200);
            assume(body.ok).to.equal(true);
            assume(body.send).to.equal(0);
            done();
          });
        });
      });
    });
    it('should broadcast to all users in multiple rooms', function (done) {
      var counter = 0;
      async.each(connections, function (client, next) {
        client.on('open', next);
      }, function (err) {
        if (err) return done(err);
        async.map(connections, function (client, next) {
          client.id(function (id) {
            counter++;
            if (counter % 2 === 0) {
              primus.join(id, rooms[0], next);
            } else {
              primus.join(id, rooms[1], next);
            }
          });
        }, function (err, ids) {
          if (err) return done(err);
          request({
            url: url(server.url, '/primus/omega/supreme'),
            auth: {user: 'omega', pass: 'supreme'},
            method: 'PUT',
            json: {msg: 'foo', rooms: rooms}
          }, function (err, res, body) {
            if (err) return next(err);
            assume(res.statusCode).to.equal(200);
            assume(body.ok).to.equal(true);
            assume(body.send).to.equal(connections.length);
            done();
          });
        });
      });
    });
    it('should broadcast to all users in a room except excluded users', function (done) {
      var counter = 0, except = [];
      async.each(connections, function (client, next) {
        client.on('open', next);
      }, function (err) {
        if (err) return done(err);
        async.map(connections, function (client, next) {
          client.id(function (id) {
            counter++;
            if (counter % 2 === 0) {
              except.push(id);
              primus.join(id, rooms[0], next);
            } else {
              primus.join(id, rooms[1], next);
            }
          });
        }, function (err, ids) {
          if (err) return done(err);
          request({
            url: url(server.url, '/primus/omega/supreme'),
            auth: {user: 'omega', pass: 'supreme'},
            method: 'PUT',
            json: {msg: 'foo', rooms: rooms, except: except}
          }, function (err, res, body) {
            if (err) return next(err);
            assume(res.statusCode).to.equal(200);
            assume(body.ok).to.equal(true);
            assume(body.send).to.equal(connections.length - except.length);
            done();
          });
        });
      });
    });
  });

  describe('rooms and metroplex integration', function () {
    var connections = [];

    beforeEach(function(done){
      primus.destroy(function () {
        primus2.destroy(function () {
          server = http.createServer();
          server2 = http.createServer();
          server.port = port++;
          server2.port = port++;

          server.url = 'http://localhost:'+ server.port;
          server2.url = 'http://localhost:'+ server2.port;

          primus = new Primus(server, {
            transformer: 'websockets',
            rooms: { adapter: roomsAdapter },
            plugin: {
              'rooms': Rooms,
              'omega-supreme': omega,
              'metroplex': metroplex,
            },
            redis: ioredis
          });
          primus2 = new Primus(server2, {
            transformer: 'websockets',
            rooms: { adapter: roomsAdapter },
            plugin: {
              'rooms': Rooms,
              'omega-supreme': omega,
              'metroplex': metroplex,
            },
            redis: ioredis
          });

          server.listen(server.port, function () {
            server2.listen(server2.port, function(){
              for (var i = 0; i < 15; i++) {
                if (i < 7) {
                  connections.push(primus.Socket(server.url));
                } else {
                  connections.push(primus2.Socket(server2.url));
                }
              }
              done();
            });
          });
          
        });
      });
    });

    afterEach(function (done) {
      connections = [];
      done();
    });

    it('should broadcast to all users in a room on different servers', function(done){
      async.each(connections, function (client, next) {
        client.on('open', next);
      }, function (err) {
        if (err) return done(err);
        async.map(connections, function (client, next) {
          client.id(function (id) {
            if (this.url.href === server.url) {
              primus.join(id, "test", next);
            } else {
              primus2.join(id, "test", next);
            }
          });
        }, function (err, ids) {
          if (err) return done(err);
          request({
            url: url(server.url, '/primus/omega/supreme'),
            auth: {user: 'omega', pass: 'supreme'},
            method: 'PUT',
            json: {msg: 'foo', rooms: "test"}
          }, function (err, res, body) {
            if (err) return next(err);
            assume(res.statusCode).to.equal(200);
            assume(body.ok).to.equal(true);
            assume(body.send).to.equal(connections.length);
            done();
          });
        });
      });
    })
  });
});
