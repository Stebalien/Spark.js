/*
 * Setup:
 * 1. Install node.js
 * 2. npm install express.io
 * 
 * Run server:
 * 1. node server.js (might need sudo)
 */

var server = require('./server.js');

server.Init();
server.Run(5000);
