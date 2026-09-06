// Run against the local game after pressing Start:
// Get-Content -Raw tools/browser-checks.js | npx agent-browser --session fpv-review eval --stdin
// This sets up deterministic test situations in the current, disposable game.
(async () => {
  const game = window.game;
  const checks = [];
  const expect = (condition, label) => {
    if (!condition) throw new Error(label);
    checks.push(label);
  };
  const frames = async count => { for (let i = 0; i < count; i++) await new Promise(requestAnimationFrame); };
  game.pauseGame();
  await frames(2);
  expect(!!game.audio.ctx, 'Audio initialized by the Start button');
  const preferences = { quality: 'medium', sensitivity: 1.75, invertY: true, masterVolume: 0.5, effectsVolume: 0.35, rotorVolume: 0.2, showPerformance: true };
  for (const [key, value] of Object.entries(preferences)) {
    const input = document.querySelector(`[data-setting="${key}"]`);
    if (input.type === 'checkbox') input.checked = value;
    else input.value = value;
    input.dispatchEvent(new Event(input.type === 'range' ? 'input' : 'change', { bubbles: true }));
  }
  expect(JSON.stringify(game.settings.value) === JSON.stringify(preferences), 'All settings applied through their form controls');
  expect(JSON.stringify(JSON.parse(localStorage.getItem('fpv-down-settings-v1'))) === JSON.stringify(preferences), 'All preferences saved in localStorage');
  expect(game.renderer.shadowMap.enabled && game.world.sun.shadow.mapSize.x === 1024 && !game.bloomPass.enabled, 'Medium quality changes shadows and bloom');
  await frames(15);
  expect(Math.abs(game.audio.master.gain.value - 0.26) < 0.02 && Math.abs(game.audio.effectsBus.gain.value - 0.35) < 0.02 && Math.abs(game.audio.rotorBus.gain.value - 0.2) < 0.02, 'Independent audio buses receive their volumes');

  game.drones.forEach(drone => drone.dispose());
  game.drones = [];
  game.state = 'PLAYING';
  game.switchWeapon(1);
  game.weaponStates[1].ammo = 1;
  game.weaponStates[2].ammo = 20;
  game.fireCooldown = 0;
  game.tryFire();
  game.switchWeapon(2);
  game.updateWeaponTimers(0.5);
  expect(!game.isReloading && game.weaponStates[2].ammo === 20, 'Empty-magazine reload cannot cross a weapon switch');
  game.startReload();
  game.reloadTimer = 1.72 / 2;
  game.weaponView.update(0.016, game);
  expect(game.weaponView.weaponRig.position.y < -0.5, 'Reload animation lowers the rendered weapon');
  game.isReloading = false;
  game.weaponStates[2].ammo = 2;
  game.hud.update(game);
  expect(game.dom.ammoWarning.textContent === 'LÅG AMMUNITION', 'Low ammunition is visible in the HUD');
  game.yaw = 0;
  game.damagePlayer(5, game.camera.position.clone().add({ x: 10, y: 0, z: 0 }));
  game.hud.updateFeedback(game, 0.016);
  expect(game.dom.damageDirection.classList.contains('visible'), 'Damage direction is displayed');

  game.health = 67;
  game.armor = 10;
  game.score = 1000;
  game.wave = 1;
  game.waveTotal = game.waveSpawned = 6;
  game.updateDrones(0.016);
  expect(game.state === 'RESUPPLY' && !game.dom.resupply.classList.contains('hidden') && game.score === 1250, 'Survived wave shows a single supply choice and bonus');
  document.querySelector('[data-resupply="armor"]').click();
  await frames(2);
  expect(game.wave === 2 && game.armor === 45 && game.health === 67, 'Armor choice starts the next wave and applies only armor');
  document.querySelector('[data-resupply="health"]').click();
  expect(game.health === 67 && game.wave === 2, 'A second supply click cannot grant another reward');
  game.pauseGame();
  await frames(2);
  for (const index of [0, 1, 2]) { game.weaponView.setWeaponModel(index); game.composer.render(); }
  game.effectsSystem.clear();
  game.effectsSystem.spawnExplosion(game.camera.position);
  game.composer.render();
  game.effectsSystem.clear();
  const before = game.renderer.info.memory.geometries;
  for (let i = 0; i < 20; i++) {
    game.weaponView.setWeaponModel(i % 3);
    game.effectsSystem.spawnExplosion(game.camera.position);
    game.composer.render();
    game.effectsSystem.clear();
  }
  expect(game.renderer.info.memory.geometries === before, 'Repeated weapon switches and explosions do not grow GPU geometry count after warmup');
  game.weaponView.setWeaponModel(game.currentWeapon);
  return { checks, geometryCount: before, settingsForReloadCheck: game.settings.value };
})()
