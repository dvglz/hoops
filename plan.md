# HOOPS — Batch 2: Geometry + Score FX + New Input Model

## Context
Second round of changes. The codebase is now split into 9 modules. This batch raises the rim, enlarges the ball, replaces the 3D scoreboard with ambient effects, adds a post-score ball drop animation, and — most significantly — replaces the drag-to-aim input with a sequential tap-to-lock ping-pong bar system designed for one-handed mobile play.

## Critical Files
- `src/constants.ts` — types, positions, radii
- `src/game.ts` — HoopsGame class, state machine, update loop, input handlers
- `src/hud.ts` — DOM creation, bar updates, hint text
- `src/hoop.ts` — pole/support/backboard/rim geometry
- `src/ball.ts` — ball creation, shadow, pre-shot bounce
- `src/scoring.ts` — score detection, updateScoreTexture (to be removed)
- `src/physics.ts` — collision resolvers
- `src/style.css` — HUD styling

---

## Task 1: Raise the rim

**constants.ts**
- `HOOP_CENTER` Y: `3.04` → `3.30` (+0.26)
- `BOARD_CENTER` Y: `3.86` → `4.12` (+0.26, same delta)

**hoop.ts** — adjust hardcoded positions (all +0.26 on Y):
- `pole`: increase height to ~5.1, Y to ~2.55 (so top reaches higher)
- `support` Y: `4.15` → `4.41`
- `supportDiagonal` Y: `3.77` → `4.03`
- `boardSquare` Y: `3.67` → `3.93`
- `hoopBase` Y: `3.08` → `3.34`

No changes needed in physics.ts/scoring.ts — they import `HOOP_CENTER`.

---

## Task 2: Make ball bigger

**constants.ts**
- `BALL_RADIUS`: `0.16` → `0.21`

**ball.ts**
- `createBallShadow`: shadow circle radius `0.38` → `0.48` (proportional)

Everything else reads `BALL_RADIUS` from the import.

---

## Task 3: Remove 3D scoreboard, add DOM score popup

**scoring.ts**
- Delete `updateScoreTexture()` entirely
- Remove `GameMode` import (only used by that function)

**game.ts** — remove score panel:
- Delete properties: `scorePanel`, `scoreCanvas`, `scoreContext`, `scoreTexture`, `swishTimer`, `scoreFlash`
- Delete score panel DOM/Three.js creation block in constructor
- Delete `callUpdateScoreTexture()` method and all calls to it
- Delete the `scoreFlash` animation block in `update()`
- Delete the `swishTimer` countdown block in `update()`

**game.ts** — add DOM score popup:
- New property: `scorePopup: HTMLDivElement`
- In constructor: create `div.score-popup`, append to `this.container`
- In `completeScore()`: set `scorePopup.textContent = String(this.score)`, add `is-active` class, setTimeout to remove it after 900ms
- Keep existing `scoreOverlay` (white edge flash)

**style.css** — add `.score-popup`:
```css
.score-popup {
  position: absolute;
  top: 28%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 5rem;
  font-weight: 800;
  color: #ffd54f;
  text-shadow: 0 4px 24px rgba(255, 213, 79, 0.6);
  pointer-events: none;
  opacity: 0;
}
.score-popup.is-active {
  animation: score-pop 0.9s ease-out forwards;
}
@keyframes score-pop {
  0%   { opacity: 1; transform: translate(-50%, -50%) scale(0.5); }
  30%  { opacity: 1; transform: translate(-50%, -50%) scale(1.25); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(1.4); }
}
```

---

## Task 4: Post-score ball animation (realistic drop)

Ball keeps its position after scoring, gets a downward velocity push, bounces on the floor naturally, then fades and resets.

**game.ts** — new properties:
- `postScoreTimer: number = 0`
- `postScoreFading: boolean = false`

**game.ts** — `completeScore()` changes:
- Set `ballScored = true`, increment score, trigger popup + flash
- Set `postScoreTimer = 1.8`
- Give downward push: `this.ballVelocity.y = Math.min(this.ballVelocity.y, -3.5)`
- Do NOT call `scheduleReset()` here anymore

**game.ts** — `update()` flight section:
- After physics substep loop, if `ballScored && postScoreTimer > 0`:
  - Decrement `postScoreTimer` by delta
  - When `postScoreTimer < 0.5` and not yet fading: set `postScoreFading = true`, `ball.material.transparent = true`
  - While fading: reduce `ball.material.opacity` toward 0, scale ball down
  - When `postScoreTimer <= 0`: call `scheduleReset(0.1)`

**game.ts** — `resetBall()`:
- Reset `postScoreTimer = 0`, `postScoreFading = false`
- Restore `ball.material.opacity = 1`, `ball.material.transparent = false`

**Note:** Rim collisions stay active — ball may clip edges for a realistic look. The existing `resolveFloorCollision` handles bouncing (0.58 restitution, stops when velocity < 1.1).

---

## Task 5: Replace drag-to-aim with sequential ping-pong bars (MAJOR)

### New flow
```
idle → (tap) → targeting (target bar sweeping L↔R) → (tap) → power (strength bar bouncing) → (tap) → flight
```

One bar visible at a time. No preview arc during targeting (arc appears only after target is locked, during strength phase). No dragging at all.

### 5a. New state in game.ts

New property: `targetDirection: number = 1`

### 5b. Input handling — game.ts

**`handlePointerDown`** rewritten as tap state machine:
- `idle` → set mode to `"targeting"`, start target sweep
- `"targeting"` → lock `targetBias`, set mode to `"power"`, start strength sweep, show preview arc
- `"power"` → call `shootBall()`
- `"flight"` / `"resetting"` → ignore

**Delete entirely:**
- `handlePointerMove` (and its event listener)
- `handlePointerUp` (and its event listener)
- `pointerActive` property
- `nudgeAim()` method
- `pointerCurrent` property (no longer needed for aiming)

**`handleKeyDown`** simplified:
- Remove all arrow key blocks
- Space/Enter: same tap-to-advance logic as pointer

### 5c. Target ping-pong in `update()`

In the pre-shot block, add targeting oscillation:
```typescript
if (this.mode === "targeting") {
  this.targetBias += delta * this.targetDirection * 1.8;
  if (this.targetBias >= 1.12) { this.targetBias = 1.12; this.targetDirection = -1; }
  else if (this.targetBias <= -1.12) { this.targetBias = -1.12; this.targetDirection = 1; }
  // NO updateAimPreview() here — arc hidden during targeting
}
```

### 5d. Rewrite `updateAimPreview()`

Remove pointer-based mapping. Replace with:
```typescript
const targetOffsetX = this.targetBias;
const targetOffsetY = 0.36; // fixed vertical aim
```
Rest of function (assist, velocity calc, arc drawing) stays identical.

Only called during `"power"` mode now (and on reset for initial state).

### 5e. HUD changes — constants.ts + hud.ts

**constants.ts** — extend `HudRefs`:
- Add `targetMetric: HTMLDivElement` and `strengthMetric: HTMLDivElement`

**hud.ts** — `createHud()`:
- Wire up the new refs from `.metric-target` and `.metric-strength` elements

**hud.ts** — new `updateBarVisibility(hud, mode)`:
- `"idle"`: both bars hidden
- `"targeting"`: target bar visible, strength hidden
- `"power"`: target hidden, strength visible
- `"flight"` / `"resetting"`: both hidden

**hud.ts** — `updateHint()` text:
- `"idle"`: "Tap anywhere to start aiming."
- `"targeting"`: "The target bar is sweeping. Tap to lock your aim."
- `"power"`: "The strength bar is bouncing. Tap to shoot."
- flight/resetting: unchanged

### 5f. CSS — style.css

Add show/hide transition for metric bars:
```css
.metric {
  transition: opacity 200ms ease, transform 200ms ease;
}
.metric.is-hidden {
  opacity: 0;
  transform: translateY(20px);
  pointer-events: none;
}
```

### 5g. Reset state

In `resetBall()`:
- `targetBias = 0`, `targetDirection = 1`
- Hide preview arc + aim marker (already done)
- Call `updateBarVisibility` for idle state

---

## Implementation Order

1. **Constants** (tasks 1+2): HOOP_CENTER, BOARD_CENTER, BALL_RADIUS
2. **Geometry** (task 1): hoop.ts positions, ball.ts shadow
3. **Scoreboard removal + popup** (task 3): scoring.ts, game.ts, style.css
4. **Post-score animation** (task 4): game.ts
5. **Input model rewrite** (task 5): game.ts, hud.ts, constants.ts, style.css
6. **Update progress.md**
7. **Build + verify**

## Verification
1. `npm run build` — zero TS errors
2. Browser test (mobile viewport 390x844):
   - Rim visually higher, ball visibly chunkier
   - No 3D scoreboard on hoop
   - Score event: gold number pops + white flash + ball drops through and bounces, fades
   - Tap → target bar sweeps → tap → strength bar bounces → tap → shoot
   - Only one bar visible at a time with smooth transitions
   - Hint text matches each phase
   - All modes cycle correctly, no stuck states
