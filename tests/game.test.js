import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { FPVDownGame as Game } from '../src/game.js';
import { WEAPONS as weapons } from '../src/config.js';
import { CollisionWorld } from '../src/collision.js';
import { EffectsSystem } from '../src/effects.js';

globalThis.document = { pointerLockElement: null, exitPointerLock() {}, querySelectorAll() { return []; }, querySelector() { return null; } };
const noop = () => {};

function element() {
  const classes = new Set();
  return {
    textContent: '', style: {},
    classList: { add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name) }
  };
}

function makeGame() {
  const game = Object.create(Game.prototype);
  const dom = Object.fromEntries([
    'gameover', 'pause', 'crosshair', 'hint', 'reloadFill', 'hit', 'damage',
    'resupply', 'resupplyWave', 'resupplyStatus', 'mission', 'finalScore', 'finalKills', 'finalWave', 'finalAccuracy'
  ].map(name => [name, element()]));
  Object.assign(game, {
    state: 'PLAYING', currentWeapon: 1, pointerLocked: true,
    weaponStates: weapons.map(weapon => ({ ammo: weapon.magazine, reserve: weapon.reserve })),
    fireCooldown: 0, isReloading: false, reloadTimer: 0, pendingAutoReload: null,
    recoil: 0, pitch: 0, yaw: 0, shots: 0, hits: 0, kills: 0, score: 0,
    health: 100, armor: 50, mouseDown: false, keys: new Set(),
    camera: new THREE.PerspectiveCamera(), scene: new THREE.Scene(),
    drones: [], solidMeshes: [], obstacles: [], effects: [], tracers: [],
    raycaster: new THREE.Raycaster(), muzzleLight: new THREE.PointLight(),
    wave: 1, waveTotal: 6, waveSpawned: 6, waveKills: 0, waveBreakTimer: 0,
    humCalls: [],
    audio: { gunshot: noop, dryFire: noop, reload: noop, tone: noop, explosion: noop,
      updateHum: (...args) => game.humCalls.push(args) },
    spawnTracer: noop, spawnExplosion: noop, updateHUD: noop,
    showNotification: noop, setWeaponModel: noop,
    canvas: { requestPointerLock: noop }, dom
  });
  game.world = new CollisionWorld(game.scene);
  game.effectsSystem = new EffectsSystem(game.scene);
  game.hud = { update: noop, clearDamage: noop, drawRadar: noop };
  game.weaponView = { muzzleLight: new THREE.PointLight(), setWeaponModel: noop };
  return game;
}

test('blocked drone climb travels the same distance at 30, 60 and 144 FPS', () => {
  for (const fps of [30, 60, 144]) {
    const game = makeGame();
    game.world.obstacles = [new THREE.Box3(new THREE.Vector3(0, -10, -10), new THREE.Vector3(1, 100, 10))];
    let position = new THREE.Vector3(-0.5, 1.72, 0);
    for (let frame = 0; frame < fps; frame++) {
      position = game.world.resolveDroneMovement(position, new THREE.Vector3(1 / fps, 0, 0), 0.5, 1 / fps).position;
    }
    assert.ok(Math.abs(position.y - 1.72 - 9.6) < 1e-8, `${fps} FPS`);
    assert.equal(position.x, -0.5);
  }
});

test('automatic fire preserves elapsed time across frame boundaries', () => {
  for (const weaponIndex of [1, 2]) {
    for (const fps of [20, 30, 60, 144]) {
      const game = makeGame();
      game.currentWeapon = weaponIndex;
      game.weaponStates[weaponIndex].ammo = 1000;
      game.mouseDown = true;
      for (let frame = 0; frame < fps * 10; frame++) game.updateWeaponTimers(1 / fps);
      assert.equal(game.shots, 1 + Math.floor(10 / weapons[weaponIndex].fireInterval), `${weaponIndex}, ${fps} FPS`);
    }
  }
});

test('automatic fire and magazine reloads agree across frame rates', () => {
  const results = [30, 60, 144].map(fps => {
    const game = makeGame();
    game.mouseDown = true;
    for (let frame = 0; frame < fps * 20; frame++) game.updateWeaponTimers(1 / fps);
    return { shots: game.shots, ...game.weaponStates[1], reloading: game.isReloading };
  });
  assert.deepEqual(results[0], results[1]);
  assert.deepEqual(results[0], results[2]);
  assert.ok(results[0].shots > 30);
});

test('weapon switch cancels automatic reload belonging to the previous weapon', () => {
  const game = makeGame();
  game.weaponStates[1].ammo = 1;
  game.weaponStates[2].ammo = 20;
  game.tryFire();
  assert.ok(game.pendingAutoReload);
  game.switchWeapon(2);
  game.updateWeaponTimers(1);
  assert.equal(game.pendingAutoReload, null);
  assert.equal(game.isReloading, false);
  assert.equal(game.weaponStates[2].ammo, 20);
});

test('pause freezes automatic reload and clears input and rotor sound', () => {
  const game = makeGame();
  game.weaponStates[1].ammo = 1;
  game.tryFire();
  const delay = game.pendingAutoReload.remaining;
  game.mouseDown = true;
  game.keys.add('KeyW');
  game.pauseGame();
  game.updateWeaponTimers(10);
  assert.equal(game.state, 'PAUSED');
  assert.equal(game.keys.size, 0);
  assert.equal(game.mouseDown, false);
  assert.deepEqual(game.humCalls.at(-1), [0, 0]);
  assert.equal(game.pendingAutoReload.remaining, delay);
  game.state = 'PLAYING';
  game.updateWeaponTimers(delay);
  assert.equal(game.isReloading, true);
  game.updateWeaponTimers(weapons[1].reloadDuration);
  assert.equal(game.weaponStates[1].ammo, 30);
  assert.equal(game.weaponStates[1].reserve, 150);
});

test('manual reload remains paused and a held shotgun does not become automatic', () => {
  const game = makeGame();
  game.currentWeapon = 0;
  game.tryFire();
  game.mouseDown = true;
  game.updateWeaponTimers(2);
  assert.equal(game.shots, 1);
  game.startReload();
  game.pauseGame();
  game.updateWeaponTimers(10);
  assert.equal(game.reloadTimer, weapons[0].reloadDuration);
  game.state = 'PLAYING';
  game.updateWeaponTimers(weapons[0].reloadDuration);
  assert.equal(game.weaponStates[0].ammo, 8);
  assert.equal(game.weaponStates[0].reserve, 39);
});

test('idle weapon does not accumulate a burst of overdue shots', () => {
  const game = makeGame();
  game.updateWeaponTimers(10);
  game.mouseDown = true;
  game.updateWeaponTimers(0.01);
  assert.equal(game.shots, 1);
});

test('rejected mouse lock pauses safely without an unhandled rejection', async () => {
  const game = makeGame();
  game.canvas.requestPointerLock = () => Promise.reject(new Error('Pointer lock denied'));
  await game.requestAim();
  assert.equal(game.state, 'PAUSED');
  assert.equal(game.dom.pause.classList.contains('hidden'), false);
});

test('legacy mouse-lock error event also pauses the game', () => {
  const game = makeGame();
  game.onPointerLockError();
  assert.equal(game.state, 'PAUSED');
  assert.equal(game.mouseDown, false);
});

test('restart resets combat state and returns active effects to their bounded pool', () => {
  const game = makeGame();
  game.effectsSystem.spawnExplosion(new THREE.Vector3());
  game.effectsSystem.spawnTracer(new THREE.Vector3(), new THREE.Vector3(1, 2, 3), new THREE.Quaternion());
  const created = { ...game.effectsSystem.created };
  Object.assign(game, { isReloading: true, reloadTimer: 1.5, fireCooldown: 0.7,
    pendingAutoReload: { weaponIndex: 1, remaining: 0.05 }, mouseDown: true,
    recoil: 0.1, swayX: 0.02, swayY: 0.02, bobTime: 12, muzzleTimer: 0.04 });
  game.keys.add('KeyW');
  game.restartGame();
  for (const name of ['reloadTimer', 'fireCooldown', 'recoil', 'swayX', 'swayY', 'bobTime', 'muzzleTimer']) assert.equal(game[name], 0, name);
  assert.equal(game.isReloading, false);
  assert.equal(game.mouseDown, false);
  assert.equal(game.pendingAutoReload, null);
  assert.equal(game.keys.size, 0);
  assert.equal(game.effectsSystem.active.length, 0);
  assert.equal(game.scene.children.length, 0);
  game.effectsSystem.spawnExplosion(new THREE.Vector3());
  game.effectsSystem.spawnTracer(new THREE.Vector3(), new THREE.Vector3(1, 2, 3), new THREE.Quaternion());
  assert.deepEqual(game.effectsSystem.created, created);
  assert.equal(game.wave, 1);
  assert.equal(game.weaponStates[0].ammo, 8);
  assert.equal(game.dom.reloadFill.style.width, '0%');
});

test('fatal final drone cannot award a wave bonus after the debrief', () => {
  const game = makeGame();
  game.score = 100;
  game.drones = [{ alive: true, update() { this.alive = false; game.damagePlayer(500); }, dispose: noop }];
  game.updateDrones(1 / 60);
  assert.equal(game.state, 'GAMEOVER');
  assert.equal(game.score, 100);
  assert.equal(game.dom.finalScore.textContent, '100');
  assert.equal(game.waveBreakTimer, 0);
  assert.deepEqual(game.humCalls.at(-1), [0, 0]);
});

test('fatal drone stops other drones updating in the same frame', () => {
  const game = makeGame();
  let updated = false;
  game.drones = [
    { alive: true, update() { this.alive = false; game.damagePlayer(500); }, dispose: noop },
    { alive: true, update() { updated = true; } }
  ];
  game.updateDrones(1 / 60);
  assert.equal(updated, false);
});

test('survived wave awards one bonus and waits for one resupply choice', () => {
  const game = makeGame();
  let radarRefreshed = false;
  game.hud.drawRadar = () => { radarRefreshed = true; };
  game.health = 80;
  game.updateDrones(1 / 60);
  assert.equal(game.score, 250);
  assert.equal(game.state, 'RESUPPLY');
  assert.equal(radarRefreshed, true);
  game.updateDrones(60);
  assert.equal(game.score, 250);
  assert.equal(game.wave, 1);
  game.chooseResupply('health');
  assert.equal(game.health, 100);
  assert.equal(game.wave, 2);
  assert.equal(game.waveSpawned, 0);
  game.chooseResupply('ammo');
  assert.equal(game.weaponStates[1].reserve, 180);
  assert.equal(game.wave, 2);
});
