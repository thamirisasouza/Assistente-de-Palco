import * as pdfjsLib from 'pdfjs-dist';

// Configura o worker do pdfjs para uso em navegador
if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
}

export interface ExtractedPdfText {
  fullText: string;
  pages: string[];
}

/**
 * Lê o arquivo PDF enviado pelo usuário e extrai todo o conteúdo de texto
 */
export async function readPdfFile(file: File): Promise<ExtractedPdfText> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdfDoc = await loadingTask.promise;
  
  const pagesText: string[] = [];
  
  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    
    // Agrupa itens por linha com base na coordenada Y
    const items = textContent.items as Array<{ str: string; transform: number[] }>;
    
    // Ordenar itens por Y (decrescente, do topo para baixo) e depois X (da esquerda para direita)
    items.sort((a, b) => {
      const yDiff = b.transform[5] - a.transform[5];
      if (Math.abs(yDiff) > 5) {
        return yDiff;
      }
      return a.transform[4] - b.transform[4];
    });

    let lastY = -1;
    let pageLines: string[] = [];
    let currentLine = "";

    for (const item of items) {
      const y = Math.round(item.transform[5]);
      if (lastY === -1 || Math.abs(y - lastY) > 5) {
        if (currentLine.trim()) {
          pageLines.push(currentLine.trim());
        }
        currentLine = item.str;
        lastY = y;
      } else {
        currentLine += " " + item.str;
      }
    }
    if (currentLine.trim()) {
      pageLines.push(currentLine.trim());
    }

    pagesText.push(pageLines.join('\n'));
  }

  return {
    fullText: pagesText.join('\n\n--- NOVA PÁGINA ---\n\n'),
    pages: pagesText
  };
}
