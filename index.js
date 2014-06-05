'use strict';

var omega = require('./omega')
  , supreme = require('./supreme');

for (var transformer in supreme) {
  omega[transformer] = supreme[transformer];
}

//
// Expose the module.
//
module.exports = omega;
