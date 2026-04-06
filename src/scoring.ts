import * as THREE from "three";
import { HOOP_CENTER } from "./constants";

const RIM_SCORE_RADIUS = 0.29;

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
    shotAssist > 0.45 &&
    ballVelocity.y < -0.2 &&
    dy < 0.5 &&
    dy > -0.24 &&
    assistDistanceSq < 1.28 * 1.28;

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
