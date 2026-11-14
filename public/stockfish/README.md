# Stockfish (GPLv3)

These files are an unmodified copy of the "lite, single-threaded" build of
[Stockfish.js](https://github.com/nmrugg/stockfish.js) version 19.0.1, taken
from the [`stockfish` npm package](https://www.npmjs.com/package/stockfish/v/19.0.1).

- `stockfish-19-lite-single.js` / `stockfish-19-lite-single.wasm` — the engine
- `COPYING.txt` — the GNU General Public License, version 3

Stockfish.js is a WebAssembly build of the
[Stockfish](https://github.com/official-stockfish/Stockfish) chess engine.
Both are licensed under the GPLv3.

Source code for exactly this build:
https://github.com/nmrugg/stockfish.js/tree/v19.0.1

The site only talks to the engine through text (UCI) messages sent to a
separate Web Worker; see `games/chess/engine.ts`.
