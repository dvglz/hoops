import * as THREE from "three";

export type GameMode = "idle" | "targeting" | "power" | "flight" | "resetting";

export type HudRefs = {
  root: HTMLDivElement;
  targetFill: HTMLDivElement;
  targetValue: HTMLSpanElement;
  strengthFill: HTMLDivElement;
  strengthValue: HTMLSpanElement;
  hint: HTMLDivElement;
  hintTitle: HTMLSpanElement;
  hintText: HTMLSpanElement;
  targetMetric: HTMLDivElement;
  strengthMetric: HTMLDivElement;
};

export const BALL_RADIUS = 0.19;
export const GRAVITY = -18;
export const RIM_RADIUS = 0.33;
export const RIM_TUBE_RADIUS = 0.025;
export const HOOP_CENTER = new THREE.Vector3(0, 3.64, -6.32);
export const BALL_SPAWN = new THREE.Vector3(0, 1.26, 2.55);
export const BOARD_CENTER = new THREE.Vector3(0, 4.09, -6.5);
export const FLOOR_Y = 0;
