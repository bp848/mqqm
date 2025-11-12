import { User } from './types.ts';
import { safeJsonParse } from './services/safeJsonParse.ts';

declare const jspdf: any;
declare const html2canvas: any;

const getImportMetaEnv = (): Record<string, string | undefined> | undefined => {
  try {
    // `import.meta` may be undefined in some runtimes (e.g. Node during testing)
    return (typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined) as
      | Record<string, string | undefined>
      | undefined;
  } catch (error) {
    console.warn('Failed to access import.meta.env:', error);
    return undefined;
  }
};

export const getEnvValue = (key: string): string | undefined => {
  if (typeof process !== 'undefined' && process.env && process.env[key] !== undefined) {
    return process.env[key];
  }

  const metaEnv = getImportMetaEnv();
  if (metaEnv) {
    if (metaEnv[key] !== undefined) {
      return metaEnv[key];
    }

    const viteKey = `VITE_${key}`;
    if (metaEnv[viteKey] !== undefined) {
      return metaEnv[viteKey];
    }
  }

  return undefined;
};


export const formatJPY = (amount: number | null | undefined): string => {
  if (amount === null || amount === undefined) return '-';
  return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY' }).format(Math.round(amount));
};

export const formatDate = (dateString: string | Date | null | undefined): string => {
  if (!dateString) return '-';
  try {
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch (e) {
    return String(dateString);
  }
};

export const formatDateTime = (dateString: string | Date | null | undefined): string => {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    //toLocaleString can produce slightly different formats, so we build it manually
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}/${month}/${day} ${hours}:${minutes}:${seconds}`;
  } catch (e) {
    return String(dateString);
  }
};

// FIX: Add interface for signature settings to fix type errors
interface SignatureSettings {
  companyName?: string;
  department?: string;
  yourName?: string;
  phone?: string;
  email?: string;
  website?: string;
}

export const createSignature = (): string => {
    try {
        const settingsStr = localStorage.getItem('signatureSettings');
        const settings: SignatureSettings | null = settingsStr ? safeJsonParse(settingsStr) : null;
        
        const companyName = settings?.companyName || '文唱堂印刷株式会社';
        const address = '〒101-0025 東京都千代田区神田佐久間町3-37';
        const phone = settings?.phone || 'TEL：03-3851-0111　FAX：03-3861-1979';
        const department = settings?.department || 'システム管理・開発';
        const name = settings?.yourName || '石嶋 洋平';
        const email = settings?.email || 'sales.system@mqprint.co.jp';
        const website = settings?.website;

        let signature = `\n\n---------------------------------------
${companyName}
${address}
${phone}
${department}
${name}
E-mail：${email}`;
        
        if (website) {
            signature += `\n${website}`;
        }

        signature += `
---------------------------------------`;
        
        return signature;

    } catch (error) {
        console.error("Failed to create signature:", error);
        // Fallback to a hardcoded default in case of any error
        return `\n\n---------------------------------------
文唱堂印刷株式会社
〒101-0025 東京都千代田区神田佐久間町3-37
TEL：03-3851-0111　FAX：03-3861-1979
システム管理・開発
石嶋 洋平
E-mail：sales.system@mqprint.co.jp
---------------------------------------`;
    }
};

export const generateMultipagePdf = async (elementId: string, fileName: string): Promise<void> => {
    const input = document.getElementById(elementId);
    if (!input) {
      throw new Error(`Element with id '${elementId}' not found.`);
    }

    const canvas = await html2canvas(input, {
        scale: 2,
        useCORS: true,
        logging: true,
        width: input.scrollWidth,
        height: input.scrollHeight,
        windowWidth: input.scrollWidth,
        windowHeight: input.scrollHeight,
    });

    const pdf = new jspdf.jsPDF({
        orientation: 'p',
        unit: 'px',
        format: 'a4',
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    
    const ratio = canvasWidth / pdfWidth;
    const canvasRenderedHeight = canvasHeight / ratio;

    let position = 0;
    let pageCount = 1;
    const totalPages = Math.ceil(canvasRenderedHeight / pdfHeight);

    while (position < canvasRenderedHeight) {
        if (pageCount > 1) {
            pdf.addPage();
        }
        
        pdf.addImage(canvas, 'PNG', 0, -position, pdfWidth, canvasRenderedHeight);

        pdf.setFontSize(8);
        pdf.setTextColor(150);
        pdf.text(
            `Page ${pageCount} of ${totalPages}`,
            pdfWidth / 2,
            pdfHeight - 10,
            { align: 'center' }
        );

        position += pdfHeight;
        pageCount++;
    }

    pdf.save(fileName);
};

export const renderPostalLabelSvg = (toName: string, toCompany?: string) => {
  return `<svg width="80mm" height="50mm" viewBox="0 0 800 500" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="800" height="500" fill="white" stroke="black" stroke-width="2"/>
  <text x="50" y="100" font-family="Noto Sans JP" font-size="36" font-weight="bold">${toName} 様</text>
  ${toCompany ? `<text x="50" y="150" font-family="Noto Sans JP" font-size="24">${toCompany} 御中</text>` : ''}
  <text x="50" y="250" font-family="Noto Sans JP" font-size="20">〒101-0025</text>
  <text x="50" y="290" font-family="Noto Sans JP" font-size="20">東京都千代田区神田佐久間町3-37</text>
  <text x="450" y="400" font-family="Noto Sans JP" font-size="18">文唱堂印刷株式会社</text>
  <text x="450" y="430" font-family="Noto Sans JP" font-size="16">〒101-0025 東京都千代田区神田佐久間町3-37</text>
</svg>`;
};