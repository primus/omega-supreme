# Omega Supreme

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

## Usage

Omega Supreme should be added as **plugin** in Primus. The plugin will also add
a `omega-supreme` middleware which will intercept the incoming HTTP requests.

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

The following options are accepted:

- **method**: HTTP method we should respond to, defaults to `PUT`.
- **password**: Password for basic auth, defaults to `supreme`.
- **username**: Username for basic auth, defaults to `omega`.
- **url**: Access path, defaults to `/primus/omega/supreme`.

## License

MIT

![Omega Supreme](https://raw.githubusercontent.com/primus/omega-supreme/master/logo.jpg)
