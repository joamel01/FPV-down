import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import { DEFAULT_SETTINGS, SettingsStore, normalizeSettings, SETTINGS_KEY } from '../src/settings.js';
import { EffectsSystem } from '../src/effects.js';
import { WeaponView } from '../src/weapon-view.js';
import { FrameProfiler } from '../src/performance.js';
import { HUD, damageBearing } from '../src/hud.js';
import { applyResupply, canResupply } from '../src/resupply.js';
import { WEAPONS } from '../src/config.js';

test('settings survive a new store and normalize invalid values', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  const store = new SettingsStore(storage);
  assert.equal(store.update({ quality: 'low', sensitivity: 1.75, invertY: true, effectsVolume: 0.3, showPerformance: true }), true);
  assert.deepEqual(new SettingsStore(storage).value, store.value);
  const normalized = normalizeSettings({ quality: 'toString', sensitivity: Infinity, masterVolume: -4, effectsVolume: 7, rotorVolume: '0.5', invertY: 'yes' });
  assert.equal(normalized.quality, DEFAULT_SETTINGS.quality);
  assert.equal(normalized.sensitivity, DEFAULT_SETTINGS.sensitivity);
  assert.equal(normalized.masterVolume, 0);
  assert.equal(normalized.effectsVolume, 1);
  assert.equal(normalized.rotorVolume, 1);
  assert.equal(normalized.invertY, false);
  values.set(SETTINGS_KEY, '{broken');
  assert.deepEqual(new SettingsStore(storage).value, DEFAULT_SETTINGS);
});

test('unavailable storage does not prevent changing settings for the session', () => {
  const storage = { getItem() { throw Error('denied'); }, setItem() { throw Error('quota'); } };
  const store = new SettingsStore(storage);
  assert.equal(store.update({ quality: 'medium', masterVolume: 0 }), false);
  assert.equal(store.value.quality, 'medium');
  assert.equal(store.value.masterVolume, 0);
});

test('effect pools stay bounded through repeated large explosions and resets', () => {
  const scene = new THREE.Scene();
  const effects = new EffectsSystem(scene, { particle: 40, tracer: 2, light: 2 });
  for (let cycle = 0; cycle < 30; cycle++) {
    for (let i = 0; i < 10; i++) {
      effects.spawnExplosion(new THREE.Vector3());
      effects.spawnTracer(new THREE.Vector3(), new THREE.Vector3(1, 1, 1), new THREE.Quaternion());
    }
    assert.equal(effects.active.length, 44);
    assert.deepEqual(effects.created, { particle: 40, tracer: 2, light: 2 });
    if (cycle % 2) effects.update(2);
    else effects.clear();
    assert.equal(effects.active.length, 0);
    assert.equal(scene.children.length, 0);
  }
  effects.dispose();
});

test('reused tracer receives fresh positions and final disposal releases shared geometry once', () => {
  const effects = new EffectsSystem(new THREE.Scene());
  const origin = new THREE.Vector3();
  effects.spawnTracer(origin, new THREE.Vector3(1, 2, 3), new THREE.Quaternion());
  const line = effects.active[0].mesh;
  effects.update(1);
  effects.spawnTracer(origin, new THREE.Vector3(4, 5, 6), new THREE.Quaternion());
  assert.equal(effects.active[0].mesh, line);
  assert.deepEqual([...line.geometry.attributes.position.array.slice(3)], [4, 5, 6]);
  effects.spawnExplosion(origin);
  let geometryDisposals = 0;
  let lineDisposals = 0;
  effects.geometry.addEventListener('dispose', () => geometryDisposals++);
  line.geometry.addEventListener('dispose', () => lineDisposals++);
  effects.dispose();
  assert.equal(geometryDisposals, 1);
  assert.equal(lineDisposals, 1);
  assert.equal(effects.scene.children.length, 0);
});

test('all weapon models are reused after switching and own resources are released once', () => {
  const view = new WeaponView(new THREE.PerspectiveCamera());
  const first = view.weaponModel;
  view.setWeaponModel(1);
  const ak5 = view.weaponModel;
  view.setWeaponModel(2);
  for (let i = 0; i < 20; i++) { view.setWeaponModel(0); view.setWeaponModel(1); }
  assert.equal(view.weaponModel, ak5);
  view.setWeaponModel(0);
  assert.equal(view.weaponModel, first);
  assert.equal(view.models.size, 3);
  assert.equal(view.weaponRig.children.filter(child => child.visible).length, 1);
  let disposals = 0;
  const sharedMaterial = ak5.children[0].children[0].material;
  sharedMaterial.addEventListener('dispose', () => disposals++);
  view.dispose();
  assert.equal(disposals, 1);
  assert.equal(view.camera.children.length, 0);
});

test('reload animation lowers the weapon and returns it to the ready pose', () => {
  const view = new WeaponView(new THREE.PerspectiveCamera());
  const game = { currentWeapon: 0, isReloading: false, reloadTimer: 0,
    recoil: 0, swayX: 0, swayY: 0, bobTime: 0, keys: new Set(), muzzleTimer: 0, camera: view.camera };
  view.update(0.016, game);
  const ready = view.weaponRig.position.y;
  game.isReloading = true;
  game.reloadTimer = WEAPONS[0].reloadDuration / 2;
  view.update(0.016, game);
  assert.ok(view.weaponRig.position.y < ready - 0.2);
  assert.ok(view.weaponRig.rotation.x > 0.3);
  game.isReloading = false;
  view.update(0.016, game);
  assert.equal(view.weaponRig.position.y, ready);
  assert.equal(view.weaponRig.rotation.x, -0.04);
  view.dispose();
});

function resupplyGame() {
  return { state: 'RESUPPLY', health: 90, armor: 40, weaponStates: WEAPONS.map(w => ({ ammo: 0, reserve: w.reserve * 2 - 1 })) };
}

test('resupply caps health, armor and reserves and cannot be claimed twice', () => {
  for (const choice of ['health', 'armor', 'ammo']) {
    const game = resupplyGame();
    assert.equal(applyResupply(game, choice), true);
    if (choice === 'health') assert.equal(game.health, 100);
    if (choice === 'armor') assert.equal(game.armor, 50);
    if (choice === 'ammo') game.weaponStates.forEach((state, i) => { assert.equal(state.reserve, WEAPONS[i].reserve * 2); assert.equal(state.ammo, 0); });
    assert.equal(applyResupply(game, choice), false);
  }
});

test('invalid and unnecessary supplies are rejected, but a full player can continue', () => {
  const game = resupplyGame();
  game.health = 100;
  game.armor = 50;
  game.weaponStates.forEach((state, i) => state.reserve = WEAPONS[i].reserve * 2);
  for (const choice of ['health', 'armor', 'ammo', 'invalid']) {
    assert.equal(canResupply(game, choice), false);
    assert.equal(applyResupply(game, choice), false);
  }
  assert.equal(game.state, 'RESUPPLY');
  assert.equal(applyResupply(game, 'continue'), true);
  assert.equal(game.state, 'PLAYING');
});

test('damage direction follows camera heading', () => {
  const position = new THREE.Vector3();
  assert.equal(damageBearing(new THREE.Vector3(0, 0, -10), position, 0), 0);
  assert.equal(damageBearing(new THREE.Vector3(10, 0, 0), position, 0), Math.PI / 2);
  assert.equal(damageBearing(new THREE.Vector3(10, 0, 0), position, -Math.PI / 2), 0);
});

test('unchanged HUD does not repeatedly write DOM and ammo warning follows actual ammo', () => {
  let writes = 0;
  const element = () => {
    let value = '', width = '';
    return {
      get textContent() { return value; }, set textContent(next) { writes++; value = next; },
      style: { get width() { return width; }, set width(next) { writes++; width = next; } },
      classList: { toggle() { writes++; } }
    };
  };
  const hud = Object.create(HUD.prototype);
  hud.dom = Object.fromEntries(['waveLabel', 'waveFill', 'threats', 'health', 'healthFill', 'armor', 'armorFill', 'fireMode', 'weaponName', 'ammo', 'reserve', 'score', 'ammoWarning', 'reloadFill'].map(key => [key, element()]));
  hud.weaponButtons = [element(), element(), element()];
  const game = { ...resupplyGame(), state: 'PLAYING', currentWeapon: 1, wave: 1, waveTotal: 6, waveSpawned: 0, drones: [], score: 0, isReloading: false };
  game.weaponStates[1].ammo = 30;
  hud.update(game);
  writes = 0;
  for (let i = 0; i < 100; i++) hud.update(game);
  assert.equal(writes, 0);
  game.weaponStates[1].ammo = 29;
  hud.update(game);
  assert.equal(writes, 1);
  game.weaponStates[1].ammo = 3;
  hud.update(game);
  assert.equal(hud.dom.ammoWarning.textContent, 'LÅG AMMUNITION');
  game.weaponStates[1].ammo = 0;
  game.weaponStates[1].reserve = 0;
  hud.update(game);
  assert.match(hud.dom.ammoWarning.textContent, /SLUT PÅ AMMUNITION/);
});

test('profiler uses a bounded window and excludes suspended-tab gaps', () => {
  const profiler = new FrameProfiler(20);
  for (let i = 0; i < 20; i++) profiler.record(10, 2);
  profiler.record(10000, 5);
  const result = profiler.snapshot();
  assert.equal(result.fps, 100);
  assert.equal(result.medianMs, 10);
  assert.equal(result.p95Ms, 10);
  assert.equal(result.cpuMs, 2);
  for (let i = 0; i < 40; i++) profiler.record(20, 3);
  assert.equal(profiler.frames.length, 20);
  assert.equal(profiler.snapshot().fps, 50);
});
