import React from 'react';
import { Home, Users, Play, BarChart3, Menu, FileText, Settings } from 'lucide-react';
import { cn } from '../lib/utils';

export type NavTab = 'programacao' | 'publicadores' | 'graficos' | 'historico' | 'configuracoes';

interface BottomNavigationProps {
  activeTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  onStartMeeting: () => void;
  onOpenDrawer: () => void;
  archivedCount?: number;
}

export function BottomNavigation({
  activeTab,
  onTabChange,
  onStartMeeting,
  onOpenDrawer,
  archivedCount = 0
}: BottomNavigationProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#1E293B]/95 backdrop-blur-xl border-t border-slate-200/80 dark:border-slate-800 shadow-[0_-4px_20px_rgba(0,0,0,0.06)] px-3 py-2 pb-safe transition-all">
      <div className="max-w-lg mx-auto flex items-center justify-around relative">
        
        {/* Aba 1: Início / Programação */}
        <button
          onClick={() => onTabChange('programacao')}
          className={cn(
            "flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-2xl transition-all cursor-pointer min-w-[64px]",
            activeTab === 'programacao'
              ? "text-[#295E9F] dark:text-[#4A6CA7] font-bold"
              : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-medium"
          )}
        >
          <div className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center transition-all",
            activeTab === 'programacao' && "bg-[#295E9F]/10 dark:bg-[#295E9F]/20"
          )}>
            <Home className="w-5 h-5" />
          </div>
          <span className="text-[11px]">Início</span>
        </button>

        {/* Aba 2: Publicadores */}
        <button
          onClick={() => onTabChange('publicadores')}
          className={cn(
            "flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-2xl transition-all cursor-pointer min-w-[64px]",
            activeTab === 'publicadores'
              ? "text-[#295E9F] dark:text-[#4A6CA7] font-bold"
              : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-medium"
          )}
        >
          <div className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center transition-all",
            activeTab === 'publicadores' && "bg-[#295E9F]/10 dark:bg-[#295E9F]/20"
          )}>
            <Users className="w-5 h-5" />
          </div>
          <span className="text-[11px]">Irmãos</span>
        </button>

        {/* Botão Central Destacado: Iniciar Reunião (Estilo FAB flutuante circular) */}
        <div className="relative -top-5 flex flex-col items-center">
          <button
            onClick={onStartMeeting}
            className="w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center shadow-lg shadow-emerald-600/30 active:scale-95 transition-all cursor-pointer ring-4 ring-white dark:ring-[#1E293B]"
            title="Iniciar Reunião no Palco"
            aria-label="Iniciar Reunião"
          >
            <Play className="w-6 h-6 fill-current ml-0.5" />
          </button>
          <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            Iniciar
          </span>
        </div>

        {/* Aba 3: Gráficos */}
        <button
          onClick={() => onTabChange('graficos')}
          className={cn(
            "flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-2xl transition-all cursor-pointer min-w-[64px]",
            activeTab === 'graficos'
              ? "text-[#295E9F] dark:text-[#4A6CA7] font-bold"
              : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-medium"
          )}
        >
          <div className={cn(
            "w-9 h-9 rounded-xl flex items-center justify-center transition-all",
            activeTab === 'graficos' && "bg-[#295E9F]/10 dark:bg-[#295E9F]/20"
          )}>
            <BarChart3 className="w-5 h-5" />
          </div>
          <span className="text-[11px]">Gráficos</span>
        </button>

        {/* Aba 4: Menu Lateral (Drawer) */}
        <button
          onClick={onOpenDrawer}
          className="flex flex-col items-center justify-center gap-1 py-1 px-3 rounded-2xl text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 font-medium transition-all cursor-pointer min-w-[64px]"
        >
          <div className="w-9 h-9 rounded-xl flex items-center justify-center transition-all">
            <Menu className="w-5 h-5" />
          </div>
          <span className="text-[11px]">Menu</span>
        </button>

      </div>
    </nav>
  );
}
