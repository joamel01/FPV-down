export const SETTINGS_KEY = 'fpv-down-settings-v1';
export const DEFAULT_SETTINGS = Object.freeze({
  quality: 'high', sensitivity: 1, invertY: false,
  masterVolume: 1, effectsVolume: 1, rotorVolume: 1, showPerformance: false
});
export const QUALITY_PRESETS = Object.freeze({
  low: { pixelRatio: 1, shadows: false, shadowSize: 512, bloom: false },
  medium: { pixelRatio: 1.25, shadows: true, shadowSize: 1024, bloom: false },
  high: { pixelRatio: 1.8, shadows: true, shadowSize: 2048, bloom: true }
});

export function normalizeSettings(input) {
  const source = input && typeof input === 'object' ? input : {};
  const result = { ...DEFAULT_SETTINGS };
  if (Object.hasOwn(QUALITY_PRESETS, source.quality)) result.quality = source.quality;
  for (const [key, min, max] of [['sensitivity', 0.3, 2.5], ['masterVolume', 0, 1], ['effectsVolume', 0, 1], ['rotorVolume', 0, 1]]) {
    if (typeof source[key] === 'number' && Number.isFinite(source[key])) result[key] = Math.max(min, Math.min(max, source[key]));
  }
  for (const key of ['invertY', 'showPerformance']) if (typeof source[key] === 'boolean') result[key] = source[key];
  return result;
}

export class SettingsStore {
  constructor(storage) {
    try { this.storage = storage ?? globalThis.localStorage; } catch { this.storage = null; }
    try { this.value = normalizeSettings(JSON.parse(this.storage?.getItem(SETTINGS_KEY) ?? 'null')); }
    catch { this.value = { ...DEFAULT_SETTINGS }; }
  }

  update(patch) {
    this.value = normalizeSettings({ ...this.value, ...patch });
    try {
      if (!this.storage) return false;
      this.storage.setItem(SETTINGS_KEY, JSON.stringify(this.value));
      return true;
    } catch { return false; }
  }
}

export class SettingsPanel {
  constructor(store, onChange) {
    this.store = store;
    this.onChange = onChange;
    this.dialog = document.getElementById('settings-dialog');
    this.status = document.getElementById('settings-status');
    this.inputs = [...this.dialog.querySelectorAll('[data-setting]')];
    this.inputs.forEach(input => input.addEventListener(input.type === 'range' ? 'input' : 'change', () => {
      const value = input.type === 'checkbox' ? input.checked : input.type === 'range' ? Number(input.value) : input.value;
      const saved = store.update({ [input.dataset.setting]: value });
      this.sync();
      this.status.textContent = saved ? 'Inställningarna sparas automatiskt på den här enheten.' : 'Inställningarna gäller för den här sessionen. Lokal lagring är inte tillgänglig.';
      onChange(store.value);
    }));
    document.getElementById('settings-close').addEventListener('click', () => this.dialog.close());
    document.getElementById('settings-reset').addEventListener('click', () => {
      const saved = store.update(DEFAULT_SETTINGS);
      this.sync();
      this.status.textContent = saved ? 'Standardinställningarna är återställda och sparade.' : 'Standardinställningarna gäller för den här sessionen.';
      onChange(store.value);
    });
    this.sync();
  }

  sync() {
    for (const input of this.inputs) {
      const value = this.store.value[input.dataset.setting];
      if (input.type === 'checkbox') input.checked = value;
      else input.value = value;
      const output = this.dialog.querySelector(`[data-output="${input.dataset.setting}"]`);
      if (output) output.textContent = input.dataset.setting === 'sensitivity' ? `${value.toFixed(2)}×` : `${Math.round(value * 100)} %`;
    }
  }

  open() { this.dialog.showModal(); }
}
