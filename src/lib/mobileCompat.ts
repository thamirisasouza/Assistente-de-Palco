/**
 * Utilitários de resiliência e compatibilidade para smartphones e navegadores móveis:
 * - Wake Lock (Impede que a tela do celular apague/bloqueie durante a reunião no palco)
 * - Web Audio API desbloqueada para alertas sonoros em iOS/Android antigos
 * - Vibração segura (com guardas para iOS onde navigator.vibrate não existe)
 * - Gerador de IDs compatível com versões antigas do JavaScript (sem exigir crypto.randomUUID)
 * - Modo Tela Cheia com suporte a prefixos de navegadores antigos
 */

// ==========================================
// 1. GERADOR DE IDENTIFICADORES UNIVERSAL
// ==========================================
export function generateId(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return `${prefix}-${crypto.randomUUID()}`;
    } catch (e) {
      // Fallback
    }
  }
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 9);
  return `${prefix}-${timestamp}-${randomPart}`;
}

// ==========================================
// 2. KEEP-AWAKE / WAKE LOCK RESILIENTE
// ==========================================
let wakeLockSentinel: any = null;
let isWakeLockRequested = false;

export async function requestScreenWakeLock(): Promise<boolean> {
  isWakeLockRequested = true;
  if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) {
    return false;
  }

  try {
    if (wakeLockSentinel !== null && !wakeLockSentinel.released) {
      return true;
    }
    wakeLockSentinel = await (navigator as any).wakeLock.request('screen');
    
    wakeLockSentinel.addEventListener('release', () => {
      wakeLockSentinel = null;
    });
    return true;
  } catch (err) {
    console.warn('[WakeLock] Could not acquire screen wake lock:', err);
    return false;
  }
}

export async function releaseScreenWakeLock(): Promise<void> {
  isWakeLockRequested = false;
  if (wakeLockSentinel !== null) {
    try {
      await wakeLockSentinel.release();
    } catch (e) {
      // Ignore
    } finally {
      wakeLockSentinel = null;
    }
  }
}

// Reativa automaticamente o WakeLock quando o usuário retorna ao navegador
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && isWakeLockRequested) {
      requestScreenWakeLock().catch(() => {});
    }
  });
}

// ==========================================
// 3. WEB AUDIO API & DESBLOQUEIO EM TOUCH
// ==========================================
let audioContextInstance: AudioContext | null = null;
let isAudioUnlocked = false;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;

  if (!audioContextInstance) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      try {
        audioContextInstance = new AudioContextClass();
      } catch (e) {
        console.warn('[WebAudio] Failed to initialize AudioContext:', e);
      }
    }
  }
  return audioContextInstance;
}

// Desbloqueia o AudioContext no primeiro toque/clique do usuário no celular
export function unlockAudioContext(): void {
  if (isAudioUnlocked) return;
  const ctx = getAudioContext();
  if (ctx && ctx.state === 'suspended') {
    ctx.resume().then(() => {
      isAudioUnlocked = true;
    }).catch(() => {});
  } else if (ctx && ctx.state === 'running') {
    isAudioUnlocked = true;
  }
}

if (typeof window !== 'undefined') {
  const unlockEvents = ['touchstart', 'touchend', 'click', 'keydown'];
  const handleFirstInteraction = () => {
    unlockAudioContext();
    unlockEvents.forEach(evt => {
      window.removeEventListener(evt, handleFirstInteraction);
    });
  };
  unlockEvents.forEach(evt => {
    window.addEventListener(evt, handleFirstInteraction, { passive: true });
  });
}

/**
 * Toca um sinal sonoro suave e limpo
 */
export function playAlertTone(type: 'warning' | 'overtime' | 'counsel' | 'bell' = 'warning'): void {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === 'warning') {
      // Beep suave de aviso de 1 minuto (Tom agradável de 587Hz / Ré)
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.18, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.36);
    } else if (type === 'overtime') {
      // Sinal sutil de tempo esgotado
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(349.23, now + 0.25);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.2, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.31);
    } else if (type === 'counsel') {
      // Sinal de transição para conselho
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.15, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.26);
    } else {
      // Sino de conclusão
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, now);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.22, now + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
      osc.start(now);
      osc.stop(now + 0.61);
    }
  } catch (e) {
    console.warn('[WebAudio] Audio alert playback skipped:', e);
  }
}

// ==========================================
// 4. VIBRAÇÃO HÁPTICA SEGURA
// ==========================================
export function safeVibrate(pattern: number | number[] = 150): boolean {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator && typeof navigator.vibrate === 'function') {
    try {
      return navigator.vibrate(pattern);
    } catch (e) {
      return false;
    }
  }
  return false;
}

// ==========================================
// 5. TELA CHEIA COMPATÍVEL
// ==========================================
export function toggleFullscreen(element: HTMLElement = document.documentElement): Promise<void> {
  const doc = document as any;
  const isFullscreen = doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement;

  if (!isFullscreen) {
    const req = element.requestFullscreen || 
                (element as any).webkitRequestFullscreen || 
                (element as any).mozRequestFullScreen || 
                (element as any).msRequestFullscreen;
    if (req) {
      return req.call(element).catch(() => {});
    }
  } else {
    const exit = doc.exitFullscreen || 
                 doc.webkitExitFullscreen || 
                 doc.mozCancelFullScreen || 
                 doc.msExitFullscreen;
    if (exit) {
      return exit.call(doc).catch(() => {});
    }
  }
  return Promise.resolve();
}
