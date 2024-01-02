import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Server } from 'socket.io';

import { generateUniqueRoomCode, shuffle } from './utils.js';
import ANSWERS from './answers.json' assert { type: 'json' };

const app = express();
const HTTP_SERVER = createServer(app);
const SERVER = new Server(HTTP_SERVER, { connectionStateRecovery: {}});

const __dirname = dirname(fileURLToPath(import.meta.url));

app.use('/js/', express.static(join(__dirname, '../client')));
app.use('/css/', express.static(join(__dirname, '../../css')));
app.use('/html/', express.static(join(__dirname, '../../html')));
app.get('/', (req, res) => {
    res.sendFile(join(__dirname, '../../html/index.html'));
});

const ROOMS = {};

SERVER.on('connection', (clientSocket) => {
    // add client socket event listeners
    clientSocket.on('createRoom', (data, callback) => {
        const { name } = data;
        let roomID = generateUniqueRoomCode(ROOMS);
        clientSocket.join(roomID);
        ROOMS[roomID] = {players: {[name]: {score: 0}}};
        callback(ROOMS[roomID].players, roomID);
    });

    clientSocket.on('joinRoom', (data, callback) => {
        const { name, roomID } = data;
        if (ROOMS[roomID]) {
            const playerList = ROOMS[roomID].players;
            clientSocket.join(roomID);
            playerList[name] = {score: 0};
            callback(playerList, roomID, false);
            SERVER.in(roomID).emit('playersChanged', { players: playerList });
        }
        else {
            callback(null, null, null);
        }
    });

    clientSocket.on('leaveRoom', async (data, callback) => {
        const { name, roomID, isHost } = data;
        const playerList = ROOMS[roomID].players;
        delete playerList[name];
        clientSocket.leave(roomID);

        if (playerList.length === 0) {
            delete ROOMS[roomID];
        } else {
            if (isHost) {
                SERVER.in(roomID).emit('hostChanged', { name: Object.keys(playerList)[0] });
            }
            SERVER.in(roomID).emit('playersChanged', { players: playerList });
        }
        callback();
    });

    clientSocket.on('startGame', (data) => {
        const { roomID } = data;
        const currentRoom = ROOMS[roomID];

        const answerGroup = ANSWERS[Math.floor(Math.random() * ANSWERS.length)];
        currentRoom.answer = answerGroup.answers[Math.floor(Math.random() * answerGroup.answers.length)];
        currentRoom.mysteryText = Array.from({length: currentRoom.answer.length}, (_, i) => (currentRoom.answer[i] === ' ') ? ' ' : '_');
        currentRoom.reveal = [];
        currentRoom.index = 0;
        for (let i = 0; i < currentRoom.answer.length; i++) {
            if (currentRoom.answer[i] !== ' ') {
                currentRoom.reveal.push({ letter: currentRoom.answer[i], index: i });
            }
        }
        shuffle(currentRoom.reveal);
        
        SERVER.in(roomID).emit('gameStarted', { mysteryString: currentRoom.mysteryText.join(' '), category: answerGroup.category });
        currentRoom.interval = setInterval(() => {
            const nextLetter = currentRoom.reveal[currentRoom.index];
            currentRoom.mysteryText[nextLetter.index] = nextLetter.letter;
            SERVER.in(roomID).emit('mysteryTextChanged', { text: currentRoom.mysteryText.join(' ')});
            currentRoom.index++;

            if (currentRoom.index >= currentRoom.reveal.length) {
                clearInterval(currentRoom.interval);
            }
        }, 3000);
    });

    clientSocket.on('submitGuess', (data, callback) => {
        const { guess, roomID, name } = data;
        const currentRoom = ROOMS[roomID];
        if (guess.toLowerCase() === currentRoom.answer.toLowerCase()) {
            const totalLetters = currentRoom.answer.replace(/\s+/g, '').length;
            const points = Math.round(((1-currentRoom.index/totalLetters))*10 + 5);
            currentRoom.players[name].score += points;
            SERVER.in(roomID).emit('gameEnded', { victor: name, answer: currentRoom.answer, players: currentRoom.players, points });
            clearInterval(currentRoom.interval);
        } else {
            callback();
        }
    });

    clientSocket.on('kickAll', async (data) => {
        const { roomID, name } = data;
        const currentRoom = ROOMS[roomID];
        const score = currentRoom.players[name].score;
        currentRoom.players = { [name]: { score }};
        clientSocket.to(roomID).emit('playerKicked');
        const sockets = await SERVER.in(roomID).fetchSockets();
        sockets.forEach((socket) => {
            if (socket.id !== clientSocket.id) {
                socket.leave(roomID);
            }
        });
        SERVER.in(roomID).emit('playersChanged', { players: currentRoom.players });
    });

    clientSocket.on('disconnect', (reason) => {

    });
});

HTTP_SERVER.listen(3000, () => {
    console.log('server running at http://localhost:3000');
});