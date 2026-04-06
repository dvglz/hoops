import type { GameMode, HudRefs } from "./constants";

export function createHud(): HudRefs {
  const hud = document.createElement("div");
  hud.className = "hud";
  hud.innerHTML = `
    <div class="hint-card">
      <strong data-hint-title>LOCK TARGET</strong>
      <span data-hint-text>Ball is dribbling. Drag to place target, release, then tap to lock strength.</span>
    </div>
    <div class="metrics">
      <div class="metric metric-target">
        <div class="metric-row">
          <span>TARGET</span>
          <span data-target-value>0</span>
        </div>
        <div class="metric-track"><div class="metric-fill" data-target-fill></div></div>
      </div>
      <div class="metric metric-strength">
        <div class="metric-row">
          <span>STRENGTH</span>
          <span data-strength-value>0</span>
        </div>
        <div class="metric-track"><div class="metric-fill" data-strength-fill></div></div>
      </div>
    </div>
  `;

  return {
    root: hud,
    targetFill: hud.querySelector("[data-target-fill]") as HTMLDivElement,
    targetValue: hud.querySelector("[data-target-value]") as HTMLSpanElement,
    strengthFill: hud.querySelector("[data-strength-fill]") as HTMLDivElement,
    strengthValue: hud.querySelector("[data-strength-value]") as HTMLSpanElement,
    hint: hud.querySelector(".hint-card") as HTMLDivElement,
    hintTitle: hud.querySelector("[data-hint-title]") as HTMLSpanElement,
    hintText: hud.querySelector("[data-hint-text]") as HTMLSpanElement,
  };
}

export function updateHud(
  hud: HudRefs,
  targetBias: number,
  strength: number,
): void {
  const targetFill = Math.max(0, Math.min(1, (targetBias + 1.12) / 2.24));
  hud.targetFill.style.width = `${(targetFill * 100).toFixed(1)}%`;
  hud.strengthFill.style.width = `${(strength * 100).toFixed(1)}%`;
  hud.targetValue.textContent =
    Math.abs(targetBias) < 0.04
      ? "C"
      : `${targetBias < 0 ? "L" : "R"}${Math.round(Math.abs(targetBias) * 38)}`;
  hud.strengthValue.textContent = `${Math.round(strength * 100)}`;
}

export function updateHint(
  hud: HudRefs,
  mode: GameMode,
  shotCount: number,
  ballScored: boolean,
): void {
  if (shotCount >= 1) {
    hud.hint.classList.add("is-hidden");
    return;
  }

  if (mode === "targeting") {
    hud.hintTitle.textContent = "LOCK TARGET";
    hud.hintText.textContent = "Drag until the arc feels right. Release to lock target.";
    return;
  }

  if (mode === "power") {
    hud.hintTitle.textContent = "LOCK STRENGTH";
    hud.hintText.textContent = "The strength bar is ping-ponging. Tap anywhere to fire.";
    return;
  }

  if (mode === "flight") {
    hud.hintTitle.textContent = "BALL LIVE";
    hud.hintText.textContent = "Track the bounce. The next dribble starts automatically.";
    return;
  }

  if (mode === "resetting") {
    hud.hintTitle.textContent = ballScored ? "BUCKET" : "RESET";
    hud.hintText.textContent = ballScored
      ? "Score is on the hoop. Get ready for the next dribble."
      : "Missed shot. The ball is resetting for another rep.";
    return;
  }

  hud.hintTitle.textContent = "LOCK TARGET";
  hud.hintText.textContent = "Ball is dribbling. Drag to place target, release, then tap to lock strength.";
}
