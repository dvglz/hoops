import * as THREE from "three";
import type { AmbienceId } from "./constants";

export type AmbienceLighting = {
  hemisphereSky: number;
  hemisphereGround: number;
  hemisphereIntensity: number;
  sunColor: number;
  sunIntensity: number;
  sunPosition: [number, number, number];
};

export type CourtRig = {
  floor: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  skyPlane: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  backdrop: THREE.Group;
};

type AmbienceTheme = {
  sceneBackground: number;
  fogColor: number;
  fogNear: number;
  fogFar: number;
  floorBase: string;
  floorNoise: string;
  lineColor: string;
  keyFill: string;
  skyStops: [string, string, string];
  skyCloudColor: string;
  sunGlowColor: string;
  lighting: AmbienceLighting;
};

const courtTextureCache = new Map<AmbienceId, THREE.CanvasTexture>();
const skyTextureCache = new Map<AmbienceId, THREE.CanvasTexture>();
let chainLinkTextureCache: THREE.CanvasTexture | null = null;
let hoodWallTextureCache: THREE.CanvasTexture | null = null;
let desertMesaTextureCache: THREE.CanvasTexture | null = null;

const AMBIENCE_THEMES: Record<AmbienceId, AmbienceTheme> = {
  city: {
    sceneBackground: 0xc5d5e2,
    fogColor: 0xcfd9e2,
    fogNear: 12,
    fogFar: 28,
    floorBase: "#b8b2aa",
    floorNoise: "rgba(178, 173, 168, 0.08)",
    lineColor: "rgba(238, 243, 247, 0.74)",
    keyFill: "rgba(236, 242, 246, 0.07)",
    skyStops: ["#92c4f2", "#c7def1", "#f5dcc0"],
    skyCloudColor: "rgba(255, 255, 255, 0.35)",
    sunGlowColor: "rgba(255, 246, 226, 0.18)",
    lighting: {
      hemisphereSky: 0xf5fbff,
      hemisphereGround: 0xcda97a,
      hemisphereIntensity: 1.25,
      sunColor: 0xfff1cf,
      sunIntensity: 1.75,
      sunPosition: [6, 9, 8],
    },
  },
  hood: {
    sceneBackground: 0xb8c5d0,
    fogColor: 0xbec9d2,
    fogNear: 10,
    fogFar: 28,
    floorBase: "#8c8f8f",
    floorNoise: "rgba(24, 28, 31, 0.09)",
    lineColor: "rgba(234, 240, 244, 0.72)",
    keyFill: "rgba(167, 56, 60, 0.12)",
    skyStops: ["#6b879f", "#9fb4c4", "#e2b188"],
    skyCloudColor: "rgba(255, 255, 255, 0.15)",
    sunGlowColor: "rgba(255, 202, 154, 0.16)",
    lighting: {
      hemisphereSky: 0xd5e9f5,
      hemisphereGround: 0x74563a,
      hemisphereIntensity: 1.05,
      sunColor: 0xffddb3,
      sunIntensity: 1.55,
      sunPosition: [5.2, 8.2, 6.4],
    },
  },
  desert: {
    sceneBackground: 0xf3d7a9,
    fogColor: 0xe7be82,
    fogNear: 11,
    fogFar: 32,
    floorBase: "#bea07c",
    floorNoise: "rgba(129, 84, 31, 0.08)",
    lineColor: "rgba(241, 234, 213, 0.62)",
    keyFill: "rgba(196, 132, 68, 0.16)",
    skyStops: ["#f2b96b", "#f6d89b", "#f4e8d3"],
    skyCloudColor: "rgba(255, 241, 214, 0.14)",
    sunGlowColor: "rgba(255, 231, 173, 0.38)",
    lighting: {
      hemisphereSky: 0xffe5b5,
      hemisphereGround: 0x8a5d2b,
      hemisphereIntensity: 1.2,
      sunColor: 0xfff0cc,
      sunIntensity: 1.9,
      sunPosition: [-6.4, 9.5, 4.6],
    },
  },
};

export function createCourtRig(scene: THREE.Scene): CourtRig {
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 26),
    new THREE.MeshStandardMaterial({
      roughness: 0.96,
      metalness: 0,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const skyPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(28, 18),
    new THREE.MeshBasicMaterial(),
  );
  skyPlane.position.set(0, 8.5, -18);
  scene.add(skyPlane);

  const backdrop = new THREE.Group();
  scene.add(backdrop);

  return { floor, skyPlane, backdrop };
}

export function applyAmbience(
  scene: THREE.Scene,
  rig: CourtRig,
  ambience: AmbienceId,
): AmbienceLighting {
  const theme = AMBIENCE_THEMES[ambience];
  scene.background = new THREE.Color(theme.sceneBackground);
  scene.fog = new THREE.Fog(theme.fogColor, theme.fogNear, theme.fogFar);

  rig.floor.material.map = getCourtTexture(ambience);
  rig.floor.material.needsUpdate = true;

  rig.skyPlane.material.map = getSkyTexture(ambience);
  rig.skyPlane.material.needsUpdate = true;

  clearBackdrop(rig.backdrop);
  if (ambience === "city") {
    buildCityBackdrop(rig.backdrop);
  } else if (ambience === "hood") {
    buildHoodBackdrop(rig.backdrop);
  } else {
    buildDesertBackdrop(rig.backdrop);
  }

  document.body.dataset.ambience = ambience;
  return theme.lighting;
}

function buildCityBackdrop(backdrop: THREE.Group): void {
  const fenceMaterial = new THREE.MeshStandardMaterial({
    color: 0x596776,
    roughness: 0.72,
    metalness: 0.12,
  });

  for (let index = -6; index <= 6; index += 1) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.8, 0.08), fenceMaterial);
    post.position.set(index * 0.85, 1.4, -10.9);
    backdrop.add(post);
  }

  const topRail = new THREE.Mesh(new THREE.BoxGeometry(11.3, 0.08, 0.08), fenceMaterial);
  topRail.position.set(0, 2.72, -10.9);
  backdrop.add(topRail);

  const midRail = new THREE.Mesh(new THREE.BoxGeometry(11.3, 0.05, 0.05), fenceMaterial);
  midRail.position.set(0, 1.5, -10.88);
  backdrop.add(midRail);

  const buildingPalette = [0x728595, 0x7f8f9e, 0x8a9ba8, 0x627585];
  for (let index = 0; index < 10; index += 1) {
    const width = 1 + (index % 3) * 0.4;
    const height = 2.2 + ((index * 7) % 5) * 0.7;
    const building = new THREE.Mesh(
      new THREE.BoxGeometry(width, height, 1.8),
      new THREE.MeshStandardMaterial({
        color: buildingPalette[index % buildingPalette.length],
        roughness: 0.94,
      }),
    );
    building.position.set(-8.2 + index * 1.85, height / 2 - 0.2, -15.2 - (index % 2) * 0.8);
    backdrop.add(building);
  }

  const treeTrunkMaterial = new THREE.MeshStandardMaterial({
    color: 0x7f5d34,
    roughness: 0.92,
  });
  const treeLeafMaterial = new THREE.MeshStandardMaterial({
    color: 0x6f8b5c,
    roughness: 0.95,
  });

  [-6.8, 7.2].forEach((x) => {
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 1.8, 7), treeTrunkMaterial);
    trunk.position.set(x, 0.9, -9.6);
    backdrop.add(trunk);

    const crown = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.8, 7), treeLeafMaterial);
    crown.position.set(x, 2.2, -9.6);
    backdrop.add(crown);
  });
}

function buildHoodBackdrop(backdrop: THREE.Group): void {
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(13.5, 6.2),
    new THREE.MeshStandardMaterial({
      map: getHoodWallTexture(),
      roughness: 0.95,
      metalness: 0.02,
    }),
  );
  wall.position.set(0, 3.18, -11.4);
  wall.receiveShadow = true;
  backdrop.add(wall);

  const wallTrimMaterial = new THREE.MeshStandardMaterial({
    color: 0x62666b,
    roughness: 0.88,
  });
  const trim = new THREE.Mesh(new THREE.BoxGeometry(13.7, 0.14, 0.16), wallTrimMaterial);
  trim.position.set(0, 6.28, -11.36);
  backdrop.add(trim);

  const door = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 2.8),
    new THREE.MeshStandardMaterial({
      color: 0x43494f,
      roughness: 0.9,
    }),
  );
  door.position.set(-4.28, 1.7, -11.32);
  backdrop.add(door);

  const vent = new THREE.Mesh(
    new THREE.BoxGeometry(1.8, 0.5, 0.55),
    new THREE.MeshStandardMaterial({
      color: 0x6a727c,
      roughness: 0.78,
      metalness: 0.12,
    }),
  );
  vent.position.set(3.9, 4.8, -10.92);
  vent.castShadow = true;
  backdrop.add(vent);

  addSideFence(backdrop, -6.9, -9.9, 0.05);
  addSideFence(backdrop, 6.9, -9.9, -0.05);

  const utilityPoleMaterial = new THREE.MeshStandardMaterial({
    color: 0x4a3e2f,
    roughness: 0.9,
  });
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 6.8, 8), utilityPoleMaterial);
  pole.position.set(5.9, 3.4, -10.2);
  pole.castShadow = true;
  backdrop.add(pole);

  const wireMaterial = new THREE.LineBasicMaterial({ color: 0x2b343c });
  const wireOne = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(4.7, 5.8, -10.4),
      new THREE.Vector3(-5.6, 5.5, -10.95),
    ]),
    wireMaterial,
  );
  const wireTwo = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(5.1, 5.5, -10.2),
      new THREE.Vector3(-5.2, 5.15, -10.82),
    ]),
    wireMaterial,
  );
  backdrop.add(wireOne, wireTwo);

  const buildingMaterial = new THREE.MeshStandardMaterial({
    color: 0x556371,
    roughness: 0.94,
  });
  [-8.2, 8.3].forEach((x, index) => {
    const building = new THREE.Mesh(new THREE.BoxGeometry(2.3, 6 + index * 0.9, 2.2), buildingMaterial);
    building.position.set(x, 3 + index * 0.45, -13.8 - index * 0.4);
    building.receiveShadow = true;
    backdrop.add(building);
  });
}

function buildDesertBackdrop(backdrop: THREE.Group): void {
  const mesas = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 9),
    new THREE.MeshBasicMaterial({
      map: getDesertMesaTexture(),
      transparent: true,
    }),
  );
  mesas.position.set(0, 4.3, -15.8);
  backdrop.add(mesas);

  const dune = new THREE.Mesh(
    new THREE.CylinderGeometry(6.6, 7.3, 1.5, 24, 1, true, Math.PI, Math.PI),
    new THREE.MeshStandardMaterial({
      color: 0xc68e53,
      roughness: 0.98,
    }),
  );
  dune.rotation.z = Math.PI / 2;
  dune.position.set(-0.3, 0.8, -10.8);
  backdrop.add(dune);

  const fenceMaterial = new THREE.MeshStandardMaterial({
    color: 0x7a6040,
    roughness: 0.9,
  });
  for (let index = -6; index <= 6; index += 2) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.9, 0.08), fenceMaterial);
    post.position.set(index * 0.9, 0.95, -9.7);
    backdrop.add(post);
  }

  const railOne = new THREE.Mesh(new THREE.BoxGeometry(12.4, 0.05, 0.05), fenceMaterial);
  railOne.position.set(0, 1.52, -9.68);
  backdrop.add(railOne);

  const railTwo = new THREE.Mesh(new THREE.BoxGeometry(12.4, 0.04, 0.04), fenceMaterial);
  railTwo.position.set(0, 0.92, -9.7);
  backdrop.add(railTwo);

  addCactus(backdrop, -6.2, -11.2, 1.9);
  addCactus(backdrop, 6.4, -10.5, 1.55);

  const rockMaterial = new THREE.MeshStandardMaterial({
    color: 0x9b6c43,
    roughness: 0.96,
  });
  [-4.4, -3.6, 4.2, 5.1].forEach((x, index) => {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(0.34 + (index % 2) * 0.12, 0), rockMaterial);
    rock.position.set(x, 0.24, -8.7 - (index % 3) * 0.35);
    rock.rotation.set(index * 0.2, index * 0.45, index * 0.12);
    backdrop.add(rock);
  });
}

function addSideFence(backdrop: THREE.Group, x: number, z: number, rotationY: number): void {
  const fence = new THREE.Mesh(
    new THREE.PlaneGeometry(2.8, 2.5),
    new THREE.MeshStandardMaterial({
      color: 0x66727e,
      alphaMap: getChainLinkTexture(),
      transparent: true,
      side: THREE.DoubleSide,
      roughness: 0.86,
      metalness: 0.12,
    }),
  );
  fence.position.set(x, 1.45, z);
  fence.rotation.y = rotationY;
  backdrop.add(fence);
}

function addCactus(backdrop: THREE.Group, x: number, z: number, height: number): void {
  const cactusMaterial = new THREE.MeshStandardMaterial({
    color: 0x486940,
    roughness: 0.9,
  });

  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, height, 10), cactusMaterial);
  trunk.position.set(x, height / 2, z);
  backdrop.add(trunk);

  const armLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, height * 0.46, 8), cactusMaterial);
  armLeft.position.set(x - 0.24, height * 0.56, z);
  armLeft.rotation.z = Math.PI / 2.8;
  backdrop.add(armLeft);

  const armRight = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.09, height * 0.38, 8), cactusMaterial);
  armRight.position.set(x + 0.22, height * 0.42, z);
  armRight.rotation.z = -Math.PI / 2.7;
  backdrop.add(armRight);
}

function clearBackdrop(group: THREE.Group): void {
  while (group.children.length > 0) {
    const child = group.children[group.children.length - 1] as THREE.Object3D;
    group.remove(child);
    disposeObject(child);
  }
}

function disposeObject(node: THREE.Object3D): void {
  for (const child of node.children) {
    disposeObject(child);
  }

  const mesh = node as THREE.Mesh;
  if (mesh.geometry) {
    mesh.geometry.dispose();
  }

  const material = mesh.material;
  if (Array.isArray(material)) {
    material.forEach((entry) => entry.dispose());
  } else if (material) {
    material.dispose();
  }
}

function getCourtTexture(ambience: AmbienceId): THREE.CanvasTexture {
  const cachedTexture = courtTextureCache.get(ambience);
  if (cachedTexture) {
    return cachedTexture;
  }

  const theme = AMBIENCE_THEMES[ambience];
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1536;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

  ctx.fillStyle = theme.floorBase;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let index = 0; index < 2600; index += 1) {
    const size = 2 + Math.random() * 10;
    ctx.fillStyle = theme.floorNoise;
    ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, size, size);
  }

  ctx.fillStyle = ambience === "hood" ? "rgba(36, 42, 45, 0.08)" : "rgba(155, 111, 56, 0.08)";
  for (let index = 0; index < 18; index += 1) {
    ctx.beginPath();
    const radius = 40 + Math.random() * 170;
    ctx.ellipse(
      Math.random() * canvas.width,
      Math.random() * canvas.height,
      radius,
      18 + Math.random() * 48,
      Math.random() * Math.PI,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  const courtLeft = canvas.width * 0.14;
  const courtRight = canvas.width * 0.86;
  const baselineY = canvas.height * 0.08;
  const nearEndY = canvas.height * 0.93;
  const centerX = canvas.width / 2;
  const hoopY = canvas.height * 0.27;
  const freeThrowY = canvas.height * 0.48;
  const paintWidth = canvas.width * 0.22;
  const paintDepth = freeThrowY - baselineY;

  ctx.fillStyle = theme.keyFill;
  ctx.fillRect(centerX - paintWidth / 2, baselineY, paintWidth, paintDepth);

  ctx.strokeStyle = theme.lineColor;
  ctx.lineWidth = ambience === "hood" ? 11 : 10;
  ctx.strokeRect(courtLeft, baselineY, courtRight - courtLeft, nearEndY - baselineY);
  ctx.strokeRect(centerX - paintWidth / 2, baselineY, paintWidth, paintDepth);

  ctx.beginPath();
  ctx.arc(centerX, freeThrowY, canvas.width * 0.11, Math.PI, 0);
  ctx.stroke();

  ctx.setLineDash([22, 18]);
  ctx.beginPath();
  ctx.arc(centerX, freeThrowY, canvas.width * 0.11, 0, Math.PI);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.beginPath();
  ctx.arc(centerX, hoopY, canvas.width * 0.045, 0, Math.PI * 2);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(centerX, hoopY, canvas.width * 0.085, Math.PI * 0.08, Math.PI * 0.92);
  ctx.stroke();

  const threePointRadius = canvas.width * 0.41;
  const cornerLineY = canvas.height * 0.355;
  ctx.beginPath();
  ctx.moveTo(courtLeft, baselineY);
  ctx.lineTo(courtLeft, cornerLineY);
  ctx.moveTo(courtRight, baselineY);
  ctx.lineTo(courtRight, cornerLineY);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(centerX, hoopY, threePointRadius, Math.PI * 0.165, Math.PI * 0.835);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(centerX, freeThrowY + canvas.height * 0.06);
  ctx.lineTo(centerX, nearEndY);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(centerX, nearEndY, canvas.width * 0.13, Math.PI, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = 7;
  ctx.strokeStyle = ambience === "hood" ? "rgba(247, 248, 249, 0.42)" : "rgba(247, 232, 205, 0.38)";
  for (let index = 0; index < 4; index += 1) {
    const y = baselineY + canvas.height * (0.07 + index * 0.06);
    ctx.beginPath();
    ctx.moveTo(centerX - paintWidth / 2, y);
    ctx.lineTo(centerX - paintWidth / 2 + 32, y);
    ctx.moveTo(centerX + paintWidth / 2, y);
    ctx.lineTo(centerX + paintWidth / 2 - 32, y);
    ctx.stroke();
  }

  if (ambience === "hood") {
    ctx.fillStyle = "rgba(44, 20, 20, 0.18)";
    ctx.fillRect(canvas.width * 0.18, canvas.height * 0.84, canvas.width * 0.2, 14);
    ctx.fillRect(canvas.width * 0.64, canvas.height * 0.18, canvas.width * 0.11, 10);
  } else {
    ctx.fillStyle = "rgba(196, 126, 68, 0.14)";
    for (let index = 0; index < 12; index += 1) {
      ctx.fillRect(Math.random() * canvas.width, canvas.height * (0.14 + Math.random() * 0.76), 18 + Math.random() * 56, 5 + Math.random() * 10);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  courtTextureCache.set(ambience, texture);
  return texture;
}

function getSkyTexture(ambience: AmbienceId): THREE.CanvasTexture {
  const cachedTexture = skyTextureCache.get(ambience);
  if (cachedTexture) {
    return cachedTexture;
  }

  const theme = AMBIENCE_THEMES[ambience];
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, theme.skyStops[0]);
  gradient.addColorStop(0.58, theme.skyStops[1]);
  gradient.addColorStop(1, theme.skyStops[2]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = theme.sunGlowColor;
  ctx.beginPath();
  ctx.arc(ambience === "hood" ? 760 : 220, ambience === "hood" ? 210 : 170, ambience === "hood" ? 120 : 150, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = theme.skyCloudColor;
  for (let index = 0; index < 5; index += 1) {
    const x = 80 + index * 180;
    const y = 120 + (index % 2) * 70;
    ctx.beginPath();
    ctx.arc(x, y, 52, 0, Math.PI * 2);
    ctx.arc(x + 60, y + 10, 68, 0, Math.PI * 2);
    ctx.arc(x + 130, y, 46, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  skyTextureCache.set(ambience, texture);
  return texture;
}

function getChainLinkTexture(): THREE.CanvasTexture {
  if (chainLinkTextureCache) {
    return chainLinkTextureCache;
  }

  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = "rgba(255,255,255,0.92)";
  ctx.lineWidth = 3;
  const spacing = 28;
  for (let x = -canvas.height; x <= canvas.width + canvas.height; x += spacing) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + canvas.height, canvas.height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x, canvas.height);
    ctx.lineTo(x + canvas.height, 0);
    ctx.stroke();
  }

  chainLinkTextureCache = new THREE.CanvasTexture(canvas);
  return chainLinkTextureCache;
}

function getHoodWallTexture(): THREE.CanvasTexture {
  if (hoodWallTextureCache) {
    return hoodWallTextureCache;
  }

  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

  ctx.fillStyle = "#824c3f";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const brickWidth = 110;
  const brickHeight = 44;
  for (let row = 0; row < Math.ceil(canvas.height / brickHeight) + 1; row += 1) {
    const rowOffset = row % 2 === 0 ? 0 : brickWidth / 2;
    for (let col = -1; col < Math.ceil(canvas.width / brickWidth) + 1; col += 1) {
      const x = col * brickWidth + rowOffset;
      const y = row * brickHeight;
      ctx.fillStyle = row % 3 === 0 ? "#8d5446" : row % 3 === 1 ? "#76483d" : "#905847";
      ctx.fillRect(x, y, brickWidth - 4, brickHeight - 4);
      ctx.fillStyle = "rgba(255,255,255,0.04)";
      ctx.fillRect(x + 10, y + 8, brickWidth * 0.42, 6);
    }
  }

  ctx.fillStyle = "rgba(40, 24, 20, 0.22)";
  for (let index = 0; index < 16; index += 1) {
    ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 40 + Math.random() * 200, 10 + Math.random() * 40);
  }

  const graffitiColors = ["#47e0ca", "#ff5f65", "#ffd74a", "#7bd0ff", "#ffffff"];
  ctx.lineCap = "round";
  for (let index = 0; index < 28; index += 1) {
    ctx.strokeStyle = graffitiColors[index % graffitiColors.length];
    ctx.lineWidth = 12 + (index % 3) * 6;
    ctx.beginPath();
    const startX = 260 + Math.random() * 1460;
    const startY = 240 + Math.random() * 430;
    ctx.moveTo(startX, startY);
    ctx.bezierCurveTo(
      startX + 60 + Math.random() * 160,
      startY - 110 + Math.random() * 120,
      startX + 160 + Math.random() * 220,
      startY + 60 + Math.random() * 140,
      startX + 240 + Math.random() * 280,
      startY - 20 + Math.random() * 180,
    );
    ctx.stroke();
  }

  ctx.font = "bold 240px Impact, Arial Black, sans-serif";
  ctx.textAlign = "center";
  ctx.fillStyle = "rgba(23, 34, 43, 0.26)";
  ctx.fillText("HOOPS", canvas.width * 0.5 + 18, canvas.height * 0.56 + 18);
  ctx.fillStyle = "#ffefdb";
  ctx.fillText("HOOPS", canvas.width * 0.5, canvas.height * 0.56);
  ctx.strokeStyle = "#ef5d5d";
  ctx.lineWidth = 16;
  ctx.strokeText("HOOPS", canvas.width * 0.5, canvas.height * 0.56);

  ctx.fillStyle = "rgba(247, 242, 220, 0.78)";
  ctx.fillRect(1520, 210, 230, 290);
  ctx.fillStyle = "#1c2c38";
  ctx.fillRect(1550, 248, 170, 18);
  ctx.fillRect(1550, 286, 120, 12);
  ctx.fillRect(1550, 318, 146, 12);
  ctx.fillStyle = "#de624a";
  ctx.fillRect(1550, 356, 92, 72);

  ctx.strokeStyle = "rgba(38, 18, 15, 0.24)";
  ctx.lineWidth = 14;
  for (let index = 0; index < 9; index += 1) {
    const x = 200 + index * 190;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x - 20, canvas.height);
    ctx.stroke();
  }

  hoodWallTextureCache = new THREE.CanvasTexture(canvas);
  hoodWallTextureCache.colorSpace = THREE.SRGBColorSpace;
  return hoodWallTextureCache;
}

function getDesertMesaTexture(): THREE.CanvasTexture {
  if (desertMesaTextureCache) {
    return desertMesaTextureCache;
  }

  const canvas = document.createElement("canvas");
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "rgba(247, 224, 177, 0)");
  gradient.addColorStop(1, "rgba(214, 146, 79, 0.25)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#b36c37";
  ctx.beginPath();
  ctx.moveTo(0, 730);
  ctx.lineTo(120, 640);
  ctx.lineTo(210, 610);
  ctx.lineTo(320, 520);
  ctx.lineTo(430, 560);
  ctx.lineTo(560, 430);
  ctx.lineTo(660, 450);
  ctx.lineTo(720, 390);
  ctx.lineTo(850, 420);
  ctx.lineTo(970, 350);
  ctx.lineTo(1090, 420);
  ctx.lineTo(1280, 330);
  ctx.lineTo(1450, 420);
  ctx.lineTo(1610, 360);
  ctx.lineTo(1770, 490);
  ctx.lineTo(1920, 460);
  ctx.lineTo(2048, 560);
  ctx.lineTo(2048, 1024);
  ctx.lineTo(0, 1024);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#d8924e";
  ctx.beginPath();
  ctx.moveTo(0, 860);
  ctx.quadraticCurveTo(600, 720, 1140, 810);
  ctx.quadraticCurveTo(1480, 860, 2048, 740);
  ctx.lineTo(2048, 1024);
  ctx.lineTo(0, 1024);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(255, 240, 204, 0.15)";
  ctx.beginPath();
  ctx.arc(240, 160, 110, 0, Math.PI * 2);
  ctx.fill();

  desertMesaTextureCache = new THREE.CanvasTexture(canvas);
  desertMesaTextureCache.colorSpace = THREE.SRGBColorSpace;
  return desertMesaTextureCache;
}
