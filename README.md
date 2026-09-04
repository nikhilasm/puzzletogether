# PuzzleTogether

Solve one shared puzzle grid together, in real time. Create a room, share the code, and everyone
types into the same board with live presence and cursors.

Puzzle types: crossword, sudoku, kenken, kakuro, nonogram, suguru. Crosswords come from an imported
bank; the rest are generated on demand.

## Technologies

- Node 22+, Express, Socket.IO
- Lit web components, vanilla JS on the client
- JSDoc plus `checkJs` for types instead of TypeScript
- Vite for the build, Vitest for unit tests, Playwright for browser tests

## Directory structure

| Path | Contents |
| --- | --- |
| `client/` | Lit components, board renderers, store, styles |
| `server/` | Express plus Socket.IO, room state, puzzle generation |
| `shared/` | Code imported by both sides: schema, ops reducer, protocol |
| `data/` | Crossword bank on disk |
| `scripts/` | Crossword importer |
| `tests/` | Playwright browser suite |
| `docs/` | Architecture, design spec, brand, ADRs |

## Develop locally

```
npm install
npm run dev
```

Server runs on 3001, Vite client on 5173. Open http://localhost:5173.

Checks:

```
npm run format
npm run lint
npm run typecheck
npm test
npm run test:ui
```

## Build

```
npm run build
npm start
```

`npm run build` writes `client/dist/`; `npm start` serves it from Express on 3001.

## Contributing

Contributions are welcome. Read [docs/code-style.md](docs/code-style.md) and
[docs/architecture.md](docs/architecture.md) first, and open an issue or pull request.
