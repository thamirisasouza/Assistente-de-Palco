import React from 'react';
import { Menu, Sparkles, Building2 } from 'lucide-react';
import { cn } from '../lib/utils';

interface TopHeaderProps {
  userName?: string;
  userEmail?: string;
  congregationName?: string;
  onOpenMenu: () => void;
}

export function TopHeader({ userName, userEmail, congregationName = 'Jd. Rosana - Ferraz de Vasconcelos, SP', onOpenMenu }: TopHeaderProps) {
  // Extrai primeiro nome amigável
  const displayName = userName || (userEmail ? userEmail.split('@')[0] : 'Irmão(ã)');
  const capitalizedName = displayName.charAt(0).toUpperCase() + displayName.slice(1);

  return (
    <header className="w-full flex items-center justify-between py-4 px-4 sm:px-6 bg-white/80 dark:bg-[#0F172A]/80 backdrop-blur-md sticky top-0 z-30 border-b border-slate-100 dark:border-slate-800/80 transition-colors">
      <div className="flex flex-col">
        <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-1.5">
          Olá, {capitalizedName}
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
          seja bem-vindo ao <strong className="text-[#295E9F] dark:text-[#4A6CA7] font-bold">Assistente de Palco</strong>
        </p>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={onOpenMenu}
          className="w-11 h-11 rounded-2xl bg-slate-100 hover:bg-slate-200/80 dark:bg-[#1E293B] dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-95"
          title="Abrir Menu Lateral"
          aria-label="Abrir Menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
}
