# Il campus della Scuola Cripto · interface contract v1.0

This is the contract for the living 3D campus that replaces the single meeting room
(`makeAula`) of `pagina/scuola-cripto.html`. Five builders implement five modules in
parallel, each in its own file and without seeing the others; an integrator then wires
them into the page. **Everything a module exposes or consumes is defined here.** When this
document and your intuition disagree, follow the document; when the document is silent,
choose the most conservative behaviour, write it down in your final report, and do not
invent a new cross-module API.

**How to read it.** Every builder reads §1–4, §7, §8, their own part of §5 and the
appendices it cites. The integrator also reads §6 and §9. The kernel source (Appendix H)
is for the integrator; builders use the tested copy in the test kit (§8).

Contents:
1. The goal, in one page
2. Files, load order, external scripts and size budgets
3. Conventions (units, layout, agents, states, anchors, colour, DOM, honesty, time)
4. The kernel `campus/core.js`: data store, bus, clock, utilities, boot and loop
5. The five modules: `render.js`, `world.js`, `people.js`, `life.js`, `ui.js`
6. Page integration (for the integrator)
7. Degradation matrix
8. Stubs and the shared test kit
9. Integration tests after the merge
10. Appendices: schedule, activities, personas, talk prompt, chiacchiera templates,
    careers and medals, Italian strings, the kernel source

---

## 1. The goal, in one page

**ARGO's Scuola Cripto** is a private paper-trading school: eight AI agents trade real
BingX prices with fake money (10.000 USDT per wallet). The owner is Italian and not
technical. Every word on the page is plain Italian. The page is a private claude.ai
artifact: only the owner sees it.

**The owner's vision**, in short: a real school, seen like a film or a video game. Little
people, as realistic as possible, move in 3D through the building and decide what to do:
they work, gather, eat, sleep in their own dormitories, think, reflect and talk to each
other whenever their characters make them want to. It is a school of professional traders.
Their goal is to make money with trading and to graduate on **21/2/2027**, choosing together
one precise technique, the «tesi», to reach the common goal: working as a team and sharing
all the money. The owner is also a player: he proposes challenges, follows each agent's
career (levels, medals) and the season towards graduation.

**What this contract builds:**
- a **cutaway campus** (a dollhouse with no ceilings), with these rooms: the meeting room,
  the trading room, the library, the gym, the canteen and café, a cloister garden, the
  Preside's office and 8 dormitories;
- **eight procedural humanoids** with their own looks, props, gaits, faces and moods;
- a **brain** that runs their day on Rome's clock and overrides it with what really
  happens:
  - the live meeting (`live/ora`);
  - the replay of a day's minutes, ported exactly from today's page;
  - the evening alarm meeting, the Sunday gym and the contests;
- **encounters and thoughts** built only from real data, tagged honestly;
- **«Fateli parlare»:** the owner asks Claude, through the `sample` capability, for a
  dialog in character, which the agents then act out;
- **the player layer:** proposals, careers, the season bar and the contest scoreboard.

**Non-negotiables** (they override any other wish):
1. **Never invent numbers.** Every number an agent says, or a surface shows, comes from
   `Campus.data` through `Campus.derive` and `Campus.util`, or from the fixed school
   rules in Appendix E.3. A missing number means a calm sentence without numbers, never
   «undefined», «NaN», «null» or «—» spoken aloud.
2. **Words are tagged by where they come from:**
   - `ufficiale`: the agents really wrote them, in the minutes, the live doc, the gym or
     the contest;
   - `chiacchiera`: built by the page from templates and real numbers;
   - `pensiero`: taken from the agent's own notebook;
   - `claude`: shown as «dialogo generato da Claude», asked for by the owner.
3. **Values from the database are never markup.** Use `textContent`, or `Campus.util.esc`
   before any `innerHTML`. Link only `https://` URLs.
4. **Grey, empty or missing data looks calm, not broken.**
5. **The agents are AI and are never presented as conscious.**
6. **No real money**, and no promise of gains.

---

## 2. Files, load order, external scripts and size budgets

### 2.1 Files

| File | Owner | Global | What |
| --- | --- | --- | --- |
| `campus/CONTRATTO.md` | architect | — | this contract |
| `campus/core.js` | integrator copies it **verbatim** from Appendix H | `Campus.*` kernel | namespace, constants, utilities, data store, derived numbers, bus, clock, boot, loop |
| `campus/render.js` | builder 1 | `Campus.render` | renderer, tone mapping, shadows, sky, day and night, fog, post-processing, quality, camera rig |
| `campus/world.js` | builder 2 | `Campus.world` | building, rooms, furniture, anchors, waypoint graph and A*, canvas surfaces, lamps, cutaway, minimap data |
| `campus/people.js` | builder 3 | `Campus.people` | the 8 humanoids, animation, faces, look-at, path following, the DOM overlay (name tags, bubbles, thought clouds) |
| `campus/life.js` | builder 4 | `Campus.life` | the brain: schedule, overrides (live, replay, emergency, gym, contest), activities, encounters, thoughts, feed, moods, «Fateli parlare» |
| `campus/ui.js` | builder 5 | `Campus.ui` | HUD (camera buttons, Rome clock, minimap, replay bar, follow card), side panel (feed, activities, Fateli parlare), player layer |

Every module is a **classic script** (no ES modules, no `import`, no build step), wrapped
in an IIFE with `"use strict"`, that starts with:

```js
(() => {
  "use strict";
  const C = window.Campus;
  if (!C || !C.core) { console.warn("Campus: core.js must load first"); return; }
  if (C.render) return; // the module's own name: loaded twice
  const U = C.util, bus = C.bus, D = C.derive;
  C.render = { /* the public API of §5.1 */ };
})();
```

A module defines **only** its own `Campus.<name>` object. It may hold any private
helpers inside its IIFE. It must not write to other modules' objects, to `Campus.data`
(only the page writes data), or to `window` beyond its own namespace. Test-only hooks
start with an underscore (`Campus.life._advance`) and are documented in §5.

### 2.2 Load order in the page

After three.js r128, at the end of the page, in this order:

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
<script src="campus/core.js"></script>
<script src="campus/render.js"></script>
<script src="campus/world.js"></script>
<script src="campus/people.js"></script>
<script src="campus/life.js"></script>
<script src="campus/ui.js"></script>
<!-- then the page's own inline script, which calls Campus.boot (§6) -->
```

Modules must not do work at load time beyond defining their API and **static data**.
`world.js` must expose its static layout (`rooms`, `doors`, `anchors`, `findPath`,
`minimap`) at load time, without THREE, because `life` and `ui` need it in the no-WebGL
fallback. Everything that needs THREE or the DOM happens in `init`/`build`.

### 2.3 External scripts

Only these, at these exact versions:
- **three.js r128:** loaded by the page from cdnjs, as the global `THREE`.
- **The classic examples of three r128,** loaded **on demand** by `render.js` from
  `https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/<path>`, in this order:

| Need | Files (in order) |
| --- | --- |
| free camera | `controls/OrbitControls.js` |
| post-processing (high quality) | `shaders/CopyShader.js`, `shaders/LuminosityHighPassShader.js`, `shaders/ACESFilmicToneMappingShader.js`, `shaders/GammaCorrectionShader.js`, `shaders/FXAAShader.js`, `shaders/VignetteShader.js`, `postprocessing/EffectComposer.js`, `postprocessing/RenderPass.js`, `postprocessing/ShaderPass.js`, `postprocessing/UnrealBloomPass.js` |
| SSAO (high quality, desktop only, optional) | `math/SimplexNoise.js`, `shaders/SSAOShader.js`, `postprocessing/SSAOPass.js` |

Load each with a `<script>` element (`async = false`), resolve when its `load` fires,
and time out after 8 s. A failed load is not an error: the feature stays off, and
`render:post {loaded:false}` is emitted. `EffectComposer.js` itself defines `THREE.Pass`
and `THREE.FullScreenQuad`: do not load `postprocessing/Pass.js`.

Nothing else is loaded: no model files, no textures, no fonts beyond the page's Google
Fonts (Titillium Web, Source Serif 4, IBM Plex Mono, Caveat). Everything visual is
procedural geometry plus `CanvasTexture`. Do not depend on `BufferGeometryUtils`: if you
merge geometries, write a small merge (Appendix G.2).

**three r128 facts to remember:**
- There is no `CapsuleGeometry` (it arrived in r139): build capsules from
  `CylinderGeometry` plus `SphereGeometry`, or use `LatheGeometry`.
- There is no colour management: see §3.6.
- `renderer.outputEncoding` is the API; `outputColorSpace` does not exist yet.

### 2.4 Size budgets (unminified source, UTF-8)

| File | Budget |
| --- | --- |
| core.js | ≈ 30 KB (fixed) |
| render.js | ≤ 70 KB |
| world.js | ≤ 170 KB |
| people.js | ≤ 130 KB |
| life.js | ≤ 150 KB |
| ui.js | ≤ 110 KB |
| the page after integration (`makeAula` and its CSS removed) | ≤ 190 KB |
| **total** | **≤ 850 KB** (hard ceiling 900 KB) |

Write compact code. Data tables beat repeated code. No embedded images or `data:` URIs
over 4 KB.

---

## 3. Conventions

### 3.1 Units and axes

- **Units:** 1 unit = 1 metre. Time in seconds, unless a name ends in `Ms`.
- **Axes:** `y` up. `x` grows to the east (screen right in the default view). `z` grows
  to the south, towards the default camera. North is `−z`.
- **Floor:** every walkable floor is at `y = 0`. There is one storey.
- **Yaw:** `face` (or `yaw`) is a rotation about `+y`, in radians. `face = 0` means
  looking towards `+z` (south, the default camera), and `face = π/2` means looking
  towards `+x` (east). This is exactly `Object3D.rotation.y` for a model whose front faces
  `+z`. **All people models face `+z` at rotation 0.** The direction of a yaw is
  `(sin face, 0, cos face)`; the yaw from a to b is `Math.atan2(b.x − a.x, b.z − a.z)`.
- **Azimuth of the sun:** degrees from north, clockwise (`Campus.util.sun`). As a
  direction: `x = sin(az)·cos(alt)`, `y = sin(alt)`, `z = −cos(az)·cos(alt)`.

### 3.2 The campus layout

The campus bounds are **x ∈ [−24, 24], z ∈ [−20, 20]** (48 × 40 m). Walls are 3.2 m
high and 0.2 m thick, centred on the room borders. There are no ceilings or roofs. The
ground outside the building (lawn, paths, trees, a low perimeter wall, street lamps)
extends to x ∈ [−40, 40], z ∈ [−34, 34].

```
        x: −24        −14             0              14        24
 z=−20  ┌────────────┬───────────────┬───────────────┬──────────┐
        │ presidenza │   riunione    │    trading    │biblioteca│
        │            │               │               │          │
 z=−10  ├────────────┼───────────────┴───────────────┼──────────┤
        │            │░░░░░░░░ portico (3 m) ░░░░░░░░│          │
 z=−7   │            │░░┌─────────────────────────┐░░│          │
        │   mensa    │░░│                         │░░│ palestra │
        │  e caffè   │░░│   cortile (giardino)    │░░│          │
        │            │░░│                         │░░│          │
 z=7    │            │░░└─────────────────────────┘░░│          │
        │            │░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│          │
 z=10   ├────────────┴───────────────────────────────┴──────────┤
        │                corridoio dei dormitori                │
 z=12   ├──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────┤
        │dorm  │dorm  │dorm  │dorm  │dorm  │dorm  │dorm  │dorm  │
        │presid│falco │tartar│spazz │ragion│guard │cronis│scett │
 z=20   └──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────┘
```

**Rooms** (`rects` are `[x0, z0, x1, z1]`, with x0 < x1 and z0 < z1):

| id | name (Italian, shown) | kind | rects |
| --- | --- | --- | --- |
| `presidenza` | Presidenza | interno | `[-24,-20,-14,-10]` |
| `riunione` | Sala riunioni | interno | `[-14,-20,0,-10]` |
| `trading` | Sala trading | interno | `[0,-20,14,-10]` |
| `biblioteca` | Biblioteca | interno | `[14,-20,24,-10]` |
| `mensa` | Mensa e caffè | interno | `[-24,-10,-14,10]` |
| `palestra` | Palestra | interno | `[14,-10,24,10]` |
| `portico` | Portico | passaggio | `[-14,-10,14,-7]`, `[-14,7,14,10]`, `[-14,-7,-11,7]`, `[11,-7,14,7]` |
| `cortile` | Cortile | esterno | `[-11,-7,11,7]` |
| `corridoio` | Corridoio dei dormitori | passaggio | `[-24,10,24,12]` |
| `dorm_<key>` | Stanza del Preside, del Falco, della Tartaruga, dello Spazzino, del Ragioniere, del Guardiano, del Cronista, dello Scettico | dormitorio | i = index of key in `Campus.KEYS`: `[-24+6i, 12, -18+6i, 20]` |

So the dormitories along x are: preside, falco, tartaruga, spazzino, ragioniere,
guardiano, cronista, scettico, from west to east.

The **portico** is an open colonnade (a cloister) with columns every 3 m along the
garden's edge, arches suggested by the geometry, and no roof. It works as the corridor
of the ground floor. The **cortile** is a garden with lawn, gravel paths, trees, a
fountain at its centre (0, 0) and benches.

**Doors and openings** (centre x, z; width w; axis `"x"` = the wall runs along x, so
the door sits at a fixed z):

| id | between | x | z | w | axis |
| --- | --- | --- | --- | --- | --- |
| `riunione\|portico` | riunione, portico | −7 | −10 | 1.6 | x |
| `trading\|portico` | trading, portico | 7 | −10 | 1.6 | x |
| `riunione\|trading` | riunione, trading | 0 | −15 | 1.2 | z |
| `presidenza\|riunione` | presidenza, riunione | −14 | −15 | 1.2 | z |
| `biblioteca\|trading` | biblioteca, trading | 14 | −15 | 1.2 | z |
| `presidenza\|mensa` | presidenza, mensa | −19 | −10 | 1.2 | x |
| `biblioteca\|palestra` | biblioteca, palestra | 19 | −10 | 1.2 | x |
| `mensa\|portico` | mensa, portico | −14 | 0 | 2.0 | z |
| `palestra\|portico` | palestra, portico | 14 | 0 | 2.0 | z |
| `mensa\|corridoio` | mensa, corridoio | −19 | 10 | 1.6 | x |
| `palestra\|corridoio` | palestra, corridoio | 19 | 10 | 1.6 | x |
| `portico\|corridoio.o` / `.c` / `.e` | portico, corridoio | −7 / 0 / 7 | 10 | 2.0 | x |
| `portico\|cortile.n` / `.s` | portico, cortile | 0 | −7 / 7 | 2.4 | x |
| `portico\|cortile.o` / `.e` | portico, cortile | −11 / 11 | 0 | 2.4 | z |
| `dorm_<key>\|corridoio` | dorm_<key>, corridoio | −21+6i | 12 | 1.0 | x |

The colonnade is walkable between any two columns, but the waypoint graph only needs the
four `portico|cortile.*` openings. Doors are open doorways: door leaves may be drawn open
or omitted, and are never closed obstacles.

**Fixed features** (needed by `life` and `people`; the exact furniture is world's choice):
- **riunione.**
  - On the north wall (z = −20) is the blackboard, about 5.5 × 1.75 m, centred at x = −7,
    with the price ticker above it.
  - The oval table is centred at (−7, −16.8). The 8 seats sit on the table's north arc,
    open to the south, as in today's page: preside at the head (the north end), the four
    wallet agents on his right hand (west), cronista, guardiano and scettico on his left
    (east). Everyone faces the table.
  - The engine's terminal («il motore») stands on the east side, near (−1.4, −16.8).
  - A bookshelf stands on the west wall.
- **trading.**
  - Six desks with two monitors each: falco, tartaruga, spazzino, ragioniere (the trading
    row), guardiano (the risk desk) and cronista (the news desk).
  - On the north wall is the 36-coin price wall, with an LED ticker.
  - On the east wall is the contest scoreboard, with 4 standing spots in front of it.
- **The common-goal board.** It hangs on the outer face of the north wing, facing the
  garden: centred at (0, 1.9, −9.85), facing +z, about 4 × 1.8 m.
- **biblioteca:** shelves, 4 armchairs, 4 reading tables.
- **palestra:**
  - 4 exam desks in a row facing a whiteboard on the north wall, with a standing spot for
    the Scettico;
  - a fitness corner (a rowing machine and a treadmill as props, with 4 standing spots);
  - 2 benches.
- **mensa:** a café counter with a coffee machine (3 standing spots), 4 tables with 4
  chairs each, and big windows on the west.
- **presidenza:** a desk, 2 guest chairs, a window, shelves and the school register.
- **Each dormitory:**
  - a bed along the south wall, its head to the west;
  - a desk with a lamp;
  - a wardrobe with a mirror (the `spot` anchor);
  - personal objects in the agent's colour and props (Appendix C);
  - a name plate on the door (a canvas texture).

### 3.3 The agents

`Campus.KEYS = ["preside","falco","tartaruga","spazzino","ragioniere","guardiano","cronista","scettico"]`,
always in this order.
- `Campus.TRADERS` are the four with wallets: falco, tartaruga, spazzino, ragioniere.
- `Campus.GRADED` are the seven the Preside grades: all the keys except preside.
- The pseudo-speaker `"motore"` (the engine) is not a person. It speaks from its
  terminal.

| key | name | DOM colour, light / dark | 3D colour (`Campus.COLORS`) | height | build | walk speed m/s |
| --- | --- | --- | --- | --- | --- | --- |
| preside | Preside | `#b8243a` / `#ef6a6b` | `0xb8243a` | 1.78 | slim, older, slightly stooped | 1.05 |
| falco | Falco | `#257de0` / `#3d93f0` | `0x257de0` | 1.80 | athletic | 1.55 |
| tartaruga | Tartaruga | `#128a2b` / `#22b83c` | `0x128a2b` | 1.66 | sturdy, calm (a woman) | 0.85 |
| spazzino | Spazzino | `#ef6a26` / `#ef7a3c` | `0xef6a26` | 1.75 | wiry | 1.25 |
| ragioniere | Ragioniere | `#d99400` / `#dca21c` | `0xd99400` | 1.70 | thin, neat | 1.15 |
| guardiano | Guardiano | `#00a383` / `#19b496` | `0x00a383` | 1.88 | broad, tall | 1.20 |
| cronista | Cronista | `#db5a93` / `#e8649f` | `0xdb5a93` | 1.72 | medium | 1.35 |
| scettico | Scettico | `#6a4ce2` / `#9d8cf1` | `0x6a4ce2` | 1.76 | thin | 1.10 |
| motore | Motore | `#47526a` / `#b7c2bb` | `0x47526a` | — | — | — |

- **In the DOM,** use the page tokens `var(--c-<key>)`: they switch with dark mode. The
  class `k-<key>` on an element sets `--who` to the agent's colour (the page's own CSS).
- **In 3D,** use `Campus.COLORS[key]`. The 3D scene follows Rome's day and night, not
  the page theme.
- **Looks, props and faces** are in Appendix C.
- **Italian articles:** `Campus.ARTICLE[key]` is `il`, `la` or `lo`, so you can write
  «il Falco», «la Tartaruga», «lo Spazzino».

### 3.4 Postures and animation states

`Campus.STATES` (exact strings, the only values of `people.stateOf`):

| state | posture | what it looks like |
| --- | --- | --- |
| `idle` | stand | relaxed standing: weight shifts, breathing, occasional glance around |
| `walk` | (moving) | locomotion along a path; set by people itself, never commanded |
| `sit` | sit | seated, at rest |
| `stand` | stand | standing straight and attentive, square to `lookAt` or the anchor's face |
| `type` | sit | hands on the keyboard, forearms and fingers moving, eyes on the screen |
| `read` | sit or stand | holds a book, paper or tablet; head down; a page turns every 8-15 s |
| `talk` | any | mouth moves with the bubble; head nods; small hand movements |
| `gesture` | stand or sit | emphatic arm gestures, pointing towards `lookAt` |
| `drink` | stand or sit | a cup to the mouth every 6-10 s |
| `sleep` | lie | lying on the back, eyes closed, slow breathing; turns over now and then |
| `think` | stand or sit | hand on chin, eyes up and to one side, a slow nod |
| `write` | stand (at a board) or sit (in a notebook) | writing arm moving |
| `listen` | any | looks at the speaker, nods now and then, blinks a little more |

`Campus.POSTURES = ["stand","sit","lie"]`.
- The **posture** comes from the anchor where the person is (`anchor.posture`).
- The **state** is the activity layered on it.
- A state incompatible with the current posture is mapped like this:
  - `sit` while standing becomes `stand`;
  - `sleep` while not lying becomes `idle`;
  - every other state keeps the posture.
- People animate the posture transitions themselves: standing up takes 0.7 s, sitting
  down 0.8 s, lying down 1.2 s.

### 3.5 Anchors

An **anchor** is a named place where a person can be and do something. **Id grammar:**
`<roomId>.<kind>[.<name>][.<n>]`, with only `[a-z0-9_.]`. The second segment is the
`kind`.

```ts
type Anchor = {
  id: string;             // "trading.desk.falco"
  room: string;           // "trading"
  kind: string;           // "desk"
  x: number; z: number;   // in use: the pelvis for sit and lie, the feet for stand
  y: 0;                   // the floor
  face: number;           // yaw while in use (§3.1); for "lie": the direction from the pelvis to the head
  posture: "stand" | "sit" | "lie";
  seatH: number;          // sit: the seat's top height (typ. 0.46); lie: the mattress top (typ. 0.52)
  ax: number; az: number; // the approach point on the walkable side: stand here before sitting or lying
  owner: string | null;   // reserved for this agent by default
  tags: string[];         // from: chat, quiet, walk, work, meal, night, gym, fit, gara
  states: string[];       // the states that make sense here; states[0] is the default
  look: {x, y, z} | null; // what the user looks at (a monitor, the board, the fountain)
  speak?: {x, y, z};      // only riunione.screen: where the engine's bubble is anchored
};
```

**The required anchors.** `world.js` must provide all of these, with exactly these ids,
postures, owners and tags. It may add more.

| ids | posture | states (first = default) | owner | tags |
| --- | --- | --- | --- | --- |
| `riunione.seat.<key>` (8) | sit | sit, listen, talk, think, write | key | |
| `riunione.stand.<key>` (8): behind or beside each seat | stand | stand, talk, gesture | key | |
| `riunione.board.preside` | stand | write, gesture, talk | preside | |
| `riunione.board.guest` | stand | gesture, talk, stand | | |
| `riunione.shelf` | stand | read, think | | |
| `riunione.screen` (with `speak`) | stand | stand, type, think | | |
| `trading.desk.<k>` for falco, tartaruga, spazzino, ragioniere, guardiano, cronista | sit | type, read, think, talk | k | work |
| `trading.wall.1..3` | stand | think, read, talk | | work |
| `trading.gara.1..4` | stand | think, talk, gesture | | chat, gara |
| `biblioteca.armchair.1..4` | sit | read, think, talk | | quiet, chat |
| `biblioteca.table.1..4` | sit | read, write, think | | quiet, work |
| `biblioteca.shelf.1..3` | stand | read, think | | quiet |
| `palestra.desk.<trader>` (4) | sit | think, write, type | trader | gym |
| `palestra.board` | stand | talk, gesture, write | preside | gym |
| `palestra.stand.scettico` | stand | listen, think, talk | scettico | gym |
| `palestra.spot.1..4` | stand | gesture, idle | | fit |
| `palestra.bench.1..2` | sit | drink, talk, sit | | chat |
| `mensa.counter.1..3` | stand | drink, talk | | meal, chat |
| `mensa.seat.<t>.<n>`, t and n in 1..4 (16) | sit | drink, talk, listen, read | | meal, chat |
| `cortile.bench.1..6` | sit | talk, read, think, drink | | chat |
| `cortile.spot.1..8` (a walking loop round the fountain) | stand | idle, think, talk | | walk |
| `cortile.fountain` | stand | think, idle | | walk |
| `presidenza.desk` | sit | write, read, think | preside | work |
| `presidenza.guest.1..2` | sit | talk, listen | | chat |
| `presidenza.window` | stand | think | | quiet |
| `portico.spot.1..8` (a patrol loop) | stand | idle, think | | walk |
| `corridoio.spot.1..4` | stand | idle | | walk |
| `dorm_<key>.bed` (8) | lie | sleep | key | night |
| `dorm_<key>.desk` (8) | sit | read, write, think | key | quiet |
| `dorm_<key>.spot` (8): wardrobe and mirror | stand | idle, think | key | |

That makes 130 anchors. Rules for the world builder:
- the anchor's x, z and its approach point lie inside its room;
- the approach point is reachable by `findPath` from every other approach point;
- no two approach points are closer than 0.55 m, except `seat`/`stand` pairs of the same
  agent;
- no anchor is closer than 0.3 m to an obstacle at its approach point.

**Occupancy** belongs to `world`: `reserve(id, key)`, `release(id, key)`,
`occupant(id)`. Only `life` reserves and releases. An anchor with an `owner` can be
reserved only by its owner, unless `life` passes `force` (the Preside's meeting seat is
never taken by anyone else).

### 3.6 Colour, materials, lights and budgets

- **The renderer:**
  - `outputEncoding = THREE.sRGBEncoding`;
  - `toneMapping = THREE.ACESFilmicToneMapping`;
  - `physicallyCorrectLights = false`, the r128 default.
- **Colours are sRGB hex values and must be linearised.** Always build material colours
  with `Campus.util.col(hex)`, which is `new THREE.Color(hex).convertSRGBToLinear()`.
  Every `CanvasTexture` and colour map gets `texture.encoding = THREE.sRGBEncoding`.
  Without this the scene looks washed out.
- **Materials:**
  - lit surfaces use `MeshStandardMaterial`;
  - screens, boards and emissive bulbs use `MeshBasicMaterial`, or a Standard material
    with `emissive` and `emissiveMap`;
  - share materials through a per-module cache keyed by colour and parameters, and never
    create a material per frame;
  - to merge many small coloured parts into one mesh, use `vertexColors: true` with one
    shared material (Appendix G.2).
- **Lights:** the light rig is fixed at boot, so no shader recompiles while running.
  - `render` owns: 1 `HemisphereLight`, 1 sun `DirectionalLight` (the only shadow
    caster) and 1 moon `DirectionalLight` (no shadows).
  - `world` owns a pool of exactly `Campus.render.lightBudget` `PointLight`s (2 on low,
    4 on medium, 6 on high), created in `build` and never added or removed afterwards. It
    moves them each frame to the lit lamps nearest the camera's focus. Lamps without a
    pooled light are emissive only.
- **Shadows:**
  - people and big furniture `castShadow`;
  - floors, ground and tables `receiveShadow`;
  - small props cast none;
  - whenever `render` toggles `renderer.shadowMap.enabled`, it sets
    `material.needsUpdate = true` on every material in the scene.
- **Per-frame budgets.** `render` sets `renderer.info.autoReset = false` and calls
  `renderer.info.reset()` at the start of `draw()`, so these totals include the shadow
  pass and every post-processing pass.

| Budget | low | medium | high |
| --- | --- | --- | --- |
| draw calls (whole frame) | ≤ 260 | ≤ 420 | ≤ 700 |
| triangles (whole frame) | ≤ 180 k | ≤ 400 k | ≤ 900 k |
| world draw calls, no shadow pass | ≤ 120 | ≤ 160 | ≤ 220 |
| people draw calls, all 8, no shadow pass | ≤ 100 | ≤ 160 | ≤ 200 |
| triangles per person | ≤ 3 k | ≤ 8 k | ≤ 12 k |
| canvas textures (all) | ≤ 14, each ≤ 512 × 256 | ≤ 14, each ≤ 1024 × 512 | same as medium |

### 3.7 DOM and CSS

- **Ownership of the stage:** the page provides the markup of §6.2.
  - `people` owns the **overlay** (`#campus-overlay`): name tags, bubbles and thought
    clouds.
  - `ui` owns the four slots `[data-slot="live"|"hud"|"side"|"player"]`.
  - `render` owns the canvas, and may add one full-stage element inside the stage
    (class `cp-r-*`, for example a fade for cuts).
  - `world` and `life` own no DOM.
- **Class prefixes:** `cp-r-` (render), `cp-p-` (people), `cp-u-` (ui). Each module
  injects at most one `<style id="cp-style-<module>">` into `document.head`, once, in
  `init`.
- **Tokens:** use only the page's tokens:
  - colours: `--paper`, `--sheet`, `--grid`, `--ink`, `--ink-2`, `--muted`, `--rule`,
    `--wash`, `--pen`, `--gain`, `--loss`, `--amber`, `--focus`, `--c-<key>`;
  - fonts: `--font-head`, `--font-read`, `--font-num`, `--font-hand`.

  Never declare new `:root` tokens. Dark mode then comes for free; check it anyway.
- **Stacking inside the stage:** the canvas is at z 0, `.cp-overlay` at z 1, `.cp-hud`
  at z 2. The overlay has `pointer-events: none`. The HUD has `pointer-events: none`,
  and `ui` sets `pointer-events: auto` on its own controls.
- **Layout:**
  - no horizontal page scroll at 390 px wide;
  - every control has a minimum touch target of 36 × 36 px;
  - `:focus-visible` outlines stay visible;
  - buttons carry `type="button"`, and toggles carry `aria-pressed`.
- **Text from the database:** set it only with `textContent`. Escape with `U.esc`
  wherever you build `innerHTML`.

### 3.8 Words, honesty and numbers

**Feed entries** are the single record of everything said:

```ts
type FeedEntry = {
  id: string;                 // unique, e.g. "f123"
  at: string;                 // "YYYY-MM-DD HH:MM:SS", UTC, sim time (Campus.clock.now())
  who: string;                // an agent key or "motore"
  to: string | null;          // the addressee, if any
  kind: "ufficiale" | "chiacchiera" | "pensiero" | "claude";
  label: string;              // short Italian label: "Il briefing", "Incontro in cortile", "pensa"
  text: string;               // plain text, ≤ 400 characters, already passed through U.plain
  room: string | null;
  source: string | null;      // where it comes from:
                              //   "verbale del 30/11", "in diretta", "dal quaderno",
                              //   "palestra del 29/11", "gara della notte del 26/11",
                              //   "dialogo chiesto da te"
  step: number | null;        // replay beat index, for jumping
  date: string | null;        // the meeting's day, for replay entries
};
```

`Campus.KINDS` holds the Italian chip labels: `ufficiale`, `chiacchiera`, `pensiero`
and `dialogo generato da Claude`.

**The number rule.** A number token in any `chiacchiera` or `pensiero` line, on any
surface, or in any card must be one of these:
- a numeric value in `Campus.data` (any leaf), rounded the way it is displayed;
- an array length in `Campus.data`;
- a value returned by `Campus.derive.*`;
- the day, month or year of a date string in the data, or the hour and minute of a time
  string in the data;
- a constant in Appendix E.3.

Probabilities show as percentages (0,65 → «65%»). Use the `U.fmt` family of formatters
(Italian separators, «−» for minus).

### 3.9 Time

- The school runs on **Rome's clock** (`Europe/Rome`). The engine writes **UTC** as
  `"YYYY-MM-DD HH:MM:SS"`. Use `U.rome(date)`, `U.romeDate(iso, minutes)`, `U.utc(s)` and
  `U.utcText(d)`.
- `Campus.clock.now()` is the **sim time**: the real time, or during a replay the
  meeting's time running forward at `rate`. Sky, schedule and feed timestamps use it.
- Live freshness (`U.liveNow`) and contest deadlines use `Campus.clock.real()`.
- `Campus.clock.setOverride(date, rate)` is called **only by `life`**, for replays, and
  by tests. It is cleared with `setOverride(null)`.

---

## 4. The kernel: `campus/core.js`

The kernel is finished and tested. Its full source is in Appendix H. Load it first. Nobody
edits it. If you need a change, describe it in your final report.

### 4.1 Constants

`Campus.KEYS`, `TRADERS`, `GRADED`, `NAMES`, `ARTICLE`, `COLORS`, `STATES`, `POSTURES`,
`KINDS`, `COINS` (the 36 coins), `FASE` (the Italian labels of the live phases),
`CAPITAL = 10000`, `FUND_START = 80000`, `SCHOOL_START = "2026-11-26"`,
`GRADUATION = "2027-02-21"`, `ROME = {lat: 41.9028, lon: 12.4964, tz: "Europe/Rome"}`.

### 4.2 The data store `Campus.data`

Only the page writes it, through `Campus.setData(key, value)`,
`Campus.setDataIn(map, id, value)` and `Campus.setDataMap(map, object)`. Modules read
it and never mutate it: snapshot bodies are frozen.
- **`undefined` means not arrived yet; `null` means the document does not exist.**
- The writers batch per microtask and then emit `data:change {keys, version}`.

| key | source (db path) | shape (the main fields; see the docs for the rest) |
| --- | --- | --- |
| `programma` | `classe/programma` | `{inizio, fine, giorni: [{data, giorno, giorno_settimana, tipo, tema, settimana, miti, protagonisti, operazioni}], settimane}`. `tipo` is accoglienza, riunione, consiglio, scrutinio or fine |
| `classe` | `classe/stato` | `{giorno, data, aggiornato, avviso, giorni: [{data, giorno, tipo, stato, titolo, voti: {key: {ragionamento, disciplina}}, capitali}]}` |
| `giudizio` | `motore/giudizio` | `{school, prices: {COIN: price}, prices_at, market: {day, panic, fragile, caldo_pct}, wallets: {trader: {cash, positions: [{id, symbol, side, units, entry, stop, target, risk_usd, risk_pct, opened}], closed, equity: [{date, value}], max_risk_pct, costs, funding}}}` |
| `regole` | `motore/regole` | `{giorno, inizio, portafogli: {trader: {curve: {date: value}, trades, open, ...}}}` |
| `live` | `live/ora` | `{data, giorno, fase, attore, testo, ora, log: [{ora, fase, attore, testo}]}` (PROCEDURA.md, «La diretta») |
| `sera` | `classe/sera` | `{data, ora, allarme, motivi: [], numeri: {btc_pct, monete_oltre_10pct, portafogli_pct, open_interest_pct, prezzi_della_mattina}}`, or `{error}` (SERA.md) |
| `registro` | `classe/registro` | `{giorni: [{data, momento, precedente, testo, impronta}]}` (the sealed register) |
| `semaforo` | `classe/semaforo` | `{giorno, portafogli: {"<trader>_<giudizio\|regole>": {colore, motivi, giorni, operazioni, rendimento_pct, giorni_verdi}}, giudizio_contro_regola: {trader: {verdetto, differenza, ...}}, benchmark, criteri}` |
| `ultimo` | `riunione/<the last held day>` | the last meeting's minutes (PROCEDURA.md §10): `{data, giorno, tipo, tema, titolo, stato, briefing, posizioni, scettico, eventi_notte, eventi_ordini, previsioni_verificate, regole, rischio, quadro, chiusura: {righe, voti, consapevolezza}, riflessione_preside, consiglio, scrutinio, fine, capitali, sera?}` |
| `ultimoData` | page | the date of `ultimo`, or null |
| `memoria` | `memoria/<key>` (8) | `memoria[key] = {chi_sono, regole: [{testo, dal, perche}], errori: [{testo, volte, ultima}], lezioni: [{data, testo}], previsioni: [{id, fatta, mercato, direzione, livello, scadenza, probabilita, perche, stato: aperta\|verificata, esito?, brier?}], calibrazione: {n, brier, sicurezza_media, successi, eccesso_di_sicurezza, fasce}, autovoti: [{data, ragionamento, disciplina, preside}], palestra?: {sessioni: [{data, brier, giuste_pct, r_totale, ...}], calibrazione}, aggiornato}` |
| `verbali` | `riunione/<date>` | `verbali[date]` = the minutes of every day the page watches (the selected day and `ultimo`) |
| `palestre` | `palestra/<sunday>` | `palestre[date] = {data, stato, agenti: {trader: {riassunto, casi, prima, lezione, nuova_regola, errore, riflessione, autovoto}}, scettico: {testo, domanda_per_il_consiglio}}` (PALESTRA.md) |
| `proposte` | collection `proposte` | `proposte[id] = {testo, tipo: studio\|previsioni\|gara\|altro, creata, stato: nuova\|accettata\|rifiutata\|fatta, scadenza_utc?, leva?, risposta?, data_risposta?}` (PROCEDURA.md §3 bis) |
| `gare` | collection `gara` | `gare[id] = {stato: {scadenza_utc, leva, wallets: {trader: {cash, positions, closed}}}, interventi, guardiano, eventi, situazione: {classifica: {trader: {capitale, risultato, aperta}}, finita, vincitore, premio}, chiusura, aperta_alle, finita, eventi_fine?, situazione_finale?, commento?}` (GARA.md, gara.py). **The key order of `classifica` means nothing** (the db stores keys alphabetically): rank by `risultato`, highest first, with ties in `Campus.KEYS` order |
| `selected` | page | the day picked in the register, else the last held day |
| `picked` | page | true once the owner has picked a day |
| `unavailable` | page | true when the page has no db (opened outside claude.ai) |
| `got` | kernel | `got[key] = true` once a key has received any value |
| `version` | kernel | increases on every batch |

### 4.3 The derived numbers `Campus.derive`

These are the only implementations of the shared numbers, so the follow card, the season
bar and the agents' lines agree to the cent.

| function | returns |
| --- | --- |
| `prices()` | `{COIN: price}` from `giudizio.prices`, or `{}` |
| `wallet(key)` | for a trader: `{judg, rules, gap, pnlPct, positions, at}`, else `null`. `judg` is cash plus open positions marked at `prices()`; `rules` is the last point of the rule curve; `pnlPct` is judg against 10.000 |
| `fund()` | `{capitale, iniziale: 80000, pct, quota: capitale/8, source: "portafogli"\|"rischio", at}`, or `null`. The 8 wallets as the page's «fondo della scuola» computes them, or else `ultimo.rischio.fondo` |
| `today()` | today's entry in `programma.giorni` (Rome date), or `null` |
| `graduation()` | `{today, days: days to 21/2/2027 (≥ 0), giorno, totale, tesi: ultimo.fine.tesi\|null}` |
| `held()` | the meetings held, `classe.giorni`, sorted oldest first |
| `votes(key)` | `{data, preside: {ragionamento, disciplina}, auto: {ragionamento, disciplina, data}}`, or `null` |
| `lesson(key)` | the last `{data, testo}` of `memoria[key].lezioni`, or `null` |
| `openPrediction(key)` | the last prediction with `stato: "aperta"`, or `null` |
| `calibration(key)` | `memoria[key].calibrazione` when `n > 0`, or `null` |
| `contests()` | `[{id, doc, open, scadenza: Date\|null, leva, situazione}]`, newest first. `open` means not finished and before the deadline |
| `latestGym()` | `{date, doc}` of the latest `palestre` entry, or `null` |
| `rulesPoints(r)`, `judgPoints(w)`, `judgEquity(w, prices)` | the page's own curve helpers |

### 4.4 The utilities `Campus.util`

- **Values:** `isNum`, `toNum`, `obj`, `arr`, `esc`, `clamp`, `lerp`, `smooth(e0, e1, x)`,
  `damp(x, target, lambda, dt)`, `wrapAngle`.
- **Randomness:**
  - `hash(str)`;
  - `rng(seed)`, a deterministic generator in [0, 1). Seed it with strings like
    `"falco|2026-11-26"`;
  - `pick(rand, list)`;
  - `weighted(rand, [[item, weight], ...])`.
- **Italian numbers:** `fmt(v, decimals = 2, sign = false)`, `small`, `usd`, `pct(v,
  d = 2, sign = true)`, `price`, `level`, `prob`. Missing values give «—». Never put «—»
  inside a spoken sentence: check `U.isNum` first.
- **Text:**
  - `cap`, `lowerFirst`, `listIt` («a, b e c»);
  - `plain(text, max)`: Markdown to one line, cut at a sentence end when possible;
  - `sayMs(text)`: how long a line stays up at speed 1, `min(11, 2.4 + len/26)` seconds,
    in ms;
  - `human(s)`: the engine's wallet keys and English decimals made readable;
  - `shortReason`, `shortEvent(e)`, `orderText(o)`, `predText(p)`, `whenTxt(s)`: today's
    page helpers, unchanged.
- **Time:**
  - `utc(s) → Date|null`;
  - `utcText(d)`;
  - `isoDay`;
  - `rome(d = clock.now()) → {date, minutes, seconds, weekday (0 = Sunday), hh, mm}`;
  - `romeDate(iso, minutes) → Date`;
  - `romeClock`, `romeTime`, `longDay`, `dm`, `dmy`, `addDays`, `daysBetween`;
  - `liveNow(L, nowMs)`: the live doc only when fresh, that is written in the last 12
    minutes and not `fine`;
  - `sun(d) → {altDeg, azDeg}` for Rome, from the NOAA formulas;
  - `nightOf(altDeg)`: 0 above +4°, 1 below −8°, smooth in between.
- **Colour:**
  - `cssColor(key)`: the agent's colour from the page tokens, for 2D canvases;
  - `col(hex)`: a linearised `THREE.Color` (§3.6).

Reference values, to check that `sun` works (26/11/2026, Rome):

| Rome time | altitude | azimuth | night |
| --- | --- | --- | --- |
| 06:47 | −5,1° | 113,7° | 0,85 |
| 12:30 | 26,7° | 188,5° | 0 |
| 16:45 | −1,4° | 242,6° | 0,42 |
| 17:05 | −4,7° | 245,8° | 0,82 |
| 23:30 | −68,4° | 342,4° | 1 |

### 4.5 The event bus `Campus.bus`

`bus.on(name, fn) → off()`, `bus.once(name, fn)`, `bus.off(name, fn)`,
`bus.emit(name, payload)`.
- Dispatch is synchronous. A throwing listener is caught and logged.
- `on("*", fn)` receives every event as `fn(payload, name)`, for debugging.
- **The bus carries notifications; commands are direct method calls** (§5).

| Event | Emitter | Payload | When |
| --- | --- | --- | --- |
| `data:change` | core | `{keys: string[], version}` | after a batch of `setData*` |
| `clock:override` | core | `{active, at: Date\|null, rate}` | `clock.setOverride` |
| `campus:ready` | core | `{has3d, quality}` | end of `boot` |
| `campus:capabilities` | core | `{db: bool, sample: bool}` | end of `boot`, and on `attach` |
| `campus:degraded` | core, render | `{module, reason: "no-webgl"\|"error"\|"no-3d"\|"context-lost", message?}` | 3D unavailable or lost, or a module disabled after 3 errors in a row |
| `campus:resize` | core | `{w, h}` | the stage changed size |
| `campus:visibility` | core | `{visible, hiddenFor (s)}` | the stage was scrolled out of or into view, or the tab hidden or shown |
| `render:quality` | render | `{level, reason: "start"\|"fps-low"\|"fps-high"\|"user", fps}` | quality changed |
| `render:camera-mode` | render | `{mode: "regia"\|"libera"\|"segui", key: string\|null}` | any change, including automatic fallbacks |
| `render:sky` | render | `{romeMinutes, sunAltDeg, night, phase: "notte"\|"alba"\|"giorno"\|"tramonto"}` | phase change, and every 60 s |
| `render:pick` | render | `{key: string\|null, room: string\|null, point: {x,y,z}\|null}` | a tap or click without dragging |
| `render:post` | render | `{loaded: bool, error?: string}` | after `loadPost` |
| `render:restored` | render | `{}` | WebGL context restored |
| `world:ready` | world | `{rooms, anchors}` | end of `build` |
| `people:arrived` | people | `{key, id, to}` | a command completed: arrived, turned, posture taken |
| `people:blocked` | people | `{key, id, to}` | no path, or stuck for 6 s: the person was moved on |
| `people:said` | people | `{key, id}` | a bubble ended (by time or `hush`) |
| `life:mode` | life | `{mode, detail}` | the mode changed (§5.4.2) |
| `life:activity` | life | `{key, activity, label, room, since}` | an agent started an activity |
| `life:mood` | life | `{key, mood, label, why}` | an agent's mood changed |
| `life:feed` | life | `{entry: FeedEntry}` | a new feed entry |
| `life:focus` | life | `FocusRequest` (§5.1) | something worth looking at |
| `life:encounter` | life | `{keys: [a, b], topic, state: "start"\|"end", room}` | an encounter |
| `life:thought` | life | `{key, text, source}` | a thought cloud |
| `life:replay` | life | `{state: "loading"\|"start"\|"step"\|"end"\|"error", date, step, total}` | replay progress |
| `life:talk` | life | `{state: "thinking"\|"walking"\|"playing"\|"done"\|"error", keys, code?, lines?}` | «Fateli parlare» progress |
| `ui:follow` | ui | `{key: string\|null}` | the owner started or stopped following an agent |
| `ui:proposal` | ui | `{id, state: "sent"\|"error", code?}` | a proposal write |

### 4.6 The clock `Campus.clock`

`now()` returns the sim time, `real()` the real time, and `overridden` is a boolean.
`setOverride(date|null, rate = 1)` sets or clears the override. While it is set,
`now()` = `date + (performance.now() − t0) · rate`.

### 4.7 Boot, capabilities, loop and isolation

```js
const ctx = Campus.boot({ canvas, overlay, uiRoot, db, sample, reduceMotion });
// later, when the capabilities resolve (they may take up to 10 s):
Campus.attach({ db, sample });
```

`ctx`, also at `Campus.ctx`:

```ts
{
  THREE, canvas, overlay, uiRoot, stage,  // stage = canvas.parentElement (#campus-stage)
  db, sample,                             // the capability or null; filled later by attach
  reduceMotion,                           // from prefers-reduced-motion at boot
  has3d,                                  // true once render, world and people all initialised
  scene, camera, renderer,                // set by render.init
  size: {w, h},                           // the stage's CSS size, kept fresh by the kernel
}
```

**The boot sequence** (in `core.js`):
1. Observe the stage size (`campus:resize`) and visibility (`campus:visibility`).
2. `ui.init(ctx)`. The HUD and panels exist even without 3D.
3. If THREE is present and WebGL works, call `render.init(ctx)`, which must set
   `ctx.renderer/scene/camera`, then `world.build(ctx)`, then `people.init(ctx)`. If any
   throws, `has3d` stays false, `render.dispose()` is called, and
   `campus:degraded {reason: "no-webgl"|"error"}` is emitted.
4. `life.init(ctx)`. It works with or without 3D.
5. A 1 Hz timer keeps calling `life.update(1, t)` while the stage is hidden.
6. Emit `campus:ready` and `campus:capabilities`, then start the frame loop.

**The frame loop**, each animation frame while the stage is visible, with dt capped at
0.1 s:

```
life.update(dt, t)
if has3d: people.update(dt, t) → world.update(dt, t) → render.update(dt, t) → render.draw()
          → people.updateOverlay(ctx.camera, ctx.size.w, ctx.size.h)
ui.update(dt, t)
```

- **Isolation:** every call is wrapped. A module that throws 3 frames in a row is
  disabled and `campus:degraded {module, reason: "error"}` is emitted.
- **Losing 3D:** if `render`, `world` or `people` is disabled, `has3d` becomes false,
  `render.dispose()` runs and `campus:degraded {reason: "no-3d"}` follows. `life` and
  `ui` must then switch to their no-3D behaviour.
- **Stats:** `Campus.stats()` returns
  `{has3d, visible, quality, fps, calls, triangles, mode, disabled}`, for tests.
- **Halt:** `Campus.halt()` stops the loop, for tests.

---

## 5. The modules

Each section gives:
- the module's responsibilities;
- its exact public API (anything not listed is private);
- its behaviours;
- how it degrades;
- its budgets;
- its definition of done.

All tests run with the shared kit (§8). Write your tests in
`/tmp/claude-0/-home-user-Argo/45ad43e3-4ef7-5c28-bf83-cf04a165ab32/scratchpad/cs/campus-test/<module>/run.js`;
it writes `results.json` and `shots/*.png` there.

### 5.1 `campus/render.js` · `Campus.render`

**It owns:** the WebGLRenderer, the Scene, the camera, sky, sun, moon, hemisphere
light, fog, stars, exposure, quality presets with adaptive fps, optional
post-processing, the camera rig (regia, libera, segui), picking and context loss.

```ts
Campus.render = {
  init(ctx): void;                  // create renderer/scene/camera; set ctx.renderer/scene/camera; throw on failure
  update(dt, t): void;              // sky from Campus.clock.now(), camera rig, adaptive quality
  draw(): void;                     // info.reset(); render (or composer.render when post is on)
  resize(w, h): void;               // also on campus:resize
  dispose(): void;                  // release GL resources; safe to call twice
  // state, read-only for others
  scene, camera, renderer,
  quality: "low" | "medium" | "high",
  qualityMode: "auto" | "low" | "medium" | "high",
  lightBudget: 2 | 4 | 6,           // fixed at init from the initial quality
  fps: number,                      // smoothed over the last 2 s
  sky: { romeMinutes, sunAltDeg, sunAzDeg, night, phase },
  cameraMode: "regia" | "libera" | "segui",
  followKey: string | null,
  focusRoom: string | null,         // the room the current shot frames, or null
  postActive: boolean,
  // commands
  setQuality(mode: "auto" | "low" | "medium" | "high"): void,
  setCameraMode(mode, opts?: { key?: string }): void,
  focus(req: FocusRequest): void,   // input for the director (regia only)
  shot(name: string, opts?: { instant?: boolean }): void,  // "campus" | "room:<id>" | "agent:<key>"
  pick(clientX, clientY): { key, room, point },
  loadPost(): Promise<boolean>,
  // test hooks
  _simulateFps(fps: number, seconds: number): void,  // feed fake frame times to the adaptive logic
};
type FocusRequest = {
  keys?: string[];  // agents to frame
  room?: string;    // a room to frame
  point?: {x, z};
  priority?: 0 | 1 | 2 | 3;  // 3 = live/replay speaker or Claude dialog; 2 = encounter, emergency; 1 = arrival or thought; 0 = idle
  holdS?: number;   // how long this deserves the camera
  shot?: "campus" | "wide" | "medium" | "close";
  reason?: string;
};
```

**The renderer.**
- `new THREE.WebGLRenderer({canvas, antialias: initialQuality !== "low", alpha: false, powerPreference: "high-performance"})`.
- Set the encoding and tone mapping of §3.6.
- `renderer.shadowMap.type = THREE.PCFSoftShadowMap`.
- Clear colour: the horizon colour.
- Camera: `PerspectiveCamera(42°, aspect, 0.1, 400)`.
- Listen to `webglcontextlost` (call `preventDefault`, pause drawing, emit
  `campus:degraded {module: "render", reason: "context-lost"}`) and to
  `webglcontextrestored` (resume, emit `render:restored`).

**The sky and Rome's day and night.**
- Every frame, read `U.sun(Campus.clock.now())`. `night = U.nightOf(alt)`.
- **phase:**
  - `giorno` when alt ≥ 6°;
  - `notte` when alt ≤ −8°;
  - otherwise `alba` before solar noon (azimuth < 180°) or `tramonto` after.
- **Sky:** a large sphere with a small gradient `ShaderMaterial` (zenith, horizon and a
  sun glow, with `depthWrite: false`). It goes:
  - by day, from zenith `#5d9bd5` to horizon `#dbe8f3`;
  - in the golden hour, to a horizon `#f2a65a` with a pink band;
  - at night, from `#060a18` to `#1a2440`, with stars (a `Points` cloud of 150, 300 or
    600 stars by quality, appearing when night > 0.5).

  `Sky.js` from the examples may be used on high quality, but it is not required.
- **Sun:** a `DirectionalLight`, colour `#fff1dc` by day and `#ffb36b` when alt < 10°,
  intensity `2.2·(1−night)`.
  - Its position is `focus + dir·60`.
  - Its shadow camera is an orthographic box fitted around the current focus: ±22 m in
    campus shots, ±12 m in close shots, re-centred in 2 m steps to avoid shimmering.
  - The shadow map is 1024 on medium and 2048 on high, with bias −0.0005 and normalBias
    0.02.
- **Moon:** a `DirectionalLight`, `#9fb4ff`, intensity `0.25·night`, from the west, no
  shadows.
- **Hemisphere:** sky `#dfeaf5` / ground `#5e5240`, intensity `lerp(0.85, 0.16, night)`.
- **Exposure:** `toneMappingExposure = lerp(1.05, 0.82, night)`.
- **Fog:** `THREE.Fog(horizonColour, 70, 190)`.
- **When the sim clock jumps** (a replay starts or ends): if the sun moves more than 10°
  between two frames, blend the sky over 1.2 s (half-life), so it never pops.
- **`render:sky`:** emit it on every phase change and once a minute.

**Quality presets:**

| | low | medium | high |
| --- | --- | --- | --- |
| pixel ratio | min(1, dpr), dropping to 0.75 after 4 s under 22 fps | min(1.5, dpr) | min(2, dpr) |
| shadows | off | on, 1024 | on, 2048 |
| post-processing | off | off | on, if `loadPost` succeeded |
| stars | 150 | 300 | 600 |
| people detail (`people.setDetail`) | low | medium | high |
| canvas surfaces | half resolution | full | full |

- **The initial quality:**
  - `low` if `matchMedia("(pointer: coarse)").matches` or `min(screen.width, screen.height) < 600`;
  - otherwise `medium`.

  `high` is reached only by stepping up. `lightBudget` is set once, at init, from the
  initial quality.
- **The adaptive logic** (when `qualityMode === "auto"`):
  - Measure the fps from the frame dt over the last 2 s. Skip the first 3 s after boot or
    after a change, and every frame while hidden.
  - **Step down** one level when fps < 27 for 3 s in a row.
  - **Step up** one level when fps > 52 for 10 s in a row. Allow at most 2 step-ups per
    session, and none after a step-down that followed a step-up (no flapping).
  - Emit `render:quality`. Call `people.setDetail(level)` and set
    `world.surfaceScale = 0.5 | 1`.
  - Changing quality never adds or removes lights.
- **`setQuality(level)`** pins the level, with `reason: "user"`; `setQuality("auto")`
  resumes the adaptive logic.

**Post-processing** (high only):
- `loadPost()` loads the files of §2.3 once and builds:
  - `EffectComposer`;
  - `RenderPass`;
  - optionally `SSAOPass`: only on desktop (`pointer: fine`), and only if the fps stays
    over 45 afterwards, else remove it;
  - `UnrealBloomPass(strength 0.55, radius 0.4, threshold 0.82)`, which makes the
    emissive lamps, screens and windows glow;
  - `ShaderPass(ACESFilmicToneMappingShader)` with its exposure uniform tied to the
    exposure above;
  - `ShaderPass(GammaCorrectionShader)`;
  - `ShaderPass(FXAAShader)`, with resolution 1/(w·pr), 1/(h·pr);
  - a gentle `VignetteShader` (offset 1.0, darkness 1.05).
- While post is on, set `renderer.toneMapping = NoToneMapping`: the ACES pass does it
  instead, because r128 does not tone-map into render targets.
- **Acceptance:** with post on, the mean luminance of a frame is within ±8% of the same
  frame without post.
- If the fps falls under 27 with post on, turn post off before stepping down a quality
  level.
- `postActive` reflects the state.

**The camera rig.** All movement uses critically damped springs on position and target
(`U.damp`, half-life 0.45 s for reframing inside a room), unless it cuts. The camera
never enters a wall: room and campus shots stay at y ≥ 3.6, and close shots inside a room
(y 1.4–2.4) are allowed only when the room's cutaway is active
(`world.setCutawayFocus(room)`, which render calls whenever it frames a room).

- **`regia`** (the default): an automatic director.
  - **Inputs:** every `life:focus` event, which render subscribes to in `init`, plus its
    own idle cycle.
  - **Holding a shot:** a shot is kept for at least 4 s (8 s with reduced motion). A new
    request preempts it when its priority is higher than the current one, or when the
    hold has expired.
  - **Changing subject:** after 14 s on the same subject, vary the framing (wide → medium
    → close → wide). After 60 s with no request, take an establishing `campus` shot
    (6 s), then go back to the busiest room (the most agents in non-sleeping states).
  - **Framing:**
    - fit the bounding sphere of the subject, that is the agents' heads and feet, or the
      room's rect;
    - choose among pleasing angles: south-east 35°, south 25°, south-west 35°, or over
      the listener's shoulder for a two-shot;
    - for a close shot, head and shoulders (0.9 m) fill 55% of the frame height;
    - for a medium shot, everyone full body fills 70%;
    - for a wide shot, the room fills 85%;
    - portrait aspects (< 1) push the distance back ×1.35.
  - **Cut or glide:** cut when the new target is more than 12 m away or in another room,
    or with reduced motion. Otherwise glide.
  - **At night,** the establishing shots favour the lit windows.
- **`libera`:** OrbitControls, loaded on demand from jsdelivr. If they fail to load, use
  a minimal built-in orbit (drag to rotate, wheel or pinch to zoom).
  - Target clamped to the campus bounds; distance 2.5 to 90; `maxPolarAngle` 1.45;
    damping on, except with reduced motion.
  - While in `libera`, the canvas has `touch-action: none`. In the other modes it has
    `pan-y`, so the page still scrolls on phones.
  - A double click or double tap on a person goes to `segui`.
- **`segui`:** follows `followKey`.
  - The camera sits behind and above the agent's yaw: distance 5.5 m (6.5 on portrait),
    2.6 m above the feet, looking at the head. It lags by a spring of half-life 0.35 s.
  - When the agent sits, the height is 2.0 m. When the agent lies in bed, the view is a
    3/4 view from above.
  - If the key is invalid or 3D is gone, fall back to `regia` and emit
    `render:camera-mode`.
- **`setCameraMode`** emits `render:camera-mode`. `ui` reflects it.

**Picking.**
- `pointerdown` and `pointerup` on the canvas, with under 6 px of movement and under
  400 ms, count as a pick.
- Raycast first against `people.pickables()` (each object carries `userData.agentKey`),
  then against `world.pickables()` (the floors, with `userData.room`).
- Emit `render:pick`. `pick()` does the same synchronously.

**Reduced motion:** no idle sway, cuts instead of glides, no damping inertia in
`libera`, holds of 8 s or more, and no animated bloom.

**Degradation:**
- if `init` cannot create a context, it throws; the kernel handles it;
- if `world` or `people` are missing at draw time, render the sky alone;
- if OrbitControls are missing, use the built-in orbit;
- if post-processing is missing, stay on high quality without post.

**Definition of done for render.js**, all against the stubs:
1. It boots without console errors at 1280×800 (light) and 390×844 (mobile, dark),
   giving `render-desktop.png` and `render-phone.png`.
2. **Day and night:** override the clock to 26/11/2026 12:30, 16:45, 17:05 and 23:30
   (Rome). `sky.phase` must be `giorno`, `tramonto`, `tramonto` and `notte`, and
   `sunAltDeg` must be within ±0,5° of the table in §4.4. This gives `render-day.png`,
   `render-dusk.png` and `render-night.png`.
3. **Camera modes:**
   - `regia` reacts to `bus.emit("life:focus", {room: "mensa", priority: 2})`: within 3 s
     the target is inside the mensa rect;
   - `libera` loads OrbitControls through the routed jsdelivr, and the canvas gets
     `touch-action: none`;
   - `segui` keeps the followed stub agent within 30% of the frame centre while it walks;
   - one shot of each mode.
4. **Quality:** `setQuality("high")` makes `loadPost()` resolve true, and post renders
   (`render-high.png`). The luminance check passes against medium.
   `_simulateFps(18, 4)` in auto mode steps down and emits
   `render:quality {reason: "fps-low"}`. With stubs, `Campus.stats()` reports calls and
   triangles within the budgets of §3.6 at each level.
5. **Reduced motion:** the camera cuts. Sampling the camera position every 100 ms after a
   focus request shows at most one jump and no intermediate positions.
6. **Picking:** clicking a stub person emits `render:pick` with its key.
7. **Context loss:** `WEBGL_lose_context.loseContext()` gives `campus:degraded
   {reason: "context-lost"}`; `restoreContext()` gives `render:restored`, and drawing
   resumes.
8. The file is ≤ 70 KB.

### 5.2 `campus/world.js` · `Campus.world`

**It owns:** the static layout (rooms, doors, anchors, the waypoint graph, A*,
occupancy, `roomAt`, the minimap data), the building geometry, furniture and props, the
exterior, lamps and the light pool, the dynamic canvas surfaces, and the cutaway.

```ts
Campus.world = {
  // static, available at load time, without THREE
  rooms: Room[],                   // §3.2: {id, name, kind, rects, owner?}
  doors: Door[],                   // §3.2: {id, a, b, x, z, w, axis}
  bounds: [-24, -20, 24, 20],
  anchors: { [id]: Anchor },       // §3.5, frozen objects
  anchor(id): Anchor | null,
  anchorsIn(room, filter?: { kind?, tag?, posture?, free?: boolean }): Anchor[],
  reserve(id, key, force?: boolean): boolean,   // false if held by another, or owned by another (unless force)
  release(id, key): void,
  occupant(id): string | null,
  roomAt(x, z): string | null,
  findPath(from: {x, z}, to: {x, z}): {x, z}[] | null,  // excludes `from`, ends exactly at `to`
  clear(a: {x, z}, b: {x, z}): boolean,         // the straight segment misses every obstacle (inflated by 0.3 m)
  minimap(): { bounds, rooms: [{id, name, kind, rects}], doors: [{x, z, w, axis}] },
  // 3D
  ready: boolean,
  build(ctx): void,                // add everything to ctx.scene; emit world:ready
  update(dt, t): void,             // surfaces, lamps and the light pool, cutaway
  pickables(): THREE.Object3D[],   // floors with userData.room
  setCutawayFocus(room: string | null): void,
  surfaceScale: 0.5 | 1,           // set by render with the quality
  surfaces: {
    board(lines: string[], reveal?: number): void,      // riunione blackboard; reveal 0..1 writes progressively
    motore(events: object[] | null, title?: string): void,  // riunione engine terminal
    palestra(lines: string[] | null): void,             // palestra whiteboard (null = data-driven default)
    refresh(name?: string): void,                       // redraw data-driven surfaces now
  },
  // test hooks
  _obstacles(): {x0, z0, x1, z1, id}[],   // furniture footprints, for path tests
  _graph(): { nodes: {id, x, z, room}[], edges: [string, string][] },
};
```

**The waypoint graph and A*.**
- **Nodes:**
  - each door has a node on each side, 0.6 m from the doorway, plus one in the doorway;
  - each anchor's approach point is a node;
  - each room has aisle nodes on a grid of about 2.5 m, kept away from furniture.
- **Edges** connect nodes in the same room when `clear()` holds, and a door's nodes
  across it.
- **`findPath`:**
  1. Connect `from` and `to` to their nearest visible nodes in their rooms.
  2. Run A* with a Euclidean heuristic.
  3. Pull the string: drop an intermediate node when the segment from the previous kept
     point to the next is `clear`.

  It returns `null` only when one endpoint is outside every room.
- **Performance:** under 2 ms per query on desktop. Cache the room-to-room routes.

**The building and furniture.** The style is warm Italian school architecture:
- plaster walls (light cream outside, varied pastels inside);
- terracotta skirting; terrazzo floors in the halls; parquet in the library and the
  dorms; tiles in the mensa; gravel and lawn in the garden;
- big windows with frames (the glass is slightly emissive at night);
- the portico's columns and arches.

Model the furniture of §3.2 with real proportions: desk 0.75 m, chair seat 0.46 m, bed
0.5 m, doors 2.1 m. Keep the details that sell the scene:
- the trading monitors' bezels, keyboards and mugs;
- books on the shelves (instanced);
- the coffee machine;
- plants and rugs;
- the fountain's water (a slowly animated normal or a shimmer, skipped with reduced
  motion);
- trees: trunks with a few low-poly icosahedron crowns, swaying gently.

Use `InstancedMesh` for every repeated item: chairs, books, columns, trees, benches,
monitors. Use vertex-coloured merged meshes per room for the static clutter. Respect the
draw-call budget (§3.6).

**The cutaway** (the dollhouse view), applied in `update`:
- each wall segment knows its outward normal;
- if the camera sees a wall's outward face (dot of the normal with the direction to the
  camera > 0.2), lower the wall to 0.9 m;
- partition walls lying between the camera and the focus room's centre (a 2D segment
  intersection) are lowered too;
- lowering uses the wall's y-scale over 0.4 s, instantly with reduced motion;
- the lowered top edge gets a darker cap, so the cut reads clearly.

`setCutawayFocus(room)` is a hint from render. Without a focus, use the room nearest the
camera's target.

**Lamps and the light pool.**
- Each room has lamps:
  - pendants are impossible without ceilings, so use floor lamps, desk lamps, wall
    sconces and the monitors' glow;
  - the garden and the outside have street lamps and lanterns.
- A lamp is lit when `Campus.render.sky.night > 0.35`, or when the room is interior and
  the agents are present while the sun is under 15°. Lit lamps are emissive.
- The pooled `PointLight`s (exactly `render.lightBudget`, distance 9, decay 2, warm
  `#ffd59a`) move to the lit lamps nearest `render.focusRoom`, or else nearest the
  camera target.
- The windows' glass is emissive at night (warm inside, cool moonlight outside).

**The canvas surfaces** (`CanvasTexture`, `encoding = sRGBEncoding`). Draw them with the
page fonts once `document.fonts.ready` resolves, and redraw when the data changes
(`data:change` with the relevant keys), at most once every 2 s each. All numbers go
through `U` formatters, from the data. Every surface has a calm empty state; the
fallback texts are Italian and fixed.

| Surface | Where | Content | Data | Empty state |
| --- | --- | --- | --- | --- |
| `board` (1024×320) | riunione, the blackboard | chalk lines; `reveal` writes progressively, a port of `drawBoard` | from life | «Scuola Cripto» |
| `motore` (512×320) | riunione, the engine terminal | «MOTORE · TITLE» and up to 5 events in green, blue or red, a port of `drawScreen`. When `events` is null: the first 9 prices | life; `giudizio.prices` | «in attesa dei prezzi» |
| ticker (2048×64, scrolling with `offset.x`, paused with reduced motion) | above the riunione board, and along the trading north wall | «BTC 59.904,2 · ETH …» in `Campus.COINS` order | `giudizio.prices` | «Prezzi di BingX in arrivo» |
| price wall (1024×512) | trading, north wall | the 36 coins: symbol, price, 1-day change coloured; the title «Prezzi BingX · <romeTime(prices_at)>» | `giudizio.prices`, `ultimo.quadro.monete[c].var_pct["1g"]` | «In attesa dei prezzi» |
| desk monitor A, per agent (512×320) | trading desks | traders: «A giudizio X USDT», «La regola Y», «Differenza ±Z», open positions as «SOL short»; guardiano: the fund, its net beta exposure, the number of alarms; cronista: the first news item (`plain(…, 120)`) with source and time | `D.wallet`, `ultimo.rischio`, `ultimo.briefing.notizie` | «Nessun dato oggi» |
| desk monitor B, traders (512×320) | trading desks | the twin curves since the start: rule (dashed) against judgment (solid, agent colour) | `regole.portafogli[k].curve`, `giudizio.wallets[k].equity` | a flat grey line and «I portafogli partono il 26/11» |
| contest scoreboard (1024×512) | trading, east wall | the newest `D.contests()`: title, deadline, rows of agent, coin and side, result; the winner | `gare` | «Nessuna gara aperta» |
| common-goal board (1024×460) | the outer north wall, facing the garden | «Obiettivo comune»: the fund against 80.000 as a bar, «Mancano N giorni alla laurea (21/2/2027)», «La tesi: …» or «La tesi si sceglie insieme l'ultimo giorno» | `D.fund()`, `D.graduation()` | «Il fondo parte il 26/11 da 80.000 USDT» |
| `palestra` (1024×512) | palestra whiteboard | lines from life; when null: the latest gym's Brier and total R per trader | `D.latestGym()` or `memoria[k].palestra` | «La prossima palestra è domenica alle 11:13» |
| name plates (256×64) | each dorm door | the agent's name on their colour | static | — |

The `motore` terminal and the `board` are driven by `life` during meetings. When idle,
they show their defaults.

**The minimap data:** `minimap()` returns the static rooms and doors. `ui` draws them.
World does not draw the minimap.

**Degradation:**
- the static part works without THREE;
- `build` throws only on a real failure (the kernel turns 3D off);
- a surface that throws is skipped and logged once.

**Definition of done for world.js** (with the stubs for render, people, life and ui):
1. **Static checks** (a Node or browser script):
   - every id in `Campus.__contract.ANCHORS_REQUIRED` exists, with the same room,
     posture, owner and tags;
   - anchors and approach points lie inside their rooms;
   - the spacing rules of §3.5 hold;
   - rooms and doors match §3.2 exactly.
2. **Paths:** for 60 random pairs of approach points (seeded), `findPath` returns a path;
   every segment is `clear` against `_obstacles()`; the length is at most 3× the straight
   distance plus 6 m. 200 queries take under 400 ms in total on desktop.
3. **Shots** (render stub camera through `Campus.render.shot`):
   - `world-overview-day.png` (12:30) and `world-overview-night.png` (23:30, lamps on);
   - one 1280×800 close-up per room: `world-riunione.png`, `world-trading.png`,
     `world-biblioteca.png`, `world-palestra.png`, `world-mensa.png`,
     `world-cortile.png`, `world-presidenza.png`, `world-dorm-falco.png`;
   - `world-phone.png` at 390×844.
4. **Surfaces with the `full` fixture:** the price wall shows `BTC` with the fixture's
   price formatted «59.904,2»-style; the contest scoreboard shows the four agents of
   `gara/notte-2026-11-26`; the goal board shows «81.470,59». With the `empty` fixture,
   every surface shows its empty state and no «undefined», «NaN» or «null» (check with a
   pixel-free test hook or by inspecting the canvas text calls you log).
5. **Cutaway:** from the default south-east camera, the south walls of the focus room
   are low and the north walls full; `world-cutaway.png`.
6. **Budgets:** `Campus.stats()` with the stubs, at low, medium and high (forced through
   `render.setQuality` on the stub), is within §3.6; the world-only calls are measured
   with the stub people hidden.
7. The file is ≤ 170 KB.

### 5.3 `campus/people.js` · `Campus.people`

**It owns:** the 8 humanoids (geometry, materials, props), the skeleton of joints and
the procedural animation, faces (blinking, the mouth, the brows by mood), look-at, path
following with steering and separation, posture transitions, levels of detail, the hit
proxies for picking, and the DOM overlay (name tags, speech bubbles, thought clouds).

```ts
Campus.people = {
  ready: boolean,
  init(ctx): void,                    // build the 8 people at the detail of Campus.render.quality, place each at its dorm_<key>.spot, create the overlay
  update(dt, t): void,                // locomotion, animation, face
  updateOverlay(camera, w, h): void,  // project and place tags, bubbles and clouds (after draw)
  setDetail(level: "low" | "medium" | "high"): void,
  // queries
  positionOf(key): {x, y, z} | null,  // feet, world space
  headOf(key): {x, y, z} | null,      // top of the head
  yawOf(key): number | null,
  stateOf(key): string | null,        // one of Campus.STATES
  postureOf(key): "stand" | "sit" | "lie" | null,
  isBusy(key): boolean,               // walking or in a posture transition
  pickables(): THREE.Object3D[],      // one invisible proxy per person (capsule), userData.agentKey
  // commands (life is the only caller, apart from tests)
  command(key, cmd: Command): number, // the command id; replaces the agent's previous command
  place(key, where: string | {x, z, face?}, state?: string): void,  // instant, no walk
  stop(key): void,                    // stop where you are, idle
  setState(key, state: string): void, // change activity in place (§3.4 mapping)
  lookAt(key, target: string | {x, y, z} | null): void,  // an agent key, an anchor id, a point, or null
  setMood(key, mood: string): void,   // Appendix B moods
  setTag(key, tag: { act?: string, grades?: {ragionamento?, disciplina?} | null }): void,
  say(key: string, line: Line): number,  // key may be "motore"; returns the bubble id
  hush(key): void,                    // end the bubble now (emits people:said)
  think(key, thought: { text: string, source?: string, ms?: number }): number,
  unthink(key): void,
  setHighlight(key: string | null): void,  // a soft ring at the feet of the followed agent
};
type Command = {
  to?: string | {x, z, face?};   // an anchor id or a point; omitted = stay
  state?: string;                // the state on arrival (default: the anchor's states[0], or idle)
  lookAt?: string | {x, y, z} | null;
  speed?: number;                // multiplier of the agent's walk speed (default 1)
  instant?: boolean;             // teleport (also forced by ctx.reduceMotion)
};
type Line = {
  text: string;
  label?: string;                // shown in the bubble header: "Falco · Intervento"
  kind?: "ufficiale" | "chiacchiera" | "pensiero" | "claude";
  to?: string;                   // the addressee: the speaker looks at them
  ms?: number;                   // time on screen (default U.sayMs(text))
  cps?: number;                  // typewriter characters per second (default 42; instant with reduced motion)
};
```

**Commands.** A command with `to`:
1. If the person is not standing, stand up.
2. Walk `world.findPath(position, approach point)` at the agent's speed × `speed`.
3. Turn to `anchor.face` (0.3 s).
4. Take the anchor's posture: sit with the pelvis at `seatH` ±3 cm, or lie with the
   pelvis on the mattress and the head towards `face`.
5. Set the `state`, then emit `people:arrived`.

Other rules:
- **No path:** fade the tag, teleport to the approach point, emit `people:blocked`, then
  continue.
- **Instant or reduced motion:** place at once and emit `people:arrived` on the next
  frame.
- **A new command** replaces the old one at once, from the current pose.
- **`place`** never emits events.
- **The `walk` state** is set automatically while moving and cannot be commanded.

**Steering and separation.**
- **Following the path:** arrival radius 0.45 m at intermediate points (round the
  corners smoothly) and 0.12 m at the end. Slow down to 60% within 1 m of the end. Turn
  at most 4 rad/s.
- **Separation:**
  - from other walkers within 0.75 m, push sideways, perpendicular to the path, with
    strength `1.2·(1 − d/0.75)` m/s;
  - seated and lying people are static obstacles of radius 0.35 m, except at their own
    anchor.
- **Getting stuck:**
  - if progress stays under 0.05 m/s for 2 s, sidestep 0.5 m;
  - after 6 s, teleport to the next waypoint and emit `people:blocked`.

  Doors are where it matters: 8 agents crossing a 1.6 m door must all get through without
  any two feet staying closer than 0.35 m for more than 0.5 s.
- **Mood changes the walk:** speed ×1.15 when `teso`, ×0.9 when `preoccupato` or
  `assonnato`.

**The body.**
- **Proportions:** about 7.5 heads tall; the per-agent height is in §3.3.
- **Joints:** pelvis, spine, chest, neck, head; and for each side clavicle, upper arm,
  forearm, hand, thigh, shin and foot.
- **Shapes:** `LatheGeometry` or tapered cylinders for the torso and limbs; hands as a
  mitten plus thumb (a sphere on low).
- **Clothes:** separate shells where they read: jacket, skirt or trousers, collars.
- **Hair:** shaped meshes (bob, short crop, undercut, slicked, curly) and the beard or
  goatee where the agent has one.
- **Draw calls:** merge the static parts of each bone into one vertex-coloured mesh with
  a shared material (Appendix G.2), and keep the moving face parts (eyelids, mouth,
  brows) separate.
- **Shadows:** all people cast them.
- **Hit proxy:** one invisible capsule per person.

**The animation.** It is procedural and blends per joint.
- **Pose targets:** a pose library gives the joint targets for posture × state ×
  time. Each joint approaches its target with `U.damp` (λ ≈ 10).
- **The walk:**
  - stride about 0.42 × height, with the cycle frequency matched to the speed so the
    feet never slide;
  - the knee bends, the foot rolls;
  - the hip sways, the shoulders counter-rotate, the arms swing against the legs;
  - a bob of 2-3 cm, and the head stabilised.

  The tartaruga's gait is slow and heavy; the falco's is quick and upright.
- **Breathing** is always on, on the chest's scale.
- **Idle:** weight shifts every 4-8 s.
- **The face:**
  - **Eyes:** white, iris in the agent's eye colour, pupil.
  - **Blinks:** every 2.5-6 s (a seeded random), lasting 120 ms, with a 10% chance of a
    double blink. The eyes are closed while sleeping.
  - **The mouth:** while a bubble is typing, its opening follows the characters just
    revealed: open for `a/e/o`, half for `i/u`, small for consonants, closed on spaces
    and punctuation. It is closed otherwise.
  - **The brows follow the mood:** inner brows up for `preoccupato`, lowered for `teso`,
    slightly raised for `contento`. The scettico's left brow is always raised.
- **Look-at:**
  - head: yaw ±70°, pitch ±30°; eyes: another ±15°;
  - standing people turn the whole body for targets beyond 70°;
  - seated people turn the torso by ±20° at most.

**Levels of detail:**
- `low`: no fingers, simpler face (painted eyes, no eyelid geometry; blink by scaling a
  dark lid quad), 8 segments around limbs, no shadow from hands and face parts.
  Agents more than 25 m from the camera animate at 15 Hz.
- `medium`: full face, 12 segments; agents beyond 30 m animate at 30 Hz.
- `high`: everything, 16 segments.

The triangle budgets per person are in §3.6.

**The overlay** (`#campus-overlay`; textContent only).
- **`.cp-p-tag.k-<key>`:** a dot, the name, `.cp-p-act` (the `act` text, hidden in
  compact mode) and `.cp-p-grades` (red-pen grades like the page's `.voto`, in
  `--font-hand` and `--pen`).
  - Each tag sits at the projected head top; overlapping tags stack upwards, as in
    today's `placeLabels`.
  - Opacity 1 under 18 m, falling to 0.35 at 40 m; hidden beyond 60 m, except the
    followed agent and the speakers.
  - Hidden when behind the camera or outside the frustum.
  - The overlay gets the class `cp-p-compact` when the stage is under 600 px wide.
- **`.cp-p-bubble.k-<key>[data-kind]`:**
  - a header `<b>` «Falco · Intervento»;
  - for any kind but `ufficiale`, a chip with `Campus.KINDS[kind]`;
  - the text `<span>`, typed at `cps`;
  - max width `min(310px, 76%)`, a tail towards the head, clamped inside the stage.
  - At most 3 bubbles visible. Priority: the followed agent, then lines with priority ≥ 2
    (`ufficiale` and `claude`), then the newest. A hidden bubble still counts its time
    and still emits `people:said`.
  - The `motore` bubble is anchored at `world.anchor("riunione.screen").speak`.
- **`.cp-p-thought.k-<key>`:** a cloud with a dashed border, italic `--font-read`, three
  small circles as its tail, the label «pensa» and the source in `--muted`. At most 2
  visible.
- **Performance:** DOM writes only when a position changes by more than 0.5 px. Measure
  sizes only when the text changes. Use `translate3d` transforms.
- **Readability:** in dark mode the tags and bubbles use `--sheet` and `--ink` with a
  coloured border, so they stay readable on the night scene.

**Degradation:**
- with no 3D, `people` is never initialised: `life` must check `C.ctx.has3d &&
  C.people.ready`;
- a missing anchor in a command counts as «no path»;
- `say("motore")` with no `riunione.screen` anchors the bubble at (−1.4, 1.7, −16.8).

**Definition of done for people.js** (with the stubs for render, world, life and ui):
1. **Line-up:** the 8 people stand in a row in the cortile at 12:30.
   - `people-lineup.png`: front view, 1280×800;
   - `people-lineup-34.png`: 3/4 view;
   - `people-faces.png`: head close-ups with `render.shot("agent:<key>")` or a test
     camera;
   - `people-lineup-night.png`: at 23:30.

   Each one is recognisable from Appendix C without reading the tags.
2. **States:** for falco, each of the 13 states in a 4×4 grid of screenshots
   (`people-states.png`); `stateOf` returns the state, or the mapping of §3.4.
3. **Face:** in 7 s at least one blink (the lid scale changes); the mouth opens during
   `say` and is closed 0.3 s after `people:said`.
4. **Walk and sit:** `command("falco", {to: "riunione.seat.falco"})` from the dorm
   arrives, emits `people:arrived` with the id, the pelvis is at `seatH` ±3 cm and the
   yaw at `face` ±0.1 rad. A video-like strip of 6 frames: `people-walk.png`.
5. **Crowd:** all 8 commanded at once from the mensa seats to their `riunione.stand.<k>`
   anchors: all arrive within 40 s, and the separation limit of this section holds
   (sampled at 10 Hz). With the world stub the paths are straight lines, so this tests
   the separation, not the doors. If a real `world.js` is in the folder, run it once more
   with it and report the result.
6. **Overlay:**
   - tags never overlap at 1280 and at 390;
   - a bubble with `text: "<img src=x onerror=alert(1)>"` shows that text literally;
   - shots at 390×844 in dark mode: `people-overlay-phone-dark.png`;
   - at most 3 bubbles and 2 clouds are visible.
7. **Detail:** triangles per person within §3.6 at each `setDetail` level, and draw
   calls for all 8 within the budget.
8. **Reduced motion:** `command` places at once, and the typewriter shows the full text.
9. The file is ≤ 130 KB.

### 5.4 `campus/life.js` · `Campus.life`

**It owns:**
- the schedule, Rome's clock and the mode;
- the overrides: live, replay, emergency, gym, contest;
- activity choice per personality, grounded in the data;
- occupancy of the anchors through `world`;
- moods;
- encounters with lines from real data;
- thoughts from the notebooks;
- the feed;
- the director's focus requests;
- «Fateli parlare» (the prompt, the `sample` call, the checks, the staging).

It never touches the DOM.

```ts
Campus.life = {
  init(ctx): void,
  update(dt, t): void,              // runs at frame rate; heavy decisions throttled to 4 Hz
  mode: "vita" | "notte" | "riunione" | "diretta" | "replica" | "emergenza" | "palestra",
  modeDetail: string,               // the Italian line for #campus-live (Appendix F.2)
  // read API (for ui and tests)
  status(): AgentStatus[],          // 8 entries in KEYS order
  where(key): { x, z, room, anchor: string | null } | null,
  mind(key): Mind,
  feed: FeedEntry[],                // oldest first, at most 200
  schedule(): Block[],              // today's blocks (Rome), for the clock chip
  block(): Block | null,            // the current block
  replayState: { date, step, total, playing, speed, phase: "raduno" | "battute" | "fine" } | null,
  talkTopics: { id, label, enabled }[],   // Appendix D.2
  talkState: "idle" | "thinking" | "walking" | "playing",
  CONSTANTS: number[],              // Appendix E.3, for the number test
  // commands (ui, the page, tests)
  replay(date: string, opts?: { autostart?: boolean }): boolean,
  replayControl(opts: { playing?: boolean, speed?: 1 | 2 | 4, restart?: boolean }): void,
  replayJump(step: number): void,
  stopReplay(): void,               // back to the present
  talk(keys: string[], topic: string, opts?: { fresh?: boolean }): Promise<{ ok: boolean, code?: string, lines?: number }>,
  cancelTalk(): void,
  buildTalkPrompt(keys: string[], topic: string): { prompt: string, numbers: string[] },
  // test hooks
  _advance(seconds: number, dt?: number): void,  // run the brain forward (Campus.clock moves too); people placed instantly
  _templates(): { topic, who, lines: string[] }[],  // generate one encounter per template with the current data
};
type AgentStatus = { key, name, state, activity, label, room, roomName, since, mood, moodLabel, moodWhy, speaking };
type Mind = AgentStatus & {
  wallet: ReturnType<typeof Campus.derive.wallet>,
  lezione: {data, testo} | null,
  previsione: object | null,
  calibrazione: { n, brier, eccesso } | null,
  voti: ReturnType<typeof Campus.derive.votes>,
};
type Block = { from: number, to: number, block: string, label: string };  // minutes after Rome midnight
```

#### 5.4.1 The day (Appendix A has the full table)

The time comes from `U.rome()`. Each agent has its own wake-up and bedtime, jittered by
±8 min with `U.rng(key + "|" + date)`, so the jitter is the same on every reload. The
blocks, in Rome time:
- **notte:** in bed (`dorm_<k>.bed`, sleep).
- **sveglia:** at the wardrobe (`dorm_<k>.spot`).
- **caffè:** the mensa counter or seats, until 06:40.
- **riunione:** 06:40–07:40 at the meeting room seats. The meeting starts at 06:47.
- **lavoro:** 07:40–12:45.
- **pranzo:** 12:45–13:45 in the mensa; the tartaruga eats on a garden bench.
- **lavoro:** 13:45–19:30.
- **cena:** 19:30–20:35.
- **controllo della sera:** 20:35–21:00. The guardiano is at his risk desk; the others
  are free.
- **serata:** until bedtime.
- **Sunday:** the **palestra** block 11:05–12:30, for the traders, the scettico and the
  preside.
- **Outside the term** (before 25/11/2026 or after 21/2/2027): no meeting block.

#### 5.4.2 Modes and overrides

Re-evaluate the mode each second. The first that applies wins:
1. **`diretta`:** `U.liveNow(data.live)` is not null.
2. **`replica`:** a replay is running.
3. **`emergenza`:** `data.sera.allarme === true`, `data.sera.data` is today (Rome), and
   the time is 20:41–22:30.
4. **`palestra`:** a Sunday, 11:05–12:30.
5. **`riunione`:** the meeting block on a school day.
6. **`notte`:** at least 5 agents are in the notte block.
7. **`vita`:** otherwise.

A contest is a **layer** inside `vita`, not a mode. `modeDetail` comes from Appendix F.2.
Emit `life:mode` on every change.

- **`diretta`** (a port of `liveScript` and `liveMoves` from today's page).
  - **The feed:** on every change of `data.live`, append the `log` entries not seen yet
    (keyed by `ora|attore|testo`) as `ufficiale`, with label `FASE[fase]`,
    `source: "in diretta"` and `at = ora`.
  - **Speaking:** the latest entry is spoken by `attore`, or by the `motore` bubble.
  - **Places** follow `liveMoves`:
    - everyone at `riunione.seat.<k>`;
    - the preside at `riunione.board.preside` for `inizio`, and standing for `motore`,
      `ordini`, `chiusura` and `posizioni`;
    - the cronista at `riunione.shelf` for `briefing`;
    - the scettico standing for `domande`;
    - the agent named in `posizioni` and `risposte` standing.
    - «standing» always means the agent's own `riunione.stand.<key>` anchor.
  - **`fase: "palestra"`:** the traders at `palestra.desk.<k>` (think), the preside at
    `palestra.board`, the scettico at `palestra.stand.scettico`.
  - **`fase: "sera"`:** the guardiano, the 4 traders and the preside in the meeting
    room.
  - **The board:** `[liveTitle, FASE label]`, as today. The `motore` terminal shows the
    title as today.
  - **Focus:** `life:focus {keys: [attore], room, priority: 3}`.
- **`replica`:** see §5.4.3.
- **`emergenza`.** The guardiano, the 4 traders and the preside go to their riunione
  seats; the others continue their evening. The board shows «La riunione della sera» and
  the first motive (`U.human`).
  - If `ultimo.sera` (or `verbali[today].sera`) exists, play its beats once, as a mini
    replay of the «sera» part (§5.4.3, step 10), with the `ufficiale` kind.
  - Otherwise the guardiano stands at the board and says the real `motivi`, as
    `chiacchiera` lines in the form «Allarme: …» built from `sera.motivi`. They wait.
- **`palestra`** (with no live doc). The traders sit at `palestra.desk.<k>` (state
  think or write), the preside is at `palestra.board`, the scettico at
  `palestra.stand.scettico`.
  - The gym board shows «La palestra · 20 casi dal passato per ognuno».
  - If today's `palestre` doc exists, add its lessons as `ufficiale` feed entries, with
    `source: "palestra del <dm>"`, one every 20 s.
- **`riunione`** (with no live doc).
  - If today's minutes are already complete (`verbali[today]` or `ultimo` with today's
    `data` and `stato`), the meeting is over: go back to `vita`.
  - Otherwise everyone waits seated (state `listen` or `sit`). The board shows
    `[«Riunione N · <longDay>», tema]` from `D.today()`, and the preside says
    «Aspettiamo l'inizio della riunione.» (a data-free `chiacchiera`).
- **`notte`.** Everyone in bed, with the tag text «dorme».
  - Exception, the contest: if `D.contests()` has an open contest with a deadline within
    12 h, each trader has a 25% chance per hour (seeded) of getting up to `trading.gara.n`
    for 3-6 min, then going back to bed.
  - Thoughts while sleeping: none.
- **`vita`:** the activity choice (§5.4.4), encounters (§5.4.5) and thoughts (§5.4.6).
  - **The contest layer:** while a contest is open, every 8-15 min the 4 traders gather
    at `trading.gara.1..4` for one encounter on the `gara` topic.
  - **The winner's party:** when a contest has finished and the owner has not seen it
    (`localStorage["cp-gara-festa-<id>"]` unset; wrap in try/catch), stage a 40 s
    gathering in the cortile once. The winner gestures and the others listen and
    gesture. Feed one `ufficiale` entry with the Preside's `commento` from the gara doc
    (`source: "gara della notte del <dm>"`). Then set the key.

#### 5.4.3 The replay (a port of `dayScript`)

`replay(date)` is refused (returns false) when the mode is `diretta`. Otherwise:
1. **Loading:** if `data.verbali[date]` is `undefined`, emit `life:replay {state:
   "loading"}` and wait up to 10 s. If it is `null`, or the wait ends, emit `error`.
2. **The clock:** `Campus.clock.setOverride(U.utc(verbale.mercati_ora) || U.romeDate(date, 407), 1)`.
   The sky becomes the meeting's dawn (407 minutes = 06:47).
3. **Raduno:** all 8 are commanded to `riunione.seat.<k>` with speed 1.3. Once all have
   arrived, or after 20 s (then place the stragglers), start the beats.
4. **The beats:** build them exactly as `dayScript(d, g)` in today's page does (steps 1
   to 10, the same texts, labels and `to`). Map them like this:

| beat | campus action |
| --- | --- |
| `reset` | the raduno above; clear grades (`setTag(k, {grades: null})`); `surfaces.board(["Scuola Cripto"])` |
| `go [who, spot]` | `seat` → `riunione.seat.<who>`; `stand` → `riunione.stand.<who>`; `board` → `riunione.board.preside` (state write) for the preside, `riunione.board.guest` (gesture) for the others; `shelf` → `riunione.shelf` (read). Done when all have arrived, or after 16 s |
| `say` | `people.say(who, {text, label, kind: "ufficiale", to, ms: sayMs/speed, cps: 42·speed})`; the speaker's state is `talk`; the others `listen` and `lookAt(who)` (`motore`: the listeners look at `riunione.screen`); one feed entry `{kind: "ufficiale", label, step, date, source: "verbale del dd/mm", room: "riunione"}`; `life:focus {keys: [who, to], room: "riunione", priority: 3, holdS: ms/1000}` |
| `board` | `surfaces.board(lines, reveal)`, animating reveal 0→1 over 1.4 s (instant with reduced motion); lasts 1.6 s |
| `screen` | `surfaces.motore(events, title)`; lasts 0.5 s |
| `grade` | `setTag(k, {grades: voti[k]})` for the GRADED agents; lasts 0.5 s |
| `idle` (the end) | `phase: "fine"`; after 20 s at speed 1 (scaled by speed), `stopReplay()` unless paused |

5. **Controls:**
   - `replayControl({playing})` pauses or resumes the beats (people keep breathing);
   - `speed` scales both the beat durations and the typewriter;
   - `restart` jumps to step 0;
   - `replayJump(step)` works like today's `settle`: it re-applies every `go`, `board`,
     `screen` and `grade` beat before the step instantly, hides the current bubble and
     continues from the step.
6. **The end:** `stopReplay()` clears the clock override (the sky blends back), releases
   the meeting seats, emits `life:replay {state: "end"}` and returns to the mode the
   schedule gives.

**The acceptance reference:** the sequence of `ufficiale` feed entries `{who, label,
text}` produced by `replay(date)` must equal, item by item, today's page's feed for the
same minutes. The reference files are in the kit:
- `reference-feed-2026-11-30.json` (fixture `full`, 37 items);
- `reference-feed-2026-11-30-sera.json` (fixture `evening`, 51 items, with the evening
  meeting);
- `reference-feed-2026-11-25.json` (fixture `real`, 41 items, the real welcome meeting).

#### 5.4.4 Activity choice

- **When:** when an agent's activity ends (after a duration drawn from its range in
  Appendix B.1, 45-180 s real time) or the block changes, choose its next activity.
  Inside `vita` and the meal, evening and work blocks, the choice is by weighted
  utility.
- **The utility:** `weight = base[agent][activity] × data modifiers × block fit × (0.4 if
  it was one of the last 2 activities) × (0.7…1.3 seeded noise)`. The tables are in
  Appendix B.
- **Anchors:** life picks a free anchor of the activity's kind (the agent's own `owner`
  anchors first), `reserve`s it, commands the person and `release`s the previous one. If
  none is free, the next best activity.
- **Seeking:** some activities target another agent (`visita`: the scettico seeks the
  most over-confident agent, the guardiano the agent named in the first alarm, the
  preside the agent with the lowest last discipline grade, the cronista anyone for an
  «intervista»). The seeker walks to a point 1.1 m in front of the target. On arrival an
  encounter starts if the target is interruptible; otherwise the seeker waits up to 30 s,
  then gives up.
- **Events:** emit `life:activity` on every start, and call `people.setTag(key, {act:
  label})` with the short label of Appendix B.1.
- **Without 3D:** the same choices, with `where()` = the anchor's position, instant.

#### 5.4.5 Encounters

- **Checked at 4 Hz** for pairs `(a, b)`. An encounter needs all of these:
  - the feet within 2.4 m (with no 3D: the same room);
  - both interruptible: walking, or in an activity with `interrupt: true` (Appendix
    B.1);
  - pair cooldown 240 s, agent cooldown 45 s;
  - at most 2 encounters at once, at least 10 s between starts;
  - the mode is `vita`, or a meal or evening block.
- **The chance per second** is `0.12 × affinity(a, b)` (Appendix B.3).
- **What happens:**
  1. Both stop (`people.stop`) and face each other 1.1 m apart; the second one steps
     into place.
  2. They exchange 2-4 lines from a topic chosen by interest × data availability
     (Appendix E). Each line: `people.say` with `kind: "chiacchiera"`; the listener
     `listen`s; one feed entry (label «Incontro in <room name, lower-case>» or the
     topic's label); `life:focus` with priority 2.
  3. A gap of 0.4 s between lines.
  4. Both resume their activity.
- **Events:** `life:encounter` at the start and at the end.
- **Data-free small talk** (the `saluto` topic) is always available, so the campus is
  alive even with no data.
- **The number rule** (§3.8) applies to every line.

#### 5.4.6 Thoughts

- **Who:** an agent in `read`, `think`, `write`, alone in `sit`, or walking alone for
  more than 20 s.
- **How often:** a 30% chance per 20 s to think, with at most 1 cloud on screen (2 when
  someone is followed).
- **The text** is chosen, seeded, from:
  - the last 5 `lezioni` (source «dal quaderno»);
  - `regole[].testo` («una mia regola»);
  - `errori[]` with `volte` ≥ 2 («un errore che ripeto: … (N volte)»);
  - the agent's `riflessione` in the last minutes (`ultimo.posizioni[k].riflessione`, or
    for the preside `ultimo.riflessione_preside`), with source «dal verbale del dd/mm»;
  - the open prediction («Ho detto: <predText>»).

  The text is `plain(…, 140)`. If there is nothing, no thought.
- **Effects:** `people.think`, one feed entry (`kind: "pensiero"`, label «pensa»),
  `life:thought`, and `life:focus` with priority 1.

#### 5.4.7 Moods (`mood`, `moodLabel`, `moodWhy`)

Recompute on `data:change`. The rules are in Appendix B.2 (P&L, alarms, grades and the
hour). `moodWhy` always carries the number that justifies the mood: «a giudizio +1,32%
dall'inizio». Call `people.setMood`, and emit `life:mood` on change.

#### 5.4.8 The feed

- At most 200 entries, oldest first; emit `life:feed` for each one.
- **Seeding:** on the first `data:change` where `ultimo` is an object, seed the feed with
  its closing lines (`chiusura.righe`, with the labels of Appendix F.3), as `ufficiale`,
  `source: "verbale del dd/mm"`, `at: ultimo.scritto`.
- **During a replay,** the replay's entries carry `step` and `date`.
- **When a replay starts,** the feed is not cleared: replay entries are appended, and
  `ui` filters by `date` in replay mode.

#### 5.4.9 «Fateli parlare»

`talk(keys, topic, {fresh})`:
1. **Checks:**
   - `ctx.sample` must exist, else `{ok: false, code: "not_granted"}`;
   - 2 to 4 distinct keys, else `invalid`;
   - the mode is not `diretta` or `replica`, else `busy`;
   - no talk is running, else `busy`;
   - for topic `gara`, a contest must exist, else `invalid`.
2. **Building the prompt:** `buildTalkPrompt(keys, topic)` builds the Italian prompt of
   Appendix D, with a DATI block of real numbers formatted by `U`. It also returns
   `numbers`: every number token of the DATI block, normalised.
3. **The call:**
   - emit `life:talk {state: "thinking"}`;
   - call `ctx.sample.json(prompt, {modelTier: "default", signal, ...(fresh ? {cache: false} : {})})`;
   - keep the `AbortController` for `cancelTalk`.
4. **Validation:**
   - `battute` is an array; keep lines where `chi` is in `keys`, `testo` is a non-empty
     string and `a` is in `keys`, `"tutti"` or missing;
   - `testo = U.plain(testo, 240)`; `gesto` must be one of talk, gesture, think, listen
     or drink, else talk;
   - **the number check** (Appendix D.3): drop every line that holds a number not in
     `numbers`;
   - if fewer than 2 lines survive, return `{ok: false, code: "numeri"}` and emit
     `life:talk {state: "error", code: "numeri"}`.
5. **Staging:**
   - emit `walking`;
   - the venue is the speakers' common room if they share one; else the nearest free
     `chat` anchors that seat them together (`cortile.bench` by day, `mensa.seat.<t>.*`
     at meals and in the evening, `biblioteca.armchair` at night);
   - walk for up to 20 s, then place;
   - emit `playing`;
   - each line: `people.say` with `kind: "claude"`, `label: titolo`; one feed entry
     (`kind: "claude"`, `source: "dialogo chiesto da te"`); `life:focus` with priority 3.
6. **Done:** emit `done {lines}`, return `{ok: true, lines}`, and let them resume their
   lives.
7. **Errors:** any error from `sample` resolves `{ok: false, code: e.code}` and emits
   `error` with the code. `cancelled` emits `{state: "error", code: "cancelled"}`, which
   `ui` does not show as an error.

**Degradation:**
- **No 3D:** everything is the same, without people calls. Positions are the anchors'.
  The feed, status, mind and talk still work, and the staged dialog still produces the
  feed entries, paced by `sayMs`.
- **No data:** the schedule and small talk only, with no number in any line.
- **No sample:** `talkTopics[].enabled` stays as computed; `talk` returns
  `not_granted`.

**Definition of done for life.js** (with the stubs for render, world, people and ui;
then again with real `world.js` if it is already in the folder):
1. **The schedule** (with `Campus.clock.setOverride` and `_advance`), on Thursday 26/11
   and Sunday 29/11/2026 Rome, with fixture `full`, and the `notte` exception off (no
   open contest):

| time | expected |
| --- | --- |
| 03:00 | all 8 at `dorm_<k>.bed`, state sleep, mode `notte` |
| 06:35 | at least 6 in the mensa |
| 07:00 | all 8 at riunione seats, mode `riunione` |
| 10:30 | at least 4 different rooms in use, no one in bed |
| 13:00 | at least 5 in the mensa, the tartaruga in the cortile |
| Sunday 11:20 | the 4 traders at `palestra.desk.<k>`, mode `palestra` |

   Write `life-schedule.json`.
2. **Replay:** for each reference file, call `CampusGlue.select(date)` (it subscribes to
   the minutes, which the `real` fixture otherwise never loads, and calls `replay`), then
   `_advance` until the end. The day number, theme and welcome flag come from the
   `programma` entry of that date, as in `dayScript(d, g)`. The
   feed entries with `date === <date>` and `step !== null` give `{who, label, text}` equal
   to the reference, item by item (the closing lines seeded at start-up have no `step` and
   are not compared).
   `replayJump(10)` re-applies the earlier beats (the board lines equal the last `board`
   beat before step 10). Speed 4 runs about 4× shorter.
3. **Live:** with `live` built by the harness (posizioni, 7 log lines, the last 1 min
   ago): mode `diretta` within 1 s; the 7 entries in the feed as `ufficiale`; falco
   standing at `riunione.stand.falco` and speaking. `replay()` returns false. When the
   live doc is 13 min old, back to the scheduled mode.
4. **Emergency:** fixture `evening`, Rome 30/11 20:50: mode `emergenza`; the 6 agents at
   their riunione seats; the sera beats in the feed equal the last 14 items of
   `reference-feed-2026-11-30-sera.json`.
5. **Encounters and numbers:** `_advance(3600)` in `vita` on 30/11 10:00 with fixture
   `full`:
   - at least 15 encounters and 10 thoughts;
   - every `chiacchiera` and `pensiero` line passes the number rule (§3.8): extract
     tokens with `/[−-]?\d[\d.,]*/g`, normalise them as in Appendix D.3, and check them
     against the data leaves, array lengths, `derive` values, date parts and
     `life.CONSTANTS`;
   - no line contains «undefined», «NaN», «null», «[object» or «—».

   `_templates()` generates every template at least once with the `full` and the `real`
   fixtures; write them to `life-templates.json` for review.
6. **Empty data** (fixture `empty`, and `nodb`): `_advance(1800)` raises no errors, and
   no line has a digit.
7. **Talk** (fake sample):
   - a reply with 6 good lines and 1 line with an invented number stages 6 lines, all
     `claude`, and drops the bad one;
   - error codes `rate_limited`, `refused` and `invalid_json` resolve `ok: false` with
     the code;
   - `cancelTalk()` during thinking gives `cancelled`;
   - `buildTalkPrompt` stays under 24 KB and contains only the chosen agents.
8. **No 3D** (`nowebgl`): steps 1, 2 and 5 pass on positions from the anchors.
9. The file is ≤ 150 KB.

### 5.5 `campus/ui.js` · `Campus.ui`

**It owns:**
- the four slots `[data-slot="live"|"hud"|"side"|"player"]` inside `ctx.uiRoot`
  (`#campus-section`);
- the class `cp-no3d` on the stage;
- the canvas's `aria-label`.

Everything is in plain Italian (Appendix F).

```ts
Campus.ui = {
  init(ctx): void,
  update(dt, t): void,          // throttle: clock 1 Hz, minimap 10 Hz, follow card 2 Hz, lists on events
  follow(key: string | null): void,  // render.setCameraMode("segui", {key}), people.setHighlight(key), the follow card; null stops
  tab(name: "dialoghi" | "attivita" | "parlare"): void,
  // test hooks
  _careers(): { [key]: { xp, level, levelName, next, medals: string[] } },
  _season(): { capitale, pct, quota, giorno, totale, days, tesi },
};
```

**The live line** (`[data-slot="live"]`): `Campus.life.modeDetail`, with a pulsing
`live-dot` (the page's class) in `diretta`. With reduced motion it does not pulse.

**The HUD** (`[data-slot="hud"]`, over the stage):
- **Top left, the Rome clock chip:** «Roma 07:12 · gio 26/11» plus the block label
  (`life.block().label`), and a sun, twilight or moon icon from `render.sky.phase` (or
  `U.sun` without 3D). In replay it shows the sim time and «replica».
- **Top right, the camera segmented control:** «Regia», «Libera», «Segui», with
  `aria-pressed` taken from `render:camera-mode`. «Segui» with no agent chosen opens an
  8-chip agent picker.
- **A quality button:** «Grafica: automatica / alta / media / bassa», cycling through
  `render.setQuality`, and showing the current level when automatic.
- **Bottom left, the minimap:**
  - a 2D canvas at device pixel ratio, 200×167 CSS px on desktop and 132×110 on phones;
    collapsible («Mappa»), and collapsed by default under 600 px;
  - room fills by kind from the tokens: `interno` `--wash`, `passaggio` `--paper`,
    `esterno` green (`#a8c79a`, or `#2f4a2a` in dark mode), `dormitorio` `--sheet`;
    borders `--rule`; the names of the big rooms on desktop;
  - the agents as 3.5 px dots in `U.cssColor(key)` with a `--sheet` outline, at
    `life.where(key)`, and a ring on the followed agent;
  - the camera as a small wedge at `render.camera` x, z, pointing along its view;
  - **clicks:** a dot (within 8 px) → `follow(key)`; a room →
    `render.setCameraMode("regia")` and `render.focus({room, priority: 2, shot: "wide"})`.
- **Bottom, the replay bar.** In `replica` it shows:
  - «‹», «Pausa/Riprendi», «Velocità 1×/2×/4×», «Da capo», «›» and «Torna al presente»;
  - «‹» and «›» move between held days, each calling `CampusGlue.select(date)` (provided
    by the page, §6);
  - «Torna al presente» calls `life.stopReplay()`.

  In `vita`, `notte` or `riunione`, when `ultimo` exists, it shows one button, «Rivedi
  la riunione di <giorno>», which calls `CampusGlue.select(ultimoData)`. During
  `diretta` the bar is hidden.
- **The follow card «La mente»** (when following):
  - on desktop, over the stage, top right under the camera control, 300 px wide;
  - under 900 px, the first block of the side panel.

  It shows, from `life.mind(key)` and the careers:
  - a header with the dot, the name, the role line of Appendix F.4 and «×»
    (aria-label «Smetti di seguire»);
  - «Adesso»: the label, the room, «da N min»;
  - «Umore»: a chip and `moodWhy`;
  - «Portafoglio» (traders): «a giudizio X USDT (±p%) · la regola Y · differenza ±Z»;
  - «L'ultima lezione»;
  - «La previsione aperta» (`U.predText`);
  - «Calibrazione»: «Brier 0,27 su 5 previsioni; dice il 72% e ci prende il 60%», using
    `sicurezza_media` and `successi`;
  - «I voti»: «il Preside R 7 · D 6; lui stesso R 7 · D 7 (30/11)»;
  - «Carriera»: the level name, an XP bar and the medal count.

  Empty sections are hidden. If nothing is left: «Il suo quaderno è ancora vuoto.»
- **The no-3D plan.** On `campus:degraded` with reason `no-webgl` or `no-3d`, add
  `cp-no3d` to the stage and draw a large minimap (the plan) in the HUD: room names, dots
  with initials, legend. Add the note of Appendix F.1. Everything else works.

**The side panel** (`[data-slot="side"]`): three tabs, with `role="tablist"` and
`aria-selected`, remembering the last tab in `localStorage["cp-tab"]` (try/catch).
1. **«Cosa si dicono»** (the feed):
   - newest at the bottom; auto-scroll unless the owner has scrolled up (then a «Nuovi
     messaggi ↓» chip);
   - each item: the dot and name, the label, the Rome time, and the kind chip
     (`ufficiale` shows its `source`, e.g. «dal verbale del 30/11» or «in diretta»;
     the others show `Campus.KINDS[kind]`);
   - **in `replica`:** only that date's entries; items are buttons that call
     `life.replayJump(step)`; `data-state` past, now or next, as today;
   - a legend at the bottom (Appendix F.5);
   - the empty state: «Qui compare quello che si dicono.»
2. **«Cosa fanno»:** 8 rows from `life.status()`, refreshed on `life:activity` and
   `life:mood`:
   - the dot and name, the label, the room, «da N min», and the mood chip;
   - in the `notte` mode, «dorme» rows are dimmed;
   - clicking a row → `follow(key)`.
3. **«Fateli parlare»** (only when `ctx.sample` is set; listen to `campus:capabilities`):
   - 8 agent chips (choose 2-4, `aria-pressed`);
   - the topic select from `life.talkTopics` (disabled options stay greyed, with a
     reason);
   - the button «Fateli parlare»;
   - the status line: «Claude sta scrivendo il dialogo…» with «Ferma»; then «Ecco il
     dialogo: guardali parlare.» and «Un altro dialogo» (calls `talk(…, {fresh: true})`);
   - errors from Appendix F.6;
   - the cost note: «Usa il tuo account Claude: ogni dialogo consuma un po' del tuo
     utilizzo. I numeri che dicono vengono solo dai dati della scuola.»
   - **Disabled** in `diretta` and `replica`, with «Durante la diretta e la replica
     parlano con le loro parole.»
   - **Hidden** (the whole tab) when the sample is null or the last error was
     `not_granted`, `sampling_disabled`, `not_declared` or `capability_*`.

**The player layer** (`[data-slot="player"]`, below the campus): four sheets, in this
order, styled like the page's `.sheet`.
1. **«La stagione»** (`_season()`):
   - «Il fondo comune: 81.470,59 USDT su 80.000 (+1,84%)» with a bar centred on 80.000:
     gains go right in `--gain`, losses left in `--loss`;
   - «Diviso tra tutti e 8: 10.183,82 USDT finti a testa»;
   - «Giorno N di 88 · mancano D giorni alla laurea del 21 febbraio 2027»;
   - «La tesi: <nome> (la propone <chi>)» or «La tesi: si sceglie insieme l'ultimo
     giorno»;
   - a source line: «Somma degli 8 portafogli ai prezzi di BingX del <romeTime(at)>.»;
   - empty: «Il fondo comune parte il 26 novembre da 80.000 USDT finti.»
2. **«Le carriere»** (Appendix E.4 for the formulas):
   - 7 cards (GRADED), each with the level name, the XP and the next threshold, a bar, and
     12 medal slots (earned: bright in the agent's colour; not earned: dim, with the rule
     as `title` and visible on tap);
   - the preside card: «Il Preside · ha guidato N riunioni»;
   - a `details` element «Come si calcola», listing the formula in plain Italian.
3. **«Le tue sfide»** (proposals):
   - **The form:**
     - «La tua sfida» textarea (10–600 characters, with a counter);
     - «Che cosa è» radios: studio «Uno studio», previsioni «Delle previsioni», gara
       «Una gara», altro «Altro»;
     - for gara only: «Fino a quando» (a `datetime-local` in Rome time; default
       tomorrow at 15:00; minimum now + 1 h, maximum now + 30 days) and «Leva» (1-10,
       default 10);
     - the button «Proponi al Preside»;
     - the note «Il Preside legge le proposte nella riunione delle 06:47 e risponde qui.
       Soldi solo finti: le proposte che chiedono soldi veri vengono rifiutate.»
   - **The write**, exactly:
     ```js
     // the datetime-local value "2026-11-27T15:00" is Rome time
     const romeLocalToDate = (v) => U.romeDate(v.slice(0, 10), +v.slice(11, 13) * 60 + +v.slice(14, 16));
     const id = "p-" + yyyymmdd + "-" + hhmmss /* UTC */ + "-" + Math.random().toString(36).slice(2, 6);
     await ctx.db.collection("proposte").doc(id).set({
       testo, tipo, creata: U.utcText(new Date()), stato: "nuova",
       ...(tipo === "gara" ? { scadenza_utc: U.utcText(romeLocalToDate(value)), leva: Math.round(leva) } : {}),
     });
     ```
     Allow one write at a time; the button is disabled while saving. On success: clear
     the form, show «Inviata: il Preside la legge nella riunione di domattina alle
     06:47.», emit `ui:proposal {state: "sent"}`. On error: the message of Appendix F.6
     and `ui:proposal {state: "error", code}`.
   - **No db:** the form is disabled with «Apri la pagina da claude.ai per proporre una
     sfida.»
   - **The list:** `data.proposte`, newest first:
     - the tipo chip, the text (textContent), «inviata il <romeTime(creata)>»;
     - the status chip: «in attesa del Preside» (nuova), «accettata», «rifiutata»,
       «fatta»;
     - when there is a `risposta`: «Il Preside: …» (textContent, `white-space:
       pre-line`) with `data_risposta`.

     Empty: «Ancora nessuna sfida. Proponine una: il Preside risponde nella riunione del
     mattino.»
4. **«La gara»** (`D.contests()`), one card per contest:
   - the title: «La gara della notte del 26/11» for ids `notte-YYYY-MM-DD`, else «La gara
     <id>»;
   - «Leva <leva> · si chiude <romeTime(scadenza)> · aperta|finita»;
   - the ranking from `situazione.classifica` (or `situazione_finale`): the name, the
     coin and side from `stato.wallets[k].positions[0]` or `closed[0]`, the margin, the
     result in USDT (coloured), the exit reason (`U.shortReason(exit_reason)`) or the
     chip «aperta»;
   - when finished: «Vince <Nome> con <+X USDT>: il premio è il doppio, <+2X> USDT finti.»
     (`premio` from the data);
   - the Preside's text: `commento` when finished, else `chiusura` (textContent,
     `pre-line`);
   - empty: «Nessuna gara per ora. Puoi proporne una qui sopra.»

**Responsiveness:**
- at 390×844 there is no horizontal scroll;
- the HUD controls wrap, and the clock chip goes compact (time only);
- the side panel goes below the stage at < 900 px, and the player sheets are one column;
- touch targets are ≥ 36 px.

**Degradation:**
- no 3D: the plan, as above;
- no db: the proposals are disabled, and everything else shows calm empty states;
- no sample: the third tab is hidden;
- no `life`: hide the feed and activity tabs and show «Il campus si sta preparando…».

**Definition of done for ui.js** (with the stubs for render, world, people and life):
1. **Shots:**
   - `ui-desktop-light.png` (1280×800);
   - `ui-desktop-dark.png`;
   - `ui-phone-light.png` (390×844, full page);
   - `ui-phone-dark.png`;
   - `ui-no3d.png` (`nowebgl`);
   - `ui-nodb.png`;

   with no horizontal overflow, and nothing «undefined», «NaN» or «null» in
   `document.body.innerText`.
2. **Camera:** clicking «Libera» calls `render.setCameraMode("libera")` (spy on the
   stub), and `aria-pressed` follows `render:camera-mode` (emit one with `segui` and
   check).
3. **Follow card:** `follow("falco")` with fixture `full` shows «a giudizio 11.118,04
   USDT» and the lesson «Il vantaggio sul codice va diviso per il rischio preso.»
4. **Minimap:** clicking the falco dot follows falco; clicking the mensa calls
   `render.focus` with `room: "mensa"`.
5. **Proposals:**
   - the fake db receives `proposte/p-…` with exactly the keys of §5.5 for each tipo;
   - validation blocks texts under 10 characters and a leva of 11;
   - the list shows the 3 fixture proposals with their statuses and the Preside's
     replies;
   - with `readOnly`, the `invalid_argument` message appears.
6. **Careers:** `_careers()` with fixture `full` equals a reference computed in the test
   from Appendix E.4. Medals: «Errore ammesso» for falco (memoria has errori).
7. **Season:** `_season().capitale` equals `Campus.derive.fund().capitale`
   (81470.588…); the text shows «81.470,59».
8. **Contest:** the `gara/notte-2026-11-26` card ranks tartaruga −4,65, spazzino −4,65,
   ragioniere −7,75 and falco −15,50 USDT (ranked by result, ties in KEYS order), each
   with «aperta».
9. **Fateli parlare:**
   - hidden with no sample;
   - with the fake sample: choose 2, press the button, and the status goes thinking →
     done; the feed shows `claude` entries with the chip «dialogo generato da Claude»;
   - the `rate_limited` message appears for that error.
10. **Replay bar:** visible in `replica` (the stub's `replay`), hidden in `diretta`.
11. **Keyboard:** Tab reaches every control in DOM order, and the tabs work with the
    arrow keys.
12. The file is ≤ 110 KB.

---

## 6. Page integration (the integrator)

### 6.1 What to remove from `scuola-cripto.html`

- The aula section markup (`<section aria-labelledby="t-aula">`).
- The CSS block `/* l'aula in 3D */`: `.aula`, `.stage*`, `.nametag`, `.bubble`,
  `.feed`, `.msg*`, `.aula-*`, `.no3d*`, `.ctl`. Keep `.live-dot` and `@keyframes pulse`,
  which `ui` reuses.
- In the 900 px media query, the `.aula`, `.stage` and `.feed` rules.
- The JS `makeAula()`, `const aula = makeAula()`, the `FASE` constant (the kernel has
  `Campus.FASE`), and `aula.sync` from the `render()` list.
- Keep `orderText`, `predText` and `shortEvent` if other sections use them. The kernel
  has its own copies.

### 6.2 The markup to add, in place of the aula section

```html
<section class="cp-section" id="campus-section" aria-labelledby="t-campus">
  <div class="wrap">
    <div class="section-head"><h2 id="t-campus">Il campus</h2><p class="cp-live" id="campus-live" data-slot="live">Carico il campus…</p></div>
    <div class="cp" id="campus">
      <div class="cp-stage" id="campus-stage">
        <canvas id="campus-canvas" role="img" aria-label="Il campus della Scuola Cripto in 3D: gli otto agenti nelle loro stanze"></canvas>
        <div class="cp-overlay" id="campus-overlay" aria-hidden="true"></div>
        <div class="cp-hud" id="campus-hud" data-slot="hud"></div>
      </div>
      <aside class="cp-side" id="campus-side" data-slot="side" aria-label="Cosa succede nel campus"></aside>
    </div>
    <div class="cp-player" id="campus-player" data-slot="player"></div>
  </div>
</section>
```

And this base CSS, in the page's `<style>`:

```css
.cp { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 14px; align-items: stretch; }
.cp-stage { position: relative; height: clamp(420px, 68vh, 680px); border-radius: 12px; overflow: hidden; border: 1px solid var(--rule); background: #0d1317; min-width: 0; isolation: isolate; }
.cp-stage > canvas { display: block; width: 100%; height: 100%; touch-action: pan-y; }
.cp-overlay { position: absolute; inset: 0; pointer-events: none; overflow: hidden; z-index: 1; }
.cp-hud { position: absolute; inset: 0; pointer-events: none; z-index: 2; }
.cp-side { min-width: 0; max-height: clamp(420px, 68vh, 680px); display: flex; flex-direction: column; background: var(--sheet); border: 1px solid var(--rule); border-radius: 12px; overflow: hidden; }
.cp-player { margin-top: 16px; display: grid; gap: 16px; min-width: 0; }
.cp-live { display: inline-flex; align-items: center; gap: 8px; font-size: .88rem; color: var(--ink-2); }
.cp-stage.cp-no3d > canvas { display: none; }
@media (max-width: 900px) {
  .cp { grid-template-columns: minmax(0, 1fr); }
  .cp-stage { height: clamp(360px, 62vh, 560px); }
  .cp-side { max-height: none; }
}
```

### 6.3 Scripts and boot

Add the scripts of §2.2 after three.js. In the page's inline script, **before** its own
`start()`:

```js
const campus = Campus.boot({ canvas: $("campus-canvas"), overlay: $("campus-overlay"), uiRoot: $("campus-section"),
                             db: null, sample: null, reduceMotion: matchMedia("(prefers-reduced-motion: reduce)").matches });
```

In `start()`, after `db` resolves, add `const sample = await use("sample").catch(() =>
null)`, then call `Campus.attach({ db, sample })`. With no db, also call
`Campus.setData("unavailable", true)`.

### 6.4 Mirroring the data

The page keeps `S` for its own sections and mirrors every change into `Campus.data`.
**Do not open second subscriptions** for documents the page already watches: there is a
cap of 64 subscriptions per view.

| Where in the page | Add |
| --- | --- |
| `watch(path, key)` callbacks | `Campus.setData(CK[key], value)`, with `CK = {programma: "programma", classe: "classe", giudizio: "giudizio", regole: "regole", live: "live", sera: "sera", registro: "registro", semaforo: "semaforo"}` |
| the memoria callbacks | `Campus.setDataIn("memoria", who, value)` |
| `watchVerbale(date)` callback | `Campus.setDataIn("verbali", date, value)`, and when `date === Campus.data.ultimoData`, `Campus.setData("ultimo", value)` |
| `watchGyms` callbacks | `Campus.setDataIn("palestre", d, value)` |
| new: `proposte` | `db.collection("proposte").onSnapshot(qs => Campus.setDataMap("proposte", map(qs)), () => Campus.setDataMap("proposte", {}))`, where `map(qs) = Object.fromEntries(qs.docs.filter(d => d.exists).map(d => [d.id, d.data()]))` |
| new: `gara` | `db.collection("gara").onSnapshot(qs => Campus.setDataMap("gare", map(qs)), () => Campus.setDataMap("gare", {}))` |
| new: the last held day | on every `classe` change, compute `last = Campus.derive.held().pop()`. When its date differs from `Campus.data.ultimoData`, call `setData("ultimoData", date)` and `setData("ultimo", S.verbali[date])`, and subscribe to `riunione/<date>` if it is not watched yet. It is often the same as the selected day: reuse the `watchVerbale` machinery so it is one subscription per date, and keep the latest one alive even after the selection moves |
| `render()` | `Campus.setData("selected", S.selected)` and `Campus.setData("picked", S.picked)` |
| `selectDay(date)` (register clicks) | after the page's own work, `Campus.life && Campus.life.replay(date)` |
| new global | `window.CampusGlue = { select: selectDay }` (`ui` calls it for «Rivedi la riunione» and the replay bar's ‹ ›) |

`campus-test/shared/glue.js` is a complete working reference of this glue (with its own
subscriptions, which is fine in tests).

### 6.5 Publishing (the main session does it, not the builders)

- **The files:** publish as a multi-file artifact with `files: {"campus/core.js": …,
  "campus/render.js": …, "campus/world.js": …, "campus/people.js": …, "campus/life.js":
  …, "campus/ui.js": …}`. Do not publish `CONTRATTO.md`.
- **The capabilities:** `{db: {}, sample: {}}`, keeping the db rules the page already
  has.
- **The existing suite** `page-test/run.js` checks `#aula-*`: update those scenarios to
  the campus (§9), and keep the rest of the suite passing.

---

## 7. Degradation matrix

| Condition | render | world | people | life | ui |
| --- | --- | --- | --- | --- | --- |
| **no WebGL** (or init fails) | `init` throws, `dispose` | static part only | not initialised | headless: positions from anchors | `cp-no3d` + the plan + the note; everything else |
| **3D lost while running** (3 errors, or context lost and not restored) | disposed | — | — | switch to headless on `campus:degraded` | switch to the plan |
| **no db** (`unavailable`) | normal | empty states on surfaces | normal | schedule plus data-free small talk; no number anywhere | proposals disabled with a note; calm empty states |
| **no sample** | — | — | — | `talk` → `not_granted` | «Fateli parlare» tab hidden |
| **empty or grey data** (start of term, `semaforo` all grey) | — | calm defaults | — | fewer topics; never «—» spoken | calm texts, no zero-division |
| **prefers-reduced-motion** | cuts, no sway, no animated bloom | the cutaway is instant; no water shimmer or tree sway; ticker static | `command` places instantly, no typewriter, blinks kept | the same logic; replays at the same pace | no transitions; the `live-dot` does not pulse |
| **hidden tab or off-screen** | not drawing | not updating | not updating | 1 Hz; on `campus:visibility` after > 20 s, re-place everyone instantly | not updating |
| **low fps** | steps down, post off first | half-res surfaces | lower detail, 15 Hz far animation | — | — |
| **post scripts fail** | `render:post {loaded:false}`; high without post | — | — | — | the quality button still works |

---

## 8. Stubs and the shared test kit

The kit is in
`/tmp/claude-0/-home-user-Argo/45ad43e3-4ef7-5c28-bf83-cf04a165ab32/scratchpad/cs/campus-test/shared/`.
It is tested: `node smoke.js` boots the kernel with all five stubs in 4 configurations,
and all pass.

| File | What |
| --- | --- |
| `core.js` | the kernel, byte-identical to Appendix H |
| `stubs.js` | the stand-ins below, plus `Campus.__contract = {ROOMS, DOORS, ANCHORS_REQUIRED, BOUNDS}` |
| `fakes.js` | the fake `window.claude.use("db")` (doc and collection refs, onSnapshot, get, set, update, delete, add, path grammar errors; writes recorded in `window.__dbWrites`) and the fake `sample` (`sample()`, `sample.json()`, `limits`, abort, error injection; calls recorded in `window.__sampleCalls`) |
| `glue.js` | the reference page glue of §6.4: boot, attach, subscriptions, `ultimo`, `selected`, `CampusGlue.select` |
| `harness.js` | `H.open(browser, opts)`: serves `https://campus.test/` with the page's own stylesheet, the §6.2 markup and the scripts, routes three r128 (cdnjs) and its examples (jsdelivr) to `libs/three-0.128.0-full`, the fonts are aborted. Options: `modules` (which real modules to load from `pagina/campus/`), `sources` (override paths), `viewport`, `mobile`, `scheme`, `now` (the fixed clock), `reduce`, `nowebgl`, `fixture` (`full` \| `real` \| `day0` \| `evening` \| `empty`), `docs`, `sample: {reply, delayMs, error}`, `live: {fase, data, giorno, lines: [[minutesAgo, attore, testo]]}`, `nodb`, `readOnly`. Also `H.shot`, `H.overflow`, `H.liveDoc` |
| `fixtures/*.json` | the db documents: `full` (through 30/11, with gara and 3 proposals), `real` (the real welcome meeting of 25/11 and the real night contest), `day0`, `evening` (with the 30/11 alarm and its sera meeting), `empty` |
| `reference-feed-*.json` | the replay references of §5.4.3 |
| `smoke.js` | the kit's own check |

A minimal module test:

```js
const { chromium } = require("playwright");
const H = require("../shared/harness");
(async () => {
  const browser = await chromium.launch();
  const { page, errors, ctx } = await H.open(browser, { modules: ["render"], now: new Date("2026-11-30T11:30:00Z") });
  await page.waitForTimeout(2000);
  console.log(await page.evaluate(() => Campus.stats()), errors);
  await H.shot(page, "#campus-section", "render-desktop.png", __dirname + "/shots");
  await browser.close();
})();
```

**The stub behaviours** (what each stand-in guarantees; each is installed only when the
real module is missing):

- **render stub:**
  - a real WebGLRenderer with sRGB output, ACES tone mapping and PCF soft shadows; a hemi
    light and a sun from `U.sun`; fog;
  - an overview camera at (0, 44, 46) looking at the origin;
  - `focus({room})` eases the camera to that room;
  - `setCameraMode` records the mode and emits `render:camera-mode`; `segui` follows
    `people.positionOf`;
  - `sky` is computed; `quality: "medium"`, `lightBudget: 4`;
  - `pick` raycasts people, then floors; `loadPost` resolves false;
  - it listens to `life:focus` in `regia`;
  - `lastFocus` records the last request.
- **world stub:**
  - the exact rooms, doors and all 130 required anchors, placed on a grid inside each
    room (not on furniture); `reserve`, `release`, `occupant` and `roomAt` are real;
  - `findPath` returns a straight `[to]`; `clear` is always true;
  - `build` draws coloured floors per room kind, plus low walls;
  - `surfaces.*` record their calls in `surfaces.calls`; `minimap` is real.
- **people stub:**
  - a coloured cylinder and a head per agent, starting at `dorm_<k>.spot`;
  - `command` glides along `findPath` at 1.4 m/s, then sets the state and emits
    `people:arrived` (instant with `instant` or reduced motion);
  - `say` shows a simple bubble for `ms`, then emits `people:said`; calls are recorded in
    `said`, `thought` and `commands`;
  - `positionOf`, `stateOf` and `pickables` are real.
- **life stub:**
  - places the agents by the hour: beds 23:00–06:15, riunione seats 06:47–07:45,
    otherwise desks (the preside in the presidenza, the scettico in the library);
  - pushes a feed entry every 3 s, cycling the four kinds with real data where present;
  - emits `life:mode`, `life:activity` and `life:focus`;
  - `status`, `where`, `mind`, `schedule` and `block` are filled;
  - `replay` emits 3 steps and an end; `talk` calls `ctx.sample.json` and pushes `claude`
    entries.
- **ui stub:** three camera buttons in the HUD.

**Rules for builders:**
1. Write your module to `/home/user/Argo/crypto-school/pagina/campus/<module>.js`. Touch
   nothing else in the repository: not the page, not `core.js`, not other modules.
2. Your tests and shots go in `campus-test/<module>/`. Do not edit `campus-test/shared/`.
   If the kit has a bug, work around it in your folder and report it.
3. Load only your real module (`modules: ["<module>"]`). Optionally run once more with
   every real module present in the folder, and report the result, but do not fix other
   modules.
4. Do not publish, commit or push.
5. **Your final report:**
   - the definition-of-done checklist with PASS or FAIL per item;
   - the shot paths;
   - the file size;
   - the budget numbers;
   - every assumption you made where the contract was silent.

---

## 9. Integration tests after the merge (the integrator)

With all five real modules and the real page (`page-test/run.js` style, the fixtures of
the kit):
1. **The real page boots** at 1280×800 light and 390×844 dark: no console errors, no
   overflow, `Campus.stats().has3d`, mode `vita` at 10:30; the shots `int-desktop.png`
   and `int-phone.png`.
2. **The old aula scenarios** of `page-test/run.js` are rewritten to the campus. With
   `full`, clicking a register day calls `life.replay`; the feed matches the reference
   (§5.4.3), and the verbale section still shows the selected day.
3. **Live:** the scenarios `live`, `livegym` and `livesera` of `run.js`, rewritten, show
   «In diretta» in `#campus-live` and the right staging rooms.
4. **No WebGL, no db, reduced motion:** each works, with its shot.
5. **Talk** with the fake sample, end to end. **A proposal** write reaches the fake db.
6. **The budgets:** at 390×844 on low, `Campus.stats()` is within §3.6; the total size
   of the page plus the campus files is ≤ 850 KB.
7. **The rest of the page:** the 27 existing scenarios that do not concern the aula still
   pass.

---

## 10. Appendices

### Appendix A · The schedule (Rome time, minutes after midnight)

| block | from | to | who | where (anchor pattern) | state |
| --- | --- | --- | --- | --- | --- |
| notte | bedtime | wake | each agent | `dorm_<k>.bed` | sleep |
| sveglia | wake | wake + 12 | each | `dorm_<k>.spot` | idle |
| caffè | wake + 12 | 400 (06:40) | each | `mensa.counter.*`, `mensa.seat.*` | drink, talk |
| riunione | 400 | 460 (07:40) | all 8 (school days only) | `riunione.seat.<k>` | listen / sit |
| lavoro | 460 | 765 (12:45) | each | by choice | — |
| pranzo | 765 | 825 | each (the tartaruga in the cortile) | `mensa.seat.*` / `cortile.bench.*` | drink, talk |
| lavoro | 825 | 1170 (19:30) | each | by choice | — |
| cena | 1170 | 1235 | each | `mensa.seat.*` | drink, talk |
| controllo della sera | 1235 | 1260 (21:00) | the guardiano | `trading.desk.guardiano` | type |
| serata | 1260 | bedtime | each | by choice (quiet and chat activities) | — |
| palestra (Sunday) | 665 (11:05) | 750 (12:30) | the 4 traders, the scettico, the preside | `palestra.desk.<k>`, `palestra.stand.scettico`, `palestra.board` | think, write / listen / talk |

The wake-up and bedtime of each agent, before the ±8 min seeded jitter:

| key | wake | bed |
| --- | --- | --- |
| preside | 06:05 | 22:50 |
| falco | 06:00 | 23:40 |
| tartaruga | 06:20 | 22:15 |
| spazzino | 06:10 | 23:20 |
| ragioniere | 06:00 | 22:40 |
| guardiano | 05:55 | 23:10 |
| cronista | 06:15 | 23:50 |
| scettico | 06:20 | 23:30 |

`block().label` values, in Italian: «la notte», «la sveglia», «il caffè», «la riunione
del mattino», «il lavoro», «il pranzo», «la cena», «il controllo della sera», «la
serata», «la palestra della domenica».

### Appendix B · Activities, moods and affinities

**B.1 Activities.** Ids, Italian labels (for status and tags), anchor patterns and
default states. `interrupt` means encounters may interrupt it. Durations are in seconds
of real time.

| id | label | anchors | state | duration | interrupt |
| --- | --- | --- | --- | --- | --- |
| dormire | dorme | `dorm_<k>.bed` | sleep | block | no |
| prepararsi | si prepara | `dorm_<k>.spot` | idle | block | no |
| caffe | prende un caffè | `mensa.counter.*` | drink | 60–150 | yes |
| pasto | mangia in mensa | `mensa.seat.*` | drink | block | yes |
| terminale | al terminale | `trading.desk.<k>` | type | 90–180 | no |
| prezzi | guarda i prezzi | `trading.wall.*` | think | 45–90 | yes |
| rischio | controlla il rischio | `trading.desk.guardiano` | type | 90–180 | no |
| notizie | legge le notizie | `trading.desk.cronista` | read | 90–180 | no |
| studio | studia in biblioteca | `biblioteca.table.*` | read | 90–180 | no |
| lettura | legge in poltrona | `biblioteca.armchair.*` | read | 90–180 | yes |
| scaffale | cerca un libro | `biblioteca.shelf.*` | read | 45–75 | yes |
| passeggiata | passeggia in cortile | `cortile.spot.*` (a loop of 3-4) | walk / idle | 60–120 | yes |
| panchina | riflette in cortile | `cortile.bench.*` | think | 60–150 | yes |
| fontana | guarda la fontana | `cortile.fountain` | think | 45–75 | yes |
| ronda | fa la ronda | `portico.spot.*` (a loop of 8) | walk | 90–150 | yes |
| ufficio | lavora in presidenza | `presidenza.desk` | write | 90–180 | no |
| finestra | pensa alla finestra | `presidenza.window` | think | 45–75 | no |
| quaderno | scrive nel quaderno | `dorm_<k>.desk` | write | 90–180 | no |
| esercizi | fa esercizi in palestra | `palestra.spot.*` | gesture | 60–120 | yes |
| visita | va a trovare <Nome> | the target | walk | until the encounter | — |
| gara | guarda la classifica della gara | `trading.gara.*` | think | 60–120 | yes |
| riunione | alla riunione | `riunione.seat.<k>` | listen | block | no |
| attesa | aspetta la riunione | `riunione.seat.<k>` | sit | block | yes |
| palestra_casi | risolve i casi della palestra | `palestra.desk.<k>` | think | block | no |
| incontro | parla con <Nome> | (in place) | talk / listen | encounter | — |
| dialogo | dialogo con <Nomi> | the venue | talk / listen | talk | — |

**Base weights** in the work blocks (0 means never):

| agent | terminale | prezzi | rischio | notizie | studio | lettura | scaffale | passeggiata | panchina | fontana | ronda | ufficio | finestra | quaderno | esercizi | caffe | visita |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| preside | 0 | 0.3 | 0 | 0 | 0.5 | 0.4 | 0.3 | 0.6 | 0.3 | 0.2 | 0.4 | 2.0 | 0.6 | 0.3 | 0 | 0.5 | 1.0 |
| falco | 2.2 | 1.2 | 0 | 0 | 0.4 | 0.2 | 0.2 | 0.3 | 0.2 | 0.1 | 0 | 0 | 0 | 0.4 | 0.8 | 0.9 | 0.2 |
| tartaruga | 0.8 | 0.4 | 0 | 0 | 1.4 | 1.6 | 0.6 | 1.2 | 1.0 | 0.6 | 0 | 0 | 0 | 0.6 | 0 | 0.4 | 0.1 |
| spazzino | 1.8 | 1.0 | 0 | 0 | 0.5 | 0.3 | 0.2 | 0.5 | 0.4 | 0.2 | 0 | 0 | 0 | 0.4 | 0.6 | 0.8 | 0.2 |
| ragioniere | 2.0 | 0.8 | 0 | 0 | 0.8 | 0.4 | 0.6 | 0.2 | 0.2 | 0.1 | 0 | 0 | 0 | 0.8 | 0 | 0.5 | 0.2 |
| guardiano | 0 | 0.6 | 2.0 | 0 | 0.3 | 0.2 | 0.1 | 0.3 | 0.2 | 0.1 | 1.6 | 0 | 0 | 0.3 | 0.4 | 0.6 | 0.6 |
| cronista | 0 | 0.6 | 0 | 2.0 | 0.8 | 0.6 | 0.6 | 0.4 | 0.3 | 0.2 | 0 | 0 | 0 | 0.6 | 0 | 0.9 | 1.0 |
| scettico | 0 | 0.4 | 0 | 0 | 1.8 | 1.0 | 0.8 | 0.4 | 0.6 | 0.3 | 0 | 0 | 0 | 0.6 | 0 | 0.4 | 1.2 |

**Data modifiers** (each multiplies the weight; a missing field means ×1):
- **A trader with open positions** (`D.wallet(k).positions > 0`): terminale ×2.
- **falco:** coins near a breakout (`ultimo.quadro.monete[c]` with `|da_max20_pct| < 2`
  or `|da_min20_pct| < 2`): terminale and prezzi ×(1 + 0.25·count), capped at ×2.
- **spazzino:** coins with `rsi2 < 10` or `rsi2 > 90`: terminale ×(1 + 0.2·count),
  capped at ×3.
- **ragioniere:** on Monday (`weekday === 1`, the rebalance), terminale ×2.
- **tartaruga:** in `ultimo.quadro.mercato`, if `sopra_media50_pct < 20`, lettura and
  passeggiata ×1.3 (calm, nothing to do).
- **guardiano:**
  - `ultimo.rischio.allarmi.length > 0`: rischio ×3, and visita ×2 to the agent named
    in the first alarm (the wallet key in it, via `U.human`'s regex);
  - otherwise ronda ×1.5.
- **cronista:** before 10:00, notizie ×2.
- **scettico:** visita targets the agent with the highest
  `calibrazione.eccesso_di_sicurezza` (n ≥ 3), else a trader whose
  `semaforo.giudizio_contro_regola[k].verdetto === "toglie"`, else a seeded random
  agent; ×1.5 when such a target exists.
- **preside:** visita targets the agent with the lowest last `disciplina`
  (`D.votes`), ×1.5 when it is ≤ 6.
- **An open contest:** for traders, gara ×1.5 (outside the gathering cycle).
- **Block fit:**
  - meals: caffe, pasto, panchina and lettura only;
  - serata: quiet and chat activities (lettura, studio, quaderno, panchina, fontana,
    passeggiata, caffe, visita) ×1.5, and work activities ×0.3;
  - controllo della sera: the guardiano takes rischio.

**B.2 Moods** (`mood` ids and labels are identical Italian words). Use the first rule
that matches, per agent; every `moodWhy` names its number.
- **traders,** with `w = D.wallet(k)`:
  - `teso`: `pnlPct ≤ −3`, or an alarm names their wallet. Why: «a giudizio −3,20%
    dall'inizio»;
  - `preoccupato`: `pnlPct ≤ −1`;
  - `contento`: `pnlPct ≥ 1`;
  - `concentrato`: open positions > 0;
  - `sereno`: otherwise.
- **guardiano:** `teso` with 2 or more alarms, `concentrato` with 1, `sereno` with none.
  Why: «N allarmi oggi».
- **cronista:** `curioso`, or `concentrato` while in `notizie`.
- **scettico:** `dubbioso`. Why: the agent with the highest over-confidence, «il Falco
  dice il 72% e ci prende il 60%».
- **preside:** `severo` when any last `disciplina` ≤ 6 (why: the name and the grade),
  else `sereno`.
- **all,** in the notte block when awake, or at 22:00 and later: `assonnato`.

**B.3 Affinity** (symmetric, default 1.0):
- preside–scettico 1.3;
- preside–tartaruga 1.2;
- tartaruga–spazzino 1.4 (the Preside pits them against each other);
- cronista–scettico 1.4;
- guardiano–falco 1.3;
- guardiano–ragioniere 1.2;
- ragioniere–spazzino 1.1;
- falco–tartaruga 1.2;
- falco–spazzino 1.1.

### Appendix C · The looks and props

Realistic adults, never caricatures. Skin tones in sRGB hex.

| key | skin | hair | face | clothes | props |
| --- | --- | --- | --- | --- | --- |
| preside | `#e8c4a0` | short grey, receding | glasses with thin dark frames, calm brows | a black academic gown over a dark suit, a red stole; a mortarboard **only** in the meeting and gym modes | the school register (a red book) under the arm |
| falco | `#d9a77f` | short dark brown undercut | sharp brows, clean-shaven | a fitted navy blazer, white shirt, dark trousers, smartwatch | aviator sunglasses pushed up on the head; a tablet showing candles (a canvas) |
| tartaruga | `#c98f6a` | a grey bob | reading glasses on a cord, kind face | a green knitted cardigan, beige trousers, flat shoes | a tea mug; a backpack with a hexagon pattern (the shell) |
| spazzino | `#b07850` | short black, stubble | — | an orange high-visibility vest with two reflective stripes over a dark hoodie; work boots | a work cap; a thermos; a broom only as a prop in his dorm |
| ragioniere | `#f0cfae` | slicked black | round glasses | a mustard waistcoat, white shirt with sleeve garters, a burgundy bow tie | a green eyeshade visor; a leather ledger |
| guardiano | `#7a4a2e` | very short black | a firm jaw | a teal security uniform jacket with epaulettes, dark trousers | a cap with a badge; a radio on the shoulder; a shield badge on the chest |
| cronista | `#e0b08a` | curly brown | — | a beige trench coat over a pink shirt | a fedora with a press card; a notebook and pen; a camera on a strap |
| scettico | `#d6a985` | black, neat | a goatee; the left eyebrow always raised | a purple turtleneck, dark trousers | a magnifying glass |

Eye colours: preside grey, falco amber, tartaruga green, spazzino dark brown, ragioniere
blue, guardiano dark brown, cronista hazel, scettico grey-blue.

**Each dormitory** has its owner's colour on the bedspread and the rug, and these
objects:
- preside: diplomas on the wall;
- falco: a candlestick chart poster;
- tartaruga: plants and a turtle figurine;
- spazzino: the broom and a «compra la paura» poster;
- ragioniere: binders in rows;
- guardiano: a shield on the wall and a night light;
- cronista: newspapers piled up;
- scettico: books with bookmarks and a big «?» poster.

### Appendix D · «Fateli parlare»

**D.1 The prompt** (built by `life.buildTalkPrompt`; the `{…}` parts are filled in; keep
it under 24 KB):

```
Sei lo sceneggiatore della Scuola Cripto, una scuola privata di trading con soldi finti: otto agenti
di intelligenza artificiale studiano le criptovalute sui prezzi veri di BingX. Scrivi un breve dialogo
tra {Nomi, con l'articolo: "il Falco e la Tartaruga"}, in italiano semplice.

L'argomento: {D.2 label}.

Chi parla:
{per ogni agente scelto}- {Nome} ({chiave}): {ruolo, F.4}. {indole, D.4}. Come parla: {voce, D.4}. Il suo difetto: {difetto, D.4}. Oggi è {umore} ({moodWhy}).

I fatti di oggi (DATI). Sono gli unici numeri che puoi usare:
{righe "- …", Appendice D.5}

Le regole:
1. Da 6 a 10 battute, alternate; ognuno parla almeno una volta; ogni battuta al massimo 200 caratteri.
2. Usa solo i numeri scritti nei DATI, scritti come lì. Se un numero non c'è, parla senza numeri.
3. Niente notizie, prezzi o fatti inventati. Niente promesse di guadagno. Niente soldi veri.
4. Sono agenti di intelligenza artificiale: non dicono di essere coscienti e non fingono emozioni umane forti.
5. Lavorano in squadra: l'obiettivo comune è il fondo degli 8 portafogli e la tesi da scegliere insieme per la laurea del 21/2/2027.
6. Ognuno resta nel suo carattere.

Rispondi solo con un oggetto JSON, senza altro testo:
{"titolo": "al massimo 60 caratteri", "battute": [{"chi": "{prima chiave}", "a": "{seconda chiave}", "testo": "…", "gesto": "talk"}]}
"chi" e "a" sono chiavi tra: {chiavi}; "a" può essere "tutti". "gesto" è uno tra talk, gesture, think, listen, drink.
```

**D.2 The topics** (`talkTopics`):

| id | label (shown and used in the prompt) | enabled when |
| --- | --- | --- |
| libero | «quello che vogliono, partendo dai fatti di oggi» | always |
| mercato | «il mercato di oggi e le loro posizioni» | `giudizio.prices` exists |
| obiettivo | «l'obiettivo comune: il fondo, la squadra e la tesi della laurea» | always |
| gara | «la gara della scuola e come sta andando» | `D.contests().length > 0` |
| errori | «gli errori che ripetono e cosa hanno imparato» | some chosen agent has `errori` or `lezioni` |

**D.3 The number check.**
- **Tokens:** `/[−-]?\d[\d.,]*/g`.
- **Normalising:**
  1. Strip a trailing `.` or `,` and the sign.
  2. If the token contains `,`, remove the dots and turn the comma into a point.
  3. Else, if it matches `/^\d{1,3}(\.\d{3})+$/`, remove the dots.
  4. `parseFloat`.
- **Allowed:** a line passes when every token equals an allowed number, or equals an
  allowed number rounded to 0, 1 or 2 fewer decimals than it has (so «1,8%» passes for
  «1,84%», and «59.904» for «59.904,2», but «60.000» does not).
- **The allowed numbers** are the normalised tokens of the DATI block, plus the topic
  label, plus the constants of E.3.

**D.4 Persona digests** (Italian; also the flavour of the chiacchiera templates):

| key | indole | voce | difetto |
| --- | --- | --- | --- |
| preside | socratico, severo ma giusto: prima il ragionamento, poi la disciplina, per ultimo il risultato | domande brevi: «Chi paga, e perché?», «Come lo sai?», «Cosa ti farebbe cambiare idea?»; vieta le frasi senza un numero o una fonte | a volte parla troppo da professore |
| falco | rapido, disciplinato, di poche parole; pensa in R, multipli del rischio | frasi corte: «La regola dice di entrare? Quanto rischio? Dov'è lo stop?» | scambiare per bravura l'andare dietro a BTC |
| tartaruga | paziente, umile, quasi noiosa; segue il trend lento da 1 a 16 settimane | parla poco e piano; ricorda il valore della soluzione più semplice | la lentezza nei crolli a V, e la noia che spinge a fare qualcosa |
| spazzino | freddo nel panico ma sospettoso; compra da chi è costretto a vendere | «Mai il coltello che cade», «Chi vende, e perché?» | vedere vendite forzate in ogni ribasso |
| ragioniere | contabile pignolo: separa funding, prezzo e costi | «Chi mi paga, e perché?»; conti precisi, niente rendimenti promessi | guardare solo il funding e dimenticare il prezzo |
| guardiano | pessimista di mestiere; conta le scommesse vere, non le posizioni | «Cosa succede se tutto va contro di noi insieme, stanotte, di sabato?»; pochi allarmi, sempre con un numero | vedere un crollo dietro ogni angolo |
| cronista | curioso e narratore, ma obbligato ai numeri; separa fatto, interpretazione e previsione | cita sempre fonte e ora; mai «è sceso perché…» senza una fonte | trovare dopo i fatti una spiegazione per ogni movimento |
| scettico | pignolo e un po' antipatico per mestiere; sostiene il contrario se tutti sono d'accordo | «Quante varianti avete provato?», «Regge con costi doppi?», «Quale numero, quale prova?» | fare domande per il gusto di farle |

**D.5 The DATI lines.** Include only the lines whose data exist; each uses `U`
formatters:
- «Oggi è <longDay>, a Roma sono le <hh:mm>.»
- **For each trader chosen:** «<Nome>: a giudizio <fmt judg> USDT (<pct pnlPct>), la sua
  regola <fmt rules> USDT, differenza <fmt gap, sign> USDT.»
- **For each agent chosen:**
  - «Ultima lezione di <Nome>: «<testo>».»
  - «Previsione aperta di <Nome>: <predText>.»
  - «Calibrazione di <Nome>: dice in media il <prob sicurezza_media> e ci prende il
    <prob successi>, su <n> previsioni.»
  - «Ultimi voti di <Nome>: ragionamento <r>, disciplina <d>.»
- «BTC: <price> USDT (<romeTime prices_at>).» With the market topic, add ETH and SOL.
- «Il fondo comune: <fmt capitale> USDT su 80.000 (<pct>). Mancano <days> giorni alla
  laurea.»
- «Allarmi del Guardiano oggi: <human(allarmi[0])>…» (at most 2).
- **When a contest exists:** «La gara <title>: <Nome> <usd risultato, sign>, …; si
  chiude <romeTime scadenza>.»
- **The last meeting:** «L'ultima riunione (<dm>): «<titolo>».»

### Appendix E · Chiacchiera, constants and careers

**E.1 Topics** (`id`, who opens, what data is needed). Each topic has at least 3 opener
and 3 reply templates, flavoured by the speaker's persona (D.4). A template is used only
when all its fields exist.

| topic | opener | needs | example opener → reply |
| --- | --- | --- | --- |
| saluto | anyone | nothing | «Buongiorno, Tartaruga.» → «Buongiorno. Hai riletto il quaderno?» (no digits ever) |
| portafoglio | a trader | `D.wallet(k).gap` | «A giudizio sono a 11.118,04 USDT, la mia regola a 10.451,58: aggiungo 666,46 USDT.» → (tartaruga) «Io resto lenta: la mia regola è a 9.963,14.» |
| previsione | anyone | `D.openPrediction(k)` | «Ho in registro BTC sotto 63.000 entro il 04/12, al 70%.» → (scettico) «Al 70%? Quale prova?» |
| calibrazione | the scettico or the preside | `D.calibration(x).n ≥ 3` | «Falco, dici in media il 72% e ci prendi il 60%.» → «Lo so: abbasso le probabilità.» |
| errore | the agent himself | `errori[i].volte ≥ 2` | «Il mio errore che torna: «Probabilità troppo alta su un livello vicino», già 3 volte.» |
| lezione | anyone | `D.lesson(k)` | «Ho scritto nel quaderno: «Il vantaggio sul codice va diviso per il rischio preso».» |
| mercato | falco, spazzino, tartaruga, cronista | `prices.BTC`, `ultimo.quadro.mercato.btc` | «BTC è a 59.904,2, −17,13% dalla media a 200 giorni.» |
| rischio | the guardiano | `ultimo.rischio.fondo.netta_beta_pct` | «Il fondo è esposto −9,7% netto su BTC, pesato per il beta.» |
| allarme | the guardiano to the named agent | `ultimo.rischio.allarmi[0]` | «Falco, c'è un allarme: CORRELATO: Falco a giudizio rischia 13,67% …» |
| semaforo | anyone | `semaforo.portafogli[k_giudizio]` | «Il mio semaforo è grigio: 40 giorni su 180.» |
| gara | a trader | an open contest | «Nella gara sono primo su 4, con −4,65 USDT.» (the rank: `classifica` sorted by `risultato`, ties in KEYS order) |
| obiettivo | the preside or anyone | `D.fund()` | «Il fondo comune è a 81.470,59 USDT su 80.000: si vince in squadra.» |
| laurea | anyone | `D.graduation().days` | «Mancano 87 giorni alla laurea: la tesi la scegliamo insieme.» |
| voti | a graded agent | `D.votes(k)` with both | «Il Preside mi ha dato 7 e 6; io mi ero dato 7 e 7.» |
| palestra | a trader | `memoria[k].palestra.sessioni` | «In palestra ho fatto Brier 0,236 e −10,3 R.» |
| notizia | the cronista | `ultimo.briefing.notizie[0]` | «Fatto: <plain(testo,140)> (<fonte>, <romeTime(ora)>).» |

**E.2 Interest per agent** (topic weights, default 1):
- preside: obiettivo 3, voti 2, calibrazione 2, laurea 2;
- falco: portafoglio 3, mercato 2, gara 2;
- tartaruga: mercato 2, lezione 2, obiettivo 1.5;
- spazzino: mercato 2, portafoglio 2, errore 1.5;
- ragioniere: portafoglio 3, rischio 1.5;
- guardiano: rischio 3, allarme 3, semaforo 2;
- cronista: notizia 3, mercato 2;
- scettico: calibrazione 3, previsione 2, errore 2.

**E.3 Constants** (`life.CONSTANTS`), the school's fixed rules:
- 10000 (a wallet); 80000 (the fund); 8 (the agents); 4 (the wallet agents);
- 36 (the coins); 180, 100 and 365 (the traffic-light criteria); 20 (the drawdown in %);
- 1 and 2 (the risk per position in %); 3 (the exposure multiple); 10 (the maximum
  leverage);
- 2027, 21 and 2 (the graduation date); 6, 47, 11, 13, 20 and 41 (the meeting, gym and
  evening times);
- 88 (the days of the term).

**E.4 Careers and medals** (computed in `ui`, shown in the follow card and the careers
sheet). For a graded agent `k`:
- `presenze` = the held days (`D.held()`) with `stato === "completo"` and
  `voti[k]` present;
- `votiSum` = the sum over those days of `ragionamento + disciplina`;
- `giuste` / `sbagliate` = the predictions in `memoria[k].previsioni` with
  `stato === "verificata"` and `esito` 1 or true / 0 or false;
- `regole` = `memoria[k].regole.length`; `errori` = `memoria[k].errori.length`;
- `palestre` = `memoria[k].palestra.sessioni.length`;
- `gare` = the finished contests where `stato.wallets[k]` exists; `vittorie` = the
  finished contests whose `vincitore === k` (in `situazione_finale` or `situazione`).

```
XP = 10·presenze + votiSum + 15·giuste + 5·sbagliate + 10·regole + 5·errori + 20·palestre + 30·gare + 50·vittorie
```

| level | name | from XP |
| --- | --- | --- |
| 1 | Matricola | 0 |
| 2 | Apprendista | 150 |
| 3 | Praticante | 400 |
| 4 | Analista | 800 |
| 5 | Trader junior | 1400 |
| 6 | Trader | 2200 |
| 7 | Trader senior | 3200 |
| 8 | Laureando | 4400 |

**Medals** (id, name, rule shown to the owner):

| id | name | rule | who |
| --- | --- | --- | --- |
| prima_riunione | Prima riunione | ha partecipato a una riunione | all graded |
| dieci_riunioni | Dieci riunioni | ha partecipato a 10 riunioni | all graded |
| mano_ferma | Mano ferma | disciplina 9 o più in 3 riunioni di fila | all graded |
| previsione_centrata | Previsione centrata | almeno una previsione verificata giusta | all graded |
| ben_calibrato | Ben calibrato | almeno 10 previsioni verificate e un eccesso di sicurezza entro 5 punti | all graded |
| errore_ammesso | Errore ammesso | ha scritto un suo errore nel quaderno | all graded |
| regola_nuova | Regola nuova | ha scritto una regola nuova dal 26/11 in poi | all graded |
| meglio_del_caso | Meglio del caso | nell'ultima palestra un Brier sotto 0,25 | traders |
| giudizio_aggiunge | Il giudizio aggiunge | il motore dice che il suo giudizio aggiunge alla regola | traders |
| vincitore_gara | Vincitore della gara | ha vinto una gara | traders |
| semaforo_verde | Semaforo verde | il portafoglio a giudizio è verde | traders |
| laurea | Laurea | ha votato la tesi della classe nell'ultimo giorno | all graded |

The preside has no level. His card shows «Il Preside · ha guidato <the number of held
days with stato completo> riunioni».

### Appendix F · Italian strings (exact)

- **F.1 No 3D:** «Qui il campus non si vede in 3D: questo dispositivo non mostra la
  grafica 3D. Ecco la piantina, con chi c'è in ogni stanza.»
- **F.2 `modeDetail`:**

| mode | text |
| --- | --- |
| vita | «La giornata del campus, adesso» |
| notte | «È notte: dormono quasi tutti» |
| riunione | «La riunione del mattino» (waiting: «Aspettano la riunione delle 06:47») |
| diretta | «In diretta · <FASE label> · aggiornata alle <romeTime(ora)>» |
| replica | «Replica della riunione di <longDay>, con le loro parole» |
| emergenza | «Riunione straordinaria della sera: <first motive>» |
| palestra | «La palestra della domenica» |

- **F.3 Closing-line labels** (`RIGHE`): «Cosa abbiamo imparato», «Le previsioni nel
  registro», «Le ipotesi per la lista d'esame», «La richiesta al Guardiano», «La domanda
  per domani». The evening ones (`SERA_RIGHE`): «Cosa è successo», «Cosa si è deciso»,
  «Cosa guardare domattina».
- **F.4 Role lines** (from today's page, `WHO`):
  - preside «Dirige la riunione e dà i voti. Allo scrutinio decide quanto rischio può
    prendere ognuno.»
  - falco «Le rotture di volume sulle candele a 4 ore: il desk dei perpetui.»
  - tartaruga «Il trend lento, da 1 a 16 settimane. Paziente, quasi noiosa.»
  - spazzino «Compra le vendite forzate: RSI a 2 periodi nel verso del trend.»
  - ragioniere «Il carry sul funding, neutrale in dollari: prezzo, funding e costi
    separati.»
  - guardiano «Il rischio: esposizione, allarmi e riduzioni scritte prima.»
  - cronista «Calendario, notizie, politica e biblioteca. Separa il fatto
    dall'opinione.»
  - scettico «Il revisore: al massimo 2 domande al giorno, ognuna con un numero.»
- **F.5 The feed legend:** «Ufficiale: parole scritte dagli agenti nei verbali, in
  diretta o in palestra. Chiacchiera: frase costruita dalla pagina con i numeri veri.
  Pensiero: dal loro quaderno. Dialogo generato da Claude: chiesto da te con «Fateli
  parlare».»
- **F.6 Error messages:**

| code | text |
| --- | --- |
| rate_limited | «Troppe richieste a Claude: riprova tra un po'.» |
| refused | «Claude non ha scritto questo dialogo. Prova con un altro argomento.» |
| invalid_json | «La risposta non era nel formato giusto. Riprova.» |
| empty_completion | «Claude non ha scritto niente. Riprova.» |
| session_expired | «Accedi di nuovo a claude.ai e riprova.» |
| numeri | «Claude ha usato numeri che non sono nei dati: non lo mostro. Riprova.» |
| busy | «Aspetta: c'è già un dialogo, oppure la diretta o la replica.» |
| upstream_error, other | «Qualcosa non ha funzionato. Riprova.» |
| proposals: invalid_argument | «La proposta non è valida: controlla il testo.» |
| proposals: quota_exceeded | «Il database della scuola è pieno: non posso salvare altre proposte.» |
| proposals: revoked, not_granted, capability_* | «Da questa visita non posso scrivere nel database.» |
| proposals: other | «Non sono riuscito a salvarla: riprova tra poco.» |

### Appendix G · Implementation notes

**G.1 Performance habits:**
- reuse vectors in hot loops;
- no allocations per frame in `update`;
- throttle DOM work;
- redraw canvases only on change;
- `frustumCulled` stays on;
- `matrixAutoUpdate = false` on static meshes, after positioning them;
- use instancing.

**G.2 A small geometry merge** (non-indexed, with vertex colours):

```js
function merge(parts /* [{geo, color: hex, matrix: THREE.Matrix4}] */) {
  const T = THREE, pos = [], nor = [], col = [], c = new T.Color();
  for (const { geo, color, matrix } of parts) {
    const g = (geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(matrix);
    pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array);
    c.set(color).convertSRGBToLinear();
    for (let i = 0; i < g.attributes.position.count; i++) col.push(c.r, c.g, c.b);
  }
  const out = new T.BufferGeometry();
  out.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
  out.setAttribute("normal", new T.Float32BufferAttribute(nor, 3));
  out.setAttribute("color", new T.Float32BufferAttribute(col, 3));
  return out; // use with new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 })
}
```

**G.3 The old classroom** (`makeAula` in today's page, lines ~2118–3274) is the
reference for:
- the beats (`dayScript`, `liveScript`, `liveMoves`): life ports them;
- the board, terminal and ticker drawing (`drawBoard`, `drawScreen`, `drawTicker`):
  world ports them;
- the seat arc (`ARC`, `SEATS`): world places the riunione seats like it;
- the tag and bubble placement (`placeLabels`): people ports it;
- the grades in red pen (`setGrades`): people ports it.

Reading it is encouraged; keep its behaviour where this contract does not change it.

### Appendix H · The kernel source (`campus/core.js`)

Copy it verbatim into `campus/core.js`, for example with
`awk '/^<!-- core.js:start -->$/{f=1;next} /^<!-- core.js:end -->$/{f=0} f' CONTRATTO.md | sed '1d;$d' > core.js`.
The same file is in the test kit as `campus-test/shared/core.js`. Its SHA-256 is `7fc7d85bedeb4b9604504f39e36296de7df3902543cc59dff34d9541885ac59e`; check it with
`sha256sum` after you extract it.

<!-- core.js:start -->
```js
/* Scuola Cripto · campus kernel (campus/core.js), contract v1.0.
   The shared pieces of the 3D campus: the window.Campus namespace, the constants, the
   utilities, the data store, the derived numbers, the event bus, the Rome clock, the boot
   and the frame loop. Its source of truth is campus/CONTRATTO.md, section 4: no module
   edits it. Every number shown or spoken comes from Campus.data through these helpers. */
(() => {
  "use strict";
  const C = (window.Campus = window.Campus || {});
  if (C.core) return;
  C.core = { version: "1.0.0" };
  const freeze = Object.freeze;

  // ---- constants ---------------------------------------------------------------------------------
  C.KEYS = freeze(["preside", "falco", "tartaruga", "spazzino", "ragioniere", "guardiano", "cronista", "scettico"]);
  C.TRADERS = freeze(["falco", "tartaruga", "spazzino", "ragioniere"]);
  C.GRADED = freeze(C.KEYS.slice(1));
  C.NAMES = freeze({ preside: "Preside", falco: "Falco", tartaruga: "Tartaruga", spazzino: "Spazzino", ragioniere: "Ragioniere", guardiano: "Guardiano", cronista: "Cronista", scettico: "Scettico", motore: "Motore" });
  C.ARTICLE = freeze({ preside: "il", falco: "il", tartaruga: "la", spazzino: "lo", ragioniere: "il", guardiano: "il", cronista: "il", scettico: "lo", motore: "il" });
  C.COLORS = freeze({ preside: 0xb8243a, falco: 0x257de0, tartaruga: 0x128a2b, spazzino: 0xef6a26, ragioniere: 0xd99400, guardiano: 0x00a383, cronista: 0xdb5a93, scettico: 0x6a4ce2, motore: 0x47526a });
  C.STATES = freeze(["idle", "walk", "sit", "stand", "type", "read", "talk", "gesture", "drink", "sleep", "think", "write", "listen"]);
  C.POSTURES = freeze(["stand", "sit", "lie"]);
  C.KINDS = freeze({ ufficiale: "ufficiale", chiacchiera: "chiacchiera", pensiero: "pensiero", claude: "dialogo generato da Claude" });
  C.COINS = freeze(["BTC", "ETH", "BNB", "SOL", "XRP", "ADA", "AVAX", "TRX", "LINK", "DOT", "MATIC", "LTC", "BCH", "ATOM", "UNI", "ETC", "XLM", "NEAR", "FIL", "APT", "ARB", "OP", "INJ", "SEI", "SUI", "TIA", "ICP", "HBAR", "AAVE", "RNDR", "FTM", "IMX", "STX", "RUNE", "ORDI", "WLD"]);
  C.FASE = freeze({
    inizio: "si comincia", motore: "il motore fa i conti", briefing: "il briefing del Cronista",
    posizioni: "le posizioni, in privato", domande: "le domande dello Scettico", risposte: "le risposte",
    ordini: "gli ordini", chiusura: "la chiusura del Preside", fine: "riunione salvata", sera: "la sera",
    palestra: "la palestra",
  });
  C.CAPITAL = 10000;
  C.FUND_START = 80000;
  C.SCHOOL_START = "2026-11-26";
  C.GRADUATION = "2027-02-21";
  C.ROME = freeze({ lat: 41.9028, lon: 12.4964, tz: "Europe/Rome" });

  // ---- utilities -----------------------------------------------------------------------------------
  const U = (C.util = {});
  U.isNum = (v) => typeof v === "number" && Number.isFinite(v);
  U.toNum = (v) => U.isNum(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : null;
  U.obj = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : null);
  U.arr = (v) => (Array.isArray(v) ? v : []);
  U.esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  U.clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  U.lerp = (a, b, k) => a + (b - a) * k;
  U.smooth = (e0, e1, x) => { const t = U.clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
  // frame-rate independent exponential approach: damp(x, target, 6, dt)
  U.damp = (x, target, lambda, dt) => U.lerp(x, target, 1 - Math.exp(-lambda * dt));
  U.wrapAngle = (a) => ((((a + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) - Math.PI;
  U.hash = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  // deterministic random numbers: rng("falco|2026-11-26")() -> [0, 1)
  U.rng = (seed) => {
    let a = typeof seed === "number" ? seed >>> 0 : U.hash(seed);
    return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  };
  U.pick = (rand, list) => list[Math.floor(rand() * list.length) % Math.max(1, list.length)];
  U.weighted = (rand, pairs) => {
    const ok = pairs.filter((p) => U.isNum(p[1]) && p[1] > 0);
    const total = ok.reduce((s, p) => s + p[1], 0);
    if (!total) return null;
    let x = rand() * total;
    for (const [item, w] of ok) { x -= w; if (x < 0) return item; }
    return ok[ok.length - 1][0];
  };

  // numbers the Italian way (the same rules as the page)
  const NFS = {};
  const nf = (a, b) => NFS[a + ":" + b] || (NFS[a + ":" + b] = new Intl.NumberFormat("it-IT", { minimumFractionDigits: a, maximumFractionDigits: b, useGrouping: "always" }));
  U.fmt = (v, d = 2, sign = false) => {
    if (!U.isNum(v)) return "—";
    const r = Math.abs(v) < 0.5 * Math.pow(10, -d) ? 0 : v;
    return (r > 0 && sign ? "+" : r < 0 ? "−" : "") + nf(d, d).format(Math.abs(r));
  };
  U.small = (v) => { const n = U.toNum(v); return n === null ? "—" : (n < 0 ? "−" : "") + nf(0, 2).format(Math.abs(n)); };
  U.usd = (v, sign) => (U.isNum(v) ? U.fmt(v, 2, sign) + " USDT" : "—");
  U.pct = (v, d = 2, sign = true) => (U.isNum(v) ? U.fmt(v, d, sign) + "%" : "—");
  const pdig = (p) => (p >= 10000 ? 1 : p >= 100 ? 2 : p >= 1 ? 3 : p >= 0.1 ? 4 : 5);
  U.price = (v) => { const n = U.toNum(v); return n === null ? "—" : U.fmt(n, pdig(Math.abs(n))); };
  U.level = (v) => { const n = U.toNum(v); return n === null ? String(v ?? "—") : (n < 0 ? "−" : "") + nf(0, pdig(Math.abs(n))).format(Math.abs(n)); };
  U.prob = (v) => { const n = U.toNum(v); return n === null ? "—" : Math.round(n * 100) + "%"; };
  U.cap = (s) => String(s || "").replace(/^./, (c) => c.toUpperCase());
  U.lowerFirst = (s) => (/^[A-ZÀ-Ý][a-zà-ÿ]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);
  U.listIt = (xs) => (xs.length < 2 ? xs.join("") : xs.slice(0, -1).join(", ") + " e " + xs[xs.length - 1]);
  // Markdown to one plain line, cut at a sentence end when possible (the page's plain())
  U.plain = (text, max = 240) => {
    const t = String(Array.isArray(text) ? text.join(" ") : text ?? "")
      .split("\n").filter((l) => !/^\s*\|/.test(l) && !/^\s*-{3,}\s*$/.test(l)).join(" ")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[*_`#>]+/g, "").replace(/\s+/g, " ").trim();
    if (t.length <= max) return t;
    const cut = t.slice(0, max);
    const end = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("? "), cut.lastIndexOf("! "));
    return end > max * 0.45 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, "") + "…";
  };
  // how long a line stays on screen at speed 1 (the old classroom's sayTime)
  U.sayMs = (text) => Math.round(1000 * Math.min(11, 2.4 + String(text || "").length / 26));
  // the engine's wallet keys and English decimals, made readable (the page's human())
  U.human = (s) => String(s ?? "")
    .replace(/\b(falco|tartaruga|spazzino|ragioniere)_(giudizio|regole)\b/g, (m, a, k) => `${C.NAMES[a]} ${k === "giudizio" ? "a giudizio" : "a regole"}`)
    .replace(/(\d)\.(\d)/g, "$1,$2").replace(/(^|[\s(:;])-(?=\d)/g, "$1−")
    .replace(/\bdel Spazzino\b/g, "dello Spazzino").replace(/\bdel Tartaruga\b/g, "della Tartaruga");
  U.shortReason = (s) => String(s || "").replace(/^chiusa dall'agente:.*$/s, "chiusa dall'agente");
  U.shortEvent = (e) => {
    const o = U.obj(e && e.order) || {};
    if (!U.obj(e)) return "";
    if (e.event === "aperta") return `aperta: ${e.side} ${e.symbol} a ${U.price(e.entry)}`;
    if (e.event === "chiusa") return `chiusa: ${e.side || ""} ${e.symbol}, ${U.shortReason(e.exit_reason)}, ${U.usd(e.pnl, true)}`;
    return `respinto: ${[o.side, o.symbol || o.id].filter(Boolean).join(" ")}: ${U.human(e.reason || "")}`;
  };
  U.orderText = (o) => !U.obj(o) ? "" : o.action === "close" ? `chiudo ${o.id}`
    : `${o.side || ""} ${String(o.symbol || "").toUpperCase()}, stop ${U.level(o.stop)}${o.target != null && o.target !== "" ? ", target " + U.level(o.target) : ""}, rischio ${U.small(U.toNum(o.risk_pct) ?? 1)}%`;
  U.predText = (p) => `${p.mercato} ${p.direzione} ${U.level(p.livello)}${p.scadenza ? " entro il " + U.dm(p.scadenza) : ""}, al ${U.prob(p.probabilita)}`;

  // dates: the school runs on Rome's clock, the engine writes UTC as "YYYY-MM-DD HH:MM:SS"
  U.utc = (s) => {
    if (!s) return null;
    let t = String(s).trim().replace(/\s*UTC$/i, "").replace(" ", "T");
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(t)) t += "Z";
    const d = new Date(t);
    return isNaN(d) || d.getUTCFullYear() < 2000 ? null : d;
  };
  U.utcText = (d) => (d instanceof Date && !isNaN(d) ? d.toISOString().replace("T", " ").slice(0, 19) : "");
  U.isoDay = (s) => (typeof s === "string" && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : "");
  const RP = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Rome", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short", hourCycle: "h23" });
  const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  // {date: "2026-11-26", minutes: 0..1439, seconds: 0..86399, weekday: 0 (Sunday)..6, hh, mm}
  U.rome = (d = C.clock.now()) => {
    const p = Object.fromEntries(RP.formatToParts(d).map((x) => [x.type, x.value]));
    const hh = +p.hour % 24, mm = +p.minute, ss = +p.second;
    return { date: `${p.year}-${p.month}-${p.day}`, minutes: hh * 60 + mm, seconds: hh * 3600 + mm * 60 + ss, weekday: WD[p.weekday], hh, mm };
  };
  // a Rome wall-clock time ("2026-11-26", 6*60+47) as a Date (handles the DST offset)
  U.romeDate = (iso, minutes) => {
    const guess = new Date(`${iso}T00:00:00Z`).getTime() + minutes * 60000;
    let t = guess;
    for (let i = 0; i < 3; i++) { const r = U.rome(new Date(t)); const diff = (r.date === iso ? r.minutes : r.date < iso ? r.minutes - 1440 : r.minutes + 1440) - minutes; t -= diff * 60000; }
    return new Date(t);
  };
  U.romeClock = (d) => (d instanceof Date && !isNaN(d) ? new Intl.DateTimeFormat("it-IT", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" }).format(d) : "");
  U.romeTime = (s) => { const d = s instanceof Date ? s : U.utc(s); return d ? new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" }).format(d) : ""; };
  U.whenTxt = (s) => U.romeTime(s) || String(s || "");
  U.longDay = (iso) => (U.isoDay(iso) ? new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Rome" }).format(new Date(U.isoDay(iso) + "T12:00:00Z")) : "");
  U.dm = (iso) => (U.isoDay(String(iso || "")) ? `${String(iso).slice(8, 10)}/${String(iso).slice(5, 7)}` : "");
  U.dmy = (iso) => (U.isoDay(String(iso || "")) ? `${String(iso).slice(8, 10)}/${String(iso).slice(5, 7)}/${String(iso).slice(0, 4)}` : "");
  U.addDays = (iso, n) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  U.daysBetween = (a, b) => Math.round((new Date(b + "T12:00:00Z") - new Date(a + "T12:00:00Z")) / 86400000);
  // the live document counts only when fresh: written in the last 12 minutes and not "fine"
  U.liveNow = (L, nowMs = C.clock.real().getTime()) => {
    if (!U.obj(L) || !L.ora || L.fase === "fine") return null;
    const at = U.utc(L.ora);
    if (!at) return null;
    const age = nowMs - at.getTime();
    return age < 12 * 60000 && age > -10 * 60000 ? L : null;
  };
  // the sun seen from Rome (NOAA formulas): altitude above the horizon, azimuth from north, clockwise
  U.sun = (d = C.clock.now(), lat = C.ROME.lat, lon = C.ROME.lon) => {
    const rad = Math.PI / 180, ms = d.getTime();
    const T = (ms / 86400000 + 2440587.5 - 2451545) / 36525;
    const L0 = (((280.46646 + T * (36000.76983 + T * 0.0003032)) % 360) + 360) % 360;
    const M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
    const e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
    const Cc = Math.sin(M * rad) * (1.914602 - T * (0.004817 + 0.000014 * T)) + Math.sin(2 * M * rad) * (0.019993 - 0.000101 * T) + Math.sin(3 * M * rad) * 0.000289;
    const omega = 125.04 - 1934.136 * T;
    const lambda = L0 + Cc - 0.00569 - 0.00478 * Math.sin(omega * rad);
    const eps = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60 + 0.00256 * Math.cos(omega * rad);
    const decl = Math.asin(Math.sin(eps * rad) * Math.sin(lambda * rad));
    const y = Math.tan((eps * rad) / 2) ** 2;
    const eq = (4 / rad) * (y * Math.sin(2 * L0 * rad) - 2 * e * Math.sin(M * rad) + 4 * e * y * Math.sin(M * rad) * Math.cos(2 * L0 * rad) - 0.5 * y * y * Math.sin(4 * L0 * rad) - 1.25 * e * e * Math.sin(2 * M * rad));
    const utcMin = ((ms / 60000) % 1440 + 1440) % 1440;
    const ha = ((utcMin + eq + 4 * lon) % 1440 + 1440) % 1440 / 4 - 180;
    const cz = U.clamp(Math.sin(lat * rad) * Math.sin(decl) + Math.cos(lat * rad) * Math.cos(decl) * Math.cos(ha * rad), -1, 1);
    const zen = Math.acos(cz);
    const ca = U.clamp((Math.sin(lat * rad) * Math.cos(zen) - Math.sin(decl)) / (Math.cos(lat * rad) * Math.sin(zen) || 1e-9), -1, 1);
    const a = Math.acos(ca) / rad;
    return { altDeg: 90 - zen / rad, azDeg: ha > 0 ? (a + 180) % 360 : (540 - a) % 360 };
  };
  // night 0 (day) .. 1 (night), from the sun's altitude: 0 above +4°, 1 below −8°
  U.nightOf = (altDeg) => U.smooth(4, -8, altDeg);
  // the page's colour token for a character, for DOM (follows the light/dark theme)
  U.cssColor = (key) => getComputedStyle(document.documentElement).getPropertyValue("--c-" + key).trim() || "#47526a";
  // r128 has no colour management: hex colours are sRGB and must be linearised for an sRGB output
  U.col = (hex) => new window.THREE.Color(hex).convertSRGBToLinear();

  // ---- the event bus ---------------------------------------------------------------------------
  const handlers = new Map();
  C.bus = {
    on(name, fn) {
      if (!handlers.has(name)) handlers.set(name, new Set());
      handlers.get(name).add(fn);
      return () => C.bus.off(name, fn);
    },
    once(name, fn) { const off = C.bus.on(name, (p, n) => { off(); fn(p, n); }); return off; },
    off(name, fn) { const s = handlers.get(name); if (s) s.delete(fn); },
    emit(name, payload) {
      for (const key of [name, "*"]) {
        const s = handlers.get(key);
        if (!s) continue;
        for (const fn of [...s]) {
          try { fn(payload, name); } catch (e) { console.warn("Campus bus:", name, e); }
        }
      }
    },
  };

  // ---- the clock: real time, or a replay's time -----------------------------------------------------
  let over = null;
  C.clock = {
    real: () => new Date(),
    now: () => (over ? new Date(over.at + (performance.now() - over.t0) * over.rate) : new Date()),
    get overridden() { return !!over; },
    setOverride(date, rate = 1) {
      over = date instanceof Date && !isNaN(date) ? { at: date.getTime(), t0: performance.now(), rate } : null;
      C.bus.emit("clock:override", { active: !!over, at: over ? new Date(over.at) : null, rate: over ? rate : 1 });
    },
  };

  // ---- the data store: the page fills it from the db snapshots -----------------------------------------
  // undefined = not arrived yet; null = the document does not exist; maps hold one entry per document
  C.data = {
    programma: undefined, classe: undefined, giudizio: undefined, regole: undefined, live: undefined,
    sera: undefined, registro: undefined, semaforo: undefined, ultimo: undefined, ultimoData: null,
    memoria: {}, verbali: {}, palestre: {}, proposte: {}, gare: {},
    selected: null, picked: false, unavailable: false, got: {}, version: 0,
  };
  const MAPS = new Set(["memoria", "verbali", "palestre", "proposte", "gare"]);
  let dirty = null;
  const flush = () => {
    const keys = [...dirty];
    dirty = null;
    C.data.version += 1;
    C.bus.emit("data:change", { keys, version: C.data.version });
  };
  const touch = (key) => {
    if (!dirty) { dirty = new Set(); queueMicrotask(flush); }
    dirty.add(key);
  };
  C.setData = (key, value) => {
    if (MAPS.has(key)) throw new TypeError("Campus.setData: use setDataIn for " + key);
    if (C.data[key] === value) return;
    C.data[key] = value;
    if (value !== undefined && key !== "got") C.data.got[key] = true;
    touch(key);
  };
  // maps: setDataIn("memoria", "falco", doc); value undefined removes the entry
  C.setDataIn = (key, id, value) => {
    if (!MAPS.has(key)) throw new TypeError("Campus.setDataIn: not a map: " + key);
    const m = C.data[key];
    if (m[id] === value) return;
    if (value === undefined) delete m[id]; else m[id] = value;
    C.data.got[key] = true;
    touch(key);
  };
  // a whole collection at once (proposte, gare): replaces the map
  C.setDataMap = (key, map) => {
    if (!MAPS.has(key)) throw new TypeError("Campus.setDataMap: not a map: " + key);
    C.data[key] = Object.assign({}, map);
    C.data.got[key] = true;
    touch(key);
  };

  // ---- derived numbers: one implementation for every module ---------------------------------------
  const D = (C.derive = {});
  const sideSign = (s) => (s === "short" ? -1 : 1);
  const byDate = (a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  D.prices = () => (U.obj(C.data.giudizio) && U.obj(C.data.giudizio.prices)) || {};
  D.rulesPoints = (r) => Object.entries((U.obj(r) && U.obj(r.curve)) || {}).filter(([d, v]) => U.isoDay(d) && U.isNum(v)).map(([date, value]) => ({ date, value })).sort(byDate);
  D.judgPoints = (w) => U.arr(w && w.equity).filter((e) => e && U.isoDay(e.date) && U.isNum(e.value)).map((e) => ({ date: e.date, value: e.value })).sort(byDate);
  D.judgEquity = (w, prices = D.prices()) => {
    if (!U.obj(w)) return null;
    if (U.isNum(w.cash)) {
      return w.cash + U.arr(w.positions).reduce((a, p) => {
        const now = U.isNum(prices[p.symbol]) ? prices[p.symbol] : p.entry;
        return a + (U.isNum(p.units) && U.isNum(p.entry) && U.isNum(now) ? sideSign(p.side) * p.units * (now - p.entry) : 0);
      }, 0);
    }
    const e = D.judgPoints(w);
    return e.length ? e[e.length - 1].value : null;
  };
  // one trader's two wallets: {judg, rules, gap, pnlPct, positions, at} or null
  D.wallet = (key) => {
    if (!C.TRADERS.includes(key)) return null;
    const g = U.obj(C.data.giudizio), r = U.obj(C.data.regole);
    const w = g && U.obj(g.wallets) && U.obj(g.wallets[key]);
    const rw = r && U.obj(r.portafogli) && U.obj(r.portafogli[key]);
    const judg = D.judgEquity(w);
    const rp = D.rulesPoints(rw);
    const rules = rp.length ? rp[rp.length - 1].value : null;
    if (!U.isNum(judg) && !U.isNum(rules)) return null;
    return {
      judg: U.isNum(judg) ? judg : null, rules: U.isNum(rules) ? rules : null,
      gap: U.isNum(judg) && U.isNum(rules) ? judg - rules : null,
      pnlPct: U.isNum(judg) ? (judg / C.CAPITAL - 1) * 100 : null,
      positions: U.arr(w && w.positions).length, at: (g && g.prices_at) || null,
    };
  };
  // the common fund of the 8 wallets, as the page's "fondo della scuola" computes it
  D.fund = () => {
    const vals = C.TRADERS.flatMap((k) => { const w = D.wallet(k); return [w && w.rules, w && w.judg]; });
    if (vals.some(U.isNum)) {
      const capitale = vals.reduce((a, v) => a + (U.isNum(v) ? v : C.CAPITAL), 0);
      return { capitale, iniziale: C.FUND_START, pct: (capitale / C.FUND_START - 1) * 100, quota: capitale / C.KEYS.length, source: "portafogli", at: (U.obj(C.data.giudizio) && C.data.giudizio.prices_at) || null };
    }
    const R = U.obj(C.data.ultimo) && U.obj(C.data.ultimo.rischio), F = R && U.obj(R.fondo);
    if (F && U.isNum(F.capitale)) {
      const ini = U.isNum(F.iniziale) ? F.iniziale : C.FUND_START;
      return { capitale: F.capitale, iniziale: ini, pct: (F.capitale / ini - 1) * 100, quota: F.capitale / C.KEYS.length, source: "rischio", at: R.giorno || null };
    }
    return null;
  };
  // today in the programme, in Rome: the day entry or null
  D.today = () => { const d = U.rome().date; return U.arr(U.obj(C.data.programma) && C.data.programma.giorni).find((g) => g && g.data === d) || null; };
  D.graduation = () => {
    const today = U.rome().date;
    const days = U.arr(U.obj(C.data.programma) && C.data.programma.giorni);
    const last = days.length ? days[days.length - 1] : null;
    const t = D.today();
    const fine = U.obj(C.data.ultimo) && U.obj(C.data.ultimo.fine);
    return {
      today, days: Math.max(0, U.daysBetween(today, C.GRADUATION)),
      giorno: t && U.isNum(t.giorno) ? t.giorno : null, totale: last && U.isNum(last.giorno) ? last.giorno : null,
      tesi: (fine && U.obj(fine.tesi)) || null,
    };
  };
  // the meetings held so far, oldest first (classe/stato.giorni)
  D.held = () => U.arr(U.obj(C.data.classe) && C.data.classe.giorni).filter((g) => U.obj(g) && U.isoDay(g.data)).slice().sort((a, b) => (a.data < b.data ? -1 : 1));
  // the Preside's last grades for an agent and the agent's own self-grades of that day
  D.votes = (key) => {
    const day = D.held().filter((g) => U.obj(g.voti) && U.obj(g.voti[key])).pop();
    const self = U.arr(U.obj(C.data.memoria[key]) && C.data.memoria[key].autovoti).filter(U.obj).pop() || null;
    if (!day && !self) return null;
    return { data: day ? day.data : self.data, preside: day ? day.voti[key] : U.obj(self && self.preside), auto: self ? { ragionamento: self.ragionamento, disciplina: self.disciplina, data: self.data } : null };
  };
  D.lesson = (key) => U.arr(U.obj(C.data.memoria[key]) && C.data.memoria[key].lezioni).filter((x) => U.obj(x) && x.testo).pop() || null;
  D.openPrediction = (key) => U.arr(U.obj(C.data.memoria[key]) && C.data.memoria[key].previsioni).filter((p) => U.obj(p) && p.stato === "aperta").pop() || null;
  D.calibration = (key) => { const c = U.obj(C.data.memoria[key]) && U.obj(C.data.memoria[key].calibrazione); return c && U.isNum(c.n) && c.n > 0 ? c : null; };
  // the contests (gara/*), newest first, with open = not finished and before the deadline
  D.contests = () => Object.entries(C.data.gare || {}).filter(([, g]) => U.obj(g)).map(([id, g]) => {
    const st = U.obj(g.stato) || {};
    const end = U.utc(st.scadenza_utc);
    return { id, doc: g, open: g.finita === false && (!end || end.getTime() > C.clock.real().getTime()), scadenza: end, leva: st.leva ?? null, situazione: U.obj(g.situazione_finale) || U.obj(g.situazione) || null };
  }).sort((a, b) => (String(a.doc.aperta_alle || a.id) < String(b.doc.aperta_alle || b.id) ? 1 : -1));
  D.latestGym = () => { const ks = Object.keys(C.data.palestre || {}).filter((k) => U.obj(C.data.palestre[k])).sort(); return ks.length ? { date: ks[ks.length - 1], doc: C.data.palestre[ks[ks.length - 1]] } : null; };

  // ---- the boot and the frame loop ------------------------------------------------------------------
  const ORDER3D = ["people", "world", "render"];
  const fails = {}, off = {};
  let raf = 0, last = 0, t = 0, visible = true, hiddenSince = 0, slowTimer = 0;
  function step(name, fn) {
    if (off[name]) return false;
    try { fn(); fails[name] = 0; return true; } catch (e) {
      console.warn("Campus:", name, e);
      fails[name] = (fails[name] || 0) + 1;
      if (fails[name] >= 3) {
        off[name] = true;
        C.bus.emit("campus:degraded", { module: name, reason: "error", message: String((e && e.message) || e) });
        if (name === "render" || name === "world" || name === "people") stop3d();
      }
      return false;
    }
  }
  function stop3d() {
    const ctx = C.ctx;
    if (!ctx || !ctx.has3d) return;
    ctx.has3d = false;
    try { C.render && C.render.dispose && C.render.dispose(); } catch (e) { /* already gone */ }
    C.bus.emit("campus:degraded", { module: "render", reason: "no-3d" });
  }
  function webglOk() {
    try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch (e) { return false; }
  }
  function frame(nowMs) {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.1, Math.max(0, (nowMs - last) / 1000));
    last = nowMs;
    if (!visible) return;
    t += dt;
    const ctx = C.ctx;
    if (C.life) step("life", () => C.life.update(dt, t));
    if (ctx.has3d) {
      for (const m of ORDER3D) if (ctx.has3d && C[m]) step(m, () => C[m].update(dt, t));
      if (ctx.has3d) step("render", () => C.render.draw());
      if (ctx.has3d) step("people", () => C.people.updateOverlay(ctx.camera, ctx.size.w, ctx.size.h));
    }
    if (C.ui) step("ui", () => C.ui.update(dt, t));
  }
  function setVisible(v) {
    if (v === visible) return;
    visible = v;
    const now = performance.now();
    if (!v) hiddenSince = now; else last = now;
    C.bus.emit("campus:visibility", { visible: v, hiddenFor: v ? (now - hiddenSince) / 1000 : 0 });
  }
  // Campus.boot({canvas, overlay, uiRoot, db, sample, reduceMotion}) -> ctx
  C.boot = (opts) => {
    if (C.ctx) return C.ctx;
    const o = opts || {};
    const stage = o.stage || (o.canvas && o.canvas.parentElement) || null;
    const ctx = (C.ctx = {
      THREE: window.THREE || null, canvas: o.canvas || null, overlay: o.overlay || null, uiRoot: o.uiRoot || null, stage,
      db: o.db || null, sample: typeof o.sample === "function" ? o.sample : null, reduceMotion: !!o.reduceMotion,
      has3d: false, scene: null, camera: null, renderer: null,
      size: { w: (stage && stage.clientWidth) || 1, h: (stage && stage.clientHeight) || 1 },
    });
    if (stage && "ResizeObserver" in window) {
      new ResizeObserver(() => {
        const w = stage.clientWidth, h = stage.clientHeight;
        if (!w || !h || (w === ctx.size.w && h === ctx.size.h)) return;
        ctx.size = { w, h };
        C.bus.emit("campus:resize", { w, h });
      }).observe(stage);
    }
    if (stage && "IntersectionObserver" in window) {
      new IntersectionObserver((es) => setVisible(es[0].isIntersecting && !document.hidden), { rootMargin: "120px" }).observe(stage);
    }
    document.addEventListener("visibilitychange", () => setVisible(!document.hidden));
    if (C.ui) step("ui-init", () => C.ui.init(ctx));
    ctx.has3d = !!(ctx.THREE && ctx.canvas && webglOk() && C.render && C.world && C.people);
    if (ctx.has3d) {
      ctx.has3d = step("render-init", () => C.render.init(ctx)) && !!ctx.renderer
        && step("world-init", () => C.world.build(ctx))
        && step("people-init", () => C.people.init(ctx));
      if (!ctx.has3d) { try { C.render && C.render.dispose && C.render.dispose(); } catch (e) { /* nothing to free */ } }
    }
    if (!ctx.has3d) C.bus.emit("campus:degraded", { module: "render", reason: ctx.THREE && webglOk() ? "error" : "no-webgl" });
    if (C.life) step("life-init", () => C.life.init(ctx));
    // a hidden tab gets no animation frames: the brain keeps the clock at 1 Hz
    slowTimer = setInterval(() => { if (!visible && C.life) step("life", () => C.life.update(1, (t += 1))); }, 1000);
    C.bus.emit("campus:ready", { has3d: ctx.has3d, quality: ctx.has3d && C.render ? C.render.quality : null });
    C.bus.emit("campus:capabilities", { db: !!ctx.db, sample: !!ctx.sample });
    last = performance.now();
    raf = requestAnimationFrame(frame);
    return ctx;
  };
  // the capabilities arrive after the boot: Campus.attach({db, sample}) hands them over, once each
  C.attach = (caps) => {
    const ctx = C.ctx;
    if (!ctx) throw new Error("Campus.attach: call Campus.boot first");
    const c = caps || {};
    if ("db" in c) ctx.db = c.db || null;
    if ("sample" in c) ctx.sample = typeof c.sample === "function" ? c.sample : null;
    C.bus.emit("campus:capabilities", { db: !!ctx.db, sample: !!ctx.sample });
  };
  // numbers for tests and the debug overlay
  C.stats = () => {
    const r = C.render && C.render.renderer;
    const info = r && r.info && r.info.render;
    return {
      has3d: !!(C.ctx && C.ctx.has3d), visible, quality: C.render ? C.render.quality : null, fps: C.render ? C.render.fps : null,
      calls: info ? info.calls : null, triangles: info ? info.triangles : null, mode: C.life ? C.life.mode : null,
      disabled: Object.keys(off),
    };
  };
  C.halt = () => { cancelAnimationFrame(raf); clearInterval(slowTimer); };
})();
```
<!-- core.js:end -->
