const fs = require('fs');
const file = 'src/components/ImportApostilaModal.tsx';
let code = fs.readFileSync(file, 'utf8');

const loadedPdfsList = `
                {loadedPdfs.length > 0 && (
                  <div className="space-y-1.5 mt-3">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      <FileText className="w-3.5 h-3.5" />
                      PDFs Carregados:
                    </label>
                    <div className="flex flex-col gap-2">
                      {loadedPdfs.map(pdf => (
                        <div key={pdf.id} className="flex items-center justify-between p-2 rounded-xl bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-slate-700">
                          <span className="text-xs text-slate-700 dark:text-slate-300 font-semibold truncate flex-1 mr-2">{pdf.name}</span>
                          <button
                            type="button"
                            onClick={() => handleDeletePdf(pdf.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            title="Excluir PDF"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
`;

code = code.replace(
  '{/* Seletor de Semanas do Mês */}',
  loadedPdfsList + '\n                {/* Seletor de Semanas do Mês */}'
);

fs.writeFileSync(file, code);
