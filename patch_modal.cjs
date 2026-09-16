const fs = require('fs');
const file = 'src/components/ImportApostilaModal.tsx';
let code = fs.readFileSync(file, 'utf8');

// 1. Remove Padrão Mensal
code = code.replace(/<span className="px-2 py-0\.5 rounded-full text-\[10px\] font-bold bg-emerald-500\/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500\/20 uppercase tracking-wider">\s*Padrão Mensal\s*<\/span>/, '');

// 2. Remove Privacy/Legal block (be careful with the regex)
const privacyBlock = /\{\/\* Legal & Privacy Compliance \*\/\}[\s\S]*?<\/div>/;
code = code.replace(privacyBlock, '');

// 3. Add interface LoadedPdf
code = code.replace(
  'const [pdfFileName, setPdfFileName] = useState<string | null>(null);',
  `const [loadedPdfs, setLoadedPdfs] = useState<{id: string, name: string, text: string}[]>([]);`
);

// 4. Update handleFileUpload
code = code.replace(
  /const handleFileUpload = async[\s\S]*?setIsProcessingPdf\(false\);\n    }\n  };/,
  `const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;
    
    const filesToProcess = files.slice(0, 10);
    setIsProcessingPdf(true);

    try {
      const newPdfs = [];
      for (const file of filesToProcess) {
        const extracted = await readPdfFile(file);
        newPdfs.push({
          id: Math.random().toString(36).substring(2, 9),
          name: file.name,
          text: extracted.fullText
        });
      }
      
      const allPdfs = [...loadedPdfs, ...newPdfs];
      setLoadedPdfs(allPdfs);
      
      const combinedText = allPdfs.map(p => p.text).join("\\n\\n--- NOVA PÁGINA ---\\n\\n");
      
      setInputText(combinedText);
      const parsed = parseMonthlyPdfText(combinedText);
      setParseResult(parsed);

      const matchingWeek = findMatchingWeekForDate(parsed.weeks, new Date());
      const matchingIndex = matchingWeek ? parsed.weeks.findIndex(w => w.id === matchingWeek.id) : 0;
      setSelectedWeekIndex(matchingIndex >= 0 ? matchingIndex : 0);
      setStep('review');
    } catch (err) {
      console.error("Erro ao ler PDF(s):", err);
      setActiveInputMode('paste');
      alert("Não foi possível extrair o texto diretamente dos arquivos PDF. Por favor, cole o texto na aba 'Colar Texto'.");
    } finally {
      setIsProcessingPdf(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeletePdf = (id: string) => {
    const updatedPdfs = loadedPdfs.filter(p => p.id !== id);
    setLoadedPdfs(updatedPdfs);
    
    if (updatedPdfs.length === 0) {
      setInputText("");
      setParseResult(null);
      setStep('input');
      return;
    }
    
    const combinedText = updatedPdfs.map(p => p.text).join("\\n\\n--- NOVA PÁGINA ---\\n\\n");
    setInputText(combinedText);
    const parsed = parseMonthlyPdfText(combinedText);
    setParseResult(parsed);
    
    const matchingWeek = findMatchingWeekForDate(parsed.weeks, new Date());
    const matchingIndex = matchingWeek ? parsed.weeks.findIndex(w => w.id === matchingWeek.id) : 0;
    setSelectedWeekIndex(matchingIndex >= 0 ? matchingIndex : 0);
  };`
);

// 5. Change "Carregar outro PDF" -> "Adicionar PDF"
code = code.replace('Carregar outro PDF', 'Adicionar PDF');

fs.writeFileSync(file, code);
