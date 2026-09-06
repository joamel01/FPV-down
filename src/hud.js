import * as THREE from 'three';
import { WEAPONS } from './config.js';
const { clamp } = THREE.MathUtils;

export function setText(element, value) {
  const text = String(value);
  if (element.textContent !== text) element.textContent = text;
}

function setWidth(element, value) {
  if (element.style.width !== value) element.style.width = value;
}

export function damageBearing(source, position, yaw) {
  return Math.atan2(source.x - position.x, -(source.z - position.z)) + yaw;
}

export class HUD {
  constructor() {
    this.radarContext = document.getElementById('radar-canvas').getContext('2d');
    this.cacheDom();
    this.activeWeapon = -1;
    this.damageTimer = 0;
    this.radarTimer = 0;
  }

  cacheDom() {
    this.dom = {
      loading: document.getElementById('loading-screen'),
      loadingState: document.getElementById('loading-state'),
      start: document.getElementById('start-screen'),
      pause: document.getElementById('pause-screen'),
      gameover: document.getElementById('gameover-screen'),
      resupply: document.getElementById('resupply-screen'),
      resupplyWave: document.getElementById('resupply-wave'),
      resupplyStatus: document.getElementById('resupply-status'),
      ammoWarning: document.getElementById('ammo-warning'),
      damageDirection: document.getElementById('damage-direction'),
      performance: document.getElementById('performance-hud'),
      notification: document.getElementById('notification'),
      hint: document.getElementById('interaction-hint'),
      crosshair: document.getElementById('crosshair'),
      damage: document.getElementById('damage-vignette'),
      hit: document.getElementById('hit-marker'),
      waveLabel: document.getElementById('wave-label'),
      mission: document.getElementById('mission-text'),
      waveFill: document.getElementById('wave-progress-fill'),
      threats: document.getElementById('threat-count'),
      health: document.getElementById('health-value'),
      healthFill: document.getElementById('health-fill'),
      armor: document.getElementById('armor-value'),
      armorFill: document.getElementById('armor-fill'),
      fireMode: document.getElementById('fire-mode'),
      weaponName: document.getElementById('weapon-name'),
      ammo: document.getElementById('ammo-current'),
      reserve: document.getElementById('ammo-reserve'),
      reloadFill: document.getElementById('reload-fill'),
      score: document.getElementById('score-value'),
      finalScore: document.getElementById('final-score'),
      finalKills: document.getElementById('final-kills'),
      finalWave: document.getElementById('final-wave'),
      finalAccuracy: document.getElementById('final-accuracy')
    };
    this.gameUi = [...document.querySelectorAll('.game-ui')];
    this.weaponButtons = [...document.querySelectorAll('.weapon-slots button')];
  }

  update(game) {
    const weapon = WEAPONS[game.currentWeapon];
    const weaponState = game.weaponStates[game.currentWeapon];
    setText(this.dom.waveLabel, `VÅG ${String(Math.max(1, game.wave)).padStart(2, '0')}`);
    setWidth(this.dom.waveFill, `${game.waveTotal ? clamp(((game.waveSpawned - game.drones.length) / game.waveTotal) * 100, 0, 100) : 0}%`);
    setText(this.dom.threats, String(game.drones.length).padStart(2, '0'));
    setText(this.dom.health, Math.ceil(game.health));
    setWidth(this.dom.healthFill, `${game.health}%`);
    setText(this.dom.armor, Math.ceil(game.armor));
    setWidth(this.dom.armorFill, `${game.armor * 2}%`);
    setText(this.dom.fireMode, weapon.mode);
    setText(this.dom.weaponName, weapon.name);
    setText(this.dom.ammo, String(weaponState.ammo).padStart(2, '0'));
    setText(this.dom.reserve, String(weaponState.reserve).padStart(3, '0'));
    setText(this.dom.score, String(game.score).padStart(6, '0'));
    if (this.activeWeapon !== game.currentWeapon) {
      this.weaponButtons.forEach((button, index) => button.classList.toggle('active', index === game.currentWeapon));
      this.activeWeapon = game.currentWeapon;
    }
    const low = weaponState.ammo <= Math.ceil(weapon.magazine * 0.2);
    const warning = game.isReloading ? 'LADDAR OM' : weaponState.ammo === 0
      ? (weaponState.reserve ? 'TOMT MAGASIN · R LADDA OM' : 'SLUT PÅ AMMUNITION · BYT VAPEN')
      : low ? 'LÅG AMMUNITION' : '';
    setText(this.dom.ammoWarning, warning);
    if (this.lowAmmo !== low) {
      this.dom.ammo.classList.toggle('low-ammo', low);
      this.lowAmmo = low;
    }
    const reloadPercent = game.isReloading ? Math.round(clamp(1 - game.reloadTimer / weapon.reloadDuration, 0, 1) * 100) : 0;
    setWidth(this.dom.reloadFill, `${reloadPercent}%`);
  }

  showDamage(source) {
    this.damageSource = source.clone();
    this.damageTimer = 0.9;
  }

  clearDamage() {
    this.damageTimer = 0;
    this.dom.damageDirection.classList.remove('visible');
  }

  updateFeedback(game, dt) {
    if (this.damageTimer > 0) {
      this.damageTimer = Math.max(0, this.damageTimer - dt);
      const angle = damageBearing(this.damageSource, game.camera.position, game.yaw);
      this.dom.damageDirection.style.transform = `translate(-50%, -50%) rotate(${angle}rad)`;
      this.dom.damageDirection.classList.toggle('visible', this.damageTimer > 0);
    }
    this.radarTimer -= dt;
    if (this.radarTimer <= 0) {
      this.drawRadar(game);
      this.radarTimer = 1 / 30;
    }
  }

  updatePerformance(metrics) {
    setText(this.dom.performance, `${Math.round(metrics.fps)} FPS · Bildtid ${metrics.medianMs.toFixed(1)} ms · P95 ${metrics.p95Ms.toFixed(1)} ms`);
  }

  drawRadar(game) {
    const ctx = this.radarContext;
    const width = ctx.canvas.width;
    const center = width / 2;
    ctx.clearRect(0, 0, width, width);
    const gradient = ctx.createRadialGradient(center, center, 0, center, center, center);
    gradient.addColorStop(0, 'rgba(32, 69, 72, .42)');
    gradient.addColorStop(1, 'rgba(3, 12, 15, .82)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(center, center, center - 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = 'rgba(123, 217, 232, .17)';
    ctx.lineWidth = 1;
    [0.32, 0.64, 0.94].forEach((ratio) => {
      ctx.beginPath();
      ctx.arc(center, center, center * ratio, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.beginPath();
    ctx.moveTo(center, 8); ctx.lineTo(center, width - 8);
    ctx.moveTo(8, center); ctx.lineTo(width - 8, center);
    ctx.stroke();

    const sweep = (performance.now() * 0.00065) % (Math.PI * 2);
    ctx.strokeStyle = 'rgba(123, 217, 232, .55)';
    ctx.beginPath();
    ctx.moveTo(center, center);
    ctx.lineTo(center + Math.sin(sweep) * (center - 8), center - Math.cos(sweep) * (center - 8));
    ctx.stroke();

    game.drones.forEach((drone) => {
      const dx = drone.group.position.x - game.camera.position.x;
      const dz = drone.group.position.z - game.camera.position.z;
      const cos = Math.cos(-game.yaw);
      const sin = Math.sin(-game.yaw);
      const rx = dx * cos - dz * sin;
      const rz = dx * sin + dz * cos;
      const scale = (center - 12) / 120;
      const x = center + clamp(rx * scale, -center + 12, center - 12);
      const y = center + clamp(rz * scale, -center + 12, center - 12);
      ctx.fillStyle = drone.type === 'armored' ? '#ffb23e' : '#ff5149';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 7;
      ctx.beginPath();
      ctx.arc(x, y, drone.type === 'armored' ? 3.2 : 2.4, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#e6f3f5';
    ctx.beginPath();
    ctx.moveTo(center, center - 6);
    ctx.lineTo(center - 4, center + 5);
    ctx.lineTo(center + 4, center + 5);
    ctx.closePath();
    ctx.fill();
  }
}
