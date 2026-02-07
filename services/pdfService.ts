
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { BudgetItem, ClientInfo } from '../types';

/**
 * Converte URL em Base64 para o PDF de forma segura com tratamento de erros.
 */
const getBase64ImageFromURL = (url: string): Promise<string | null> => {
  return new Promise((resolve) => {
    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.setAttribute('crossOrigin', 'anonymous');
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const dataURL = canvas.toDataURL('image/png');
        resolve(dataURL);
      } catch (e) {
        console.error('Erro ao processar imagem para Base64:', e);
        resolve(null);
      }
    };
    img.onerror = () => {
      console.warn('Não foi possível carregar a imagem:', url);
      resolve(null);
    };
    img.src = url;
    
    // Timeout de 5 segundos para não travar a geração do PDF
    setTimeout(() => resolve(null), 5000);
  });
};

export const generatePDF = async (items: BudgetItem[], client: ClientInfo) => {
  // Garantir que trabalhamos com uma lista válida e imutável de itens
  const validItems = [...(items || [])].filter(item => item && typeof item === 'object');
  
  if (validItems.length === 0) {
    alert("Adicione itens ao orçamento antes de exportar.");
    return;
  }

  const doc = new jsPDF();
  const totalPrice = validItems.reduce((sum, item) => sum + (item.total || 0), 0);

  // 1. Pré-carregar imagens em cache usando o ID como chave
  const imageCache: Record<string | number, string | null> = {};
  await Promise.all(
    validItems.map(async (item) => {
      if (item && item.id && item.imagem) {
        imageCache[item.id] = await getBase64ImageFromURL(item.imagem);
      }
    })
  );

  // 2. Cabeçalho: Logo da Art Brasil
  try {
    const logoUrl = 'https://i.postimg.cc/dts7TZmg/ARTBRASIL.png';
    const base64Logo = await getBase64ImageFromURL(logoUrl);
    if (base64Logo) {
      doc.addImage(base64Logo, 'PNG', 15, 10, 35, 12);
    }
  } catch (e) {
    console.warn('Logo indisponível para o PDF');
  }

  // 3. Título do Documento
  doc.setFontSize(18);
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.text('ORÇAMENTO', 195, 20, { align: 'right' });
  
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.setFont('helvetica', 'normal');
  const dateStr = client.date ? new Date(client.date + 'T12:00:00').toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR');
  doc.text(`Emissão: ${dateStr}`, 195, 26, { align: 'right' });

  // 4. Divisor e Dados do Cliente
  doc.setDrawColor(241, 245, 249);
  doc.line(15, 35, 195, 35);
  
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text('DADOS DO CLIENTE:', 15, 43);
  
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.setFont('helvetica', 'bold');
  doc.text(client.name || 'Consumidor Final', 15, 49);
  
  if (client.phone) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Contato: ${client.phone}`, 15, 55);
  }

  // 5. Montagem da Tabela
  const tableRows = validItems.map(item => [
    '', // Espaço para a miniatura
    item.nome || 'Produto',
    `${item.cm || '0'} cm`,
    (item.quantity || 0).toString(),
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.valor || 0),
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.total || 0),
  ]);

  autoTable(doc, {
    startY: 65,
    head: [['FOTO', 'PRODUTO', 'TAM.', 'QTD', 'VALOR UN.', 'TOTAL']],
    body: tableRows,
    theme: 'striped',
    headStyles: { 
      fillColor: [79, 70, 229], 
      textColor: [255, 255, 255],
      fontSize: 9,
      fontStyle: 'bold',
      halign: 'center'
    },
    styles: {
      fontSize: 9,
      cellPadding: 4,
      valign: 'middle'
    },
    columnStyles: {
      0: { cellWidth: 22 },
      1: { cellWidth: 'auto' },
      2: { halign: 'center', cellWidth: 20 },
      3: { halign: 'center', cellWidth: 15 },
      4: { halign: 'right', cellWidth: 30 },
      5: { halign: 'right', cellWidth: 30 },
    },
    didParseCell: (data) => {
      if (data.section === 'body') {
        data.cell.styles.minCellHeight = 22; // Altura para as fotos
      }
    },
    didDrawCell: (data) => {
      // Verifica se é a coluna da foto no corpo da tabela
      if (data.section === 'body' && data.column.index === 0) {
        const rowIndex = data.row.index;
        const currentItem = validItems[rowIndex];
        
        // PROTEÇÃO: Verifica se o item existe antes de acessar propriedades
        if (currentItem && currentItem.id) {
          const base64 = imageCache[currentItem.id];
          if (base64) {
            const imgSize = 18;
            const xPos = data.cell.x + (data.cell.width - imgSize) / 2;
            const yPos = data.cell.y + (data.cell.height - imgSize) / 2;
            doc.addImage(base64, 'PNG', xPos, yPos, imgSize, imgSize);
          }
        }
      }
    },
    margin: { left: 15, right: 15 }
  });

  // 6. Rodapé Dinâmico (Total e Validade)
  // @ts-ignore
  const finalY = doc.lastAutoTable ? doc.lastAutoTable.finalY : 150;
  const pageHeight = doc.internal.pageSize.getHeight();
  let footerY = finalY + 10;

  // Verifica se há espaço para o rodapé na página atual
  if (footerY + 40 > pageHeight) {
    doc.addPage();
    footerY = 20;
  }

  // Caixa de Resumo Financeiro
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(130, footerY, 65, 15, 2, 2, 'F');
  
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(71, 85, 105);
  doc.text('VALOR TOTAL:', 135, footerY + 9);
  
  doc.setFontSize(14);
  doc.setTextColor(79, 70, 229);
  const totalFormatted = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPrice);
  doc.text(totalFormatted, 190, footerY + 9, { align: 'right' });

  // Notas de Rodapé
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.setFont('helvetica', 'italic');
  doc.text('Art Brasil Imagens - Devoção em cada detalhe.', 105, footerY + 30, { align: 'center' });
  doc.text('Preços sujeitos a alteração sem aviso prévio. Orçamento válido por 15 dias.', 105, footerY + 34, { align: 'center' });

  // 7. Download do PDF
  const cleanClientName = (client.name || 'Cliente').replace(/[^a-z0-9]/gi, '_').substring(0, 30);
  doc.save(`Orcamento_${cleanClientName}.pdf`);
};
