import * as THREE from "three";
import type {
  AmbienceId,
  BallSkinId,
  DebugPanelRefs,
  GameMode,
  HudRefs,
  RuntimeSettings,
} from "./constants";
import { BALL_SPAWN, DEFAULT_SETTINGS, FLOOR_Y, HOOP_CENTER } from "./constants";
import { applyBallSkin, createBall, createBallShadow, syncBallMesh, updatePreShotBall } from "./ball";
import { applyAmbience, createCourtRig, type CourtRig } from "./court";
import { buildHoop } from "./hoop";
import {
  applyGroundFriction,
  applyHoopAssist,
  resolveBackboardCollision,
  resolveBounds,
  resolveFloorCollision,
  resolveRimCollisions,
} from "./physics";
import { checkScore } from "./scoring";
import { syncDebugPanel } from "./debug";
import { updateBarVisibility, updateHint, updateHud } from "./hud";

export class HoopsGame {
  private container: HTMLElement;
  private hud: HudRefs;
  private debug: DebugPanelRefs;
  private settings: RuntimeSettings = { ...DEFAULT_SETTINGS };
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private clock = new THREE.Clock();
  private ambientLight: THREE.HemisphereLight;
  private sunLight: THREE.DirectionalLight;
  private courtRig: CourtRig;
  private ball: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  private ballShadow: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  private previewGeometry = new THREE.BufferGeometry();
  private previewLine: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  private aimMarker: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private ballPosition = BALL_SPAWN.clone();
  private previousBallPosition = BALL_SPAWN.clone();
  private ballVelocity = new THREE.Vector3();
  private aimPoint = HOOP_CENTER.clone().add(new THREE.Vector3(0, 0.36, 0.08));
  private predictedVelocity = new THREE.Vector3();
  private rimCollisionNodes: THREE.Vector3[] = [];
  private score = 0;
  private strength = 0.58;
  private strengthDirection = 1;
  private targetBias = 0;
  private targetDirection = 1;
  private previewAssist = 0;
  private shotAssist = 0;
  private mode: GameMode = "idle";
  private ballScored = false;
  private resetTimer = 0;
  private shotClock = 0;
  private scoreBallPop = 0;
  private scoreOverlay: HTMLDivElement;
  private scorePopup: HTMLDivElement;
  private preShotClock = 0;
  private shotCount = 0;
  private postScoreTimer = 0;
  private postScoreFading = false;
  private externalStepLockUntil = 0;
  private readonly tempVec = new THREE.Vector3();
  private readonly rimCenter = HOOP_CENTER.clone();

  constructor(container: HTMLElement, hud: HudRefs, debug: DebugPanelRefs) {
    this.container = container;
    this.hud = hud;
    this.debug = debug;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xbec9d2, 10, 28);

    this.camera = new THREE.PerspectiveCamera(44, 1, 0.1, 100);
    this.camera.position.set(1.95, 3.38, 8.25);
    this.camera.lookAt(0, 2.7, -2.2);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.domElement.setAttribute("aria-label", "HOOPS game canvas");
    this.renderer.domElement.style.touchAction = "none";
    this.container.append(this.renderer.domElement);

    this.ambientLight = new THREE.HemisphereLight(0xf5fbff, 0xcda97a, 1.25);
    this.scene.add(this.ambientLight);

    this.sunLight = new THREE.DirectionalLight(0xfff1cf, 1.75);
    this.sunLight.position.set(6, 9, 8);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.camera.left = -10;
    this.sunLight.shadow.camera.right = 10;
    this.sunLight.shadow.camera.top = 10;
    this.sunLight.shadow.camera.bottom = -10;
    this.sunLight.shadow.camera.near = 1;
    this.sunLight.shadow.camera.far = 25;
    this.scene.add(this.sunLight);

    this.courtRig = createCourtRig(this.scene);
    this.ball = createBall(this.scene, this.settings.ballSkin);
    this.ballShadow = createBallShadow(this.scene);
    this.previewLine = new THREE.Line(
      this.previewGeometry,
      new THREE.LineBasicMaterial({
        color: 0xf6f6f0,
        transparent: true,
        opacity: 0.64,
      }),
    );
    this.aimMarker = new THREE.Mesh(
      new THREE.RingGeometry(0.06, 0.1, 24),
      new THREE.MeshBasicMaterial({
        color: 0xfff7d8,
        transparent: true,
        opacity: 0.78,
        side: THREE.DoubleSide,
      }),
    );
    this.aimMarker.visible = false;
    this.scene.add(this.aimMarker);
    this.scene.add(this.previewLine);

    this.scoreOverlay = document.createElement("div");
    this.scoreOverlay.className = "score-flash-overlay";
    this.container.append(this.scoreOverlay);

    this.scorePopup = document.createElement("div");
    this.scorePopup.className = "score-popup";
    this.container.append(this.scorePopup);

    this.rimCollisionNodes = buildHoop(this.scene);
    this.applyAmbienceTheme(this.settings.ambience);
    this.resetBall();
    syncDebugPanel(this.debug, this.settings);
    updateHud(this.hud, this.targetBias, this.strength);
    updateHint(this.hud, this.mode, this.shotCount, this.ballScored);
    updateBarVisibility(this.hud, this.mode);
    this.attachEvents();
    this.resize();
  }

  start(): void {
    this.clock.start();
    this.renderer.setAnimationLoop(this.animate);
  }

  dispose(): void {
    this.renderer.setAnimationLoop(null);
    window.removeEventListener("resize", this.handleResize);
    window.removeEventListener("keydown", this.handleKeyDown);
    this.renderer.domElement.removeEventListener("pointerdown", this.handlePointerDown);
    this.debug.gravityInput.removeEventListener("input", this.handleGravityInput);
    this.debug.ambienceSelect.removeEventListener("change", this.handleAmbienceChange);
    this.debug.ballSkinSelect.removeEventListener("change", this.handleBallSkinChange);
    this.renderer.dispose();
  }

  renderGameToText(): string {
    return JSON.stringify({
      mode: this.mode,
      coordSystem: "x right, y up, z toward player",
      score: this.score,
      preShotMode: this.mode === "idle" || this.mode === "targeting" || this.mode === "power",
      settings: {
        gravity: Number(this.settings.gravity.toFixed(1)),
        ambience: this.settings.ambience,
        ballSkin: this.settings.ballSkin,
      },
      strength: Number(this.strength.toFixed(2)),
      target: {
        x: Number(this.aimPoint.x.toFixed(2)),
        y: Number(this.aimPoint.y.toFixed(2)),
        z: Number(this.aimPoint.z.toFixed(2)),
      },
      ball: {
        x: Number(this.ball.position.x.toFixed(2)),
        y: Number(this.ball.position.y.toFixed(2)),
        z: Number(this.ball.position.z.toFixed(2)),
        vx: Number(this.ballVelocity.x.toFixed(2)),
        vy: Number(this.ballVelocity.y.toFixed(2)),
        vz: Number(this.ballVelocity.z.toFixed(2)),
      },
      hoop: {
        x: this.rimCenter.x,
        y: this.rimCenter.y,
        z: this.rimCenter.z,
      },
      liveBall: this.mode === "flight",
    });
  }

  advanceTime(milliseconds: number): void {
    const steps = Math.max(1, Math.round(milliseconds / (1000 / 60)));
    this.externalStepLockUntil = performance.now() + 250;
    for (let index = 0; index < steps; index += 1) {
      this.update(1 / 60);
    }
    this.render();
  }

  private callSyncBallMesh(): void {
    syncBallMesh(this.ball, this.ballShadow, this.ballPosition);
  }

  private attachEvents(): void {
    this.renderer.domElement.addEventListener("pointerdown", this.handlePointerDown);
    window.addEventListener("resize", this.handleResize);
    window.addEventListener("keydown", this.handleKeyDown);
    this.debug.gravityInput.addEventListener("input", this.handleGravityInput);
    this.debug.ambienceSelect.addEventListener("change", this.handleAmbienceChange);
    this.debug.ballSkinSelect.addEventListener("change", this.handleBallSkinChange);
  }

  private handlePointerDown = (event: PointerEvent): void => {
    event.preventDefault();
    this.advanceMode();
  };

  private handleResize = (): void => {
    this.resize();
  };

  private handleKeyDown = (event: KeyboardEvent): void => {
    const key = event.key.toLowerCase();
    if (key === "f") {
      void this.toggleFullscreen();
      return;
    }

    if (key === " " || key === "space" || key === "enter") {
      event.preventDefault();
      this.advanceMode();
    }
  };

  private handleGravityInput = (): void => {
    this.settings.gravity = Number(this.debug.gravityInput.value);
    this.debug.gravityValue.textContent = this.settings.gravity.toFixed(1);
    if (this.mode === "power") {
      this.updateAimPreview();
    }
  };

  private handleAmbienceChange = (): void => {
    const ambience = this.debug.ambienceSelect.value as AmbienceId;
    if (ambience === this.settings.ambience) {
      return;
    }

    this.settings.ambience = ambience;
    this.applyAmbienceTheme(ambience);
    syncDebugPanel(this.debug, this.settings);
  };

  private handleBallSkinChange = (): void => {
    const ballSkin = this.debug.ballSkinSelect.value as BallSkinId;
    if (ballSkin === this.settings.ballSkin) {
      return;
    }

    this.settings.ballSkin = ballSkin;
    applyBallSkin(this.ball, ballSkin);
    syncDebugPanel(this.debug, this.settings);
  };

  private advanceMode(): void {
    if (this.mode === "idle") {
      this.mode = "targeting";
      updateHint(this.hud, this.mode, this.shotCount, this.ballScored);
      updateBarVisibility(this.hud, this.mode);
      return;
    }

    if (this.mode === "targeting") {
      this.mode = "power";
      this.strength = 0.18;
      this.strengthDirection = 1;
      this.updateAimPreview();
      updateHint(this.hud, this.mode, this.shotCount, this.ballScored);
      updateBarVisibility(this.hud, this.mode);
      return;
    }

    if (this.mode === "power") {
      this.shootBall();
    }
  }

  private animate = (time: number): void => {
    if (time < this.externalStepLockUntil) {
      this.render();
      return;
    }

    const delta = Math.min(this.clock.getDelta(), 1 / 24);
    this.update(delta);
    this.render();
  };

  private update(delta: number): void {
    if (this.scoreBallPop > 0) {
      this.scoreBallPop = Math.max(0, this.scoreBallPop - delta * 3.3);
      const pop = 1 + this.scoreBallPop * 0.35;
      this.ball.scale.setScalar(pop);
    }

    if (this.mode === "idle" || this.mode === "targeting" || this.mode === "power") {
      this.preShotClock = updatePreShotBall(
        this.ball,
        this.ballPosition,
        this.preShotClock,
        delta,
        () => this.callSyncBallMesh(),
      );

      if (this.mode === "targeting") {
        this.targetBias += delta * this.targetDirection * 1.8;
        if (this.targetBias >= 1.12) {
          this.targetBias = 1.12;
          this.targetDirection = -1;
        } else if (this.targetBias <= -1.12) {
          this.targetBias = -1.12;
          this.targetDirection = 1;
        }
        updateHud(this.hud, this.targetBias, this.strength);
      }

      if (this.mode === "power") {
        this.strength += delta * this.strengthDirection * 1.35;
        if (this.strength >= 1) {
          this.strength = 1;
          this.strengthDirection = -1;
        } else if (this.strength <= 0.18) {
          this.strength = 0.18;
          this.strengthDirection = 1;
        }
        this.updateAimPreview();
      }
      return;
    }

    if (this.mode === "resetting") {
      this.resetTimer -= delta;
      if (this.resetTimer <= 0) {
        this.resetBall();
      }
      return;
    }

    if (this.mode !== "flight") {
      return;
    }

    this.shotClock += delta;
    const substeps = Math.max(1, Math.ceil(delta / (1 / 120)));
    const step = delta / substeps;

    for (let index = 0; index < substeps; index += 1) {
      this.previousBallPosition.copy(this.ballPosition);
      this.ballVelocity.y += this.settings.gravity * step;
      this.ballPosition.addScaledVector(this.ballVelocity, step);
      this.ball.rotation.x += this.ballVelocity.z * step * 3;
      this.ball.rotation.z -= this.ballVelocity.x * step * 3;
      applyHoopAssist(this.ballPosition, this.ballVelocity, this.ballScored, this.shotAssist, step, this.tempVec);
      resolveBackboardCollision(this.ballPosition, this.previousBallPosition, this.ballVelocity);
      resolveRimCollisions(this.ballPosition, this.ballVelocity, this.rimCollisionNodes, this.tempVec);
      const stopped = resolveFloorCollision(this.ballPosition, this.ballVelocity, this.shotClock, FLOOR_Y);
      applyGroundFriction(this.ballPosition, this.ballVelocity, step, FLOOR_Y);
      if (stopped && !this.ballScored) {
        this.scheduleReset(0.45);
      }
      if (resolveBounds(this.ballPosition, this.shotClock) && !this.ballScored) {
        this.scheduleReset(0.3);
      }
      const scoreResult = checkScore(
        this.ballPosition,
        this.previousBallPosition,
        this.ballVelocity,
        this.ballScored,
        this.shotAssist,
        this.rimCenter,
      );
      if (scoreResult) {
        this.completeScore();
      }
      if (this.resetTimer > 0) {
        break;
      }
    }
    this.callSyncBallMesh();

    if (this.ballScored && this.postScoreTimer > 0) {
      this.postScoreTimer -= delta;
      if (this.postScoreTimer < 0.5 && !this.postScoreFading) {
        this.postScoreFading = true;
        this.ball.material.transparent = true;
      }
      if (this.postScoreFading) {
        const fadeProgress = Math.max(0, this.postScoreTimer) / 0.5;
        this.ball.material.opacity = fadeProgress;
      }
      if (this.postScoreTimer <= 0) {
        this.scheduleReset(0.1);
      }
    }
  }

  private completeScore(): void {
    this.ballScored = true;
    this.score += 1;
    this.scoreBallPop = 1;
    this.postScoreTimer = 1.8;
    this.ballVelocity.y = Math.min(this.ballVelocity.y, -3.5);

    this.scorePopup.textContent = String(this.score);
    this.scorePopup.classList.remove("is-active");
    void this.scorePopup.offsetWidth;
    this.scorePopup.classList.add("is-active");
    setTimeout(() => this.scorePopup.classList.remove("is-active"), 900);

    this.scoreOverlay.classList.add("is-active");
    setTimeout(() => this.scoreOverlay.classList.remove("is-active"), 400);
  }

  private scheduleReset(delay: number): void {
    this.mode = "resetting";
    this.resetTimer = delay;
    this.previewLine.visible = false;
    this.aimMarker.visible = false;
    updateHint(this.hud, this.mode, this.shotCount, this.ballScored);
    updateBarVisibility(this.hud, this.mode);
  }

  private resetBall(): void {
    this.mode = "idle";
    this.ballScored = false;
    this.shotClock = 0;
    this.shotAssist = 0;
    this.resetTimer = 0;
    this.preShotClock = 0;
    this.strength = 0.58;
    this.strengthDirection = 1;
    this.targetBias = 0;
    this.targetDirection = 1;
    this.postScoreTimer = 0;
    this.postScoreFading = false;
    this.ballPosition.copy(BALL_SPAWN);
    this.previousBallPosition.copy(BALL_SPAWN);
    this.ballVelocity.set(0, 0, 0);
    this.ball.scale.setScalar(1);
    this.ball.material.opacity = 1;
    this.ball.material.transparent = false;
    this.callSyncBallMesh();
    this.previewLine.visible = false;
    this.aimMarker.visible = false;
    updateHud(this.hud, this.targetBias, this.strength);
    updateHint(this.hud, this.mode, this.shotCount, this.ballScored);
    updateBarVisibility(this.hud, this.mode);
  }

  private shootBall(): void {
    this.mode = "flight";
    this.ballScored = false;
    this.shotClock = 0;
    this.shotCount += 1;
    this.postScoreTimer = 0;
    this.postScoreFading = false;
    this.shotAssist = this.previewAssist;
    this.ball.scale.setScalar(1);
    this.ballPosition.copy(BALL_SPAWN);
    this.previousBallPosition.copy(BALL_SPAWN);
    this.ballVelocity.copy(this.predictedVelocity);
    this.callSyncBallMesh();
    this.previewLine.visible = false;
    this.aimMarker.visible = false;
    updateHint(this.hud, this.mode, this.shotCount, this.ballScored);
    updateBarVisibility(this.hud, this.mode);
  }

  private updateAimPreview(): void {
    const rawAimPoint = new THREE.Vector3(
      HOOP_CENTER.x + this.targetBias,
      HOOP_CENTER.y + 0.36,
      HOOP_CENTER.z + 0.08,
    );

    const centerAssist = 1 - THREE.MathUtils.clamp(Math.abs(this.targetBias) / 0.42, 0, 1);
    const strengthAssist = 1 - THREE.MathUtils.clamp(Math.abs(this.strength - 0.76) / 0.52, 0, 1);
    const assist = centerAssist * strengthAssist;
    this.previewAssist = assist;
    this.aimPoint
      .copy(rawAimPoint)
      .lerp(new THREE.Vector3(0, HOOP_CENTER.y + 0.42, HOOP_CENTER.z + 0.12), assist * 0.52);

    const flightTime = THREE.MathUtils.lerp(1.36, 0.76, this.strength);
    this.predictedVelocity
      .copy(this.aimPoint)
      .sub(BALL_SPAWN)
      .addScaledVector(new THREE.Vector3(0, -this.settings.gravity, 0), 0.5 * flightTime * flightTime)
      .divideScalar(flightTime);

    const points: THREE.Vector3[] = [];
    const simulatedPosition = BALL_SPAWN.clone();
    const simulatedVelocity = this.predictedVelocity.clone();
    const timeStep = 1 / 30;
    for (let index = 0; index < 26; index += 1) {
      points.push(simulatedPosition.clone());
      simulatedVelocity.y += this.settings.gravity * timeStep;
      simulatedPosition.addScaledVector(simulatedVelocity, timeStep);
    }
    this.previewGeometry.setFromPoints(points);
    this.previewLine.visible = this.mode === "power";

    this.aimMarker.position.copy(this.aimPoint);
    this.aimMarker.lookAt(this.camera.position);
    this.aimMarker.visible = this.mode === "power";
    updateHud(this.hud, this.targetBias, this.strength);
  }

  private applyAmbienceTheme(ambience: AmbienceId): void {
    const lighting = applyAmbience(this.scene, this.courtRig, ambience);
    this.ambientLight.color.setHex(lighting.hemisphereSky);
    this.ambientLight.groundColor.setHex(lighting.hemisphereGround);
    this.ambientLight.intensity = lighting.hemisphereIntensity;
    this.sunLight.color.setHex(lighting.sunColor);
    this.sunLight.intensity = lighting.sunIntensity;
    this.sunLight.position.set(...lighting.sunPosition);
    this.renderer.toneMappingExposure = ambience === "desert" ? 1.04 : 0.94;
  }

  private resize(): void {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  private async toggleFullscreen(): Promise<void> {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await this.container.requestFullscreen();
  }

  private render(): void {
    this.aimMarker.lookAt(this.camera.position);
    this.renderer.render(this.scene, this.camera);
  }
}
