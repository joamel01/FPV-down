import * as THREE from 'three';

// Procedural sky dome: gradient, sun disc with glow and drifting clouds.
// Cloud noise is pre-baked once into a tileable DataTexture so the fragment
// shader only does two texture lookups per visible sky pixel.
export const SKY_COLORS = Object.freeze({
  zenith: 0x3f78b8,
  horizon: 0xb9c9d3,
  ground: 0x6d6a5c,
  sun: 0xfff1d6
});

function hash(x, y, period) {
  const px = ((x % period) + period) % period;
  const py = ((y % period) + period) % period;
  const n = Math.sin(px * 127.1 + py * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function periodicNoise(u, v, period) {
  const x = u * period;
  const y = v * period;
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const fx = x - ix;
  const fy = y - iy;
  const ux = fx * fx * (3 - 2 * fx);
  const uy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, period);
  const b = hash(ix + 1, iy, period);
  const c = hash(ix, iy + 1, period);
  const d = hash(ix + 1, iy + 1, period);
  return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}

function fbmTile(u, v, basePeriod) {
  let value = 0;
  let amplitude = 0.5;
  let period = basePeriod;
  for (let octave = 0; octave < 5; octave++) {
    value += amplitude * periodicNoise(u, v, period);
    period *= 2;
    amplitude *= 0.5;
  }
  return value;
}

let cloudTexture;
function getCloudTexture() {
  if (cloudTexture) return cloudTexture;
  const size = 256;
  const data = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const shape = fbmTile(u, v, 4);
      const detail = fbmTile(u + 0.37, v + 0.61, 12);
      const index = (y * size + x) * 4;
      data[index] = Math.round(shape * 255);
      data[index + 1] = Math.round(detail * 255);
      data[index + 2] = 0;
      data[index + 3] = 255;
    }
  }
  cloudTexture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  cloudTexture.wrapS = cloudTexture.wrapT = THREE.RepeatWrapping;
  cloudTexture.magFilter = cloudTexture.minFilter = THREE.LinearFilter;
  cloudTexture.needsUpdate = true;
  return cloudTexture;
}

export function createSky(sunDirection) {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: true,
    depthFunc: THREE.LessEqualDepth,
    fog: false,
    uniforms: {
      sunDirection: { value: sunDirection.clone().normalize() },
      zenithColor: { value: new THREE.Color(SKY_COLORS.zenith) },
      horizonColor: { value: new THREE.Color(SKY_COLORS.horizon) },
      groundColor: { value: new THREE.Color(SKY_COLORS.ground) },
      sunColor: { value: new THREE.Color(SKY_COLORS.sun) },
      clouds: { value: getCloudTexture() },
      time: { value: 0 }
    },
    vertexShader: /* glsl */ `
      varying vec3 vDirection;
      void main() {
        vDirection = position;
        vec4 clip = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
        gl_Position = clip.xyww;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 sunDirection;
      uniform vec3 zenithColor;
      uniform vec3 horizonColor;
      uniform vec3 groundColor;
      uniform vec3 sunColor;
      uniform sampler2D clouds;
      uniform float time;
      varying vec3 vDirection;

      void main() {
        vec3 direction = normalize(vDirection);
        float height = direction.y;
        float sunAmount = max(dot(direction, sunDirection), 0.0);

        vec3 sky = mix(horizonColor, zenithColor, pow(smoothstep(0.0, 0.62, height), 0.75));
        sky += sunColor * pow(sunAmount, 6.0) * 0.28;
        sky = mix(sky, groundColor, smoothstep(0.0, -0.08, height));

        if (height > 0.0) {
          vec2 uv = direction.xz / (height + 0.14) * 0.28;
          vec2 drift = vec2(time * 0.0015, time * 0.0005);
          float shape = texture2D(clouds, uv + drift).r;
          float detail = texture2D(clouds, uv * 2.3 - drift * 1.4).g;
          float coverage = smoothstep(0.48, 0.78, shape * 0.78 + detail * 0.32);
          coverage *= smoothstep(0.02, 0.22, height);
          float shade = mix(0.72, 1.08, smoothstep(0.35, 0.85, detail));
          vec3 cloudColor = mix(horizonColor * 0.92, vec3(1.0, 0.98, 0.95), shade);
          cloudColor += sunColor * pow(sunAmount, 10.0) * 0.45;
          sky = mix(sky, cloudColor, coverage * 0.92);
        }

        sky += sunColor * smoothstep(0.9993, 0.99965, sunAmount) * 12.0;
        sky += sunColor * pow(sunAmount, 900.0) * 3.0;
        gl_FragColor = vec4(sky, 1.0);
      }
    `
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 14), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;
  mesh.scale.setScalar(400);
  return mesh;
}
