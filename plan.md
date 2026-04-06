# HOOPS — Round of Fixes

## Context
Post-refactor cleanup round. The game is a single-file Three.js basketball shootaround (`src/main.ts`, 1208 lines). User reviewed discrepancies between progress.md and actual code, triaged issues, and wants specific fixes applied then documented in progress.md.

## Tasks (in order)

### 1. Fix rim distance from backboard
**Problem:** Rim center is at Z=-6.12, backboard front face at Z=-6.46. That's 0.34m gap — real basketball is ~0.15m (6 inches).
**Fix:** Move `HOOP_CENTER` Z from `-6.12` to `-6.32`. Update dependent positions:
- `hoopBase` position (line 359): Z from `-6.29` to ~`-6.42`
- `boardSquare` position (line 342): may need slight Z adjustment
- Rim collision nodes are derived from `HOOP_CENTER` — auto-fixed
- Net points reference `HOOP_CENTER` — but net is being removed (task 4)

**Files:** `src/main.ts` lines 21, 342, 358-359

### 2. Remove net geometry
**What:** Delete the net creation code (lines 362-380) and any net references.
**Files:** `src/main.ts`

### 3. Improve score feedback
**Problem:** Only a brief panel flash on score — flat feel. State messaging is confusing.
**Fix (juicy):**
- Ball scale pop on score (grow then shrink over ~0.3s)
- Screen-edge white flash overlay div, fade out over ~0.4s
- Score text gold flash on the hoop panel
- Brief "SWISH!" text on the score panel before reverting to number

**Files:** `src/main.ts` (completeScore, scoreFlash animation, updateScoreTexture), `src/style.css`

### 4. Ball spin during flight + better ball texture
**Spin:** In the flight physics substep loop (line 561-574), apply rotation based on velocity:
```
ball.rotation.x += ballVelocity.z * step * 3;
ball.rotation.z -= ballVelocity.x * step * 3;
```
**Ball stitches:** Enhance the existing seam lines (lines 183-199). Currently has 2 seams (equator + vertical). Add the characteristic basketball channel pattern — 4 curved seam lines that create the 8-panel look. Use slightly wider/more visible LineBasicMaterial.

**Files:** `src/main.ts`

### 5. Hide hint card after first shot
**Fix:** Add a `shotCount` counter. Increment in `shootBall()`. In `updateHint()`, if `shotCount >= 1`, hide the hint card (`this.hud.hint.style.display = 'none'`). Could also fade it out by reducing opacity over the first flight.

**Files:** `src/main.ts`

### 6. Split into modules
Break `src/main.ts` into focused files:
```
src/
  main.ts          — bootstrap only (~20 lines)
  constants.ts     — BALL_RADIUS, GRAVITY, positions, types
  game.ts          — HoopsGame class shell, lifecycle, resize, render loop
  ball.ts          — createBall, createBallShadow, updatePreShotBall, syncBallMesh
  court.ts         — buildCourt, buildBackdrop
  hoop.ts          — buildHoop (rim, backboard, supports, collision nodes)
  physics.ts       — update, flight substeps, all collision resolvers
  scoring.ts       — checkScore, completeScore, updateScoreTexture
  controls.ts      — pointer/keyboard handlers, nudgeAim, updateAimPreview
  hud.ts           — createHud, updateHint, updateHud
  style.css        — unchanged
```
All imports use relative paths. HoopsGame class stays in `game.ts` — helper modules export functions/constants that the class calls. Minimal refactor, same runtime shape.

### 7. Update progress.md
Document all changes made in this round:
- Rim repositioned closer to backboard
- Net removed (placeholder, will revisit)
- Score feedback enhanced (scale pop, flash, text)
- Ball spins during flight, basketball channel stitching added
- Hint auto-hides after first shot
- Codebase split into modules

## Verification
1. `npm run build` — must succeed with no TS errors
2. Browser test on mobile viewport (Chrome DevTools 390x844) — verify:
   - Rim visually flush with backboard
   - Ball spins in flight with visible stitches
   - Score triggers visual pop + flash
   - No net visible
   - Hint disappears after first shot
   - All game modes still cycle correctly
