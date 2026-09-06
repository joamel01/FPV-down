import * as THREE from 'three';

// Keep a bounded set of reusable GPU objects. A full pool drops cosmetic
// effects; it never affects damage, score or collision detection.
export class EffectsSystem {
  constructor(scene, limits = {}) {
    this.scene = scene;
    this.limits = { particle: 256, tracer: 24, light: 6, ...limits };
    this.free = { particle: [], tracer: [], light: [] };
    this.created = { particle: 0, tracer: 0, light: 0 };
    this.active = [];
    this.geometry = new THREE.SphereGeometry(1, 6, 5);
  }

  acquire(kind) {
    let effect = this.free[kind].pop();
    if (!effect) {
      if (this.created[kind] >= this.limits[kind]) return null;
      let mesh;
      if (kind === 'particle') {
        mesh = new THREE.Mesh(this.geometry, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false }));
      } else if (kind === 'tracer') {
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
        mesh = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color: 0xffcf78, transparent: true, depthWrite: false }));
        mesh.frustumCulled = false;
      } else {
        mesh = new THREE.PointLight(0xff5c24, 0, 16, 2);
      }
      effect = { kind, mesh, velocity: new THREE.Vector3(), life: 0, maxLife: 1, gravity: 0 };
      this.created[kind]++;
    }
    this.scene.add(effect.mesh);
    this.active.push(effect);
    return effect;
  }

  particle(position, color, radius, life, speed, gravity, upward = 0) {
    const effect = this.acquire('particle');
    if (!effect) return;
    effect.mesh.position.copy(position);
    effect.mesh.scale.setScalar(radius);
    effect.mesh.material.color.setHex(color);
    effect.mesh.material.opacity = 1;
    effect.velocity.set((Math.random() - 0.5) * speed, (Math.random() - 0.5 + upward) * speed, (Math.random() - 0.5) * speed);
    effect.life = effect.maxLife = life;
    effect.gravity = gravity;
  }

  spawnImpact(position, color) {
    for (let i = 0; i < 7; i++) this.particle(position, color, 0.025 + Math.random() * 0.025, 0.28 + Math.random() * 0.16, 4, 3);
  }

  spawnExplosion(position) {
    const light = this.acquire('light');
    if (light) {
      light.mesh.position.copy(position);
      light.mesh.intensity = 12;
      light.life = light.maxLife = 0.22;
    }
    const colors = [0xffcf55, 0xff6729, 0x303537];
    for (let i = 0; i < 34; i++) this.particle(position, colors[i % 3], 0.055 + Math.random() * 0.11, 0.5 + Math.random() * 0.7, 11, 5.5, 0.3);
  }

  spawnTracer(origin, target, quaternion) {
    const effect = this.acquire('tracer');
    if (!effect) return;
    const start = new THREE.Vector3(0.22, -0.17, -0.34).applyQuaternion(quaternion).add(origin);
    const positions = effect.mesh.geometry.attributes.position;
    positions.setXYZ(0, start.x, start.y, start.z);
    positions.setXYZ(1, target.x, target.y, target.z);
    positions.needsUpdate = true;
    effect.mesh.material.opacity = 0.65;
    effect.life = effect.maxLife = 0.055;
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
        effect.mesh.material.opacity = 0.65 * effect.life / effect.maxLife;
      } else {
        effect.velocity.y -= effect.gravity * dt;
        effect.mesh.position.addScaledVector(effect.velocity, dt);
        effect.mesh.material.opacity = Math.min(1, effect.life * 2);
        effect.mesh.scale.multiplyScalar(Math.exp(dt * 1.4));
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
    this.created = { particle: 0, tracer: 0, light: 0 };
  }
}
