import * as THREE from "three";
import { BALL_RADIUS, BALL_SPAWN, FLOOR_Y } from "./constants";

export function createBall(scene: THREE.Scene): THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial> {
  const geometry = new THREE.SphereGeometry(BALL_RADIUS, 28, 20);
  const material = new THREE.MeshStandardMaterial({
    color: 0xdb7c2f,
    roughness: 0.78,
    metalness: 0.08,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const seamMaterial = new THREE.LineBasicMaterial({ color: 0x3a1c08, linewidth: 1 });
  const seamGroup = new THREE.Group();
  const r = BALL_RADIUS * 1.002;
  const segments = 48;

  const horizontalRing: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    horizontalRing.push(new THREE.Vector3(Math.cos(theta) * r, 0, Math.sin(theta) * r));
  }
  seamGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(horizontalRing), seamMaterial));

  const verticalRing: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    verticalRing.push(new THREE.Vector3(Math.cos(theta) * r, Math.sin(theta) * r, 0));
  }
  seamGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(verticalRing), seamMaterial));

  const curveAmplitude = r * 0.28;
  for (let c = 0; c < 4; c++) {
    const channelPoints: THREE.Vector3[] = [];
    const baseAngle = (c / 4) * Math.PI * 2;
    for (let i = 0; i <= segments; i++) {
      const t = (i / segments) * Math.PI * 2;
      const wave = Math.sin(t * 2) * curveAmplitude;
      const x = Math.cos(baseAngle) * (r + wave) * Math.cos(t);
      const y = Math.sin(t) * r;
      const z = Math.sin(baseAngle) * (r + wave) * Math.cos(t);
      const len = Math.sqrt(x * x + y * y + z * z);
      channelPoints.push(new THREE.Vector3((x / len) * r, (y / len) * r, (z / len) * r));
    }
    seamGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(channelPoints), seamMaterial));
  }

  mesh.add(seamGroup);
  scene.add(mesh);
  return mesh;
}

export function createBallShadow(scene: THREE.Scene): THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial> {
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.38, 30),
    new THREE.MeshBasicMaterial({
      color: 0x102131,
      transparent: true,
      opacity: 0.18,
    }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = FLOOR_Y + 0.003;
  scene.add(shadow);
  return shadow;
}

export function updatePreShotBall(
  ball: THREE.Mesh,
  ballPosition: THREE.Vector3,
  preShotClock: number,
  delta: number,
  syncBallMesh: () => void,
): number {
  const clock = preShotClock + delta;
  const cycle = 0.8;
  const t = (clock % cycle) / cycle;
  const bounce = Math.max(0, Math.sin(t * Math.PI));
  const shapedBounce = Math.pow(bounce, 0.72);
  const floorContactY = FLOOR_Y + BALL_RADIUS;
  const xOffset = Math.sin(clock * 2.1) * 0.028;
  const zOffset = Math.cos(clock * 2.1) * 0.024;
  const y = floorContactY + shapedBounce * (BALL_SPAWN.y - floorContactY);
  const compression = 1 - THREE.MathUtils.clamp((y - floorContactY) / (BALL_SPAWN.y - floorContactY + 0.001), 0, 1);

  ballPosition.set(BALL_SPAWN.x + xOffset, y, BALL_SPAWN.z + zOffset);
  ball.rotation.x += delta * 7.4;
  ball.rotation.z += delta * 2.6;
  ball.scale.set(1 + compression * 0.06, 1 - compression * 0.08, 1 + compression * 0.06);
  syncBallMesh();
  return clock;
}

export function syncBallMesh(
  ball: THREE.Mesh,
  ballShadow: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>,
  ballPosition: THREE.Vector3,
): void {
  ball.position.copy(ballPosition);
  const shadowScale = THREE.MathUtils.clamp(1.18 - (ballPosition.y - FLOOR_Y) * 0.24, 0.55, 1.12);
  ballShadow.position.set(ballPosition.x, FLOOR_Y + 0.003, ballPosition.z);
  ballShadow.scale.setScalar(shadowScale);
  ballShadow.material.opacity = THREE.MathUtils.clamp(0.24 - (ballPosition.y - FLOOR_Y) * 0.04, 0.06, 0.2);
}
