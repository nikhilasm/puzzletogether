function generateUniqueRoomCode (currentRooms) {
    let roomID = Math.random().toString(36).substring(2, 6);
    while (roomID in Object.keys(currentRooms)) {
        roomID = Math.random().toString(36).substring(2, 6);
    }
    return roomID;
}

function shuffle(array) {
    let currentIndex = array.length,  randomIndex;

    // While there remain elements to shuffle.
    while (currentIndex > 0) {

        // Pick a remaining element.
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;

        // And swap it with the current element.
        [array[currentIndex], array[randomIndex]] = [
        array[randomIndex], array[currentIndex]];
    }

    return array;
}

export {
    generateUniqueRoomCode,
    shuffle
}