// Run against a fresh local game. Captures real rendered frames, not an FPS estimate.
// Get-Content -Raw tools/browser-benchmark.js | npx agent-browser --session fpv-review eval --stdin
(async () => {
  const game = window.game;
  const originalSettings = { ...game.settings.value };
  const originalRandom = Math.random;
  const results = [];
  game.settingsPanel.dialog.close();
  game.pauseGame();
  await new Promise(requestAnimationFrame);
  for (const quality of ['high', 'medium', 'low']) {
    game.drones.forEach(drone => drone.dispose());
    game.drones = [];
    game.effectsSystem.clear();
    game.settings.value = { ...originalSettings, quality };
    game.applySettings();
    game.state = 'PLAYING';
    game.camera.position.set(0, 1.72, 14);
    game.health = 100000;
    game.wave = 1;
    game.waveTotal = game.waveSpawned = 24;
    let seed = 12345;
    Math.random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
    for (let i = 0; i < 24; i++) game.spawnDrone();
    Math.random = originalRandom;
    const samples = [], calls = [], cpu = [];
    let previous = performance.now(), warmup = 60;
    await new Promise(resolve => {
      function tick(now) {
        const elapsed = now - previous;
        previous = now;
        if (warmup-- <= 0) {
          samples.push(elapsed);
          calls.push(game.renderer.info.render.calls);
          cpu.push(game.profiler.snapshot().cpuMs);
        }
        if (samples.length < 180) requestAnimationFrame(tick);
        else resolve();
      }
      requestAnimationFrame(tick);
    });
    samples.sort((a, b) => a - b);
    results.push({ quality, viewport: [innerWidth, innerHeight], pixelRatio: game.renderer.getPixelRatio(), medianMs: samples[90], p95Ms: samples[171], drawCalls: Math.round(calls.reduce((a, b) => a + b, 0) / calls.length), geometries: game.renderer.info.memory.geometries, dronesAtEnd: game.drones.length });
    game.state = 'PAUSED';
  }
  Math.random = originalRandom;
  game.settings.value = originalSettings;
  game.applySettings();
  return results;
})()
