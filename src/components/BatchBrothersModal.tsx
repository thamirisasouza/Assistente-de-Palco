import React, { useState, useMemo } from 'react';
import { Role, Brother } from '../types';
import { X, Users, Check, AlertCircle, FileText, Sparkles, UserPlus } from 'lucide-react';
import { cn } from '../lib/utils';

interface BatchBrothersModalProps {
  isOpen: boolean;
  onClose: () => void;
  existingBrothers: Brother[];
  onAddBrothers: (brothers: Array<{ name: string; role: Role }>) => void;
}

interface ParsedEntry {
  name: string;
  role: Role;
  isExisting: boolean;
}

export function BatchBrothersModal({
  isOpen,
  onClose,
  existingBrothers,
  onAddBrothers
}: BatchBrothersModalProps) {
  const [rawText, setRawText] = useState("");
  const [defaultRole, setDefaultRole] = useState<Role>("Publicador");
  const [mode, setMode] = useState<'append' | 'replace'>('append');

  // Mapeia publicadores já existentes em caixa baixa para checagem rápida
  const existingMap = useMemo(() => {
    return new Set(existingBrothers.map(b => b.name.trim().toLowerCase()));
  }, [existingBrothers]);

  // Parse inteligente do texto em tempo real
  const parsedList = useMemo(() => {
    if (!rawText.trim()) return [];

    const lines = rawText.split(/\r?\n/);
    const seenNames = new Set<string>();
    const result: ParsedEntry[] = [];

    for (const rawLine of lines) {
      let line = rawLine.trim();
      if (!line) continue;

      // 1. Remove marcadores comuns de lista no início: "1.", "01 -", "•", "-", "*"
      line = line.replace(/^(\d+[\.\-\)]\s*|[\•\-\*\>]\s*)/, '').trim();
      if (!line) continue;

      // 2. Detecta cargo se estiver explícito na linha
      let role: Role = defaultRole;
      const lower = line.toLowerCase();

      if (
        lower.includes('(ancião)') || 
        lower.includes('[ancião]') || 
        lower.includes('(anciao)') || 
        lower.includes('[anciao]') ||
        lower.includes('- ancião') ||
        lower.includes('- anciao') ||
        /\bancião\b/i.test(line) ||
        /\banciao\b/i.test(line) ||
        /\belder\b/i.test(line)
      ) {
        role = "Ancião";
      } else if (
        lower.includes('(servo ministerial)') || 
        lower.includes('[servo ministerial]') || 
        lower.includes('(servo)') || 
        lower.includes('[servo]') ||
        lower.includes('(sm)') ||
        lower.includes('[sm]') ||
        lower.includes('- servo') ||
        /\bservo ministerial\b/i.test(line)
      ) {
        role = "Servo Ministerial";
      } else if (
        lower.includes('(publicador)') || 
        lower.includes('[publicador]') ||
        /\bpublicador\b/i.test(line)
      ) {
        role = "Publicador";
      }

      // 3. Limpa o nome removendo os termos de cargo entre parênteses/colchetes/hífens
      let cleanName = line
        .replace(/\((ancião|anciao|servo ministerial|servo|sm|publicador|elder)\)/gi, '')
        .replace(/\[(ancião|anciao|servo ministerial|servo|sm|publicador|elder)\]/gi, '')
        .replace(/\-(ancião|anciao|servo ministerial|servo|sm|publicador|elder)/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

      // Se após a limpeza o nome ainda for válido
      if (cleanName.length >= 2) {
        const lowerKey = cleanName.toLowerCase();
        if (!seenNames.has(lowerKey)) {
          seenNames.add(lowerKey);
          result.push({
            name: cleanName,
            role,
            isExisting: existingMap.has(lowerKey)
          });
        }
      }
    }

    return result;
  }, [rawText, defaultRole, existingMap]);

  const newCount = parsedList.filter(p => !p.isExisting).length;
  const alreadyExistingCount = parsedList.filter(p => p.isExisting).length;

  const handleImport = () => {
    if (parsedList.length === 0) return;
    
    // Filtra para enviar os publicadores
    const toImport = parsedList
      .filter(p => !p.isExisting)
      .map(p => ({ name: p.name, role: p.role }));

    if (toImport.length > 0) {
      onAddBrothers(toImport);
    }
    
    setRawText("");
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-800 rounded-3xl p-5 sm:p-6 max-w-xl w-full shadow-2xl space-y-4 max-h-[90vh] flex flex-col">
        
        {/* Cabeçalho */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#295E9F]/10 text-[#295E9F] dark:text-[#4A6CA7] flex items-center justify-center">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                Lançar Publicadores em Formato Texto
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Cole uma lista com os nomes dos irmãos e servos
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Corpo com Textarea */}
        <div className="space-y-3 flex-1 overflow-y-auto pr-1">
          <div className="space-y-1.5">
            <div className="flex justify-between items-center text-xs">
              <label className="font-bold text-slate-700 dark:text-slate-300">
                Lista de Nomes (um por linha):
              </label>
              <span className="text-slate-400 font-mono">
                {parsedList.length} identificados
              </span>
            </div>
            <textarea
              rows={7}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={`Exemplo de lista para colar:\nAntonio Carlos (Ancião)\nLucas Silveira (Servo Ministerial)\nGabriel Souza\nMateus Ferreira (Ancião)\nPaulo Roberto`}
              className="w-full bg-slate-50 dark:bg-[#0F172A] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-white rounded-2xl p-3.5 text-xs sm:text-sm focus:border-[#295E9F] focus:ring-1 focus:ring-[#295E9F] transition-all font-mono leading-relaxed"
              autoFocus
            />
          </div>

          {/* Opções de Importação */}
          <div className="p-3 bg-slate-50 dark:bg-[#0F172A] rounded-2xl border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-600 dark:text-slate-300 block">
                Função padrão para nomes sem indicação:
              </label>
              <select
                value={defaultRole}
                onChange={(e) => setDefaultRole(e.target.value as Role)}
                className="bg-white dark:bg-[#1E293B] border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-xl px-3 py-1.5 text-xs focus:border-[#295E9F] focus:outline-none"
              >
                <option value="Publicador">Publicador</option>
                <option value="Servo Ministerial">Servo Ministerial</option>
                <option value="Ancião">Ancião</option>
              </select>
            </div>

            <div className="text-xs text-slate-500 dark:text-slate-400">
              <p>💡 <span className="font-semibold">Dica:</span> Escreva <code className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded text-[11px]">(Ancião)</code> ou <code className="bg-slate-200 dark:bg-slate-800 px-1 py-0.5 rounded text-[11px]">(Servo)</code> na linha para classificar automaticamente.</p>
            </div>
          </div>

          {/* Preview dos Nomes Identificados */}
          {parsedList.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-slate-700 dark:text-slate-300">
                  Prévia da Identificação ({parsedList.length}):
                </span>
                <div className="flex gap-2">
                  <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                    +{newCount} novos
                  </span>
                  {alreadyExistingCount > 0 && (
                    <span className="text-amber-500 font-medium">
                      ({alreadyExistingCount} já cadastrados)
                    </span>
                  )}
                </div>
              </div>

              <div className="max-h-36 overflow-y-auto space-y-1.5 p-2 bg-slate-50 dark:bg-[#0F172A] rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
                {parsedList.map((item, idx) => (
                  <div 
                    key={idx}
                    className={cn(
                      "flex items-center justify-between p-1.5 px-2.5 rounded-xl transition-colors",
                      item.isExisting ? "opacity-50 bg-slate-100 dark:bg-slate-800/40" : "bg-white dark:bg-[#1E293B] shadow-xs"
                    )}
                  >
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                      {item.name}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className={cn(
                        "text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full border",
                        item.role === 'Ancião' ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" :
                        item.role === 'Servo Ministerial' ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20" :
                        "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20"
                      )}>
                        {item.role}
                      </span>
                      {item.isExisting ? (
                        <span className="text-[10px] text-amber-500 font-semibold">(Existente)</span>
                      ) : (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Rodapé com Botões */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200 dark:border-slate-800 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs rounded-xl transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleImport}
            disabled={newCount === 0}
            className="min-h-[44px] px-6 bg-[#295E9F] hover:bg-[#3474C2] disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs rounded-xl shadow-md shadow-[#295E9F]/20 transition-all flex items-center gap-2 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            {newCount > 0 ? `Adicionar ${newCount} Publicador${newCount > 1 ? 'es' : ''}` : 'Nenhum Novo Publicador'}
          </button>
        </div>

      </div>
    </div>
  );
}
