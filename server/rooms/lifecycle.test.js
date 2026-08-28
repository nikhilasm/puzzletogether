import { describe, expect, it } from 'vitest';

import { PLAYER_COLOR_COUNT } from '../../shared/constants.js';

import { addPlayer, dropPlayer, setPlayerColor, toRoomView } from './lifecycle.js';
import { createRoom } from './store.js';

/** A room with the named players seated in order, so colours are assigned 0, 1, 2… */
function roomWith(...names) {
    const room = createRoom();
    const players = names.map((name) => addPlayer(room, name, `socket-${name}`).player);
    return { room, players };
}

describe('colour assignment', () => {
    it('gives each player a different colour on the way in', () => {
        const { players } = roomWith('Ada', 'Grace', 'Alan');
        expect(players.map((player) => player.colorIndex)).toEqual([0, 1, 2]);
    });

    it('reuses a colour once its owner leaves', () => {
        const { room, players } = roomWith('Ada', 'Grace');
        dropPlayer(room, players[0].id);

        const { player } = addPlayer(room, 'Alan', 'socket-alan');
        expect(player.colorIndex).toBe(0);
    });
});

describe('setPlayerColor', () => {
    it('takes a free colour', () => {
        const { room, players } = roomWith('Ada', 'Grace');
        expect(setPlayerColor(room, players[0].id, 5)).toBe(true);
        expect(room.players.get(players[0].id).colorIndex).toBe(5);
    });

    it("refuses a colour somebody else holds, and leaves the asker's own alone", () => {
        const { room, players } = roomWith('Ada', 'Grace');
        expect(setPlayerColor(room, players[0].id, 1)).toBe(false);
        expect(room.players.get(players[0].id).colorIndex).toBe(0);
        expect(room.players.get(players[1].id).colorIndex).toBe(1);
    });

    it('accepts re-picking the colour you already have', () => {
        const { room, players } = roomWith('Ada');
        expect(setPlayerColor(room, players[0].id, 0)).toBe(true);
    });

    it('frees the old colour for the next person to ask', () => {
        const { room, players } = roomWith('Ada', 'Grace');
        setPlayerColor(room, players[0].id, 4);
        expect(setPlayerColor(room, players[1].id, 0)).toBe(true);
    });

    it('ignores a player who is not in the room', () => {
        const { room } = roomWith('Ada');
        expect(setPlayerColor(room, 'nobody', 3)).toBe(false);
    });

    it('keeps every colour in the room distinct however players swap around', () => {
        const { room, players } = roomWith('Ada', 'Grace', 'Alan');
        setPlayerColor(room, players[0].id, 7);
        setPlayerColor(room, players[1].id, 0);
        setPlayerColor(room, players[2].id, 7); // refused: Ada has it

        const colors = toRoomView(room).players.map((player) => player.colorIndex);
        expect(new Set(colors).size).toBe(colors.length);
        expect(colors.every((index) => index >= 0 && index < PLAYER_COLOR_COUNT)).toBe(true);
    });
});
