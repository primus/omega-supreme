# Omega Supreme

[![Version npm](https://img.shields.io/npm/v/omega-supreme.svg?style=flat-square)](http://browsenpm.org/package/omega-supreme)[![Build Status](https://img.shields.io/travis/primus/omega-supreme/master.svg?style=flat-square)](https://travis-ci.org/primus/omega-supreme)[![Dependencies](https://img.shields.io/david/primus/omega-supreme.svg?style=flat-square)](https://david-dm.org/primus/omega-supreme)[![Coverage Status](https://img.shields.io/coveralls/primus/omega-supreme/master.svg?style=flat-square)](https://coveralls.io/r/primus/omega-supreme?branch=master)[![IRC channel](https://img.shields.io/badge/IRC-irc.freenode.net%23primus-00a8ff.svg?style=flat-square)](https://webchat.freenode.net/?channels=primus)

Known for his great strength and greater courage, Omega Supreme is the Autobots’
last line of defense against the Decepticons. He will stand unwaveringly against
overwhelming odds, and although outwardly grim, he is known by those with enough
insight to actually relish the importance of his task – Omega knows that if he
falls, it is unlikely there will be any remaining Autobots to take his place,
but he would not have it any other way.

In Primus mode, Omega Supreme has an incredible configurability, is able to
broadcast a message with a single request and can distribute messages to single
sparks. In place of his left hand, he is armed with authentication which can
pulverize any attacker.

Or in plain English, `omega-supreme` allows you to broadcast messages to
Primus using a regular HTTP request. These messages can be broadcasted to every
single connection on the server, a single spark or an array of sparks. This
allows other languages to easily write messages to your server without the need
of creating a complex architecture.

## Installation

```js
npm install --save omega-supreme
```

## Adding Omega Supreme to Primus

Omega Supreme should be added as a **plugin** in Primus. The plugin will also add
a `omega-supreme` middleware which will intercept the incoming HTTP requests and
will take care of the actual distribution of the message to every single connected
client. Adding plugins in Primus is done using the `.use(name, plugin)` method. The
options for the plugin can directly be added to the constructor of your Primus
server so all the configuration of the server and the plugins is in one central
location as illustrated in the example below:

```js
'use strict';

var Primus = require('primus')
  , server = require('http').createServer();

var primus = new Primus(server, {
  /* Add the options here, in the Primus's options */
});

primus.use('omega-supreme', require('omega-supreme'));

server.listen(8080);
```

There are various options available, they are all optional but we highly
recommend to change the `password` and `username` options to something unique.
User name and password are used to authenticate the HTTP requests containing the
information to bradcast. The following options can be configured:

- **method**: HTTP method we should respond to, defaults to `PUT`.
- **password**: Password for basic authorization, defaults to `supreme`.
- **username**: Username for basic authorization, defaults to `omega`.
- **url**: Access path, defaults to `/primus/omega/supreme`.
- **concurrently**: How many servers can we broadcast to at once, defaults to `10`.

### Messaging

Now that you've added the `omega-supreme` plugin to your Primus server you can
communicate/broadcast with it using plain HTTP requests. We make a couple
assumptions to the data that is sent to the server:

- The POST/PUT data is JSON encoded.
- The request is made against the supplied URL option.
- The request uses Basic Authentication with the supplied username and password.
- The `msg` Property contains the data that needs to be sent to the connections.
- The `sparks` Property can be an array of spark ids or a string which is the
  spark id. If no `sparks` property is supplied we assume that the given message
  needs to be broadcasted to every single connection on this server.

When your message has been successfully processed by the server it returns a
JSON object with some information:

```js
{
  ok: true,
  send: 10
}
```

The `send` property indicates the amount of connections we've written the
message payload to. If your request has failed a 500 or 401 status code will be
set and a slightly different JSON object will be returned:

```js
{
  ok: false,
  reason: 'invalid data structure'
}
```

## Primus.forward

```js
primus.forward(server, msg, [sparks], fn);
```

In order to make the messaging even easier to use, `omega-supreme` adds a
`primus.forward` method to your Primus server instance. It allows you to broadcast
messages to the supplied server. It will only write the message to the supplied
server if the supplied sparks are not on the current server.

Sending a message to a spark on a different server:

```js
primus.forward('http://localhost:8080', {
  event: 'name'
}, 'ad8a-280z-18', function (err, data) {
  // data.send = 1 if it was successful.
});
```

Sending to a group of sparks:

```js
primus.forward('http://localhost:8080', {
  event: 'name'
}, ['ad8a-280z-18', 'y97x-42480-13', /* more spark.id's */ ], function (err, data) {

});
```

Or just broadcasting by not supplying the optional sparks argument:

```js
primus.forward('http://localhost:8080', {
  event: 'name'
}, function (err, data) {

});
```

In all the examples above, we've sent an `event` packet. If you're using
[`primus-emit`](https://github.com/primus/primus-emit) and you want to trigger
custom events you should use this format:

```js
primus.forward('http://localhost:8080', { emit: [ eventName, ...args ] }, fn);
```

Keep in mind that you don't have to write event blobs, you can write anything
you want.

## License

[MIT](LICENSE)

![Omega Supreme](https://raw.githubusercontent.com/primus/omega-supreme/master/logo.jpg)
