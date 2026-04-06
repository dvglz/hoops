import * as THREE from "three";
import { BOARD_CENTER, HOOP_CENTER, RIM_RADIUS, RIM_TUBE_RADIUS } from "./constants";

export function buildHoop(scene: THREE.Scene): THREE.Vector3[] {
  const poleMaterial = new THREE.MeshStandardMaterial({
    color: 0x41586d,
    roughness: 0.68,
    metalness: 0.24,
  });
  const boardMaterial = new THREE.MeshStandardMaterial({
    color: 0xf3f5f9,
    roughness: 0.34,
    metalness: 0.06,
    transparent: true,
    opacity: 0.94,
  });

  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.12, 4.8, 10), poleMaterial);
  pole.position.set(0, 2.4, -7.4);
  pole.castShadow = true;
  pole.receiveShadow = true;
  scene.add(pole);

  const support = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.96), poleMaterial);
  support.position.set(0, 4.15, -6.94);
  support.castShadow = true;
  scene.add(support);

  const supportDiagonal = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.7, 0.06), poleMaterial);
  supportDiagonal.position.set(0, 3.77, -6.99);
  supportDiagonal.rotation.x = Math.PI / 4;
  supportDiagonal.castShadow = true;
  scene.add(supportDiagonal);

  const backboard = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.08, 0.08), boardMaterial);
  backboard.position.copy(BOARD_CENTER);
  backboard.castShadow = true;
  backboard.receiveShadow = true;
  scene.add(backboard);

  const boardSquare = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(0.62, 0.46, 0.09)),
    new THREE.LineBasicMaterial({ color: 0xffffff }),
  );
  boardSquare.position.set(0, 3.67, -6.46);
  scene.add(boardSquare);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(RIM_RADIUS, RIM_TUBE_RADIUS, 14, 36),
    new THREE.MeshStandardMaterial({
      color: 0xd44f31,
      roughness: 0.38,
      metalness: 0.18,
    }),
  );
  rim.rotation.x = Math.PI / 2;
  rim.position.copy(HOOP_CENTER);
  rim.castShadow = true;
  scene.add(rim);

  const hoopBase = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.28), poleMaterial);
  hoopBase.position.set(0, 3.08, -6.42);
  scene.add(hoopBase);

  const rimCollisionNodes: THREE.Vector3[] = [];
  const collisionSegments = 18;
  for (let index = 0; index < collisionSegments; index += 1) {
    const angle = (index / collisionSegments) * Math.PI * 2;
    rimCollisionNodes.push(
      new THREE.Vector3(
        HOOP_CENTER.x + Math.cos(angle) * RIM_RADIUS,
        HOOP_CENTER.y,
        HOOP_CENTER.z + Math.sin(angle) * RIM_RADIUS,
      ),
    );
  }

  return rimCollisionNodes;
}
