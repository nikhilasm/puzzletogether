//Main client-side game logic handler

var socket;
var name, color, role;
var roomID;

//jQuery function to run on page load
$(function() {
    showLandingPage();
    socket = io();
    socket.on('connected', onConnect);

    //Bind socket events
    socket.on()

});

function showLandingPage() {
    $('#gameArea').load('templates/landing.html');
}

function showJoinRoomPage() {
    $('#gameArea').load('templates/join.html');
}

function showCreateRoomPage() {
    $('#gameArea').load('templates/create.html');
}

function onConnect() {
    console.log('Connected to server!');
}

function backToLandingPage(source) {
    if (source == 'join') {
        $('#input_name').val('');
        $('#input_roomCode').val('');

    }
    else if (source == 'create') {
        $('#input_name').val('');
    }

    showLandingPage();
}

//Player joined room
function joinRoom() {
    var playerName = $('#input_name').val();
    var roomCode = $('#input_roomCode').val();
    
}

//Host created new room
function createRoom() {
    var playerName = $('#input_name').val();
}