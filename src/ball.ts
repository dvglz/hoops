import * as THREE from "three";
import { BALL_RADIUS, BALL_SPAWN, FLOOR_Y, type BallSkinId } from "./constants";

const ballTextureCache = new Map<BallSkinId, THREE.CanvasTexture>();

type BallPalette = {
  base: string;
  dark: string;
  speckle: string;
  seam: number;
  roughness: number;
  metalness: number;
};

const BALL_SKIN_PALETTES: Record<BallSkinId, BallPalette> = {
  classic: {
    base: "#d97528",
    dark: "#8f4514",
    speckle: "rgba(60, 22, 6, 0.18)",
    seam: 0x3a1c08,
    roughness: 0.8,
    metalness: 0.05,
  },
  blacktop: {
    base: "#2f3034",
    dark: "#121318",
    speckle: "rgba(255, 186, 92, 0.14)",
    seam: 0xe07d36,
    roughness: 0.92,
    metalness: 0.04,
  },
  sunburst: {
    base: "#d7b07a",
    dark: "#a06a34",
    speckle: "rgba(132, 80, 24, 0.18)",
    seam: 0x6a3710,
    roughness: 0.84,
    metalness: 0.03,
  },
};

export function createBall(
  scene: THREE.Scene,
  skin: BallSkinId,
): THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial> {
  const geometry = new THREE.SphereGeometry(BALL_RADIUS, 28, 20);
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: getBallTexture(skin),
    roughness: BALL_SKIN_PALETTES[skin].roughness,
    metalness: BALL_SKIN_PALETTES[skin].metalness,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const seamMaterial = new THREE.LineBasicMaterial({ color: BALL_SKIN_PALETTES[skin].seam });
  const seamGroup = new THREE.Group();
  const r = BALL_RADIUS * 1.002;
  const segments = 48;

  const horizontalRing: THREE.Vector3[] = [];
  for (let index = 0; index <= segments; index += 1) {
    const theta = (index / segments) * Math.PI * 2;
    horizontalRing.push(new THREE.Vector3(Math.cos(theta) * r, 0, Math.sin(theta) * r));
  }
  seamGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(horizontalRing), seamMaterial));

  const verticalRing: THREE.Vector3[] = [];
  for (let index = 0; index <= segments; index += 1) {
    const theta = (index / segments) * Math.PI * 2;
    verticalRing.push(new THREE.Vector3(Math.cos(theta) * r, Math.sin(theta) * r, 0));
  }
  seamGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(verticalRing), seamMaterial));

  const curveAmplitude = r * 0.28;
  for (let channelIndex = 0; channelIndex < 4; channelIndex += 1) {
    const channelPoints: THREE.Vector3[] = [];
    const baseAngle = (channelIndex / 4) * Math.PI * 2;
    for (let segmentIndex = 0; segmentIndex <= segments; segmentIndex += 1) {
      const t = (segmentIndex / segments) * Math.PI * 2;
      const wave = Math.sin(t * 2) * curveAmplitude;
      const x = Math.cos(baseAngle) * (r + wave) * Math.cos(t);
      const y = Math.sin(t) * r;
      const z = Math.sin(baseAngle) * (r + wave) * Math.cos(t);
      const length = Math.sqrt(x * x + y * y + z * z);
      channelPoints.push(new THREE.Vector3((x / length) * r, (y / length) * r, (z / length) * r));
    }
    seamGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(channelPoints), seamMaterial));
  }

  mesh.userData.seamMaterial = seamMaterial;
  mesh.add(seamGroup);
  scene.add(mesh);
  return mesh;
}

export function applyBallSkin(
  ball: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>,
  skin: BallSkinId,
): void {
  const palette = BALL_SKIN_PALETTES[skin];
  ball.material.map = getBallTexture(skin);
  ball.material.color.set(0xffffff);
  ball.material.roughness = palette.roughness;
  ball.material.metalness = palette.metalness;
  ball.material.needsUpdate = true;

  const seamMaterial = ball.userData.seamMaterial as THREE.LineBasicMaterial | undefined;
  seamMaterial?.color.setHex(palette.seam);
}

export function createBallShadow(scene: THREE.Scene): THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial> {
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.48, 30),
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

function getBallTexture(skin: BallSkinId): THREE.CanvasTexture {
  const cachedTexture = ballTextureCache.get(skin);
  if (cachedTexture) {
    return cachedTexture;
  }

  const palette = BALL_SKIN_PALETTES[skin];
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  gradient.addColorStop(0, lightenHex(palette.base, 0.08));
  gradient.addColorStop(0.52, palette.base);
  gradient.addColorStop(1, palette.dark);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let index = 0; index < 6500; index += 1) {
    const size = 1 + Math.random() * 3.4;
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    ctx.fillStyle = palette.speckle;
    ctx.fillRect(x, y, size, size);
  }

  ctx.globalAlpha = 0.12;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(canvas.width * 0.3, canvas.height * 0.24, canvas.width * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(0, canvas.height * 0.32);
  ctx.bezierCurveTo(
    canvas.width * 0.28,
    canvas.height * 0.18,
    canvas.width * 0.54,
    canvas.height * 0.42,
    canvas.width,
    canvas.height * 0.24,
  );
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(0, canvas.height * 0.76);
  ctx.bezierCurveTo(
    canvas.width * 0.22,
    canvas.height * 0.62,
    canvas.width * 0.48,
    canvas.height * 0.9,
    canvas.width,
    canvas.height * 0.7,
  );
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  ballTextureCache.set(skin, texture);
  return texture;
}

function lightenHex(hex: string, amount: number): string {
  const color = new THREE.Color(hex);
  color.lerp(new THREE.Color("#ffffff"), amount);
  return `#${color.getHexString()}`;
}
