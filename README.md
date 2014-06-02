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

## Installation

```js
npm install --save omega-supreme
```

## Usage

Omega Supreme should be added as **middleware** layer in Primus so it can
intercept requests.

```js
'use strict';

var Primus = require('primus')
  , server = require('http').createServer();

var primus = new Primus(server);

primus.before('omega-supreme', require('omega-supreme')({
  password: 'your secret password'
}));

server.listen(8080);
```

## License

MIT
