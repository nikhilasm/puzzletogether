var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')(server);
var path = require('path');

var ptgame = require('./puzzletogether');

const PORT = 9000;

app.use(express.static(path.join(__dirname, 'public')));

server.listen(PORT, function() {
    console.log('listening on *:' + PORT);
});

io.on('connection', function(socket) {
    console.log('User connected!');
    //Initialize game
    ptgame.init(io, socket);
});