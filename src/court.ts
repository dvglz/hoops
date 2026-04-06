import * as THREE from "three";

export function buildCourt(scene: THREE.Scene): void {
  scene.background = new THREE.Color(0xc5d5e2);

  const floorTexture = createCourtTexture();
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 26),
    new THREE.MeshStandardMaterial({
      map: floorTexture,
      roughness: 0.96,
      metalness: 0,
    }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const skyPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(28, 18),
    new THREE.MeshBasicMaterial({
      map: createSkyTexture(),
    }),
  );
  skyPlane.position.set(0, 8.5, -18);
  scene.add(skyPlane);
}

export function buildBackdrop(scene: THREE.Scene): void {
  const fenceMaterial = new THREE.MeshStandardMaterial({
    color: 0x596776,
    roughness: 0.72,
    metalness: 0.12,
  });

  for (let index = -6; index <= 6; index += 1) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.8, 0.08), fenceMaterial);
    post.position.set(index * 0.85, 1.4, -10.9);
    scene.add(post);
  }

  const topRail = new THREE.Mesh(new THREE.BoxGeometry(11.3, 0.08, 0.08), fenceMaterial);
  topRail.position.set(0, 2.72, -10.9);
  scene.add(topRail);

  const midRail = new THREE.Mesh(new THREE.BoxGeometry(11.3, 0.05, 0.05), fenceMaterial);
  midRail.position.set(0, 1.5, -10.88);
  scene.add(midRail);

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
    scene.add(building);
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
    scene.add(trunk);

    const crown = new THREE.Mesh(new THREE.ConeGeometry(0.7, 1.8, 7), treeLeafMaterial);
    crown.position.set(x, 2.2, -9.6);
    scene.add(crown);
  });
}

function createCourtTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1536;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

  ctx.fillStyle = "#b8b2aa";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let index = 0; index < 2500; index += 1) {
    const tone = 178 + Math.random() * 24;
    ctx.fillStyle = `rgba(${tone}, ${tone - 5}, ${tone - 10}, ${0.05 + Math.random() * 0.07})`;
    ctx.fillRect(Math.random() * canvas.width, Math.random() * canvas.height, 3 + Math.random() * 9, 3 + Math.random() * 9);
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

  ctx.fillStyle = "rgba(236, 242, 246, 0.07)";
  ctx.fillRect(centerX - paintWidth / 2, baselineY, paintWidth, paintDepth);

  ctx.strokeStyle = "rgba(238, 243, 247, 0.74)";
  ctx.lineWidth = 11;
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
  ctx.moveTo(centerX - paintWidth / 2, freeThrowY);
  ctx.lineTo(centerX - paintWidth / 2, freeThrowY + canvas.height * 0.1);
  ctx.moveTo(centerX + paintWidth / 2, freeThrowY);
  ctx.lineTo(centerX + paintWidth / 2, freeThrowY + canvas.height * 0.1);
  ctx.stroke();

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
  ctx.strokeStyle = "rgba(238, 243, 247, 0.5)";
  for (let index = 0; index < 4; index += 1) {
    const y = baselineY + canvas.height * (0.07 + index * 0.06);
    ctx.beginPath();
    ctx.moveTo(centerX - paintWidth / 2, y);
    ctx.lineTo(centerX - paintWidth / 2 + 32, y);
    ctx.moveTo(centerX + paintWidth / 2, y);
    ctx.lineTo(centerX + paintWidth / 2 - 32, y);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

function createSkyTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 1024;
  const ctx = canvas.getContext("2d") as CanvasRenderingContext2D;

  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, "#92c4f2");
  gradient.addColorStop(0.52, "#c7def1");
  gradient.addColorStop(1, "#f5dcc0");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "rgba(255,255,255,0.35)";
  for (let index = 0; index < 5; index += 1) {
    const x = 80 + index * 170;
    const y = 120 + (index % 2) * 60;
    ctx.beginPath();
    ctx.arc(x, y, 46, 0, Math.PI * 2);
    ctx.arc(x + 50, y + 8, 58, 0, Math.PI * 2);
    ctx.arc(x + 108, y, 44, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
