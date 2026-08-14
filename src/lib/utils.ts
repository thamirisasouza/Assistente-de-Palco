import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatTime(seconds: number): string {
  const isNegative = seconds < 0;
  const absSeconds = Math.abs(seconds);
  const m = Math.floor(absSeconds / 60);
  const s = Math.floor(absSeconds % 60);
  const sign = isNegative ? '-' : '';
  return `${sign}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function formatTimeHours(seconds: number): string {
  const isNegative = seconds < 0;
  const absSeconds = Math.abs(seconds);
  const h = Math.floor(absSeconds / 3600);
  const m = Math.floor((absSeconds % 3600) / 60);
  const s = Math.floor(absSeconds % 60);
  const sign = isNegative ? '-' : '';
  if (h > 0) {
    return `${sign}${h}h ${m.toString().padStart(2, '0')}m`;
  }
  return `${sign}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function formatBalanceDisplay(seconds: number): string {
  const isNegative = seconds < 0;
  const absSeconds = Math.abs(seconds);
  const m = Math.floor(absSeconds / 60);
  const s = Math.floor(absSeconds % 60);
  const sign = isNegative ? '-' : seconds > 0 ? '+' : '';
  return `${sign}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function addMinutesToTime(timeString: string, minsToAdd: number): string {
  try {
    const [hStr, mStr] = timeString.split(':');
    let h = parseInt(hStr, 10);
    let m = parseInt(mStr, 10);
    
    if (isNaN(h) || isNaN(m)) return timeString;
    
    m += minsToAdd;
    h += Math.floor(m / 60);
    m = m % 60;
    h = h % 24;
    
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  } catch (e) {
    return timeString;
  }
}

/**
 * Convenção de cores padronizada (PRD v1.3):
 * - Âmbar / Laranja = Atrasado (tempo positivo gasto além do previsto)
 * - Azul / Sky = Adiantado (tempo negativo, reunião terminando antes)
 * - Verde / Slate = No tempo exato (dentro de margem segura de 15s)
 */
export function getBalanceColorClass(balanceSeconds: number): {
  text: string;
  bg: string;
  border: string;
  badge: string;
} {
  if (balanceSeconds > 15) {
    // Atrasado -> Âmbar padronizado
    return {
      text: "text-amber-500 dark:text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/30",
      badge: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
    };
  } else if (balanceSeconds < -15) {
    // Adiantado -> Azul padronizado
    return {
      text: "text-sky-600 dark:text-sky-400",
      bg: "bg-sky-500/10",
      border: "border-sky-500/30",
      badge: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-500/30"
    };
  } else {
    // No tempo
    return {
      text: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/30",
      badge: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
    };
  }
}
