import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { WEAPONS, DRONE_TYPES, getWaveSettings } from './config.js';
import { AudioEngine } from './audio.js';
import { Drone } from './drone.js';
import { World } from './world.js';
import { WeaponView } from './weapon-view.js';
import { HUD } from './hud.js';
import { EffectsSystem } from './effects.js';
import { SettingsStore, SettingsPanel, QUALITY_PRESETS } from './settings.js';
import { FrameProfiler } from './performance.js';
import { canResupply, applyResupply } from './resupply.js';
const { clamp } = THREE.MathUtils;

export class FPVDownGame {
  constructor() {
    this.settings = new SettingsStore();
    this.profiler = new FrameProfiler();
    this.performanceTimer = 0;
    this.canvas = document.getElementById('game-canvas');
    this.clock = new THREE.Clock();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87959a);
    this.scene.fog = new THREE.FogExp2(0x89979a, 0.0085);
    this.camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.05, 420);
    this.camera.position.set(0, 1.72, 14);
    this.scene.add(this.camera);

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.8));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.info.autoReset = false;

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.25, 0.55, 0.88);
    this.composer.addPass(this.bloomPass);
    this.composer.addPass(new OutputPass());

    this.audio = new AudioEngine();
    this.keys = new Set();
    this.world = new World(this.scene, this.renderer);
    this.drones = [];
    this.effectsSystem = new EffectsSystem(this.scene);
    this.raycaster = new THREE.Raycaster();
    this.pointerLocked = false;
    this.mouseDown = false;
    this.state = 'START';
    this.yaw = 0;
    this.pitch = -0.04;
    this.bobTime = 0;
    this.swayX = 0;
    this.swayY = 0;
    this.recoil = 0;
    this.health = 100;
    this.armor = 50;
    this.score = 0;
    this.kills = 0;
    this.shots = 0;
    this.hits = 0;
    this.wave = 0;
    this.waveTotal = 0;
    this.waveSpawned = 0;
    this.waveKills = 0;
    this.spawnTimer = 0;
    this.currentWeapon = 0;
    this.weaponStates = WEAPONS.map((weapon) => ({ ammo: weapon.magazine, reserve: weapon.reserve }));
    this.fireCooldown = 0;
    this.isReloading = false;
    this.reloadTimer = 0;
    this.pendingAutoReload = null;
    this.notificationTimer = 0;
    this.muzzleTimer = 0;
    this.hud = new HUD();
    this.dom = this.hud.dom;
    this.gameUi = this.hud.gameUi;
    this.weaponButtons = this.hud.weaponButtons;
    this.settingsPanel = new SettingsPanel(this.settings, () => this.applySettings());
    this.bindEvents();
  }

  async init() {
    this.dom.loadingState.textContent = 'Laddar realistisk terräng…';
    await this.world.create();
    this.dom.loadingState.textContent = 'Kalibrerar vapensystem…';
    this.weaponView = new WeaponView(this.camera);
    this.applySettings();
    this.hud.update(this);
    this.animate();
    window.setTimeout(() => {
      this.dom.loading.classList.add('fade');
      window.setTimeout(() => this.dom.loading.classList.add('hidden'), 700);
    }, 500);
  }

  bindEvents() {
    window.addEventListener('resize', () => this.onResize());
    document.addEventListener('keydown', (event) => {
      if (this.state !== 'PLAYING' || !this.pointerLocked) return;
      this.keys.add(event.code);
      if (event.code === 'KeyR') this.startReload();
      if (event.code === 'Digit1') this.switchWeapon(0);
      if (event.code === 'Digit2') this.switchWeapon(1);
      if (event.code === 'Digit3') this.switchWeapon(2);
    });
    document.addEventListener('keyup', (event) => this.keys.delete(event.code));
    document.addEventListener('mousemove', (event) => {
      if (!this.pointerLocked || this.state !== 'PLAYING') return;
      const { sensitivity, invertY } = this.settings.value;
      this.yaw -= event.movementX * 0.0018 * sensitivity;
      this.pitch -= event.movementY * 0.00165 * sensitivity * (invertY ? -1 : 1);
      this.pitch = clamp(this.pitch, -1.35, 1.25);
      this.swayX = clamp(this.swayX + event.movementX * 0.0002, -0.032, 0.032);
      this.swayY = clamp(this.swayY + event.movementY * 0.00018, -0.025, 0.025);
    });
    document.addEventListener('mousedown', (event) => {
      if (event.button !== 0 || this.state !== 'PLAYING') return;
      if (!this.pointerLocked) {
        this.requestAim();
        return;
      }
      this.mouseDown = true;
      this.tryFire();
    });
    document.addEventListener('mouseup', (event) => { if (event.button === 0) this.mouseDown = false; });
    document.addEventListener('wheel', (event) => {
      if (this.state !== 'PLAYING') return;
      const next = (this.currentWeapon + (event.deltaY > 0 ? 1 : -1) + WEAPONS.length) % WEAPONS.length;
      this.switchWeapon(next);
    }, { passive: true });
    document.addEventListener('pointerlockchange', () => this.onPointerLockChange());
    document.addEventListener('pointerlockerror', () => this.onPointerLockError());
    window.addEventListener('blur', () => this.pauseGame());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pauseGame();
    });

    document.getElementById('start-button').addEventListener('click', () => this.startGame());
    document.getElementById('resume-button').addEventListener('click', () => this.requestAim());
    document.getElementById('restart-button').addEventListener('click', () => this.restartGame());
    this.weaponButtons.forEach((button) => button.addEventListener('click', () => this.switchWeapon(Number(button.dataset.weapon))));
    document.querySelectorAll('[data-open-settings]').forEach(button => button.addEventListener('click', () => this.settingsPanel.open()));
    document.querySelectorAll('[data-resupply]').forEach(button => button.addEventListener('click', () => this.chooseResupply(button.dataset.resupply)));
  }

  async startGame() {
    await this.audio.start();
    this.dom.start.classList.add('hidden');
    this.gameUi.forEach((element) => element.classList.remove('hidden'));
    this.dom.hint.classList.add('hidden');
    this.dom.crosshair.classList.add('visible');
    this.state = 'PLAYING';
    this.startWave(1);
    this.requestAim();
  }

  async requestAim() {
    try {
      await this.canvas.requestPointerLock();
    } catch {
      this.onPointerLockError();
    }
  }

  onPointerLockError() {
    if (this.state !== 'PLAYING' && this.state !== 'PAUSED') return;
    this.pauseGame();
    this.showNotification('MUSSIKTET KUNDE INTE AKTIVERAS · TRYCK FORTSÄTT FÖR ATT FÖRSÖKA IGEN', 5);
  }

  onPointerLockChange() {
    this.pointerLocked = document.pointerLockElement === this.canvas;
    if (this.pointerLocked) {
      if (this.state !== 'PLAYING' && this.state !== 'PAUSED') return;
      if (this.state === 'PAUSED') this.state = 'PLAYING';
      this.dom.pause.classList.add('hidden');
      this.dom.hint.classList.add('hidden');
      this.dom.crosshair.classList.add('visible');
      this.clock.getDelta();
    } else if (this.state === 'PLAYING') {
      this.pauseGame();
    }
  }

  pauseGame() {
    this.keys.clear();
    this.mouseDown = false;
    if (this.state !== 'PLAYING') return;
    this.state = 'PAUSED';
    this.audio.updateHum(0, 0);
    this.hud.clearDamage();
    this.dom.pause.classList.remove('hidden');
    this.dom.hint.classList.remove('hidden');
    this.dom.crosshair.classList.remove('visible');
    if (document.pointerLockElement === this.canvas) document.exitPointerLock?.();
  }

  restartGame() {
    this.drones.forEach((drone) => drone.dispose());
    this.drones = [];
    this.effectsSystem.clear();
    this.health = 100;
    this.armor = 50;
    this.score = 0;
    this.kills = 0;
    this.shots = 0;
    this.hits = 0;
    this.wave = 0;
    this.waveKills = 0;
    this.weaponStates = WEAPONS.map((weapon) => ({ ammo: weapon.magazine, reserve: weapon.reserve }));
    this.currentWeapon = 0;
    this.keys.clear();
    this.mouseDown = false;
    this.isReloading = false;
    this.reloadTimer = 0;
    this.pendingAutoReload = null;
    this.fireCooldown = 0;
    this.recoil = 0;
    this.swayX = 0;
    this.swayY = 0;
    this.bobTime = 0;
    this.muzzleTimer = 0;
    this.weaponView.muzzleLight.intensity = 0;
    this.dom.reloadFill.style.width = '0%';
    this.dom.hit.classList.remove('show');
    this.dom.damage.classList.remove('flash');
    this.hud.clearDamage();
    this.dom.resupply.classList.add('hidden');
    this.dom.pause.classList.add('hidden');
    this.dom.hint.classList.add('hidden');
    this.audio.updateHum(0, 0);
    this.camera.position.set(0, 1.72, 14);
    this.yaw = 0;
    this.pitch = -0.04;
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    this.state = 'PLAYING';
    this.dom.gameover.classList.add('hidden');
    this.dom.crosshair.classList.add('visible');
    this.weaponView.setWeaponModel(this.currentWeapon);
    this.startWave(1);
    this.requestAim();
  }

  startWave(number) {
    const settings = getWaveSettings(number);
    this.wave = number;
    this.waveTotal = settings.count;
    this.waveSpawned = 0;
    this.waveKills = 0;
    this.spawnTimer = settings.initialDelay;
    this.dom.mission.textContent = 'HÅLL SEKTORN';
    this.showNotification(`VÅG ${String(number).padStart(2, '0')} · INKOMMANDE FPV-HOT`);
    this.hud.update(this);
  }

  spawnDrone() {
    let type = 'scout';
    const roll = Math.random();
    if (this.wave >= 4 && roll > 0.78) type = 'armored';
    else if (this.wave >= 2 && roll > 0.45) type = 'strike';

    let position = null;
    const radius = 0.72 * DRONE_TYPES[type].scale;
    for (let attempt = 0; attempt < 8 && !position; attempt += 1) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 62 + Math.random() * 34;
      const altitude = 7 + Math.random() * 13;
      const candidate = this.camera.position.clone().add(new THREE.Vector3(Math.sin(angle) * distance, 0, Math.cos(angle) * distance));
      candidate.y = altitude;
      if (!this.world.sphereCollidesAt(candidate, radius)) position = candidate;
    }
    if (!position) position = new THREE.Vector3(0, 24, -82);
    this.drones.push(new Drone(this, type, position));
  }

  switchWeapon(index) {
    if (index === this.currentWeapon || index < 0 || index >= WEAPONS.length || this.state !== 'PLAYING') return;
    this.currentWeapon = index;
    this.isReloading = false;
    this.reloadTimer = 0;
    this.pendingAutoReload = null;
    this.fireCooldown = 0.18;
    this.weaponView.setWeaponModel(this.currentWeapon);
    this.hud.update(this);
    this.showNotification(WEAPONS[index].name);
    this.audio.tone(430, 0.045, 'square', 0.06, 90);
  }

  startReload() {
    if (this.state !== 'PLAYING' || this.isReloading) return;
    const weapon = WEAPONS[this.currentWeapon];
    const state = this.weaponStates[this.currentWeapon];
    if (state.ammo >= weapon.magazine || state.reserve <= 0) return;
    this.pendingAutoReload = null;
    this.isReloading = true;
    this.reloadTimer = weapon.reloadDuration;
    this.audio.reload();
    this.showNotification('LADDAR OM');
  }

  finishReload() {
    const weapon = WEAPONS[this.currentWeapon];
    const state = this.weaponStates[this.currentWeapon];
    const needed = weapon.magazine - state.ammo;
    const loaded = Math.min(needed, state.reserve);
    state.ammo += loaded;
    state.reserve -= loaded;
    this.isReloading = false;
    this.reloadTimer = 0;
    this.hud.update(this);
  }

  tryFire() {
    if (this.state !== 'PLAYING' || this.fireCooldown > 0 || this.isReloading) return;
    const weapon = WEAPONS[this.currentWeapon];
    const state = this.weaponStates[this.currentWeapon];
    if (state.ammo <= 0) {
      this.audio.dryFire();
      this.fireCooldown = 0.25;
      if (state.reserve > 0) this.startReload();
      return;
    }

    state.ammo -= 1;
    this.shots += 1;
    this.fireCooldown = weapon.fireInterval;
    this.recoil = Math.min(0.16, this.recoil + weapon.recoil);
    this.pitch = clamp(this.pitch + weapon.recoil * (0.16 + Math.random() * 0.16), -1.35, 1.25);
    this.muzzleTimer = 0.045;
    this.audio.gunshot(weapon);

    const origin = new THREE.Vector3();
    this.camera.getWorldPosition(origin);
    const forward = new THREE.Vector3();
    this.camera.getWorldDirection(forward);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.camera.quaternion);
    const damageByDrone = new Map();
    const hitMeshes = this.drones.filter((drone) => drone.alive).flatMap((drone) => {
      const meshes = [];
      drone.group.traverse((child) => { if (child.isMesh) meshes.push(child); });
      return meshes;
    });
    const shotTargets = [...hitMeshes, ...this.world.solidMeshes];

    for (let pellet = 0; pellet < weapon.pellets; pellet += 1) {
      const direction = forward.clone()
        .addScaledVector(right, (Math.random() - 0.5) * weapon.spread)
        .addScaledVector(up, (Math.random() - 0.5) * weapon.spread)
        .normalize();
      this.raycaster.set(origin, direction);
      this.raycaster.far = weapon.range;
      const intersections = this.raycaster.intersectObjects(shotTargets, false);
      let pelletEnd = origin.clone().addScaledVector(direction, weapon.range);
      if (intersections.length > 0) {
        const hit = intersections[0];
        pelletEnd = hit.point.clone();
        const drone = hit.object.userData.drone;
        if (drone) damageByDrone.set(drone, (damageByDrone.get(drone) || 0) + weapon.damage);
        else if (pellet === 0) this.effectsSystem.spawnImpact(hit.point, 0xd8c7a8);
      }
      if (pellet === 0) this.effectsSystem.spawnTracer(origin, pelletEnd, this.camera.quaternion);
    }

    if (damageByDrone.size > 0) {
      this.hits += 1;
      let destroyed = false;
      damageByDrone.forEach((damage, drone) => {
        const point = drone.group.position.clone();
        destroyed = drone.takeDamage(damage, point) || destroyed;
      });
      this.showHitMarker(destroyed);
      this.audio.hit(destroyed);
    }

    if (state.ammo === 0 && state.reserve > 0) {
      this.pendingAutoReload = { weaponIndex: this.currentWeapon, remaining: weapon.fireInterval * 0.7 };
    }
    this.hud.update(this);
  }

  destroyDrone(drone) {
    this.score += drone.stats.score;
    this.kills += 1;
    this.waveKills += 1;
    this.effectsSystem.spawnExplosion(drone.group.position.clone());
    this.audio.explosion();
    this.hud.update(this);
  }

  droneDetonation(drone, damage) {
    this.effectsSystem.spawnExplosion(drone.group.position.clone());
    this.audio.explosion();
    this.damagePlayer(damage, drone.group.position);
  }

  damagePlayer(amount, source) {
    if (source) this.hud.showDamage(source);
    const absorbed = Math.min(this.armor, Math.round(amount * 0.55));
    this.armor -= absorbed;
    this.health = Math.max(0, this.health - (amount - absorbed));
    this.dom.damage.classList.remove('flash');
    void this.dom.damage.offsetWidth;
    this.dom.damage.classList.add('flash');
    this.hud.update(this);
    if (this.health <= 0) this.gameOver();
  }

  gameOver() {
    if (this.state === 'GAMEOVER') return;
    this.state = 'GAMEOVER';
    this.mouseDown = false;
    this.keys.clear();
    this.pendingAutoReload = null;
    this.audio.updateHum(0, 0);
    this.hud.clearDamage();
    document.exitPointerLock?.();
    this.dom.pause.classList.add('hidden');
    this.dom.hint.classList.add('hidden');
    this.dom.crosshair.classList.remove('visible');
    this.dom.finalScore.textContent = this.score.toLocaleString('sv-SE');
    this.dom.finalKills.textContent = this.kills;
    this.dom.finalWave.textContent = this.wave;
    this.dom.finalAccuracy.textContent = `${this.shots ? Math.round((this.hits / this.shots) * 100) : 0}%`;
    this.dom.gameover.classList.remove('hidden');
  }

  showHitMarker(destroyed) {
    this.dom.hit.querySelectorAll('i').forEach((line) => { line.style.background = destroyed ? '#ffb23e' : '#fff'; });
    this.dom.hit.classList.remove('show');
    void this.dom.hit.offsetWidth;
    this.dom.hit.classList.add('show');
  }

  showNotification(text, duration = 2.2) {
    this.dom.notification.textContent = text;
    this.dom.notification.classList.add('show');
    this.notificationTimer = duration;
  }

  updateMovement(dt) {
    const move = new THREE.Vector3();
    if (this.keys.has('KeyW')) move.z -= 1;
    if (this.keys.has('KeyS')) move.z += 1;
    if (this.keys.has('KeyA')) move.x -= 1;
    if (this.keys.has('KeyD')) move.x += 1;
    if (move.lengthSq() === 0) {
      this.bobTime += dt * 2;
      return;
    }
    move.normalize();
    const speed = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? 9.2 : 5.6;
    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const right = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    const delta = forward.multiplyScalar(-move.z).add(right.multiplyScalar(move.x)).multiplyScalar(speed * dt);
    this.camera.position.copy(this.world.resolvePlayerMovement(this.camera.position, delta));
    this.bobTime += dt * (speed > 7 ? 13 : 9);
  }

  updateWeaponTimers(dt) {
    if (this.state !== 'PLAYING') return;
    // Advance to each weapon event so frame boundaries do not discard time.
    let remaining = dt;
    const epsilon = 1e-9;
    while (true) {
      if (this.isReloading && this.reloadTimer <= epsilon) this.finishReload();
      if (this.pendingAutoReload && this.pendingAutoReload.remaining <= epsilon) {
        const { weaponIndex } = this.pendingAutoReload;
        this.pendingAutoReload = null;
        if (weaponIndex === this.currentWeapon) this.startReload();
      }
      if (this.fireCooldown <= epsilon) {
        this.fireCooldown = 0;
        if (this.mouseDown && WEAPONS[this.currentWeapon].automatic && !this.isReloading) this.tryFire();
      }
      if (remaining <= epsilon) break;
      let step = remaining;
      if (this.fireCooldown > epsilon) step = Math.min(step, this.fireCooldown);
      if (this.isReloading) step = Math.min(step, this.reloadTimer);
      if (this.pendingAutoReload) step = Math.min(step, this.pendingAutoReload.remaining);
      this.fireCooldown = Math.max(0, this.fireCooldown - step);
      if (this.isReloading) this.reloadTimer -= step;
      if (this.pendingAutoReload) this.pendingAutoReload.remaining -= step;
      remaining -= step;
    }
  }

  updateWeapon(dt) {
    this.updateWeaponTimers(dt);
    this.weaponView.update(dt, this);
  }

  updateDrones(dt) {
    if (this.state !== 'PLAYING') return;
    if (this.waveSpawned < this.waveTotal) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        this.spawnDrone();
        this.waveSpawned += 1;
        this.spawnTimer = getWaveSettings(this.wave).spawnInterval + Math.random() * 0.45;
      }
    }

    for (const drone of this.drones) {
      drone.update(dt);
      if (this.state !== 'PLAYING') break;
    }
    const removed = this.drones.filter((drone) => !drone.alive);
    this.drones = this.drones.filter((drone) => drone.alive);
    removed.forEach((drone) => drone.dispose());
    if (this.state !== 'PLAYING') return;

    if (this.waveSpawned >= this.waveTotal && this.drones.length === 0) {
      this.beginResupply();
      return;
    }

    const nearest = this.drones.reduce((distance, drone) => Math.min(distance, drone.group.position.distanceTo(this.camera.position)), 120);
    this.audio.updateHum(this.drones.length, clamp(1 - nearest / 80, 0, 1));
  }

  beginResupply() {
    if (this.state !== 'PLAYING') return;
    this.state = 'RESUPPLY';
    this.keys.clear();
    this.mouseDown = false;
    this.audio.updateHum(0, 0);
    this.hud.clearDamage();
    this.score += this.wave * 250;
    this.dom.mission.textContent = 'SEKTOR TILLFÄLLIGT SÄKRAD';
    this.dom.resupplyWave.textContent = `VÅG ${this.wave} SLUTFÖRD · +${this.wave * 250} POÄNG`;
    this.dom.resupplyStatus.textContent = `Hälsa ${Math.ceil(this.health)}/100 · Skyddsväst ${Math.ceil(this.armor)}/50`;
    document.querySelectorAll('[data-resupply]').forEach(button => {
      button.disabled = !canResupply(this, button.dataset.resupply);
    });
    this.dom.crosshair.classList.remove('visible');
    this.dom.hint.classList.add('hidden');
    this.dom.resupply.classList.remove('hidden');
    this.hud.update(this);
    this.hud.drawRadar(this);
    document.exitPointerLock?.();
    document.querySelector('[data-resupply]:not(:disabled)')?.focus();
  }

  chooseResupply(choice) {
    if (!applyResupply(this, choice)) return;
    this.dom.resupply.classList.add('hidden');
    this.startWave(this.wave + 1);
    this.requestAim();
  }

  applySettings() {
    const settings = this.settings.value;
    this.audio.setVolumes(settings);
    this.dom.performance.classList.toggle('hidden', !settings.showPerformance);
    if (this.appliedQuality === settings.quality) return;
    this.appliedQuality = settings.quality;
    const preset = QUALITY_PRESETS[settings.quality];
    this.renderer.shadowMap.enabled = preset.shadows;
    this.bloomPass.enabled = preset.bloom;
    const sun = this.world.sun;
    if (sun && sun.shadow.mapSize.x !== preset.shadowSize) {
      sun.shadow.map?.dispose();
      sun.shadow.map = null;
      sun.shadow.mapSize.set(preset.shadowSize, preset.shadowSize);
    }
    this.scene.traverse(object => {
      if (object.isMesh) for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.needsUpdate = true;
    });
    this.onResize();
  }

  update(dt) {
    if (this.notificationTimer > 0) {
      this.notificationTimer -= dt;
      if (this.notificationTimer <= 0) this.dom.notification.classList.remove('show');
    }
    if (this.state !== 'PLAYING') return;
    this.updateMovement(dt);
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
    this.updateWeapon(dt);
    this.updateDrones(dt);
    if (this.state !== 'PLAYING') return;
    this.effectsSystem.update(dt);
    this.hud.update(this);
    this.hud.updateFeedback(this, dt);
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    const ratio = Math.min(window.devicePixelRatio || 1, QUALITY_PRESETS[this.settings.value.quality].pixelRatio);
    this.renderer.setPixelRatio(ratio);
    this.composer.setPixelRatio(ratio);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.composer.setSize(window.innerWidth, window.innerHeight);
  }

  animate() {
    requestAnimationFrame(() => this.animate());
    const elapsed = this.clock.getDelta();
    const dt = Math.min(elapsed, 0.05);
    const start = performance.now();
    this.update(dt);
    this.renderer.info.reset();
    this.composer.render();
    this.profiler.record(elapsed * 1000, performance.now() - start);
    this.performanceTimer -= elapsed;
    if (this.settings.value.showPerformance && this.performanceTimer <= 0) {
      this.hud.updatePerformance(this.profiler.snapshot());
      this.performanceTimer = 0.25;
    }
  }
}
