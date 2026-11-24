# Bingo Spinner

A 3D bingo ball cage you can play with. Ninety numbered balls tumble inside a
spinning wire drum with real-time physics. Press **Spin & draw**: the drum spins
up and slows down, then the drawn ball lights up, pushes its way to the top, and
pops out to be shown off before it drops into the tray.

## Features

- 3D brass-and-chrome cage built with [three.js](https://threejs.org), with
  shadows, reflections and glossy numbered balls
- Physics by [cannon-es](https://github.com/pmndrs/cannon-es): all 90 balls
  collide with each other, the drum wall and the baffles inside it
- Interactive:
  - **Hold to crank** (or hold <kbd>Space</kbd>) to spin the drum by hand
  - **Idle spin** slider sets how fast the drum turns on its own
  - **Shake** throws every ball up in the air
  - Click any ball in the cage to flick it
  - Drag to look around, scroll to zoom
- **Spin & draw** (or <kbd>Enter</kbd>) draws a ball; drawn balls line up in a
  tray in the order they came out, and the last 10 are listed on screen
- **New game** sends every ball back into the drum
- The game is saved on the server (`data/state.json`), so a reload or restart
  keeps the drawn balls

## How the draw is random

The ball is chosen on the server with Node's `crypto.randomInt`, which reads the
operating system's cryptographically secure random number generator (seeded from
hardware entropy) and uses rejection sampling, so every ball still in the cage
has exactly the same chance. A physics simulation on a computer is
deterministic, so it isn't used to choose the ball. The physics is there for the
look and for you to play with; the ball the server picks is the one that lights
up and comes out of the drum.

## Run it

Requires Node.js 18 or newer.

```bash
npm install
npm start
```

Then open <http://localhost:3001>. Set `PORT` to use a different port.

## Project layout

```
server/index.js   Express server: static files, libraries, API
server/game.js    Game state and the random draw
public/           Frontend: index.html, styles.css, main.js (scene, physics, UI)
```

## API

| Method | Path          | What it does                                   |
| ------ | ------------- | ---------------------------------------------- |
| GET    | `/api/state`  | Current game state                             |
| POST   | `/api/draw`   | Draw a random ball; returns `number` and state |
| POST   | `/api/reset`  | Start a new game                               |

State looks like:

```json
{ "min": 1, "max": 90, "drawn": [75, 43], "last": 43, "remaining": 88,
  "randomSource": "crypto.randomInt (operating system CSPRNG)" }
```
