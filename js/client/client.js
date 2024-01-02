const CLIENT = io();
const GAME_DATA = {};
const GAME_CANVAS = $('#game-canvas');

const HANDLERS = {
    loadCreate: () => {
        GAME_CANVAS.load('html/CreateRoomTemplate.html');
    },
    loadJoin: () => {
        GAME_CANVAS.load('html/JoinRoomTemplate.html');
    },
    loadLanding: () => {
        GAME_CANVAS.load('html/LandingTemplate.html');
    },
    create: () => {
        const name = $('#name-input').val();
        CLIENT.emit('createRoom', { name }, (players, roomID) => {
            GAME_DATA.name = name;
            GAME_DATA.roomID = roomID;
            GAME_DATA.isHost = true;
            GAME_CANVAS.load('html/LobbyTemplate.html', () => {
                $('#room-code').text(roomID);
                updatePlayers($('#players-list'), players);
                if (GAME_DATA.isHost) {
                    $('#host-controls').load('html/HostControlTemplate.html');
                }
            });
        });
    },
    join: () => {
        const name = $('#name-input').val();
        const roomID = $('#room-input').val();
        if (roomID === '' || roomID.length !== 4) {
            $('#error-text').text('A 4 character room code must be provided!');
            return;
        }
        CLIENT.emit('joinRoom', { roomID, name }, (players, roomID) => {
            if (!roomID) {
                $('#error-text').text('That room does not exist!');
                return;
            }
            GAME_DATA.name = name;
            GAME_DATA.roomID = roomID;
            GAME_DATA.isHost = false;
            GAME_CANVAS.load('html/LobbyTemplate.html', () => {
                $('#room-code').text(roomID);
                updatePlayers($('#players-list'), players);
                if (GAME_DATA.isHost) {
                    $('#host-controls').load('html/HostControlTemplate.html');
                }
            });
        });
    },
    leave: () => {
        CLIENT.emit('leaveRoom', Object.assign({}, GAME_DATA), () => {
            GAME_DATA.name = null;
            GAME_DATA.isHost = null;
            GAME_DATA.roomID = null;
            GAME_CANVAS.load('html/LandingTemplate.html');
        });
    },
    start: () => {
        CLIENT.emit('startGame', { roomID: GAME_DATA.roomID });
    },
    guess: () => {
        const dataObj = {
            guess: $('#guess-input').val(),
            roomID: GAME_DATA.roomID,
            name: GAME_DATA.name
        };
        CLIENT.emit('submitGuess', dataObj, () => {
            $('#error-text').text('That guess is incorrect. Try again!');
        });
    },
    hostKickAll: () => {
        CLIENT.emit('kickAll', Object.assign({}, GAME_DATA));
    }
};

CLIENT.on('playersChanged', (data) => {
    const { players } = data;
    updatePlayers($('#players-list'), players);
});

CLIENT.on('hostChanged', (data) => {
    if (data.name === GAME_DATA.name) {
        GAME_DATA.isHost = true;
        $('#host-controls').load('html/HostControlTemplate.html');
    }
})

CLIENT.on('gameStarted', (data) => {
    const { mysteryString, category } = data;
    GAME_CANVAS.load('html/GameTemplate.html', () => {
        $('#room-code').text(GAME_DATA.roomID);
        $('#mystery-text').text(mysteryString);
        $('#category-text').text(category);
    });
});

CLIENT.on('mysteryTextChanged', (data) => {
    const { text } = data;
    $('#mystery-text').text(text);
});

CLIENT.on('gameEnded', (data) => {
    const { victor, players, answer, points } = data;
    GAME_CANVAS.load('html/LobbyTemplate.html', () => {
        $('#room-code').text(GAME_DATA.roomID);
        updatePlayers($('#players-list'), players);
        if (GAME_DATA.isHost) {
            $('#host-controls').load('html/HostControlTemplate.html');
        }
        $('#victory-text').text(`${victor} earned ${points} points for guessing "${answer}" first!`);
    });
});

CLIENT.on('playerKicked', () => {
    GAME_DATA.name = null;
    GAME_DATA.isHost = null;
    GAME_DATA.roomID = null;
    GAME_CANVAS.load('html/LandingTemplate.html');
    window.alert('You were kicked from the room.');
});

const updatePlayers = (parent, players) => {
    parent.empty();
    for (const [key, value] of Object.entries(players)) {
        parent.append($(`<li class="list-group-item d-flex justify-content-between align-items-center">
            <div class="text-center">
                ${key}${(key === GAME_DATA.name) ? '<span class="text-decoration"> (you)</span>' : ''}
            </div>
            <span class="badge bg-success rounded-pill">${value.score}</span>
        </li>`));
    }
};

HANDLERS.loadLanding();
