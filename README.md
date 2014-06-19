# Omega Supreme [![Build Status](https://travis-ci.org/primus/omega-supreme.svg)](https://travis-ci.org/primus/omega-supreme)

Known for his great strength and greater courage, Omega Supreme is the Autobots’
last line of defense against the Decepticons. He will stand unwaveringly against
overwhelming odds, and although outwardly grim, he is known by those with enough
insight to actually relish the importance of his task – Omega knows that if he
falls, it is unlikely there will be any remaining Autobots to take his place,
but he would not have it any other way.

In Primus mode, Omega Supreme has incredible configurablity, able to broadcast
a message with a single request and distribute messages to single sparks. In
place of his left hand, he is armed with authentication which can pulverize any
attacker.

Or in plain English, `omega-supreme` allows you to broadcast messages to
Primus using a regular HTTP request. These messages be broadcasted to every
single connection on the server, a single spark or an array of sparks. This
allows other languages to easily write messages to your server without the need
creating a complex architecture.

## Installation

```js
npm install --save omega-supreme
```

## Adding Omega Supreme to Primus

Omega Supreme should be added as **plugin** in Primus. The plugin will also add
a `omega-supreme` middleware which will intercept the incoming HTTP requests and
to the actual distribution of the message to every single connected client.
Adding plugins in Primus is done using the `.use(name, plugin)` method. The
options for the plugin can directly be added to the constructor of your Primus
server so all the configuration of the server and plugins is in one central
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

There are various of options available, there are all optional but we highly
recommend to change the `password` and `username` options to something unique.
The user name and password are used to authenticate the HTTP requests with the
broadcast information. The following options can be configured:

- **method**: HTTP method we should respond to, defaults to `PUT`.
- **password**: Password for basic auth, defaults to `supreme`.
- **username**: Username for basic auth, defaults to `omega`.
- **url**: Access path, defaults to `/primus/omega/supreme`.

### Messaging

Now that you've added the `omega-supreme` plugin to your Primus server you can
communicate/broadcast using plain HTTP requests with it. We make a couple
assumptions to the data that is send to the server:

- The POST/PUT data is JSON encoded.
- The request is made against the supplied URL option.
- The request uses Basic Authentication with the supplied username and password.
- The `msg` Property contains the data that needs to be send to the connections.
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
message payload to.  If your request has failed a 500 or 401 status code will be
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

In order to make the messaging even easier to use we've added a `primus.forward`
method to your Primus server instance. It allows you to broadcast messages to
the supplied server. It will only write the message to the supplied server if
the supplied sparks are not on the current server.

Sending a message to a spark on a different server:

```js
primus.forward('http://localhost:8080', {
  event: 'name'
}, 'ad8a-280z-18', function (err, data) {
  // data.calls = 1 if it was successful.
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

## License

MIT

![Omega Supreme](https://raw.githubusercontent.com/primus/omega-supreme/master/logo.jpg)
