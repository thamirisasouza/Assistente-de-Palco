import React from 'react';
import { 
  X, MapPin, Settings, FileText, Users, BarChart3, 
  Sparkles, Sun, Moon, LogOut, ChevronRight, CheckCircle2,
  ShieldCheck, Info
} from 'lucide-react';
import { cn } from '../lib/utils';
import { NavTab } from './BottomNavigation';

interface DrawerMenuProps {
  isOpen: boolean;
  onClose: () => void;
  userEmail: string;
  userName?: string;
  congregationName: string;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onNavigate: (tab: NavTab) => void;
  onOpenImportPdf: () => void;
  onLogout: () => void;
  archivedCount: number;
}

export function DrawerMenu({
  isOpen,
  onClose,
  userEmail,
  userName,
  congregationName,
  theme,
  onToggleTheme,
  onNavigate,
  onOpenImportPdf,
  onLogout,
  archivedCount
}: DrawerMenuProps) {
  if (!isOpen) return null;

  const displayName = userName || (userEmail ? userEmail.split('@')[0] : 'Usuário');
  const capitalizedName = displayName.charAt(0).toUpperCase() + displayName.slice(1);
  const initials = displayName.slice(0, 2).toUpperCase();

  const handleItemClick = (tab?: NavTab) => {
    if (tab) {
      onNavigate(tab);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end md:items-stretch">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-300"
      />

      {/* Drawer Panel (Mobile Bottom-Sheet on small screens / Right Drawer on tablets & desktop) */}
      <div className="relative z-10 w-full sm:max-w-md bg-white dark:bg-[#1E293B] shadow-2xl flex flex-col max-h-[92vh] sm:max-h-full sm:h-full rounded-t-[32px] sm:rounded-t-none sm:rounded-l-[32px] overflow-hidden mt-auto sm:mt-0 animate-in slide-in-from-bottom-6 sm:slide-in-from-right duration-300">
        
        {/* Mobile Pull Handle Bar */}
        <div className="pt-3 pb-1 flex justify-center sm:hidden">
          <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full" />
        </div>

        {/* Close Button Top Right */}
        <div className="absolute top-4 right-4 z-20">
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white flex items-center justify-center transition-all cursor-pointer"
            aria-label="Fechar Menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Profile Header (Matching Screenshot 2) */}
        <div className="p-6 sm:pt-8 flex flex-col items-center text-center border-b border-slate-100 dark:border-slate-800">
          <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-[#295E9F] to-[#4A6CA7] p-1 shadow-md mb-3 flex items-center justify-center">
            <div className="w-full h-full rounded-full bg-white dark:bg-[#0F172A] flex items-center justify-center text-xl font-black text-[#295E9F] dark:text-[#4A6CA7]">
              {initials}
            </div>
          </div>
          
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            {capitalizedName}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5">
            {userEmail}
          </p>
        </div>

        {/* Menu Options List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
          
          {/* Localização / Congregação */}
          <div className="flex items-center justify-between p-3.5 rounded-2xl bg-slate-50 dark:bg-[#0F172A]/50 border border-slate-100 dark:border-slate-800 mb-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="text-left">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">Localização</span>
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200 line-clamp-1">{congregationName}</span>
              </div>
            </div>
          </div>

          {/* Configurações da Reunião */}
          <button
            onClick={() => handleItemClick('configuracoes')}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200 transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 group-hover:bg-[#295E9F]/10 group-hover:text-[#295E9F] flex items-center justify-center transition-colors">
                <Settings className="w-4 h-4" />
              </div>
              <span className="text-sm font-semibold">Configurações da Reunião</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>

          {/* Histórico de Reuniões */}
          <button
            onClick={() => handleItemClick('historico')}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200 transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 group-hover:bg-[#295E9F]/10 group-hover:text-[#295E9F] flex items-center justify-center transition-colors">
                <FileText className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">Histórico & Arquivo</span>
                {archivedCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {archivedCount}
                  </span>
                )}
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>

          {/* Publicadores & Irmãos */}
          <button
            onClick={() => handleItemClick('publicadores')}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200 transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 group-hover:bg-[#295E9F]/10 group-hover:text-[#295E9F] flex items-center justify-center transition-colors">
                <Users className="w-4 h-4" />
              </div>
              <span className="text-sm font-semibold">Publicadores & Designações</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>

          {/* Gráficos & Estatísticas */}
          <button
            onClick={() => handleItemClick('graficos')}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200 transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 group-hover:bg-[#295E9F]/10 group-hover:text-[#295E9F] flex items-center justify-center transition-colors">
                <BarChart3 className="w-4 h-4" />
              </div>
              <span className="text-sm font-semibold">Gráficos & Estatísticas</span>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400" />
          </button>

          {/* Importar PDF da Programação */}
          <button
            onClick={() => {
              onClose();
              onOpenImportPdf();
            }}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl hover:bg-blue-50/60 dark:hover:bg-blue-950/30 text-[#295E9F] dark:text-[#4A6CA7] transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#295E9F]/10 text-[#295E9F] dark:text-[#4A6CA7] flex items-center justify-center transition-colors">
                <Sparkles className="w-4 h-4" />
              </div>
              <span className="text-sm font-bold">Importar PDF da Programação</span>
            </div>
            <ChevronRight className="w-4 h-4 text-[#295E9F]" />
          </button>

          <div className="my-2 border-t border-slate-100 dark:border-slate-800" />

          {/* Alternar Tema */}
          <button
            onClick={onToggleTheme}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200 transition-all cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
              </div>
              <span className="text-sm font-semibold">Tema: {theme === 'dark' ? 'Escuro' : 'Claro'}</span>
            </div>
            <span className="text-xs font-bold text-slate-400">Alternar</span>
          </button>

          {/* Sair da Conta */}
          <button
            onClick={() => {
              onClose();
              onLogout();
            }}
            className="w-full flex items-center justify-between p-3.5 rounded-2xl hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 transition-all cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center">
                <LogOut className="w-4 h-4" />
              </div>
              <span className="text-sm font-semibold">Sair da Conta</span>
            </div>
          </button>

        </div>

        {/* Versão Footer (Matching Screenshot 2) */}
        <div className="p-4 text-center border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-400 font-medium">
          v1.0.18 • Assistente de Palco
        </div>

      </div>
    </div>
  );
}
