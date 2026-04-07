import * as THREE from "three";

export type GameMode = "idle" | "targeting" | "power" | "flight" | "resetting";
export type AmbienceId = "city" | "hood" | "desert";
export type BallSkinId = "classic" | "blacktop" | "sunburst";

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

export type DebugPanelRefs = {
  root: HTMLDivElement;
  toggle: HTMLButtonElement;
  body: HTMLDivElement;
  gravityInput: HTMLInputElement;
  gravityValue: HTMLSpanElement;
  ambienceSelect: HTMLSelectElement;
  ballSkinSelect: HTMLSelectElement;
};

export type RuntimeSettings = {
  gravity: number;
  ambience: AmbienceId;
  ballSkin: BallSkinId;
};

export const AMBIENCE_OPTIONS: Array<{ id: AmbienceId; label: string }> = [
  { id: "city", label: "City Run" },
  { id: "hood", label: "The Hood" },
  { id: "desert", label: "Desert Run" },
];

export const BALL_SKIN_OPTIONS: Array<{ id: BallSkinId; label: string }> = [
  { id: "classic", label: "Classic Orange" },
  { id: "blacktop", label: "Blacktop Night" },
  { id: "sunburst", label: "Sunburst Sand" },
];

export const BALL_RADIUS = 0.19;
export const DEFAULT_GRAVITY = -18;
export const RIM_RADIUS = 0.32;
export const RIM_TUBE_RADIUS = 0.023;
export const HOOP_CENTER = new THREE.Vector3(0, 3.64, -6.32);
export const BALL_SPAWN = new THREE.Vector3(0, 1.26, 2.55);
export const BOARD_CENTER = new THREE.Vector3(0, 4.09, -6.5);
export const FLOOR_Y = 0;

export const DEFAULT_SETTINGS: RuntimeSettings = {
  gravity: DEFAULT_GRAVITY,
  ambience: "city",
  ballSkin: "classic",
};
