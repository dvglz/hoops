import * as THREE from "three";
import { BALL_RADIUS, BOARD_CENTER, HOOP_CENTER, RIM_TUBE_RADIUS } from "./constants";

export function resolveBackboardCollision(
  ballPosition: THREE.Vector3,
  previousBallPosition: THREE.Vector3,
  ballVelocity: THREE.Vector3,
): void {
  const boardHalfWidth = 0.95;
  const boardHalfHeight = 0.54;
  const planeZ = BOARD_CENTER.z + 0.05;

  const withinWidth = Math.abs(ballPosition.x - BOARD_CENTER.x) <= boardHalfWidth + BALL_RADIUS;
  const withinHeight = Math.abs(ballPosition.y - BOARD_CENTER.y) <= boardHalfHeight + BALL_RADIUS;
  const crossedPlane =
    previousBallPosition.z - BALL_RADIUS > planeZ &&
    ballPosition.z - BALL_RADIUS <= planeZ &&
    ballVelocity.z < 0;

  if (!withinWidth || !withinHeight || !crossedPlane) {
    return;
  }

  ballPosition.z = planeZ + BALL_RADIUS;
  ballVelocity.z = Math.abs(ballVelocity.z) * 0.76;
  ballVelocity.x *= 0.97;
  ballVelocity.y *= 0.98;
}

export function applyHoopAssist(
  ballPosition: THREE.Vector3,
  ballVelocity: THREE.Vector3,
  ballScored: boolean,
  shotAssist: number,
  step: number,
  tempVec: THREE.Vector3,
): void {
  if (shotAssist <= 0 || ballScored || ballVelocity.y >= 0) {
    return;
  }

  const dy = ballPosition.y - HOOP_CENTER.y;
  if (dy > 1.2 || dy < -0.24) {
    return;
  }

  tempVec.set(HOOP_CENTER.x, HOOP_CENTER.y + 0.04, HOOP_CENTER.z + 0.1).sub(ballPosition);
  const lateralDistance = Math.hypot(tempVec.x, tempVec.z);
  if (lateralDistance > 1.45) {
    return;
  }

  const pull = (1 - lateralDistance / 1.45) * shotAssist;
  ballVelocity.x += tempVec.x * pull * step * 44;
  ballVelocity.z += tempVec.z * pull * step * 34;
  ballPosition.x += tempVec.x * pull * step * 0.34;
  ballPosition.z += tempVec.z * pull * step * 0.24;
}

export function resolveRimCollisions(
  ballPosition: THREE.Vector3,
  ballVelocity: THREE.Vector3,
  rimCollisionNodes: THREE.Vector3[],
  tempVec: THREE.Vector3,
): void {
  const minDistance = BALL_RADIUS + RIM_TUBE_RADIUS * 0.58;
  let collided = false;

  for (const node of rimCollisionNodes) {
    tempVec.copy(ballPosition).sub(node);
    const distance = tempVec.length();
    if (distance === 0 || distance >= minDistance) {
      continue;
    }

    const normal = tempVec.divideScalar(distance);
    ballPosition.copy(node).addScaledVector(normal, minDistance + 0.001);
    const normalSpeed = ballVelocity.dot(normal);
    if (normalSpeed < 0) {
      ballVelocity.addScaledVector(normal, -(1.2 * normalSpeed));
      ballVelocity.multiplyScalar(0.975);
    }
    collided = true;
  }

  if (!collided) {
    return;
  }

  ballVelocity.y *= 0.995;
}

export function resolveFloorCollision(
  ballPosition: THREE.Vector3,
  ballVelocity: THREE.Vector3,
  shotClock: number,
  floorY: number,
): boolean {
  if (ballPosition.y - BALL_RADIUS >= floorY) {
    return false;
  }

  ballPosition.y = floorY + BALL_RADIUS;
  if (Math.abs(ballVelocity.y) < 1.1 || shotClock > 2.8) {
    ballVelocity.y = 0;
    return Math.abs(ballVelocity.x) < 0.15 && Math.abs(ballVelocity.z) < 0.15;
  }

  ballVelocity.y = -ballVelocity.y * 0.58;
  ballVelocity.x *= 0.84;
  ballVelocity.z *= 0.82;
  return false;
}

export function applyGroundFriction(
  ballPosition: THREE.Vector3,
  ballVelocity: THREE.Vector3,
  step: number,
  floorY: number,
): void {
  if (ballPosition.y - BALL_RADIUS > floorY + 0.01) {
    return;
  }
  if (ballVelocity.y > 0.5) {
    return;
  }
  const friction = 2.8;
  const speed = Math.hypot(ballVelocity.x, ballVelocity.z);
  if (speed < 0.01) {
    ballVelocity.x = 0;
    ballVelocity.z = 0;
    return;
  }
  const decel = Math.min(friction * step, speed);
  const factor = (speed - decel) / speed;
  ballVelocity.x *= factor;
  ballVelocity.z *= factor;
}

export function resolveBounds(
  ballPosition: THREE.Vector3,
  shotClock: number,
): boolean {
  return shotClock > 5 || ballPosition.z < -13 || Math.abs(ballPosition.x) > 9;
}
