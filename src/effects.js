import * as THREE from 'three';

// Mjuk, radiell partikeltextur. DataTexture fungerar även utan DOM (tester).
function createSoftTexture(size = 64) {
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5) / size * 2 - 1;
      const dy = (y + 0.5) / size * 2 - 1;
      const distance = Math.min(1, Math.sqrt(dx * dx + dy * dy));
      const alpha = Math.pow(1 - distance, 1.8);
      const index = (y * size + x) * 4;
      data[index] = data[index + 1] = data[index + 2] = 255;
      data[index + 3] = Math.round(alpha * 255);
    }
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

// Keep a bounded set of reusable GPU objects. A full pool drops cosmetic
// effects; it never affects damage, score or collision detection.
export class EffectsSystem {
  constructor(scene, limits = {}) {
    this.scene = scene;
    this.camera = null;
    this.limits = { particle: 256, tracer: 24, light: 6, ...limits };
    this.free = { particle: [], tracer: [], light: [] };
    this.created = { particle: 0, tracer: 0, light: 0 };
    this.active = [];
    this.geometry = new THREE.PlaneGeometry(1, 1);
    this.softTexture = createSoftTexture();
  }

  acquire(kind) {
    let effect = this.free[kind].pop();
    if (!effect) {
      if (this.created[kind] >= this.limits[kind]) return null;
      let mesh;
      if (kind === 'particle') {
        mesh = new THREE.Mesh(this.geometry, new THREE.MeshBasicMaterial({ map: this.softTexture, transparent: true, depthWrite: false, fog: true }));
        mesh.renderOrder = 2;
      } else if (kind === 'tracer') {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
        mesh = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xffe2a0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        mesh.frustumCulled = false;
      } else {
        mesh = new THREE.PointLight(0xff6a2a, 0, 18, 2);
      }
      effect = { kind, mesh, velocity: new THREE.Vector3(), life: 0, maxLife: 1, gravity: 0, grow: 1.4, drag: 0, opacity: 1, fade: 2 };
      this.created[kind]++;
    }
    this.scene.add(effect.mesh);
    this.active.push(effect);
    return effect;
  }

  particle(position, color, radius, life, speed, gravity, upward = 0, options = {}) {
    const effect = this.acquire('particle');
    if (!effect) return;
    const { additive = true, grow = 1.4, drag = 0, opacity = 1, fade = 2 } = options;
    effect.mesh.position.copy(position);
    effect.mesh.scale.setScalar(radius * 2.6);
    effect.mesh.material.color.setHex(color);
    effect.mesh.material.blending = additive ? THREE.AdditiveBlending : THREE.NormalBlending;
    effect.mesh.material.opacity = opacity;
    effect.velocity.set((Math.random() - 0.5) * speed, (Math.random() - 0.5 + upward) * speed, (Math.random() - 0.5) * speed);
    effect.life = effect.maxLife = life;
    effect.gravity = gravity;
    effect.grow = grow;
    effect.drag = drag;
    effect.opacity = opacity;
    effect.fade = fade;
    if (this.camera) effect.mesh.quaternion.copy(this.camera.quaternion);
  }

  spawnImpact(position, color) {
    for (let i = 0; i < 5; i++) this.particle(position, color, 0.018 + Math.random() * 0.02, 0.18 + Math.random() * 0.16, 6, 6, 0.2, { grow: 0.2 });
    for (let i = 0; i < 2; i++) this.particle(position, 0x8f877a, 0.08 + Math.random() * 0.06, 0.5 + Math.random() * 0.3, 0.9, -0.4, 0.4, { additive: false, grow: 2.2, drag: 2, opacity: 0.45, fade: 1.2 });
  }

  spawnExplosion(position) {
    const light = this.acquire('light');
    if (light) {
      light.mesh.position.copy(position);
      light.mesh.intensity = 30;
      light.life = light.maxLife = 0.3;
    }
    // Eldklot.
    const fire = [0xffd27a, 0xff9a3c, 0xff6a24];
    for (let i = 0; i < 10; i++) this.particle(position, fire[i % 3], 0.3 + Math.random() * 0.35, 0.22 + Math.random() * 0.25, 5.5, 0, 0.15, { grow: 2.6, drag: 3.5, opacity: 1, fade: 1 });
    // Rök som stiger och breder ut sig.
    const smoke = [0x3a3734, 0x56514a, 0x2a2826];
    for (let i = 0; i < 12; i++) this.particle(position, smoke[i % 3], 0.35 + Math.random() * 0.4, 1.15 + Math.random() * 0.75, 3.2, -1.1, 0.25, { additive: false, grow: 0.9, drag: 1.6, opacity: 0.72, fade: 1.1 });
    // Gnistor och skräp.
    for (let i = 0; i < 8; i++) this.particle(position, 0xffc768, 0.035 + Math.random() * 0.03, 0.45 + Math.random() * 0.45, 15, 9, 0.35, { grow: 0, drag: 0.6 });
    for (let i = 0; i < 4; i++) this.particle(position, 0x1c1d1e, 0.05 + Math.random() * 0.04, 0.7 + Math.random() * 0.5, 11, 9.8, 0.45, { additive: false, grow: 0, opacity: 0.95, fade: 4 });
  }

  spawnTracer(origin, target, quaternion) {
    const effect = this.acquire('tracer');
    if (!effect) return;
    const start = new THREE.Vector3(0.22, -0.17, -0.34).applyQuaternion(quaternion).add(origin);
    const positions = effect.mesh.geometry.attributes.position;
    positions.setXYZ(0, start.x, start.y, start.z);
    positions.setXYZ(1, target.x, target.y, target.z);
    positions.needsUpdate = true;
    effect.mesh.material.opacity = 0.85;
    effect.life = effect.maxLife = 0.06;
  }

  release(effect) {
    this.scene.remove(effect.mesh);
    if (effect.kind === 'light') effect.mesh.intensity = 0;
    this.free[effect.kind].push(effect);
  }

  update(dt) {
    for (let index = this.active.length - 1; index >= 0; index--) {
      const effect = this.active[index];
      effect.life -= dt;
      if (effect.life <= 0) {
        this.release(effect);
        this.active.splice(index, 1);
      } else if (effect.kind === 'light') {
        effect.mesh.intensity *= Math.pow(0.84, dt * 60);
      } else if (effect.kind === 'tracer') {
        effect.mesh.material.opacity = 0.85 * effect.life / effect.maxLife;
      } else {
        if (effect.drag) effect.velocity.multiplyScalar(Math.exp(-dt * effect.drag));
        effect.velocity.y -= effect.gravity * dt;
        effect.mesh.position.addScaledVector(effect.velocity, dt);
        effect.mesh.material.opacity = effect.opacity * Math.min(1, (effect.life / effect.maxLife) * effect.fade);
        effect.mesh.scale.multiplyScalar(Math.exp(dt * effect.grow));
        if (this.camera) effect.mesh.quaternion.copy(this.camera.quaternion);
      }
    }
  }

  clear() {
    this.active.forEach(effect => this.release(effect));
    this.active.length = 0;
  }

  dispose() {
    this.clear();
    for (const pool of Object.values(this.free)) {
      for (const { kind, mesh } of pool) {
        if (kind === 'light') mesh.dispose();
        else {
          if (kind === 'tracer') mesh.geometry.dispose();
          mesh.material.dispose();
        }
      }
      pool.length = 0;
    }
    this.geometry.dispose();
    this.softTexture.dispose();
    this.created = { particle: 0, tracer: 0, light: 0 };
  }
}
