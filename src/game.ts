import * as THREE from "three";
import type { GameMode, HudRefs } from "./constants";
import { BALL_SPAWN, FLOOR_Y, GRAVITY, HOOP_CENTER } from "./constants";
import { createBall, createBallShadow, syncBallMesh, updatePreShotBall } from "./ball";
import { buildCourt, buildBackdrop } from "./court";
import { buildHoop } from "./hoop";
import { applyHoopAssist, resolveBackboardCollision, resolveBounds, resolveFloorCollision, resolveRimCollisions } from "./physics";
import { checkScore, updateScoreTexture } from "./scoring";
import { updateHud, updateHint } from "./hud";

export class HoopsGame {
  private container: HTMLElement;
  private hud: HudRefs;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private clock = new THREE.Clock();
  private ball: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  private ballShadow: THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  private previewGeometry = new THREE.BufferGeometry();
  private previewLine: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  private aimMarker: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  private scorePanel: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private scoreCanvas: HTMLCanvasElement;
  private scoreContext: CanvasRenderingContext2D;
  private scoreTexture: THREE.CanvasTexture;
  private pointerCurrent = new THREE.Vector2();
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
  private previewAssist = 0;
  private shotAssist = 0;
  private mode: GameMode = "idle";
  private ballScored = false;
  private resetTimer = 0;
  private shotClock = 0;
  private scoreFlash = 0;
  private scoreBallPop = 0;
  private scoreOverlay: HTMLDivElement | null = null;
  private swishTimer = 0;
  private pointerActive = false;
  private preShotClock = 0;
  private shotCount = 0;
  private externalStepLockUntil = 0;
  private readonly tempVec = new THREE.Vector3();
  private readonly rimCenter = HOOP_CENTER.clone();

  constructor(container: HTMLElement, hud: HudRefs) {
    this.container = container;
    this.hud = hud;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xcfd9e2, 12, 28);

    this.camera = new THREE.PerspectiveCamera(44, 1, 0.1, 100);
    this.camera.position.set(1.95, 3.38, 8.25);
    this.camera.lookAt(0, 2.7, -2.2);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.setAttribute("aria-label", "HOOPS game canvas");
    this.renderer.domElement.style.touchAction = "none";
    this.container.append(this.renderer.domElement);

    const ambientLight = new THREE.HemisphereLight(0xf5fbff, 0xcda97a, 1.25);
    this.scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfff1cf, 1.75);
    sunLight.position.set(6, 9, 8);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.set(1024, 1024);
    sunLight.shadow.camera.left = -10;
    sunLight.shadow.camera.right = 10;
    sunLight.shadow.camera.top = 10;
    sunLight.shadow.camera.bottom = -10;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 25;
    this.scene.add(sunLight);

    this.ball = createBall(this.scene);
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

    const scoreCanvas = document.createElement("canvas");
    scoreCanvas.width = 320;
    scoreCanvas.height = 160;
    this.scoreCanvas = scoreCanvas;
    this.scoreContext = scoreCanvas.getContext("2d") as CanvasRenderingContext2D;
    this.scoreTexture = new THREE.CanvasTexture(scoreCanvas);
    this.scoreTexture.colorSpace = THREE.SRGBColorSpace;
    this.scorePanel = new THREE.Mesh(
      new THREE.PlaneGeometry(1.3, 0.58),
      new THREE.MeshBasicMaterial({
        map: this.scoreTexture,
        transparent: true,
      }),
    );
    this.scorePanel.position.set(0, 4.8, -6.48);
    this.scene.add(this.scorePanel);

    this.scoreOverlay = document.createElement("div");
    this.scoreOverlay.className = "score-flash-overlay";
    this.container.append(this.scoreOverlay);

    buildCourt(this.scene);
    buildBackdrop(this.scene);
    this.rimCollisionNodes = buildHoop(this.scene);
    this.pointerCurrent.set(window.innerWidth * 0.5, window.innerHeight * 0.38);
    this.callUpdateScoreTexture();
    this.resetBall();
    updateHud(this.hud, this.targetBias, this.strength);
    updateHint(this.hud, this.mode, this.shotCount, this.ballScored);
    this.updateAimPreview();
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
    window.removeEventListener("pointermove", this.handlePointerMove);
    window.removeEventListener("pointerup", this.handlePointerUp);
    this.renderer.dispose();
  }

  private callSyncBallMesh(): void {
    syncBallMesh(this.ball, this.ballShadow, this.ballPosition);
  }

  private callUpdateScoreTexture(): void {
    updateScoreTexture(this.scoreContext, this.scoreCanvas, this.scoreTexture, this.score, this.mode, this.swishTimer);
  }

  private attachEvents(): void {
    this.renderer.domElement.addEventListener("pointerdown", this.handlePointerDown);
    window.addEventListener("pointermove", this.handlePointerMove);
    window.addEventListener("pointerup", this.handlePointerUp);
    window.addEventListener("resize", this.handleResize);
    window.addEventListener("keydown", this.handleKeyDown);
  }

  private handlePointerDown = (event: PointerEvent): void => {
    if (this.mode === "flight" || this.mode === "resetting") {
      return;
    }

    event.preventDefault();
    this.pointerCurrent.set(event.clientX, event.clientY);
    if (this.mode === "power") {
      this.shootBall();
      return;
    }

    this.pointerActive = true;
    this.mode = "targeting";
    this.renderer.domElement.setPointerCapture(event.pointerId);
    this.updateAimPreview();
    updateHint(this.hud, this.mode, this.shotCount, this.ballScored);
  };

  private handlePointerMove = (event: PointerEvent): void => {
    if (!this.pointerActive || this.mode !== "targeting") {
      return;
    }

    this.pointerCurrent.set(event.clientX, event.clientY);
    this.updateAimPreview();
  };

  private handlePointerUp = (event: PointerEvent): void => {
    if (!this.pointerActive || this.mode !== "targeting") {
      return;
    }

    this.pointerCurrent.set(event.clientX, event.clientY);
    this.pointerActive = false;
    this.renderer.domElement.releasePointerCapture(event.pointerId);
    this.updateAimPreview();
    this.beginStrengthLock();
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

    if (this.mode === "flight" || this.mode === "resetting") {
      return;
    }

    if (key === "arrowleft") {
      event.preventDefault();
      if (this.mode === "idle") {
        this.mode = "targeting";
      }
      this.nudgeAim(-0.08, 0);
      updateHint(this.hud, this.mode, this.shotCount, this.ballScored);
      return;
    }

    if (key === "arrowright") {
      event.preventDefault();
      if (this.mode === "idle") {
        this.mode = "targeting";
      }
      this.nudgeAim(0.08, 0);
      updateHint(this.hud, this.mode, this.shotCount, this.ballScored);
      return;
    }

    if (key === "arrowup") {
      event.preventDefault();
      if (this.mode === "idle") {
        this.mode = "targeting";
      }
      this.nudgeAim(0, -0.08);
      updateHint(this.hud, this.mode, this.shotCount, this.ballScored);
      return;
    }

    if (key === "arrowdown") {
      event.preventDefault();
      if (this.mode === "idle") {
        this.mode = "targeting";
      }
      this.nudgeAim(0, 0.08);
      updateHint(this.hud, this.mode, this.shotCount, this.ballScored);
      return;
    }

    if (key === " " || key === "space" || key === "enter") {
      event.preventDefault();
      if (this.mode === "power") {
        this.shootBall();
      } else {
        this.beginStrengthLock();
      }
    }
  };

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
    if (this.scoreFlash > 0) {
      this.scoreFlash = Math.max(0, this.scoreFlash - delta * 2.2);
      this.scorePanel.material.opacity = 0.82 + this.scoreFlash * 0.18;
      this.scorePanel.scale.setScalar(1 + this.scoreFlash * 0.08);
    } else {
      this.scorePanel.material.opacity = 1;
      this.scorePanel.scale.setScalar(1);
    }

    if (this.scoreBallPop > 0) {
      this.scoreBallPop = Math.max(0, this.scoreBallPop - delta * 3.3);
      const pop = 1 + this.scoreBallPop * 0.35;
      this.ball.scale.setScalar(pop);
    }

    if (this.swishTimer > 0) {
      const prev = this.swishTimer;
      this.swishTimer = Math.max(0, this.swishTimer - delta);
      if (this.swishTimer <= 0 && prev > 0) {
        this.callUpdateScoreTexture();
      }
    }

    if (this.mode === "idle" || this.mode === "targeting" || this.mode === "power") {
      this.preShotClock = updatePreShotBall(
        this.ball, this.ballPosition, this.preShotClock, delta,
        () => this.callSyncBallMesh(),
      );
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
      this.ballVelocity.y += GRAVITY * step;
      this.ballPosition.addScaledVector(this.ballVelocity, step);
      this.ball.rotation.x += this.ballVelocity.z * step * 3;
      this.ball.rotation.z -= this.ballVelocity.x * step * 3;
      applyHoopAssist(this.ballPosition, this.ballVelocity, this.ballScored, this.shotAssist, step, this.tempVec);
      resolveBackboardCollision(this.ballPosition, this.previousBallPosition, this.ballVelocity);
      resolveRimCollisions(this.ballPosition, this.ballVelocity, this.rimCollisionNodes, this.tempVec);
      const stopped = resolveFloorCollision(this.ballPosition, this.ballVelocity, this.shotClock, FLOOR_Y);
      if (stopped) {
        this.scheduleReset(0.45);
      }
      if (resolveBounds(this.ballPosition, this.shotClock)) {
        this.scheduleReset(0.3);
      }
      const scoreResult = checkScore(this.ballPosition, this.previousBallPosition, this.ballVelocity, this.ballScored, this.shotAssist, this.rimCenter);
      if (scoreResult) {
        this.completeScore();
      }
      if (this.resetTimer > 0) {
        break;
      }
    }
    this.callSyncBallMesh();
  }

  private completeScore(): void {
    this.ballScored = true;
    this.score += 1;
    this.scoreFlash = 1;
    this.scoreBallPop = 1;
    this.swishTimer = 0.8;
    this.callUpdateScoreTexture();
    if (this.scoreOverlay) {
      this.scoreOverlay.classList.add("is-active");
      setTimeout(() => this.scoreOverlay?.classList.remove("is-active"), 400);
    }
    this.scheduleReset(0.9);
  }

  private scheduleReset(delay: number): void {
    this.mode = "resetting";
    this.resetTimer = delay;
    this.previewLine.visible = false;
    this.aimMarker.visible = false;
    updateHint(this.hud, this.mode, this.shotCount, this.ballScored);
  }

  private resetBall(): void {
    this.mode = "idle";
    this.ballScored = false;
    this.shotClock = 0;
    this.shotAssist = 0;
    this.resetTimer = 0;
    this.pointerActive = false;
    this.preShotClock = 0;
    this.strength = 0.58;
    this.strengthDirection = 1;
    this.ballPosition.copy(BALL_SPAWN);
    this.previousBallPosition.copy(BALL_SPAWN);
    this.ballVelocity.set(0, 0, 0);
    this.ball.scale.setScalar(1);
    this.callSyncBallMesh();
    this.previewLine.visible = true;
    this.aimMarker.visible = true;
    this.callUpdateScoreTexture();
    this.updateAimPreview();
    updateHint(this.hud, this.mode, this.shotCount, this.ballScored);
  }

  private beginStrengthLock(): void {
    if (this.mode === "flight" || this.mode === "resetting") {
      return;
    }

    this.mode = "power";
    this.pointerActive = false;
    this.strength = 0.18;
    this.strengthDirection = 1;
    this.updateAimPreview();
    updateHint(this.hud, this.mode, this.shotCount, this.ballScored);
  }

  private shootBall(): void {
    this.mode = "flight";
    this.ballScored = false;
    this.shotClock = 0;
    this.shotCount += 1;
    this.shotAssist = this.previewAssist;
    this.ball.scale.setScalar(1);
    this.ballPosition.copy(BALL_SPAWN);
    this.previousBallPosition.copy(BALL_SPAWN);
    this.ballVelocity.copy(this.predictedVelocity);
    this.callSyncBallMesh();
    this.previewLine.visible = false;
    this.aimMarker.visible = false;
    this.callUpdateScoreTexture();
    updateHint(this.hud, this.mode, this.shotCount, this.ballScored);
  }

  private updateAimPreview(): void {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    const normalizedX = THREE.MathUtils.clamp(this.pointerCurrent.x / width, 0, 1);
    const normalizedY = THREE.MathUtils.clamp(this.pointerCurrent.y / height, 0, 1);

    const targetOffsetX = THREE.MathUtils.mapLinear(normalizedX, 0, 1, -1.12, 1.12);
    const targetOffsetY = THREE.MathUtils.mapLinear(1 - normalizedY, 0.08, 0.96, -0.38, 1.02);
    this.targetBias = targetOffsetX;

    const rawAimPoint = new THREE.Vector3(
      HOOP_CENTER.x + targetOffsetX,
      HOOP_CENTER.y + THREE.MathUtils.clamp(targetOffsetY, -0.42, 1.08),
      HOOP_CENTER.z + 0.08,
    );

    const centerAssist = 1 - THREE.MathUtils.clamp(Math.abs(targetOffsetX) / 0.42, 0, 1);
    const strengthAssist = 1 - THREE.MathUtils.clamp(Math.abs(this.strength - 0.76) / 0.52, 0, 1);
    const assist = centerAssist * strengthAssist;
    this.previewAssist = assist;
    this.aimPoint.copy(rawAimPoint).lerp(new THREE.Vector3(0, HOOP_CENTER.y + 0.42, HOOP_CENTER.z + 0.12), assist * 0.52);

    const flightTime = THREE.MathUtils.lerp(1.36, 0.76, this.strength);
    this.predictedVelocity
      .copy(this.aimPoint)
      .sub(BALL_SPAWN)
      .addScaledVector(new THREE.Vector3(0, -GRAVITY, 0), 0.5 * flightTime * flightTime)
      .divideScalar(flightTime);

    const points: THREE.Vector3[] = [];
    const simulatedPosition = BALL_SPAWN.clone();
    const simulatedVelocity = this.predictedVelocity.clone();
    const timeStep = 1 / 30;
    for (let index = 0; index < 26; index += 1) {
      points.push(simulatedPosition.clone());
      simulatedVelocity.y += GRAVITY * timeStep;
      simulatedPosition.addScaledVector(simulatedVelocity, timeStep);
    }
    this.previewGeometry.setFromPoints(points);
    this.previewLine.visible = this.mode !== "flight" && this.mode !== "resetting";

    this.aimMarker.position.copy(this.aimPoint);
    this.aimMarker.lookAt(this.camera.position);
    this.aimMarker.visible = this.mode !== "flight" && this.mode !== "resetting";
    updateHud(this.hud, this.targetBias, this.strength);
  }

  private nudgeAim(deltaX: number, deltaY: number): void {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    this.pointerCurrent.x = THREE.MathUtils.clamp(this.pointerCurrent.x + width * deltaX, width * 0.08, width * 0.92);
    this.pointerCurrent.y = THREE.MathUtils.clamp(this.pointerCurrent.y + height * deltaY, height * 0.08, height * 0.94);
    this.updateAimPreview();
  }

  private resize(): void {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.updateAimPreview();
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

  renderGameToText(): string {
    return JSON.stringify({
      mode: this.mode,
      coordSystem: "x right, y up, z toward player",
      score: this.score,
      preShotMode: this.mode === "idle" || this.mode === "targeting" || this.mode === "power",
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
}
