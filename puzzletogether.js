//Main server-side game logic handler

var io;
var gameSocket;

exports.init = function(sio, socket) {
    io = sio;
    gameSocket = socket;
    gameSocket.emit('connected');

    //Bind host events

    //Bind player events

}