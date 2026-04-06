import * as THREE from "three";
import type { GameMode } from "./constants";
import { HOOP_CENTER } from "./constants";

const RIM_SCORE_RADIUS = 0.25;

export function checkScore(
  ballPosition: THREE.Vector3,
  previousBallPosition: THREE.Vector3,
  ballVelocity: THREE.Vector3,
  ballScored: boolean,
  shotAssist: number,
  rimCenter: THREE.Vector3,
): "guided" | "clean" | null {
  if (ballScored) {
    return null;
  }

  const dy = ballPosition.y - rimCenter.y;
  const assistDx = ballPosition.x - rimCenter.x;
  const assistDz = ballPosition.z - (rimCenter.z + 0.06);
  const assistDistanceSq = assistDx * assistDx + assistDz * assistDz;
  const guidedMake =
    shotAssist > 0.55 &&
    ballVelocity.y < -0.2 &&
    dy < 0.42 &&
    dy > -0.18 &&
    assistDistanceSq < 1.15 * 1.15;

  if (guidedMake) {
    ballPosition.x = THREE.MathUtils.lerp(ballPosition.x, rimCenter.x, 0.68);
    ballPosition.z = THREE.MathUtils.lerp(ballPosition.z, rimCenter.z + 0.04, 0.68);
    ballVelocity.x *= 0.18;
    ballVelocity.z *= 0.18;
    return "guided";
  }

  const crossedDownward =
    previousBallPosition.y > rimCenter.y &&
    ballPosition.y <= rimCenter.y &&
    ballVelocity.y < 0;

  if (!crossedDownward) {
    return null;
  }

  const dx = ballPosition.x - rimCenter.x;
  const dz = ballPosition.z - rimCenter.z;
  const radialDistanceSq = dx * dx + dz * dz;
  if (radialDistanceSq > RIM_SCORE_RADIUS * RIM_SCORE_RADIUS) {
    return null;
  }

  return "clean";
}

export function updateScoreTexture(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  texture: THREE.CanvasTexture,
  score: number,
  mode: GameMode,
  swishTimer: number,
): void {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, "#0f2438");
  gradient.addColorStop(1, "#1f4565");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = "rgba(255,255,255,0.18)";
  ctx.lineWidth = 6;
  ctx.strokeRect(6, 6, canvas.width - 12, canvas.height - 12);

  ctx.fillStyle = "rgba(236, 246, 252, 0.66)";
  ctx.font = "600 22px Avenir Next, Segoe UI, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("HOOPS SCORE", canvas.width / 2, 36);

  if (swishTimer > 0) {
    ctx.fillStyle = "#ffd54f";
    ctx.shadowColor = "rgba(255, 213, 79, 0.9)";
    ctx.shadowBlur = 22;
    ctx.font = "800 62px Avenir Next, Segoe UI, sans-serif";
    ctx.fillText("SWISH!", canvas.width / 2, 112);
    ctx.shadowBlur = 0;
  } else {
    ctx.fillStyle = "#f5f8d5";
    ctx.shadowColor = "rgba(255, 238, 146, 0.8)";
    ctx.shadowBlur = 16;
    ctx.font = "700 78px Avenir Next, Segoe UI, sans-serif";
    ctx.fillText(String(score).padStart(2, "0"), canvas.width / 2, 116);
    ctx.shadowBlur = 0;
  }

  ctx.fillStyle = "rgba(236, 246, 252, 0.78)";
  ctx.font = "600 18px Avenir Next, Segoe UI, sans-serif";
  const boardStatus =
    mode === "power"
      ? "LOCK STRENGTH"
      : mode === "targeting"
        ? "LOCK TARGET"
        : mode === "flight"
          ? "BALL LIVE"
          : "ENDLESS RUN";
  ctx.fillText(boardStatus, canvas.width / 2, 142);

  texture.needsUpdate = true;
}
