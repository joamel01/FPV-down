import * as THREE from 'three';

// Procedural sky dome: gradient, sun disc with glow and drifting fbm clouds.
// Outputs linear HDR colour; the OutputPass applies tone mapping and sRGB.
export const SKY_COLORS = Object.freeze({
  zenith: 0x3f78b8,
  horizon: 0xb9c9d3,
  ground: 0x6d6a5c,
  sun: 0xfff1d6
});

export function createSky(sunDirection) {
  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
    uniforms: {
      sunDirection: { value: sunDirection.clone().normalize() },
      zenithColor: { value: new THREE.Color(SKY_COLORS.zenith) },
      horizonColor: { value: new THREE.Color(SKY_COLORS.horizon) },
      groundColor: { value: new THREE.Color(SKY_COLORS.ground) },
      sunColor: { value: new THREE.Color(SKY_COLORS.sun) },
      time: { value: 0 }
    },
    vertexShader: /* glsl */ `
      varying vec3 vDirection;
      void main() {
        vDirection = normalize((modelMatrix * vec4(position, 0.0)).xyz);
        vec4 clip = projectionMatrix * viewMatrix * vec4((modelMatrix * vec4(position, 1.0)).xyz, 1.0);
        gl_Position = clip.xyww;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 sunDirection;
      uniform vec3 zenithColor;
      uniform vec3 horizonColor;
      uniform vec3 groundColor;
      uniform vec3 sunColor;
      uniform float time;
      varying vec3 vDirection;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }
      float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;
        for (int i = 0; i < 5; i++) {
          value += amplitude * noise(p);
          p = p * 2.03 + vec2(17.1, 9.2);
          amplitude *= 0.5;
        }
        return value;
      }

      void main() {
        vec3 direction = normalize(vDirection);
        float height = direction.y;
        float sunAmount = max(dot(direction, sunDirection), 0.0);

        vec3 sky = mix(horizonColor, zenithColor, pow(smoothstep(0.0, 0.62, height), 0.75));
        sky += sunColor * pow(sunAmount, 6.0) * 0.28;
        sky = mix(sky, groundColor, smoothstep(0.0, -0.08, height));

        if (height > 0.0) {
          vec2 uv = direction.xz / (height + 0.12) * 1.4;
          vec2 drift = vec2(time * 0.006, time * 0.002);
          float shape = fbm(uv + drift);
          float detail = fbm(uv * 3.1 - drift * 1.7);
          float coverage = smoothstep(0.5, 0.82, shape * 0.78 + detail * 0.32);
          coverage *= smoothstep(0.02, 0.22, height);
          float shade = mix(0.72, 1.08, smoothstep(0.35, 0.9, detail));
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
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 24), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -1;
  mesh.scale.setScalar(300);
  return mesh;
}
