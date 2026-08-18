/**
 * Camada de armazenamento resiliente para compatibilidade com navegadores
 * móveis antigos, Safari em modo Privado/Anônimo e WebViews com cotas restritas.
 */

const memoryFallback = new Map<string, string>();

let isLocalStorageSupported: boolean | null = null;

function checkStorageSupport(): boolean {
  if (isLocalStorageSupported !== null) {
    return isLocalStorageSupported;
  }
  if (typeof window === 'undefined' || typeof window.localStorage === 'undefined') {
    isLocalStorageSupported = false;
    return false;
  }
  try {
    const testKey = '__jw_stage_test_storage__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    isLocalStorageSupported = true;
    return true;
  } catch (e) {
    // Safari Private Mode ou armazenamento desabilitado
    isLocalStorageSupported = false;
    return false;
  }
}

export const safeStorage = {
  getItem(key: string): string | null {
    try {
      if (checkStorageSupport()) {
        const val = window.localStorage.getItem(key);
        if (val !== null) return val;
      }
    } catch (e) {
      console.warn(`[safeStorage] Error reading key "${key}":`, e);
    }
    return memoryFallback.get(key) || null;
  },

  setItem(key: string, value: string): void {
    try {
      if (checkStorageSupport()) {
        window.localStorage.setItem(key, value);
        return;
      }
    } catch (e) {
      console.warn(`[safeStorage] Fallback to memory for key "${key}":`, e);
    }
    memoryFallback.set(key, value);
  },

  removeItem(key: string): void {
    try {
      if (checkStorageSupport()) {
        window.localStorage.removeItem(key);
      }
    } catch (e) {
      console.warn(`[safeStorage] Error removing key "${key}":`, e);
    }
    memoryFallback.delete(key);
  },

  getJSON<T>(key: string, defaultValue: T): T {
    try {
      const raw = this.getItem(key);
      if (raw) {
        return JSON.parse(raw) as T;
      }
    } catch (e) {
      console.warn(`[safeStorage] JSON parse error for key "${key}":`, e);
    }
    return defaultValue;
  },

  setJSON(key: string, value: any): void {
    try {
      const str = JSON.stringify(value);
      this.setItem(key, str);
    } catch (e) {
      console.warn(`[safeStorage] JSON stringify error for key "${key}":`, e);
    }
  }
};
