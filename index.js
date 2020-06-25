var app = require('express')();
var server = require('http').createServer(app);
var io = require('socket.io')(server);

const PORT = 9000;

server.listen(PORT, function() {
    console.log('listening on *:' + PORT);
});

io.on('connection', function(socket) {
    //Initialize game
    //ptgame.init(io, socket);
});