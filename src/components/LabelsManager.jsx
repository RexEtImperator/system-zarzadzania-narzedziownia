import { useState, useEffect, useMemo, useRef } from 'react';
import { useTheme } from '../contexts/ThemeContext';
import { MoonIcon, SunIcon } from '@heroicons/react/24/outline';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import api from '../api';
import { PERMISSIONS, hasPermission } from '../constants';

// Prosta walidacja URL (HTTP/HTTPS)
function isValidHttpUrl(str) {
  if (!str || typeof str !== 'string') return false;
  try {
    const u = new URL(str);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

// Komponent zarządzania etykietami
function LabelsManager({ tools = [], user }) {
  const { isDarkMode, toggleTheme } = useTheme();
  const [selectedTools, setSelectedTools] = useState([]);
  const [toolsData, setToolsData] = useState(Array.isArray(tools) ? tools : []);
  const [toolsCodePrefix, setToolsCodePrefix] = useState('');
  const [toolCategoryPrefixes, setToolCategoryPrefixes] = useState({});
  const [expandedIds, setExpandedIds] = useState([]);
  const [previews, setPreviews] = useState({}); // { [id]: { qr: string|null, barcode: string|null } }
  const [selectedSizes, setSelectedSizes] = useState({}); // { [id]: '70x40' | '51x32' | '110x60' }
  const [currentTab, setCurrentTab] = useState('generator'); // 'generator' | 'editor' | 'editor_separate'

  // Konfiguracja szablonu etykiety (zapisywana w localStorage)
  const DEFAULT_TEMPLATE = {
    version: 1,
    language: 'pl',
    logoUrl: '',
    sizeKey: '70x40',
    options: {
      barcodeShowValue: false,
      barcodeValueFontRatio: 0.12,
      logoVisible: true
    },
    layout: {
      title: { x: 0.5, y: 0.13, fontSize: 26, align: 'center' },
      subtitle: { x: 0.5, y: 0.23, fontSize: 18, align: 'center' },
      qr: { x: 0.125, y: 0.33, w: 0.4, h: 0.53 },
      barcode: { x: 0.55, y: 0.33, w: 0.42, h: 0.36 },
      info: { x: 0.5, y: 0.93, fontSize: 14, align: 'center' },
      logo: { x: 0.06, y: 0.08, w: 0.1, h: 0.12 }
    },
    translations: {
      pl: { sku: 'SKU', scanInfo: 'Zeskanuj kod aby sprawdzić status' },
      en: { sku: 'SKU', scanInfo: 'Scan the code to check status' }
    }
  };
  const [templateConfig, setTemplateConfig] = useState(() => {
    try {
      const raw = localStorage.getItem('labelTemplateConfig');
      if (raw) {
        const loaded = JSON.parse(raw);
        return {
          ...DEFAULT_TEMPLATE,
          ...loaded,
          options: { ...DEFAULT_TEMPLATE.options, ...(loaded.options || {}) },
          layout: { ...DEFAULT_TEMPLATE.layout, ...(loaded.layout || {}) },
          sizeKey: loaded.sizeKey || DEFAULT_TEMPLATE.sizeKey,
          dpi: loaded.dpi || DEFAULT_TEMPLATE.dpi
        };
      }
    } catch {}
    return DEFAULT_TEMPLATE;
  });

  // Osobne konfiguracje dla etykiety QR i etykiety kodu kreskowego
  const DEFAULT_QR_TEMPLATE = {
    version: 1,
    language: 'pl',
    logoUrl: '',
    sizeKey: '70x40',
    options: {
      logoVisible: true
    },
    layout: {
      title: { x: 0.5, y: 0.13, fontSize: 26, align: 'center' },
      subtitle: { x: 0.5, y: 0.23, fontSize: 18, align: 'center' },
      qr: { x: 0.125, y: 0.33, w: 0.4, h: 0.53 },
      info: { x: 0.5, y: 0.93, fontSize: 14, align: 'center' },
      logo: { x: 0.06, y: 0.08, w: 0.1, h: 0.12 }
    },
    translations: {
      pl: { sku: 'SKU', scanInfo: 'Zeskanuj kod aby sprawdzić status' },
      en: { sku: 'SKU', scanInfo: 'Scan the code to check status' }
    }
  };
  const DEFAULT_BARCODE_TEMPLATE = {
    version: 1,
    language: 'pl',
    logoUrl: '',
    sizeKey: '70x40',
    options: {
      barcodeShowValue: true,
      barcodeValueFontRatio: 0.12,
      logoVisible: true
    },
    layout: {
      title: { x: 0.5, y: 0.13, fontSize: 26, align: 'center' },
      subtitle: { x: 0.5, y: 0.23, fontSize: 18, align: 'center' },
      barcode: { x: 0.55, y: 0.33, w: 0.42, h: 0.36 },
      info: { x: 0.5, y: 0.93, fontSize: 14, align: 'center' },
      logo: { x: 0.06, y: 0.08, w: 0.1, h: 0.12 }
    },
    translations: {
      pl: { sku: 'SKU', scanInfo: 'Zeskanuj kod aby sprawdzić status' },
      en: { sku: 'SKU', scanInfo: 'Scan the code to check status' }
    }
  };
  const [qrTemplateConfig, setQrTemplateConfig] = useState(() => {
    try {
      const raw = localStorage.getItem('qrLabelTemplateConfig');
      if (raw) {
        const loaded = JSON.parse(raw);
        return {
          ...DEFAULT_QR_TEMPLATE,
          ...loaded,
          options: { ...DEFAULT_QR_TEMPLATE.options, ...(loaded.options || {}) },
          layout: { ...DEFAULT_QR_TEMPLATE.layout, ...(loaded.layout || {}) },
          sizeKey: loaded.sizeKey || DEFAULT_QR_TEMPLATE.sizeKey,
          dpi: loaded.dpi || DEFAULT_QR_TEMPLATE.dpi
        };
      }
    } catch {}
    return DEFAULT_QR_TEMPLATE;
  });
  const [barcodeTemplateConfig, setBarcodeTemplateConfig] = useState(() => {
    try {
      const raw = localStorage.getItem('barcodeLabelTemplateConfig');
      if (raw) {
        const loaded = JSON.parse(raw);
        return {
          ...DEFAULT_BARCODE_TEMPLATE,
          ...loaded,
          options: { ...DEFAULT_BARCODE_TEMPLATE.options, ...(loaded.options || {}) },
          layout: { ...DEFAULT_BARCODE_TEMPLATE.layout, ...(loaded.layout || {}) },
          sizeKey: loaded.sizeKey || DEFAULT_BARCODE_TEMPLATE.sizeKey,
          dpi: loaded.dpi || DEFAULT_BARCODE_TEMPLATE.dpi
        };
      }
    } catch {}
    return DEFAULT_BARCODE_TEMPLATE;
  });
  // Konfiguracje drukowania dla osobnych szablonów
  const [qrPrintConfig, setQrPrintConfig] = useState({ protocol: 'ipp', url: '', copies: 1 });
  const [barcodePrintConfig, setBarcodePrintConfig] = useState({ protocol: 'ipp', url: '', copies: 1 });

  // Zapis w czasie rzeczywistym i emitowanie zdarzenia aktualizacji
  useEffect(() => {
    try {
      localStorage.setItem('labelTemplateConfig', JSON.stringify(templateConfig));
      window.dispatchEvent(new CustomEvent('labelTemplateConfigUpdated', { detail: templateConfig }));
    } catch (e) {
      console.warn('Nie udało się zapisać konfiguracji szablonu etykiety:', e);
    }
  }, [templateConfig]);

  // Zapis osobnych konfiguracji
  useEffect(() => {
    try {
      localStorage.setItem('qrLabelTemplateConfig', JSON.stringify(qrTemplateConfig));
    } catch (e) {
      console.warn('Nie udało się zapisać konfiguracji szablonu QR:', e);
    }
  }, [qrTemplateConfig]);
  useEffect(() => {
    try {
      localStorage.setItem('barcodeLabelTemplateConfig', JSON.stringify(barcodeTemplateConfig));
    } catch (e) {
      console.warn('Nie udało się zapisać konfiguracji szablonu kodu kreskowego:', e);
    }
  }, [barcodeTemplateConfig]);

  // Konwersja mm -> px (300 DPI)
  const mmToPx = (mm) => Math.round((mm * 300) / 25.4);
  const LABEL_SIZES = {
    '51x32': { w: mmToPx(51), h: mmToPx(32), label: '51x32 mm' },
    '70x40': { w: mmToPx(70), h: mmToPx(40), label: '70x40 mm' },
    '110x60': { w: mmToPx(110), h: mmToPx(60), label: '110x60 mm' },
  };

  useEffect(() => {
    const loadConfig = async () => {
      try {
        const cfg = await api.get('/api/config/general');
        setToolsCodePrefix(cfg?.toolsCodePrefix || '');
        setToolCategoryPrefixes(cfg?.toolCategoryPrefixes || {});
      } catch (err) {
        console.error('Błąd ładowania konfiguracji etykiet:', err);
      }
    };
    loadConfig();
  }, []);

  // Synchronizuj stan z przekazanymi propsami lub pobierz narzędzia z API gdy brak
  // Uwaga: zależność oparta o długość tablicy, aby uniknąć pętli (domyślne [] zmienia referencję przy każdym renderze)
  useEffect(() => {
    // Bramka uprawnień: bez VIEW_LABELS nie pobieraj danych
    if (!hasPermission(user, PERMISSIONS.VIEW_LABELS)) {
      setToolsData([]);
      return;
    }
    if (Array.isArray(tools) && tools.length > 0) {
      setToolsData(tools);
      return;
    }
    const fetchTools = async () => {
      try {
        const resp = await api.get('/api/tools');
        const list = Array.isArray(resp) ? resp : (resp?.data || []);
        setToolsData(list);
      } catch (err) {
        console.error('Błąd pobierania narzędzi dla etykiet:', err);
        setToolsData([]);
      }
    };
    fetchTools();
  }, [tools?.length]);

  // Narzędzie używane do generowania wartości w podglądzie (QR/BARCODE)
  const [selectedPreviewToolId, setSelectedPreviewToolId] = useState(null);
  const previewTool = useMemo(() => {
    if (!toolsData || toolsData.length === 0) return null;
    const found = toolsData.find(t => t.id === selectedPreviewToolId);
    return found || toolsData[0];
  }, [toolsData, selectedPreviewToolId]);
  const previewValue = useMemo(() => {
    if (!previewTool) return 'DEMO-001';
    return previewTool.sku || previewTool.code || `TOOL-${previewTool.id}`;
  }, [previewTool]);

  const computeToolCodeText = (tool) => {
    const cat = tool?.category || '';
    const byCat = (toolCategoryPrefixes || {})[cat];
    const prefix = byCat || toolsCodePrefix || '';
    return tool.qr_code || tool.barcode || (prefix ? `${prefix}-${tool.sku}` : tool.sku);
  };

  // Funkcja zaznaczania/odznaczania wszystkich narzędzi
  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedTools(toolsData.map(tool => tool.id));
    } else {
      setSelectedTools([]);
    }
  };

  // Sprawdź czy wszystkie narzędzia są zaznaczone
  const isAllSelected = toolsData.length > 0 && selectedTools.length === toolsData.length;
  const isIndeterminate = selectedTools.length > 0 && selectedTools.length < toolsData.length;

  // Generate QR Code
  const generateQRCode = async (text, size = 200) => {
    try {
      const url = await QRCode.toDataURL(text, {
        width: size,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'M'
      });
      return url;
    } catch (error) {
      console.error('Error generating QR code:', error);
      return null;
    }
  };

  // Generate Barcode
  const generateBarcode = (text) => {
    try {
      const canvas = document.createElement('canvas');
      JsBarcode(canvas, text, {
        format: 'CODE128',
        width: 3,
        height: 120,
        fontSize: 16,
        margin: 10,
        font: 'Arial',
        fontOptions: 'bold'
      });
      return canvas.toDataURL('image/png', 1.0);
    } catch (error) {
      console.error('Error generating barcode:', error);
      return null;
    }
  };

  // Upewnij się, że podglądy dla danego narzędzia są wygenerowane (tylko po rozwinięciu)
  const ensurePreviews = async (tool) => {
    const id = tool.id;
    if (previews[id] && previews[id].qr && previews[id].barcode) return;
    const codeText = computeToolCodeText(tool);
    try {
      const qrUrl = await generateQRCode(codeText, 200);
      const barcodeUrl = generateBarcode(codeText);
      setPreviews(prev => ({ ...prev, [id]: { qr: qrUrl, barcode: barcodeUrl } }));
    } catch (e) {
      console.error('Błąd generowania podglądu:', e);
    }
  };

  const toggleExpand = async (tool) => {
    setExpandedIds(prev => {
      const isOpen = prev.includes(tool.id);
      const next = isOpen ? prev.filter(x => x !== tool.id) : [...prev, tool.id];
      return next;
    });
    // Ustaw domyślny rozmiar i wygeneruj podgląd
    setSelectedSizes(prev => ({ ...prev, [tool.id]: prev[tool.id] || '70x40' }));
    await ensurePreviews(tool);
  };

  // Pobieranie etykiety QR w wybranym rozmiarze
  const downloadQrLabelSized = async (tool, sizeKey) => {
    try {
      const { w, h } = LABEL_SIZES[sizeKey] || LABEL_SIZES['70x40'];
      const [mmW, mmH] = (sizeKey || '70x40').split('x').map(n => Number(n));
      const PREVIEW_PX_PER_MM = 8;
      const previewW = Math.floor(mmW * PREVIEW_PX_PER_MM);
      const scale = w / previewW; // skala względem podglądu
      const codeText = computeToolCodeText(tool);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = w;
      canvas.height = h;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      // tło
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      const t = qrTemplateConfig;
      // Tytuł wg layoutu
      ctx.fillStyle = '#000000';
      ctx.textAlign = t?.layout?.title?.align || 'center';
      ctx.font = `bold ${Math.floor((t?.layout?.title?.fontSize || 26) * scale)}px Arial`;
      const tx = Math.floor((t?.layout?.title?.x ?? 0.5) * w);
      const ty = Math.floor((t?.layout?.title?.y ?? 0.13) * h);
      ctx.fillText(tool.name, tx, ty);
      // Podtytuł (SKU)
      ctx.textAlign = t?.layout?.subtitle?.align || 'center';
      ctx.font = `${Math.floor((t?.layout?.subtitle?.fontSize || 18) * scale)}px Arial`;
      const skuLabel = t?.translations?.[t?.language || 'pl']?.sku || 'SKU';
      const sx = Math.floor((t?.layout?.subtitle?.x ?? 0.5) * w);
      const sy = Math.floor((t?.layout?.subtitle?.y ?? 0.23) * h);
      ctx.fillText(`${skuLabel}: ${tool.sku}`, sx, sy);
      // QR wg layoutu
      const qrL = t?.layout?.qr || { x: 0.125, y: 0.33, w: 0.4, h: 0.53 };
      const qrBoxW = Math.floor(qrL.w * w);
      const qrBoxH = Math.floor(qrL.h * h);
      const qrSize = Math.min(qrBoxW, qrBoxH);
      const qrUrl = await generateQRCode(codeText, qrSize);
      if (qrUrl) {
        const img = new Image();
        img.onload = () => {
          const qrX = Math.floor(qrL.x * w + (qrBoxW - qrSize) / 2);
          const qrY = Math.floor(qrL.y * h + (qrBoxH - qrSize) / 2);
          ctx.drawImage(img, qrX, qrY, qrSize, qrSize);
          // Info wg layoutu
          ctx.textAlign = t?.layout?.info?.align || 'center';
          ctx.font = `${Math.floor((t?.layout?.info?.fontSize || 14) * scale)}px Arial`;
          const scanInfo = t?.translations?.[t?.language || 'pl']?.scanInfo || 'Zeskanuj kod aby sprawdzić status';
          const ix = Math.floor((t?.layout?.info?.x ?? 0.5) * w);
          const iy = Math.floor((t?.layout?.info?.y ?? 0.93) * h);
          ctx.fillText(scanInfo, ix, iy);
          const maybeFinish = () => {
            const link = document.createElement('a');
            link.download = `etykieta-qr-${codeText}-${sizeKey}.png`;
            link.href = canvas.toDataURL('image/png', 1.0);
            link.click();
          };
          const showLogo = (t?.options?.logoVisible ?? true);
          const lx = Math.floor(w * (t?.layout?.logo?.x ?? 0.06));
          const ly = Math.floor(h * (t?.layout?.logo?.y ?? 0.08));
          const lw = Math.floor(w * (t?.layout?.logo?.w ?? 0.1));
          const lh = Math.floor(h * (t?.layout?.logo?.h ?? 0.12));
          if (showLogo && isValidHttpUrl(t?.logoUrl)) {
            try {
              const logoImg = new Image();
              logoImg.crossOrigin = 'anonymous';
              logoImg.onload = () => { ctx.drawImage(logoImg, lx, ly, lw, lh); maybeFinish(); };
              logoImg.onerror = () => {
                ctx.strokeStyle = '#888'; ctx.strokeRect(lx, ly, lw, lh);
                ctx.font = `${Math.max(10, Math.floor(lh * 0.4))}px Arial`;
                ctx.fillStyle = '#000'; ctx.textAlign = 'center';
                ctx.fillText('LOGO', lx + lw / 2, ly + lh / 2 + Math.floor(lh * 0.15));
                maybeFinish();
              };
              logoImg.src = t.logoUrl;
            } catch { maybeFinish(); }
          } else if (showLogo) {
            ctx.strokeStyle = '#888'; ctx.strokeRect(lx, ly, lw, lh);
            ctx.font = `${Math.max(10, Math.floor(lh * 0.4))}px Arial`;
            ctx.fillStyle = '#000'; ctx.textAlign = 'center';
            ctx.fillText('LOGO', lx + lw / 2, ly + lh / 2 + Math.floor(lh * 0.15));
            maybeFinish();
          } else {
            maybeFinish();
          }
        };
        img.src = qrUrl;
      }
    } catch (error) {
      console.error('Błąd generowania etykiety QR:', error);
      alert('Wystąpił błąd podczas generowania etykiety QR');
    }
  };

  // Drukowanie etykiety QR w wybranym rozmiarze przez Print API
  const printQrLabelSized = async (tool, sizeKey) => {
    try {
      const { w, h } = LABEL_SIZES[sizeKey] || LABEL_SIZES['70x40'];
      const codeText = computeToolCodeText(tool);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = w;
      canvas.height = h;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      ctx.font = `${Math.max(12, Math.floor(h * 0.14))}px Arial`;
      ctx.fillText(tool.name, w / 2, Math.floor(h * 0.16));
      const qrSize = Math.min(Math.floor(w * 0.6), Math.floor(h * 0.62));
      const qrUrl = await generateQRCode(codeText, qrSize);
      if (qrUrl) {
        const img = new Image();
        img.onload = async () => {
          const x = Math.floor((w - qrSize) / 2);
          const y = Math.floor(h * 0.2);
          ctx.drawImage(img, x, y, qrSize, qrSize);
          ctx.font = `${Math.max(10, Math.floor(h * 0.12))}px Arial`;
          ctx.fillText(codeText, w / 2, Math.floor(h * 0.92));
          const showLogo = (qrTemplateConfig?.options?.logoVisible ?? true);
          const lx = Math.floor(w * (qrTemplateConfig?.layout?.logo?.x ?? 0.06));
          const ly = Math.floor(h * (qrTemplateConfig?.layout?.logo?.y ?? 0.08));
          const lw = Math.floor(w * (qrTemplateConfig?.layout?.logo?.w ?? 0.1));
          const lh = Math.floor(h * (qrTemplateConfig?.layout?.logo?.h ?? 0.12));
          if (showLogo && isValidHttpUrl(qrTemplateConfig?.logoUrl)) {
            try {
              const logoImg = new Image();
              logoImg.crossOrigin = 'anonymous';
              logoImg.onload = async () => {
                ctx.drawImage(logoImg, lx, ly, lw, lh);
                const base64 = canvas.toDataURL('image/png', 1.0).split(',')[1];
                await api.post('/api/print', {
                  protocol: qrPrintConfig.protocol || 'ipp',
                  printerUrl: qrPrintConfig.url,
                  contentType: 'image/png',
                  dataBase64: base64,
                  copies: Number(qrPrintConfig.copies || 1),
                  jobName: `QR-${codeText}-${sizeKey}`
                });
                alert('Wysłano zadanie drukowania (QR)');
              };
              logoImg.onerror = async () => {
                ctx.strokeStyle = '#888';
                ctx.strokeRect(lx, ly, lw, lh);
                ctx.font = `${Math.max(10, Math.floor(lh * 0.4))}px Arial`;
                ctx.fillStyle = '#000';
                ctx.textAlign = 'center';
                ctx.fillText('LOGO', lx + lw / 2, ly + lh / 2 + Math.floor(lh * 0.15));
                const base64 = canvas.toDataURL('image/png', 1.0).split(',')[1];
                await api.post('/api/print', {
                  protocol: qrPrintConfig.protocol || 'ipp',
                  printerUrl: qrPrintConfig.url,
                  contentType: 'image/png',
                  dataBase64: base64,
                  copies: Number(qrPrintConfig.copies || 1),
                  jobName: `QR-${codeText}-${sizeKey}`
                });
                alert('Wysłano zadanie drukowania (QR)');
              };
              logoImg.src = qrTemplateConfig.logoUrl;
            } catch {
              const base64 = canvas.toDataURL('image/png', 1.0).split(',')[1];
              await api.post('/api/print', {
                protocol: qrPrintConfig.protocol || 'ipp',
                printerUrl: qrPrintConfig.url,
                contentType: 'image/png',
                dataBase64: base64,
                copies: Number(qrPrintConfig.copies || 1),
                jobName: `QR-${codeText}-${sizeKey}`
              });
              alert('Wysłano zadanie drukowania (QR)');
            }
          } else {
            const base64 = canvas.toDataURL('image/png', 1.0).split(',')[1];
            await api.post('/api/print', {
              protocol: qrPrintConfig.protocol || 'ipp',
              printerUrl: qrPrintConfig.url,
              contentType: 'image/png',
              dataBase64: base64,
              copies: Number(qrPrintConfig.copies || 1),
              jobName: `QR-${codeText}-${sizeKey}`
            });
            alert('Wysłano zadanie drukowania (QR)');
          }
        };
        img.src = qrUrl;
      }
    } catch (error) {
      console.error('Błąd drukowania etykiety QR:', error);
      alert('Wystąpił błąd podczas wysyłania do drukarki (QR)');
    }
  };

  // Pobieranie etykiety kodu kreskowego w wybranym rozmiarze
  const downloadBarcodeLabelSized = async (tool, sizeKey) => {
    try {
      const { w, h } = LABEL_SIZES[sizeKey] || LABEL_SIZES['70x40'];
      const [mmW, mmH] = (sizeKey || '70x40').split('x').map(n => Number(n));
      const PREVIEW_PX_PER_MM = 8;
      const previewW = Math.floor(mmW * PREVIEW_PX_PER_MM);
      const scale = w / previewW;
      const codeText = computeToolCodeText(tool);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = w;
      canvas.height = h;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      // tło
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      const t = barcodeTemplateConfig;
      // nagłówek wg layoutu
      ctx.fillStyle = '#000000';
      ctx.textAlign = t?.layout?.title?.align || 'center';
      ctx.font = `bold ${Math.floor((t?.layout?.title?.fontSize || 26) * scale)}px Arial`;
      const tx = Math.floor((t?.layout?.title?.x ?? 0.5) * w);
      const ty = Math.floor((t?.layout?.title?.y ?? 0.13) * h);
      ctx.fillText(tool.name, tx, ty);
      // podtytuł (SKU)
      ctx.textAlign = t?.layout?.subtitle?.align || 'center';
      ctx.font = `${Math.floor((t?.layout?.subtitle?.fontSize || 18) * scale)}px Arial`;
      const skuLabel = t?.translations?.[t?.language || 'pl']?.sku || 'SKU';
      const sx = Math.floor((t?.layout?.subtitle?.x ?? 0.5) * w);
      const sy = Math.floor((t?.layout?.subtitle?.y ?? 0.23) * h);
      ctx.fillText(`${skuLabel}: ${tool.sku}`, sx, sy);
      // Kod kreskowy wg layoutu
      const bcL = t?.layout?.barcode || { x: 0.55, y: 0.33, w: 0.42, h: 0.36 };
      const targetWAreaPx = Math.max(32, Math.floor(bcL.w * w));
      const barsHeightPx = Math.max(24, Math.floor(bcL.h * h));
      const valueFontRatio = (t?.options?.barcodeValueFontRatio ?? 0.12);
      const barWidth = Math.max(1, Math.floor(targetWAreaPx / 150));
      const barcodeCanvas = document.createElement('canvas');
      try {
        JsBarcode(barcodeCanvas, codeText, {
          format: 'CODE128',
          displayValue: t?.options?.barcodeShowValue !== false,
          margin: 0,
          background: 'transparent',
          lineColor: '#1f2937',
          height: barsHeightPx,
          width: barWidth,
          textMargin: 2,
          fontSize: Math.max(8, Math.round(barsHeightPx * valueFontRatio)),
          font: 'Arial',
          fontOptions: 'bold'
        });
      } catch {}
      const img = new Image();
      img.onload = () => {
        const canvasW = barcodeCanvas.width;
        const canvasH = barcodeCanvas.height;
        const targetW = Math.min(targetWAreaPx, canvasW);
        const x = Math.floor(bcL.x * w + (targetWAreaPx - targetW) / 2);
        const y = Math.floor(bcL.y * h);
        ctx.drawImage(img, x, y, targetW, canvasH);
        // Info
        ctx.textAlign = t?.layout?.info?.align || 'center';
        ctx.font = `${Math.floor((t?.layout?.info?.fontSize || 14) * scale)}px Arial`;
        const scanInfo = t?.translations?.[t?.language || 'pl']?.scanInfo || 'Zeskanuj kod aby sprawdzić status';
        const ix = Math.floor((t?.layout?.info?.x ?? 0.5) * w);
        const iy = Math.floor((t?.layout?.info?.y ?? 0.93) * h);
        ctx.fillText(scanInfo, ix, iy);
        const maybeFinish = () => {
          const link = document.createElement('a');
          link.download = `etykieta-barcode-${codeText}-${sizeKey}.png`;
          link.href = canvas.toDataURL('image/png', 1.0);
          link.click();
        };
        const showLogo = (t?.options?.logoVisible ?? true);
        const lx = Math.floor(w * (t?.layout?.logo?.x ?? 0.06));
        const ly = Math.floor(h * (t?.layout?.logo?.y ?? 0.08));
        const lw = Math.floor(w * (t?.layout?.logo?.w ?? 0.1));
        const lh = Math.floor(h * (t?.layout?.logo?.h ?? 0.12));
        if (showLogo && isValidHttpUrl(t?.logoUrl)) {
          try {
            const logoImg = new Image();
            logoImg.crossOrigin = 'anonymous';
            logoImg.onload = () => { ctx.drawImage(logoImg, lx, ly, lw, lh); maybeFinish(); };
            logoImg.onerror = () => {
              ctx.strokeStyle = '#888'; ctx.strokeRect(lx, ly, lw, lh);
              ctx.font = `${Math.max(10, Math.floor(lh * 0.4))}px Arial`;
              ctx.fillStyle = '#000'; ctx.textAlign = 'center';
              ctx.fillText('LOGO', lx + lw / 2, ly + lh / 2 + Math.floor(lh * 0.15));
              maybeFinish();
            };
            logoImg.src = t.logoUrl;
          } catch { maybeFinish(); }
        } else if (showLogo) {
          ctx.strokeStyle = '#888'; ctx.strokeRect(lx, ly, lw, lh);
          ctx.font = `${Math.max(10, Math.floor(lh * 0.4))}px Arial`;
          ctx.fillStyle = '#000'; ctx.textAlign = 'center';
          ctx.fillText('LOGO', lx + lw / 2, ly + lh / 2 + Math.floor(lh * 0.15));
          maybeFinish();
        } else {
          maybeFinish();
        }
      };
      img.src = barcodeCanvas.toDataURL('image/png', 1.0);
    } catch (error) {
      console.error('Błąd generowania etykiety kreskowej:', error);
      alert('Wystąpił błąd podczas generowania etykiety kreskowej');
    }
  };

  // Drukowanie etykiety kodu kreskowego przez Print API
  const printBarcodeLabelSized = async (tool, sizeKey) => {
    try {
      const { w, h } = LABEL_SIZES[sizeKey] || LABEL_SIZES['70x40'];
      const codeText = computeToolCodeText(tool);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      canvas.width = w;
      canvas.height = h;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      ctx.font = `${Math.max(12, Math.floor(h * 0.14))}px Arial`;
      ctx.fillText(tool.name, w / 2, Math.floor(h * 0.16));
      const barcodeCanvas = document.createElement('canvas');
      const barWidth = w >= 1000 ? 3 : w >= 800 ? 3 : w >= 600 ? 2 : 2;
      const barHeight = Math.floor(h * 0.5);
      const valueFontRatio = (barcodeTemplateConfig?.options?.barcodeValueFontRatio ?? templateConfig?.options?.barcodeValueFontRatio ?? 0.12);
      JsBarcode(barcodeCanvas, codeText, {
        format: 'CODE128',
        width: barWidth,
        height: barHeight,
        fontSize: Math.max(8, Math.floor(h * valueFontRatio)),
        margin: 10,
        font: 'Arial',
        fontOptions: 'bold'
      });
      const img = new Image();
      img.onload = async () => {
        const targetW = Math.min(w - 20, barcodeCanvas.width);
        const x = Math.floor((w - targetW) / 2);
        const y = Math.floor(h * 0.22);
        ctx.drawImage(img, x, y, targetW, barHeight + 40);
        const showLogo = (barcodeTemplateConfig?.options?.logoVisible ?? true);
        const lx = Math.floor(w * (barcodeTemplateConfig?.layout?.logo?.x ?? 0.06));
        const ly = Math.floor(h * (barcodeTemplateConfig?.layout?.logo?.y ?? 0.08));
        const lw = Math.floor(w * (barcodeTemplateConfig?.layout?.logo?.w ?? 0.1));
        const lh = Math.floor(h * (barcodeTemplateConfig?.layout?.logo?.h ?? 0.12));
        if (showLogo && isValidHttpUrl(barcodeTemplateConfig?.logoUrl)) {
          try {
            const logoImg = new Image();
            logoImg.crossOrigin = 'anonymous';
            logoImg.onload = async () => {
              ctx.drawImage(logoImg, lx, ly, lw, lh);
              const base64 = canvas.toDataURL('image/png', 1.0).split(',')[1];
              await api.post('/api/print', {
                protocol: barcodePrintConfig.protocol || 'ipp',
                printerUrl: barcodePrintConfig.url,
                contentType: 'image/png',
                dataBase64: base64,
                copies: Number(barcodePrintConfig.copies || 1),
                jobName: `BAR-${codeText}-${sizeKey}`
              });
              alert('Wysłano zadanie drukowania (Kod kreskowy)');
            };
            logoImg.onerror = async () => {
              ctx.strokeStyle = '#888';
              ctx.strokeRect(lx, ly, lw, lh);
              ctx.font = `${Math.max(10, Math.floor(lh * 0.4))}px Arial`;
              ctx.fillStyle = '#000';
              ctx.textAlign = 'center';
              ctx.fillText('LOGO', lx + lw / 2, ly + lh / 2 + Math.floor(lh * 0.15));
              const base64 = canvas.toDataURL('image/png', 1.0).split(',')[1];
              await api.post('/api/print', {
                protocol: barcodePrintConfig.protocol || 'ipp',
                printerUrl: barcodePrintConfig.url,
                contentType: 'image/png',
                dataBase64: base64,
                copies: Number(barcodePrintConfig.copies || 1),
                jobName: `BAR-${codeText}-${sizeKey}`
              });
              alert('Wysłano zadanie drukowania (Kod kreskowy)');
            };
            logoImg.src = barcodeTemplateConfig.logoUrl;
          } catch {
            const base64 = canvas.toDataURL('image/png', 1.0).split(',')[1];
            await api.post('/api/print', {
              protocol: barcodePrintConfig.protocol || 'ipp',
              printerUrl: barcodePrintConfig.url,
              contentType: 'image/png',
              dataBase64: base64,
              copies: Number(barcodePrintConfig.copies || 1),
              jobName: `BAR-${codeText}-${sizeKey}`
            });
            alert('Wysłano zadanie drukowania (Kod kreskowy)');
          }
        } else {
          const base64 = canvas.toDataURL('image/png', 1.0).split(',')[1];
          await api.post('/api/print', {
            protocol: barcodePrintConfig.protocol || 'ipp',
            printerUrl: barcodePrintConfig.url,
            contentType: 'image/png',
            dataBase64: base64,
            copies: Number(barcodePrintConfig.copies || 1),
            jobName: `BAR-${codeText}-${sizeKey}`
          });
          alert('Wysłano zadanie drukowania (Kod kreskowy)');
        }
      };
      img.src = barcodeCanvas.toDataURL('image/png', 1.0);
    } catch (error) {
      console.error('Błąd drukowania etykiety kodu kreskowego:', error);
      alert('Wystąpił błąd podczas wysyłania do drukarki (Kod kreskowy)');
    }
  };

  // Download label function for a single tool
  const downloadSingleLabel = async (tool) => {
    try {
      const codeText = computeToolCodeText(tool);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Increase canvas size for better print quality (4x scale)
      const scale = 4;
      canvas.width = 400 * scale;
      canvas.height = 300 * scale;
      
      // Enable anti-aliasing and image smoothing
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.textRenderingOptimization = 'optimizeQuality';
      
      // White background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Tool name wg szablonu
      ctx.fillStyle = '#000000';
      const titleFont = (templateConfig?.layout?.title?.fontSize || 26) * scale;
      ctx.font = `bold ${titleFont}px Arial`;
      ctx.textAlign = templateConfig?.layout?.title?.align || 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.1)';
      ctx.shadowBlur = 2;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
      const tx = (templateConfig?.layout?.title?.x || 0.5) * canvas.width;
      const ty = (templateConfig?.layout?.title?.y || 0.13) * canvas.height;
      ctx.fillText(tool.name, tx, ty);
      
      // SKU wg szablonu
      const subFont = (templateConfig?.layout?.subtitle?.fontSize || 18) * scale;
      ctx.font = `${subFont}px Arial`;
      ctx.shadowColor = 'transparent';
      const skuLabel = templateConfig?.translations?.[templateConfig?.language || 'pl']?.sku || 'SKU';
      const sTx = (templateConfig?.layout?.subtitle?.x || 0.5) * canvas.width;
      const sTy = (templateConfig?.layout?.subtitle?.y || 0.23) * canvas.height;
      ctx.fillText(`${skuLabel}: ${tool.sku}`, sTx, sTy);
      
      // Generate and draw QR code
      const qrCodeUrl = await generateQRCode(codeText, 400);
      if (qrCodeUrl) {
        const qrImg = new Image();
        qrImg.onload = () => {
          const qrL = templateConfig?.layout?.qr || { x: 0.125, y: 0.33, w: 0.4, h: 0.53 };
          ctx.drawImage(qrImg, qrL.x * canvas.width, qrL.y * canvas.height, qrL.w * canvas.width, qrL.h * canvas.height);
          
          // Generate and draw barcode
          const barcodeUrl = generateBarcode(codeText);
          if (barcodeUrl) {
            const barcodeImg = new Image();
            barcodeImg.onload = () => {
              const bcL = templateConfig?.layout?.barcode || { x: 0.55, y: 0.33, w: 0.42, h: 0.36 };
              ctx.drawImage(barcodeImg, bcL.x * canvas.width, bcL.y * canvas.height, bcL.w * canvas.width, bcL.h * canvas.height);
              
              // Tekst informacyjny wg szablonu
              const infoFont = (templateConfig?.layout?.info?.fontSize || 14) * scale;
              ctx.font = `${infoFont}px Arial`;
              ctx.textAlign = templateConfig?.layout?.info?.align || 'center';
              const infoText = templateConfig?.translations?.[templateConfig?.language || 'pl']?.scanInfo || 'Zeskanuj kod aby sprawdzić status';
              const iTx = (templateConfig?.layout?.info?.x || 0.5) * canvas.width;
              const iTy = (templateConfig?.layout?.info?.y || 0.93) * canvas.height;
              ctx.fillText(infoText, iTx, iTy);
              
              // Logo (opcjonalnie wg opcji) + fallback placeholder
              const lg = templateConfig?.layout?.logo || { x: 0.06, y: 0.08, w: 0.1, h: 0.12 };
              const showLogo = (templateConfig?.options?.logoVisible ?? true);
              if (showLogo && isValidHttpUrl(templateConfig?.logoUrl)) {
                const logoImg = new Image();
                logoImg.crossOrigin = 'anonymous';
                logoImg.onload = () => {
                  ctx.drawImage(logoImg, lg.x * canvas.width, lg.y * canvas.height, lg.w * canvas.width, lg.h * canvas.height);
                  const link = document.createElement('a');
                  link.download = `etykieta-${codeText}.png`;
                  link.href = canvas.toDataURL('image/png', 1.0);
                  link.click();
                };
                logoImg.onerror = () => {
                  // Fallback: placeholder LOGO
                  ctx.strokeStyle = '#888';
                  ctx.strokeRect(lg.x * canvas.width, lg.y * canvas.height, lg.w * canvas.width, lg.h * canvas.height);
                  ctx.font = `${Math.max(10, Math.floor((lg.h * canvas.height) * 0.4))}px Arial`;
                  ctx.fillStyle = '#000';
                  ctx.textAlign = 'center';
                  ctx.fillText('LOGO', (lg.x + lg.w / 2) * canvas.width, (lg.y + lg.h / 2) * canvas.height + Math.floor((lg.h * canvas.height) * 0.15));
                  const link = document.createElement('a');
                  link.download = `etykieta-${codeText}.png`;
                  link.href = canvas.toDataURL('image/png', 1.0);
                  link.click();
                };
                logoImg.src = templateConfig.logoUrl;
              } else if (showLogo) {
                // Fallback: placeholder LOGO przy niepoprawnym URL
                ctx.strokeStyle = '#888';
                ctx.strokeRect(lg.x * canvas.width, lg.y * canvas.height, lg.w * canvas.width, lg.h * canvas.height);
                ctx.font = `${Math.max(10, Math.floor((lg.h * canvas.height) * 0.4))}px Arial`;
                ctx.fillStyle = '#000';
                ctx.textAlign = 'center';
                ctx.fillText('LOGO', (lg.x + lg.w / 2) * canvas.width, (lg.y + lg.h / 2) * canvas.height + Math.floor((lg.h * canvas.height) * 0.15));
                const link = document.createElement('a');
                link.download = `etykieta-${codeText}.png`;
                link.href = canvas.toDataURL('image/png', 1.0);
                link.click();
              } else {
                const link = document.createElement('a');
                link.download = `etykieta-${codeText}.png`;
                link.href = canvas.toDataURL('image/png', 1.0);
                link.click();
              }
            };
            barcodeImg.src = barcodeUrl;
          }
        };
        qrImg.src = qrCodeUrl;
      }
    } catch (error) {
      console.error('Error generating label:', error);
      alert('Wystąpił błąd podczas generowania etykiety');
    }
  };

  // Download labels for all selected tools
  const downloadSelectedLabels = async () => {
    if (selectedTools.length === 0) return;

    const selectedToolsData = toolsData.filter(tool => selectedTools.includes(tool.id));
    
    // Show progress indicator
    const progressDiv = document.createElement('div');
    progressDiv.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      z-index: 10000;
      text-align: center;
    `;
    progressDiv.innerHTML = `
      <div>Generowanie etykiet...</div>
      <div style="margin-top: 10px;">
        <div style="width: 200px; height: 4px; background: #e5e7eb; border-radius: 2px;">
          <div id="progress-bar" style="width: 0%; height: 100%; background: #3b82f6; border-radius: 2px; transition: width 0.3s;"></div>
        </div>
      </div>
      <div id="progress-text" style="margin-top: 10px; font-size: 14px; color: #6b7280;">0 / ${selectedToolsData.length}</div>
    `;
    document.body.appendChild(progressDiv);

    try {
      for (let i = 0; i < selectedToolsData.length; i++) {
        const tool = selectedToolsData[i];
        
        // Update progress
        const progressBar = document.getElementById('progress-bar');
        const progressText = document.getElementById('progress-text');
        if (progressBar && progressText) {
          const progress = ((i + 1) / selectedToolsData.length) * 100;
          progressBar.style.width = `${progress}%`;
          progressText.textContent = `${i + 1} / ${selectedToolsData.length}`;
        }

        await downloadSingleLabel(tool);
        
        // Small delay between downloads to prevent browser blocking
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error('Error downloading labels:', error);
      alert('Wystąpił błąd podczas pobierania etykiet');
    } finally {
      // Remove progress indicator
      document.body.removeChild(progressDiv);
    }
  };

  // Jeśli brak uprawnienia, pokaż czytelny komunikat i nie renderuj reszty UI
  if (!hasPermission(user, PERMISSIONS.VIEW_LABELS)) {
    return (
      <div className="p-4 lg:p-8 bg-slate-50 dark:bg-slate-900 min-h-screen">
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">Brak uprawnień</h3>
          <p className="text-slate-600 dark:text-slate-400">Brak uprawnień do przeglądania etykiet (VIEW_LABELS).</p>
        </div>
      </div>
    );
  }

  // Reset konfiguracji szablonu do wartości domyślnych
  const handleResetTemplate = () => {
    setTemplateConfig(DEFAULT_TEMPLATE);
    try {
      localStorage.setItem('labelTemplateConfig', JSON.stringify(DEFAULT_TEMPLATE));
      window.dispatchEvent(new Event('labelTemplateConfigUpdated'));
    } catch {}
  };

  return (
    <div className="p-4 lg:p-8 bg-slate-50 dark:bg-slate-900 min-h-screen">
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">Etykiety</h1>
        <p className="text-slate-600 dark:text-slate-400">Generuj i drukuj etykiety dla narzędzi</p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700">
        <div className="flex border-b border-slate-200 dark:border-slate-700">
          <button
            className={`px-4 py-3 text-sm font-medium ${currentTab === 'generator' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-600 hover:text-slate-900'}`}
            onClick={() => setCurrentTab('generator')}
          >
            Generator
          </button>
          <button
            className={`px-4 py-3 text-sm font-medium ${currentTab === 'editor' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-600 hover:text-slate-900'}`}
            onClick={() => setCurrentTab('editor')}
          >
            Edytor szablonów
          </button>
          <button
            className={`px-4 py-3 text-sm font-medium ${currentTab === 'editor_separate' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-slate-600 hover:text-slate-900'}`}
            onClick={() => setCurrentTab('editor_separate')}
          >
            Edytor osobnych szablonów
          </button>
        </div>

        {currentTab === 'generator' ? (
          <div className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Generator etykiet</h3>
            <p className="text-slate-600 dark:text-slate-400 mb-6">Wybierz narzędzia, dla których chcesz wygenerować etykiety.</p>

            {toolsData.length > 0 && (
              <div className="mb-4 pb-4 border-b border-slate-200 dark:border-slate-700">
                <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    ref={(el) => { if (el) el.indeterminate = isIndeterminate; }}
                    onChange={(e) => handleSelectAll(e.target.checked)}
                    className="w-4 h-4 accent-blue-600 dark:accent-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400"
                  />
                  <div className="flex-1">
                    <p className="font-medium text-slate-900 dark:text-slate-100">
                      {isAllSelected ? 'Odznacz wszystkie' : 'Zaznacz wszystkie'}
                    </p>
                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {selectedTools.length} z {toolsData.length} narzędzi zaznaczonych
                    </p>
                  </div>
                </label>
                <label className="mt-3 flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors">
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-blue-600 dark:accent-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400"
                    checked={templateConfig.options?.logoVisible ?? true}
                    onChange={(e) => setTemplateConfig(prev => ({
                      ...prev,
                      options: { ...(prev.options || {}), logoVisible: e.target.checked }
                    }))}
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">Pokaż logo na etykiecie</span>
                </label>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {toolsData.map(tool => {
                const isSelected = selectedTools.includes(tool.id);
                const toggleSelect = (id, checked = null) => {
                  setSelectedTools(prev => {
                    const currentlySelected = prev.includes(id);
                    const shouldSelect = checked !== null ? checked : !currentlySelected;
                    return shouldSelect ? [...prev, id] : prev.filter(x => x !== id);
                  });
                };
                return (
                  <div
                    key={tool.id}
                    onClick={() => toggleSelect(tool.id)}
                    className={`cursor-pointer rounded-xl border p-4 transition-shadow shadow-sm ${isSelected ? 'border-blue-500 dark:border-blue-600 ring-2 ring-blue-200 dark:ring-blue-500/40 bg-blue-50/50 dark:bg-blue-900/25' : 'border-slate-200 dark:border-slate-700 hover:shadow-md hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-medium text-slate-900 dark:text-slate-100">{tool.name}</p>
                        <p className="text-sm text-slate-600 dark:text-slate-400">SKU: {tool.sku}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          title="Podgląd"
                          onClick={async (e) => { e.stopPropagation(); await toggleExpand(tool); }}
                          className="px-2 py-1 text-xs rounded-md bg-slate-600 hover:bg-slate-700 text-white dark:bg-slate-700 dark:hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-500 dark:focus:ring-slate-400"
                          aria-label="Podgląd"
                        >
                          👁️
                        </button>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => { e.stopPropagation(); toggleSelect(tool.id, e.target.checked); }}
                          className="mt-1 w-4 h-4 accent-blue-600 dark:accent-blue-400 focus:ring-blue-500 dark:focus:ring-blue-400"
                          aria-label="Zaznacz narzędzie"
                        />
                      </div>
                    </div>

                    {/* Globalne sterowanie logo przeniesione do nagłówka Generatora */}

                    {tool.category && (
                      <span className="inline-block mt-1 text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-700/60 text-slate-600 dark:text-slate-200 border border-slate-200 dark:border-slate-600">Kategoria: {tool.category}</span>
                    )}

                    {expandedIds.includes(tool.id) && (
                      <div className="mt-4 p-3 rounded-md bg-slate-50 dark:bg-slate-700/40 border border-slate-200 dark:border-slate-600" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center gap-3 mb-3">
                          <label className="text-sm text-slate-700 dark:text-slate-200">Rozmiar etykiety:</label>
                          <select
                            value={selectedSizes[tool.id] || '70x40'}
                            onChange={(e) => setSelectedSizes(prev => ({ ...prev, [tool.id]: e.target.value }))}
                            className="text-sm px-2 py-1 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100"
                          >
                            {Object.keys(LABEL_SIZES).map(key => (
                              <option key={key} value={key}>{LABEL_SIZES[key].label}</option>
                            ))}
                          </select>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <p className="text-xs text-slate-600 dark:text-slate-300 mb-1">Podgląd QR</p>
                            {previews[tool.id]?.qr ? (
                              <img src={previews[tool.id].qr} alt="Podgląd QR" className="w-full max-w-[240px] rounded border border-slate-200 dark:border-slate-600 bg-white" />
                            ) : (
                              <div className="text-xs text-slate-500 dark:text-slate-400">Generowanie podglądu...</div>
                            )}
                            <div className="mt-2">
                              <button
                                type="button"
                                className="px-3 py-1 text-xs rounded-md bg-blue-600 hover:bg-blue-700 text-white"
                                onClick={async () => await downloadQrLabelSized(tool, selectedSizes[tool.id] || '70x40')}
                              >
                                Pobierz QR
                              </button>
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-slate-600 dark:text-slate-300 mb-1">Podgląd kodu kreskowego</p>
                            {previews[tool.id]?.barcode ? (
                              <img src={previews[tool.id].barcode} alt="Podgląd kreskowego" className="w-full max-w-[300px] rounded border border-slate-200 dark:border-slate-600 bg-white" />
                            ) : (
                              <div className="text-xs text-slate-500 dark:text-slate-400">Generowanie podglądu...</div>
                            )}
                            <div className="mt-2">
                              <button
                                type="button"
                                className="px-3 py-1 text-xs rounded-md bg-indigo-600 hover:bg-indigo-700 text-white"
                                onClick={async () => await downloadBarcodeLabelSized(tool, selectedSizes[tool.id] || '70x40')}
                              >
                                Pobierz kod kreskowy
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {selectedTools.length > 0 && (
                <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={downloadSelectedLabels}
                      className="bg-blue-600 dark:bg-blue-700 text-white px-6 py-2 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800 transition-colors flex items-center justify-center gap-2"
                    >
                      <span>📄</span>
                      Pobierz etykiety zaznaczonych ({selectedTools.length})
                    </button>
                    <button
                      onClick={() => setSelectedTools([])}
                      className="bg-slate-500 dark:bg-slate-600 text-white px-6 py-2 rounded-lg hover:bg-slate-600 dark:hover:bg-slate-700 transition-colors"
                    >
                      Wyczyść zaznaczenie
                    </button>
                  </div>
                </div>
              )}

              {toolsData.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-slate-500 dark:text-slate-400">Brak narzędzi do wyświetlenia</p>
                </div>
              )}
            </div>
          </div>
        ) : currentTab === 'editor' ? (
          <div className="p-6 grid grid-cols-1 xl:grid-cols-1 gap-6">
            {/* Panel konfiguracji */}
            <div className="xl:col-span-1">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Konfiguracja szablonu</h3>
                <div className="flex gap-2 items-center">
                  <button
                    type="button"
                    onClick={handleResetTemplate}
                    className="px-3 py-1.5 text-sm rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700/80"
                  >
                    Resetuj do domyślnego
                  </button>
                </div>
              </div>

              <div className="space-y-6">
                {/* Ustawienia ogólne */}
                <section className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/30 p-4">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Ustawienia ogólne</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Logo (URL)</label>
                      <input
                        type="url"
                        placeholder="https://..."
                        className={`mt-1 block w-full rounded-md border ${(!templateConfig.logoUrl || isValidHttpUrl(templateConfig.logoUrl)) ? 'border-slate-300 dark:border-slate-600' : 'border-red-500 dark:border-red-400'} bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100`}
                        value={templateConfig.logoUrl}
                        onChange={(e) => setTemplateConfig(prev => ({ ...prev, logoUrl: e.target.value }))}
                      />
                      <p className="mt-1 text-xs text-slate-500">Opcjonalne logo firmy na etykiecie.</p>
                      {templateConfig.logoUrl && !isValidHttpUrl(templateConfig.logoUrl) && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">Niepoprawny URL – użyty będzie placeholder.</p>
                      )}
                      <label className="mt-2 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          className="w-4 h-4 accent-indigo-600 dark:accent-indigo-400"
                          checked={templateConfig.options?.logoVisible ?? true}
                          onChange={(e) => setTemplateConfig(prev => ({
                            ...prev,
                            options: { ...(prev.options || {}), logoVisible: e.target.checked }
                          }))}
                        />
                        Pokaż logo na etykiecie
                      </label>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Rozdzielczość (DPI)</label>
                      <select
                        className="mt-1 block w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                        value={templateConfig.dpi || 300}
                        onChange={(e) => setTemplateConfig(prev => ({ ...prev, dpi: Number(e.target.value) }))}
                      >
                        <option value={300}>300 DPI</option>
                        <option value={600}>600 DPI</option>
                      </select>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Używane do wyliczenia rozdzielczości eksportu w pikselach.</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Rozmiar etykiety</label>
                      <select
                        className="mt-1 block w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                        value={templateConfig.sizeKey || '70x40'}
                        onChange={(e) => setTemplateConfig(prev => ({ ...prev, sizeKey: e.target.value }))}
                      >
                        <option value="51x32">51x32 mm</option>
                        <option value="70x40">70x40 mm</option>
                        <option value="110x60">110x60 mm</option>
                      </select>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Wpływa na proporcje podglądu szablonu.</p>
                    </div>
                  </div>
                </section>

                {/* Tekst: tytuł/podtytuł */}
                <section className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Teksty</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Tytuł – pozycja (X/Y)</label>
                      <div className="mt-1 grid grid-cols-2 gap-2">
                        <input type="number" step="0.01" min="0" max="1" value={templateConfig.layout.title.x}
                          className="block w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                          onChange={(e) => setTemplateConfig(prev => ({ ...prev, layout: { ...prev.layout, title: { ...prev.layout.title, x: Number(e.target.value) } } }))} />
                        <input type="number" step="0.01" min="0" max="1" value={templateConfig.layout.title.y}
                          className="block w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                          onChange={(e) => setTemplateConfig(prev => ({ ...prev, layout: { ...prev.layout, title: { ...prev.layout.title, y: Number(e.target.value) } } }))} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Tytuł – rozmiar</label>
                      <input type="number" min="8" max="64" value={templateConfig.layout.title.fontSize}
                        className="mt-1 block w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                        onChange={(e) => setTemplateConfig(prev => ({ ...prev, layout: { ...prev.layout, title: { ...prev.layout.title, fontSize: Number(e.target.value) } } }))} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Podtytuł – pozycja (X/Y)</label>
                      <div className="mt-1 grid grid-cols-2 gap-2">
                        <input type="number" step="0.01" min="0" max="1" value={templateConfig.layout.subtitle.x}
                          className="block w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                          onChange={(e) => setTemplateConfig(prev => ({ ...prev, layout: { ...prev.layout, subtitle: { ...prev.layout.subtitle, x: Number(e.target.value) } } }))} />
                        <input type="number" step="0.01" min="0" max="1" value={templateConfig.layout.subtitle.y}
                          className="block w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                          onChange={(e) => setTemplateConfig(prev => ({ ...prev, layout: { ...prev.layout, subtitle: { ...prev.layout.subtitle, y: Number(e.target.value) } } }))} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Podtytuł – rozmiar</label>
                      <input type="number" min="8" max="64" value={templateConfig.layout.subtitle.fontSize}
                        className="mt-1 block w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                        onChange={(e) => setTemplateConfig(prev => ({ ...prev, layout: { ...prev.layout, subtitle: { ...prev.layout.subtitle, fontSize: Number(e.target.value) } } }))} />
                    </div>
                  </div>
                </section>

                {/* QR i Kod kreskowy */}
                <section className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Kody</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">QR – pozycja i rozmiar (X/Y/W/H)</label>
                      <div className="mt-1 grid grid-cols-4 gap-2">
                        {['x','y','w','h'].map(k => (
                          <input key={`qr-${k}`} type="number" step="0.01" min="0" max="1" value={templateConfig.layout.qr[k]}
                            className="block w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                            onChange={(e) => setTemplateConfig(prev => ({ ...prev, layout: { ...prev.layout, qr: { ...prev.layout.qr, [k]: Number(e.target.value) } } }))} />
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Kod kreskowy – pozycja i rozmiar (X/Y/W/H)</label>
                      <div className="mt-1 grid grid-cols-4 gap-2">
                        {['x','y','w','h'].map(k => (
                          <input key={`bc-${k}`} type="number" step="0.01" min="0" max="1" value={templateConfig.layout.barcode[k]}
                            className="block w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                            onChange={(e) => setTemplateConfig(prev => ({ ...prev, layout: { ...prev.layout, barcode: { ...prev.layout.barcode, [k]: Number(e.target.value) } } }))} />
                        ))}
                      </div>
                      <label className="mt-3 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          className="w-4 h-4 accent-indigo-600 dark:accent-indigo-400"
                          checked={Boolean(templateConfig.options?.barcodeShowValue)}
                          onChange={(e) => setTemplateConfig(prev => ({
                            ...prev,
                            options: { ...(prev.options || {}), barcodeShowValue: e.target.checked }
                          }))}
                        />
                        Pokaż wartości pod kodem kreskowym
                      </label>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Rozmiar tekstu pod kodem (%)</label>
                          <input
                            type="number"
                            min={6}
                            max={24}
                            step={1}
                            value={Math.round(((templateConfig.options?.barcodeValueFontRatio ?? 0.12) * 100))}
                            onChange={(e) => {
                              const pct = Number(e.target.value);
                              const ratio = isNaN(pct) ? 0.12 : Math.min(Math.max(pct, 1), 50) / 100;
                              setTemplateConfig(prev => ({
                                ...prev,
                                options: { ...(prev.options || {}), barcodeValueFontRatio: ratio }
                              }));
                            }}
                            className="mt-1 block w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Info i Logo */}
                <section className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 shadow-sm">
                  <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">Informacje dodatkowe</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Tekst informacji</label>
                      <input
                        type="text"
                        placeholder="np. Zeskanuj kod aby sprawdzić status"
                        className="mt-1 block w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                        value={templateConfig?.translations?.[templateConfig?.language || 'pl']?.scanInfo || ''}
                        onChange={(e) => setTemplateConfig(prev => ({
                          ...prev,
                          translations: {
                            ...(prev.translations || {}),
                            [prev.language || 'pl']: {
                              ...(prev.translations?.[prev.language || 'pl'] || {}),
                              scanInfo: e.target.value
                            }
                          }
                        }))}
                      />
                      <p className="mt-1 text-xs text-slate-500">Ten tekst pojawi się na dole etykiety.</p>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Informacja – pozycja (X/Y) i rozmiar</label>
                      <div className="mt-1 grid grid-cols-3 gap-2">
                        <input type="number" step="0.01" min="0" max="1" value={templateConfig.layout.info.x}
                          className="block w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                          onChange={(e) => setTemplateConfig(prev => ({ ...prev, layout: { ...prev.layout, info: { ...prev.layout.info, x: Number(e.target.value) } } }))} />
                        <input type="number" step="0.01" min="0" max="1" value={templateConfig.layout.info.y}
                          className="block w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                          onChange={(e) => setTemplateConfig(prev => ({ ...prev, layout: { ...prev.layout, info: { ...prev.layout.info, y: Number(e.target.value) } } }))} />
                        <input type="number" min="8" max="64" value={templateConfig.layout.info.fontSize}
                          className="block w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                          onChange={(e) => setTemplateConfig(prev => ({ ...prev, layout: { ...prev.layout, info: { ...prev.layout.info, fontSize: Number(e.target.value) } } }))} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Logo – pozycja i rozmiar (X/Y/W/H)</label>
                      <div className="mt-1 grid grid-cols-4 gap-2">
                        {['x','y','w','h'].map(k => (
                          <input key={`lg-${k}`} type="number" step="0.01" min="0" max="1" value={templateConfig.layout.logo[k]}
                            className="block w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                            onChange={(e) => setTemplateConfig(prev => ({ ...prev, layout: { ...prev.layout, logo: { ...prev.layout.logo, [k]: Number(e.target.value) } } }))} />
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            </div>

            {/* Panel podglądu */}
            <div className="xl:col-span-1">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">Podgląd szablonu</h3>
              {toolsData.length > 0 && (
                <div className="mb-3 flex items-center gap-2">
                  <label className="text-sm text-slate-700 dark:text-slate-300">Dane podglądu:</label>
                  <select
                    className="text-sm px-2 py-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                    value={previewTool?.id || ''}
                    onChange={(e) => setSelectedPreviewToolId(Number(e.target.value))}
                  >
                    {toolsData.map(tool => (
                      <option key={tool.id} value={tool.id}>{tool.name} ({tool.sku || tool.id})</option>
                    ))}
                  </select>
                </div>
              )}
              <TemplatePreview
                template={templateConfig}
                sampleValue={previewValue}
                sampleTitle={previewTool?.name || 'Przykładowe narzędzie'}
                onUpdateLayout={(key, patch) => setTemplateConfig(prev => ({
                  ...prev,
                  layout: { ...prev.layout, [key]: { ...prev.layout[key], ...patch } }
                }))}
              />
              {(() => {
                const sizesMM = { '51x32': { w: 51, h: 32 }, '70x40': { w: 70, h: 40 }, '110x60': { w: 110, h: 60 } };
                const key = templateConfig.sizeKey || '70x40';
                const mm = sizesMM[key] || sizesMM['70x40'];
                const dpi = templateConfig.dpi || 300;
                const pxW = Math.round(mm.w * dpi / 25.4);
                const pxH = Math.round(mm.h * dpi / 25.4);
                return (
                  <div className="mt-2 text-xs text-slate-700 dark:text-slate-300">
                    Rozmiar: {mm.w}×{mm.h} mm • DPI: {dpi} • Eksport: {pxW}×{pxH} px
                  </div>
                );
              })()}
              <p className="text-xs text-slate-500 mt-2">Zmiany zapisywane są automatycznie i obowiązują globalnie.</p>
            </div>
          </div>
        ) : (
          // Edytor osobnych szablonów: osobno dla QR i kodu kreskowego
          <div className="p-6 grid grid-cols-1 xl:grid-cols-1 gap-6">
            <div className="xl:col-span-1">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Edytor osobnych szablonów</h3>
              {toolsData.length > 0 && (
                <div className="mb-4 flex items-center gap-2">
                  <label className="text-sm text-slate-700 dark:text-slate-300">Dane podglądu:</label>
                  <select
                    className="text-sm px-2 py-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                    value={previewTool?.id || ''}
                    onChange={(e) => setSelectedPreviewToolId(Number(e.target.value))}
                  >
                    {toolsData.map(tool => (
                      <option key={tool.id} value={tool.id}>{tool.name} ({tool.sku || tool.id})</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Sekcja QR */}
              <section className="mb-6">
                <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-3">Szablon etykiety QR</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
                    <h5 className="font-medium text-slate-900 dark:text-slate-100 mb-2">Tytuł i SKU</h5>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Tytuł – pozycja (X/Y)</label>
                        <div className="mt-1 grid grid-cols-2 gap-2">
                          <input type="number" step="0.01" min="0" max="1" value={qrTemplateConfig.layout.title.x}
                            className="block w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                            onChange={(e) => setQrTemplateConfig(prev => ({ ...prev, layout: { ...prev.layout, title: { ...prev.layout.title, x: Number(e.target.value) } } }))} />
                          <input type="number" step="0.01" min="0" max="1" value={qrTemplateConfig.layout.title.y}
                            className="block w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                            onChange={(e) => setQrTemplateConfig(prev => ({ ...prev, layout: { ...prev.layout, title: { ...prev.layout.title, y: Number(e.target.value) } } }))} />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Tytuł – rozmiar</label>
                        <input type="number" min="12" max="64" value={qrTemplateConfig.layout.title.fontSize}
                          className="mt-1 block w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                          onChange={(e) => setQrTemplateConfig(prev => ({ ...prev, layout: { ...prev.layout, title: { ...prev.layout.title, fontSize: Number(e.target.value) } } }))} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">SKU – pozycja (X/Y)</label>
                        <div className="mt-1 grid grid-cols-2 gap-2">
                          <input type="number" step="0.01" min="0" max="1" value={qrTemplateConfig.layout.subtitle.x}
                            className="block w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                            onChange={(e) => setQrTemplateConfig(prev => ({ ...prev, layout: { ...prev.layout, subtitle: { ...prev.layout.subtitle, x: Number(e.target.value) } } }))} />
                          <input type="number" step="0.01" min="0" max="1" value={qrTemplateConfig.layout.subtitle.y}
                            className="block w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                            onChange={(e) => setQrTemplateConfig(prev => ({ ...prev, layout: { ...prev.layout, subtitle: { ...prev.layout.subtitle, y: Number(e.target.value) } } }))} />
                        </div>
                      </div>
                    </div>
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">QR – pozycja i rozmiar (X/Y/W/H)</label>
                      <div className="mt-1 grid grid-cols-4 gap-2">
                        {['x','y','w','h'].map(k => (
                          <input key={`qrsep-${k}`} type="number" step="0.01" min="0" max="1" value={qrTemplateConfig.layout.qr[k]}
                            className="block w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                            onChange={(e) => setQrTemplateConfig(prev => ({ ...prev, layout: { ...prev.layout, qr: { ...prev.layout.qr, [k]: Number(e.target.value) } } }))} />
                        ))}
                      </div>
                    </div>

                    <div className="mt-3">
                      {/* Informacja: tekst oraz pozycja (X/Y) i rozmiar – nad polem Logo (URL) */}
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Tekst informacji</label>
                      <input
                        type="text"
                        placeholder="np. Zeskanuj kod aby sprawdzić status"
                        className="mt-1 block w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                        value={qrTemplateConfig?.translations?.[qrTemplateConfig?.language || 'pl']?.scanInfo || ''}
                        onChange={(e) => setQrTemplateConfig(prev => ({
                          ...prev,
                          translations: {
                            ...(prev.translations || {}),
                            [prev.language || 'pl']: {
                              ...(prev.translations?.[prev.language || 'pl'] || {}),
                              scanInfo: e.target.value
                            }
                          }
                        }))}
                      />
                      <div className="mt-2">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Informacja – pozycja (X/Y) i rozmiar</label>
                        <div className="mt-1 grid grid-cols-3 gap-2">
                          <input type="number" step="0.01" min="0" max="1" value={qrTemplateConfig.layout.info.x}
                            className="block w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                            onChange={(e) => setQrTemplateConfig(prev => ({ ...prev, layout: { ...prev.layout, info: { ...prev.layout.info, x: Number(e.target.value) } } }))} />
                          <input type="number" step="0.01" min="0" max="1" value={qrTemplateConfig.layout.info.y}
                            className="block w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                            onChange={(e) => setQrTemplateConfig(prev => ({ ...prev, layout: { ...prev.layout, info: { ...prev.layout.info, y: Number(e.target.value) } } }))} />
                          <input type="number" min="8" max="64" value={qrTemplateConfig.layout.info.fontSize}
                            className="block w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                            onChange={(e) => setQrTemplateConfig(prev => ({ ...prev, layout: { ...prev.layout, info: { ...prev.layout.info, fontSize: Number(e.target.value) } } }))} />
                        </div>
                      </div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Logo (URL)</label>
                      <input
                        type="url"
                        placeholder="https://..."
                        className={`mt-1 block w-full rounded-md border ${(!qrTemplateConfig.logoUrl || isValidHttpUrl(qrTemplateConfig.logoUrl)) ? 'border-slate-300 dark:border-slate-600' : 'border-red-500 dark:border-red-400'} bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100`}
                        value={qrTemplateConfig.logoUrl}
                        onChange={(e) => setQrTemplateConfig(prev => ({ ...prev, logoUrl: e.target.value }))}
                      />
                      {qrTemplateConfig.logoUrl && !isValidHttpUrl(qrTemplateConfig.logoUrl) && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">Niepoprawny URL – użyty będzie placeholder.</p>
                      )}
                      <label className="mt-2 inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400"
                          checked={qrTemplateConfig.options?.logoVisible ?? true}
                          onChange={(e) => setQrTemplateConfig(prev => ({ ...prev, options: { ...(prev.options || {}), logoVisible: e.target.checked } }))}
                        />
                        Pokaż logo na etykiecie
                      </label>
                      <div className="mt-2">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Logo – pozycja i rozmiar (X/Y/W/H)</label>
                        <div className="mt-1 grid grid-cols-4 gap-2">
                          {['x','y','w','h'].map(k => (
                            <input key={`lgqr-${k}`} type="number" step="0.01" min="0" max="1" value={qrTemplateConfig.layout.logo[k]}
                              className="block w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                              onChange={(e) => setQrTemplateConfig(prev => ({ ...prev, layout: { ...prev.layout, logo: { ...prev.layout.logo, [k]: Number(e.target.value) } } }))} />
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:items-center">
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-slate-700 dark:text-slate-300">Rozmiar etykiety:</label>
                        <select
                          className="text-sm px-2 py-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                          value={qrTemplateConfig.sizeKey || '70x40'}
                          onChange={(e) => setQrTemplateConfig(prev => ({ ...prev, sizeKey: e.target.value }))}
                        >
                          <option value="51x32">51x32 mm</option>
                          <option value="70x40">70x40 mm</option>
                          <option value="110x60">110x60 mm</option>
                        </select>
                      </div>
                      <div className="flex-1" />
                      <button
                        type="button"
                        disabled={!previewTool}
                        className="px-3 py-1.5 text-sm rounded-md bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white"
                        onClick={async () => {
                          if (!previewTool) return;
                          await downloadQrLabelSized(previewTool, qrTemplateConfig.sizeKey || '70x40');
                        }}
                      >
                        Pobierz etykietę (tylko QR)
                      </button>
                    </div>
                    {/* Kafelek: Drukowanie (QR) */}
                    <div className="mt-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
                      <h5 className="font-medium text-slate-900 dark:text-slate-100 mb-2">Drukowanie</h5>
                      <div className="grid grid-cols-1 lg:grid-cols-4 gap-2 lg:items-end">
                        <div className="flex flex-col">
                          <label className="text-sm text-slate-700 dark:text-slate-300">Protokół:</label>
                          <select
                            className="text-sm px-2 py-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                            value={qrPrintConfig.protocol}
                            onChange={(e) => setQrPrintConfig(prev => ({ ...prev, protocol: e.target.value }))}
                          >
                            <option value="ipp">IPP</option>
                            <option value="zebra_raw">Zebra RAW (9100)</option>
                          </select>
                        </div>
                        <div className="flex flex-col lg:col-span-2">
                          <label className="text-sm text-slate-700 dark:text-slate-300">Adres drukarki</label>
                          <input
                            type="text"
                            placeholder="ipp://adres-drukarki/ipp/print lub tcp://IP:9100"
                            className="text-sm px-2 py-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                            value={qrPrintConfig.url}
                            onChange={(e) => setQrPrintConfig(prev => ({ ...prev, url: e.target.value }))}
                          />
                        </div>
                        <div className="flex flex-col">
                          <label className="text-sm text-slate-700 dark:text-slate-300">Kopie</label>
                          <input
                            type="number"
                            min={1}
                            className="text-sm px-2 py-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                            value={qrPrintConfig.copies}
                            onChange={(e) => setQrPrintConfig(prev => ({ ...prev, copies: Number(e.target.value) }))}
                          />
                        </div>
                        <div className="lg:col-span-4 flex justify-end">
                          <button
                            type="button"
                            disabled={!previewTool || !qrPrintConfig.url}
                            className="mt-2 px-3 py-1.5 text-sm rounded-md bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white"
                            onClick={async () => {
                              if (!previewTool || !qrPrintConfig.url) return;
                              await printQrLabelSized(previewTool, qrTemplateConfig.sizeKey || '70x40');
                            }}
                          >
                            Drukuj (QR)
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
                    <TemplatePreview
                      template={qrTemplateConfig}
                      sampleTitle={previewTool?.name || 'Przykładowe narzędzie'}
                      sampleValue={previewValue}
                      mode="qr"
                      onUpdateLayout={(key, patch) => setQrTemplateConfig(prev => ({
                        ...prev,
                        layout: { ...prev.layout, [key]: { ...prev.layout[key], ...patch } }
                      }))}
                    />
                  </div>
                </div>
              </section>

              {/* Sekcja Kod kreskowy */}
              <section>
                <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100 mb-3">Szablon etykiety kodu kreskowego</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
                    <h5 className="font-medium text-slate-900 dark:text-slate-100 mb-2">Tytuł i SKU</h5>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Tytuł – pozycja (X/Y)</label>
                        <div className="mt-1 grid grid-cols-2 gap-2">
                          <input type="number" step="0.01" min="0" max="1" value={barcodeTemplateConfig.layout.title.x}
                            className="block w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                            onChange={(e) => setBarcodeTemplateConfig(prev => ({ ...prev, layout: { ...prev.layout, title: { ...prev.layout.title, x: Number(e.target.value) } } }))} />
                          <input type="number" step="0.01" min="0" max="1" value={barcodeTemplateConfig.layout.title.y}
                            className="block w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                            onChange={(e) => setBarcodeTemplateConfig(prev => ({ ...prev, layout: { ...prev.layout, title: { ...prev.layout.title, y: Number(e.target.value) } } }))} />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Tytuł – rozmiar</label>
                        <input type="number" min="12" max="64" value={barcodeTemplateConfig.layout.title.fontSize}
                          className="mt-1 block w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                          onChange={(e) => setBarcodeTemplateConfig(prev => ({ ...prev, layout: { ...prev.layout, title: { ...prev.layout.title, fontSize: Number(e.target.value) } } }))} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">SKU – pozycja (X/Y)</label>
                        <div className="mt-1 grid grid-cols-2 gap-2">
                          <input type="number" step="0.01" min="0" max="1" value={barcodeTemplateConfig.layout.subtitle.x}
                            className="block w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                            onChange={(e) => setBarcodeTemplateConfig(prev => ({ ...prev, layout: { ...prev.layout, subtitle: { ...prev.layout.subtitle, x: Number(e.target.value) } } }))} />
                          <input type="number" step="0.01" min="0" max="1" value={barcodeTemplateConfig.layout.subtitle.y}
                            className="block w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                            onChange={(e) => setBarcodeTemplateConfig(prev => ({ ...prev, layout: { ...prev.layout, subtitle: { ...prev.layout.subtitle, y: Number(e.target.value) } } }))} />
                        </div>
                      </div>
                    </div>
                    <div className="mt-4">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Kod kreskowy – pozycja i rozmiar (X/Y/W/H)</label>
                      <div className="mt-1 grid grid-cols-4 gap-2">
                        {['x','y','w','h'].map(k => (
                          <input key={`bcsep-${k}`} type="number" step="0.01" min="0" max="1" value={barcodeTemplateConfig.layout.barcode[k]}
                            className="block w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                            onChange={(e) => setBarcodeTemplateConfig(prev => ({ ...prev, layout: { ...prev.layout, barcode: { ...prev.layout.barcode, [k]: Number(e.target.value) } } }))} />
                        ))}
                      </div>
                    </div>
                    <div className="mt-3">
                      <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                        <input type="checkbox" checked={Boolean(barcodeTemplateConfig.options?.barcodeShowValue)}
                          onChange={(e) => setBarcodeTemplateConfig(prev => ({ ...prev, options: { ...prev.options, barcodeShowValue: e.target.checked } }))}
                          className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400" />
                        Pokazuj wartość pod kodem kreskowym
                      </label>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Rozmiar tekstu pod kodem (%)</label>
                          <input
                            type="number"
                            min={6}
                            max={24}
                            step={1}
                            value={Math.round(((barcodeTemplateConfig.options?.barcodeValueFontRatio ?? 0.12) * 100))}
                            onChange={(e) => {
                              const pct = Number(e.target.value);
                              const ratio = isNaN(pct) ? 0.12 : Math.min(Math.max(pct, 1), 50) / 100;
                              setBarcodeTemplateConfig(prev => ({
                                ...prev,
                                options: { ...(prev.options || {}), barcodeValueFontRatio: ratio }
                              }));
                            }}
                            className="mt-1 block w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                          />
                        </div>
                      </div>
                      <div className="mt-2">
                        {/* Informacja: tekst oraz pozycja (X/Y) i rozmiar – nad polem Logo (URL) */}
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Tekst informacji</label>
                        <input
                          type="text"
                          placeholder="np. Zeskanuj kod aby sprawdzić status"
                          className="mt-1 block w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                          value={barcodeTemplateConfig?.translations?.[barcodeTemplateConfig?.language || 'pl']?.scanInfo || ''}
                          onChange={(e) => setBarcodeTemplateConfig(prev => ({
                            ...prev,
                            translations: {
                              ...(prev.translations || {}),
                              [prev.language || 'pl']: {
                                ...(prev.translations?.[prev.language || 'pl'] || {}),
                                scanInfo: e.target.value
                              }
                            }
                          }))}
                        />
                        <div className="mt-2">
                          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Informacja – pozycja (X/Y) i rozmiar</label>
                          <div className="mt-1 grid grid-cols-3 gap-2">
                            <input type="number" step="0.01" min="0" max="1" value={barcodeTemplateConfig.layout.info.x}
                              className="block w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                              onChange={(e) => setBarcodeTemplateConfig(prev => ({ ...prev, layout: { ...prev.layout, info: { ...prev.layout.info, x: Number(e.target.value) } } }))} />
                            <input type="number" step="0.01" min="0" max="1" value={barcodeTemplateConfig.layout.info.y}
                              className="block w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                              onChange={(e) => setBarcodeTemplateConfig(prev => ({ ...prev, layout: { ...prev.layout, info: { ...prev.layout.info, y: Number(e.target.value) } } }))} />
                            <input type="number" min="8" max="64" value={barcodeTemplateConfig.layout.info.fontSize}
                              className="block w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                              onChange={(e) => setBarcodeTemplateConfig(prev => ({ ...prev, layout: { ...prev.layout, info: { ...prev.layout.info, fontSize: Number(e.target.value) } } }))} />
                          </div>
                        </div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Logo (URL)</label>
                        <input
                          type="url"
                          placeholder="https://..."
                          className={`mt-1 block w-full rounded-md border ${(!barcodeTemplateConfig.logoUrl || isValidHttpUrl(barcodeTemplateConfig.logoUrl)) ? 'border-slate-300 dark:border-slate-600' : 'border-red-500 dark:border-red-400'} bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100`}
                          value={barcodeTemplateConfig.logoUrl || ''}
                          onChange={(e) => setBarcodeTemplateConfig(prev => ({ ...prev, logoUrl: e.target.value }))}
                        />
                        {barcodeTemplateConfig.logoUrl && !isValidHttpUrl(barcodeTemplateConfig.logoUrl) && (
                          <p className="mt-1 text-xs text-red-600 dark:text-red-400">Niepoprawny URL – użyty będzie placeholder.</p>
                        )}
                      </div>
                      <label className="mt-2 inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500 dark:focus:ring-blue-400"
                          checked={barcodeTemplateConfig.options?.logoVisible ?? true}
                          onChange={(e) => setBarcodeTemplateConfig(prev => ({ ...prev, options: { ...(prev.options || {}), logoVisible: e.target.checked } }))}
                        />
                        Pokaż logo na etykiecie
                      </label>
                      <div className="mt-2">
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Logo – pozycja i rozmiar (X/Y/W/H)</label>
                        <div className="mt-1 grid grid-cols-4 gap-2">
                          {['x','y','w','h'].map(k => (
                            <input key={`lgbc-${k}`} type="number" step="0.01" min="0" max="1" value={barcodeTemplateConfig.layout.logo[k]}
                              className="block w-full rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100"
                              onChange={(e) => setBarcodeTemplateConfig(prev => ({ ...prev, layout: { ...prev.layout, logo: { ...prev.layout.logo, [k]: Number(e.target.value) } } }))} />
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:items-center">
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-slate-700 dark:text-slate-300">Rozmiar etykiety:</label>
                        <select
                          className="text-sm px-2 py-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                          value={barcodeTemplateConfig.sizeKey || '70x40'}
                          onChange={(e) => setBarcodeTemplateConfig(prev => ({ ...prev, sizeKey: e.target.value }))}
                        >
                          <option value="51x32">51x32 mm</option>
                          <option value="70x40">70x40 mm</option>
                          <option value="110x60">110x60 mm</option>
                        </select>
                      </div>
                      <div className="flex-1" />
                      <button
                        type="button"
                        disabled={!previewTool}
                        className="px-3 py-1.5 text-sm rounded-md bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white"
                        onClick={async () => {
                          if (!previewTool) return;
                          await downloadBarcodeLabelSized(previewTool, barcodeTemplateConfig.sizeKey || '70x40');
                        }}
                      >
                        Pobierz etykietę (tylko kod kreskowy)
                      </button>
                    </div>
                    {/* Kafelek: Drukowanie (Kod kreskowy) */}
                    <div className="mt-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
                      <h5 className="font-medium text-slate-900 dark:text-slate-100 mb-2">Drukowanie</h5>
                      <div className="grid grid-cols-1 lg:grid-cols-4 gap-2 lg:items-end">
                        <div className="flex flex-col">
                          <label className="text-sm text-slate-700 dark:text-slate-300">Protokół:</label>
                          <select
                            className="text-sm px-2 py-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                            value={barcodePrintConfig.protocol}
                            onChange={(e) => setBarcodePrintConfig(prev => ({ ...prev, protocol: e.target.value }))}
                          >
                            <option value="ipp">IPP</option>
                            <option value="zebra_raw">Zebra RAW (9100)</option>
                          </select>
                        </div>
                        <div className="flex flex-col lg:col-span-2">
                          <label className="text-sm text-slate-700 dark:text-slate-300">Adres drukarki</label>
                          <input
                            type="text"
                            placeholder="ipp://adres-drukarki/ipp/print lub tcp://IP:9100"
                            className="text-sm px-2 py-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                            value={barcodePrintConfig.url}
                            onChange={(e) => setBarcodePrintConfig(prev => ({ ...prev, url: e.target.value }))}
                          />
                        </div>
                        <div className="flex flex-col">
                          <label className="text-sm text-slate-700 dark:text-slate-300">Kopie</label>
                          <input
                            type="number"
                            min={1}
                            className="text-sm px-2 py-1 rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                            value={barcodePrintConfig.copies}
                            onChange={(e) => setBarcodePrintConfig(prev => ({ ...prev, copies: Number(e.target.value) }))}
                          />
                        </div>
                        <div className="lg:col-span-4 flex justify-end">
                          <button
                            type="button"
                            disabled={!previewTool || !barcodePrintConfig.url}
                            className="mt-2 px-3 py-1.5 text-sm rounded-md bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-400 disabled:cursor-not-allowed text-white"
                            onClick={async () => {
                              if (!previewTool || !barcodePrintConfig.url) return;
                              await printBarcodeLabelSized(previewTool, barcodeTemplateConfig.sizeKey || '70x40');
                            }}
                          >
                            Drukuj (Kod kreskowy)
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
                    <TemplatePreview
                      template={barcodeTemplateConfig}
                      sampleTitle={previewTool?.name || 'Przykładowe narzędzie'}
                      sampleValue={previewValue}
                      mode="barcode"
                      onUpdateLayout={(key, patch) => setBarcodeTemplateConfig(prev => ({
                        ...prev,
                        layout: { ...prev.layout, [key]: { ...prev.layout[key], ...patch } }
                      }))}
                    />
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Podgląd szablonu etykiety (HTML/CSS – bez generowania pliku)
function TemplatePreview({ template, onUpdateLayout, sampleValue, sampleTitle, mode = 'both' }) {
  // Ustal wymiar podglądu w oparciu o wybrany rozmiar etykiety (proporcje mm)
  const sizesMM = {
    '51x32': { w: 51, h: 32 },
    '70x40': { w: 70, h: 40 },
    '110x60': { w: 110, h: 60 },
  };
  const sizeKey = template?.sizeKey || '70x40';
  const mm = sizesMM[sizeKey] || sizesMM['70x40'];
  const dpi = (template?.dpi || 300);
  const exportPxW = Math.round(mm.w * dpi / 25.4);
  const exportPxH = Math.round(mm.h * dpi / 25.4);
  // Podgląd powinien odzwierciedlać wybrany rozmiar etykiety.
  // Zamiast stałej szerokości, użyj skalowania stałego w px/mm.
  const PREVIEW_PX_PER_MM = 8; // współczynnik podglądu: 8 px na 1 mm
  const w = Math.round(mm.w * PREVIEW_PX_PER_MM);
  const h = Math.round(mm.h * PREVIEW_PX_PER_MM);
  // Skala czcionek względem bazowego rozmiaru 70x40 mm, aby przy zmianie rozmiaru etykiety
  // teksty automatycznie skalowały się proporcjonalnie
  const baseH = Math.round(sizesMM['70x40'].h * PREVIEW_PX_PER_MM);
  const fontScale = h / baseH;
  // Siatka pomocnicza: linie co 1 mm (delikatne) i co 10 mm (mocniejsze)
  const gridMinor = PREVIEW_PX_PER_MM; // 1 mm
  const gridMajor = PREVIEW_PX_PER_MM * 10; // 10 mm
  const gridColorMinor = 'rgba(100,116,139,0.12)'; // slate-500 z niską przezroczystością
  const gridColorMajor = 'rgba(100,116,139,0.25)'; // bardziej widoczne
  const t = template || {};
  const merge = (def, obj) => ({ ...def, ...(obj || {}) });
  const title = merge({ x: 0.5, y: 0.13, fontSize: 26, align: 'center' }, t.layout?.title);
  const subtitle = merge({ x: 0.5, y: 0.23, fontSize: 18, align: 'center' }, t.layout?.subtitle);
  const qr = merge({ x: 0.125, y: 0.33, w: 0.4, h: 0.53 }, t.layout?.qr);
  const barcode = merge({ x: 0.55, y: 0.33, w: 0.42, h: 0.36 }, t.layout?.barcode);
  const info = merge({ x: 0.5, y: 0.93, fontSize: 14, align: 'center' }, t.layout?.info);
  const logo = merge({ x: 0.06, y: 0.08, w: 0.1, h: 0.12 }, t.layout?.logo);
  const skuLabel = (t.translations?.[t.language || 'pl']?.sku) || 'SKU';
  const scanInfo = (t.translations?.[t.language || 'pl']?.scanInfo) || 'Zeskanuj kod aby sprawdzić status';

  const pos = (p) => ({ left: `${p.x * w}px`, top: `${p.y * h}px` });
  const box = (p) => ({ left: `${p.x * w}px`, top: `${p.y * h}px`, width: `${p.w * w}px`, height: `${p.h * h}px` });

  const containerRef = useRef(null);
  const barcodeCanvasRef = useRef(null);
  const [qrSrc, setQrSrc] = useState('');
  const [dragState, setDragState] = useState(null); // { target: 'qr'|'barcode', type: 'move'|'resize', handle?: 'nw'|'ne'|'sw'|'se', offsetX, offsetY, startBox }

  useEffect(() => {
    const sample = sampleValue || 'DEMO-001';
    const size = Math.max(32, Math.round((t.layout?.qr?.w || qr.w) * exportPxW));
    QRCode.toDataURL(sample, {
      width: size,
      margin: 1,
      color: { dark: '#000000', light: '#FFFFFF' },
      errorCorrectionLevel: 'H',
      quality: 1
    })
      .then(setQrSrc)
      .catch(() => setQrSrc(''));
  }, [t.layout?.qr?.w, sampleValue, exportPxW]);

  useEffect(() => {
    const sample = sampleValue || 'DEMO-001';
    const canvas = barcodeCanvasRef.current;
    if (!canvas) return;
    const targetW = Math.max(32, Math.round((t.layout?.barcode?.w || barcode.w) * exportPxW));
    const targetH = Math.max(24, Math.round((t.layout?.barcode?.h || barcode.h) * exportPxH));
    canvas.width = targetW;
    canvas.height = targetH;
    try {
      JsBarcode(canvas, sample, {
        format: 'CODE128',
        displayValue: Boolean(t.options?.barcodeShowValue),
        margin: 0,
        background: 'transparent',
        lineColor: '#1f2937',
        height: targetH,
        width: Math.max(1, Math.floor(targetW / 150)),
        textMargin: 2,
        fontSize: Math.max(8, Math.round(targetH * (t.options?.barcodeValueFontRatio ?? 0.12)))
      });
    } catch {}
  }, [t.layout?.barcode?.w, t.layout?.barcode?.h, t.options?.barcodeShowValue, t.options?.barcodeValueFontRatio, sampleValue, exportPxW, exportPxH]);

  const clamp = (val, min, max) => Math.min(Math.max(val, min), max);
  const handleDragStart = (target, e) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const clientX = e.clientX;
    const clientY = e.clientY;
    const current =
      target === 'qr' ? qr :
      target === 'barcode' ? barcode :
      target === 'title' ? (t.layout?.title || title) :
      target === 'subtitle' ? (t.layout?.subtitle || subtitle) :
      (t.layout?.info || info);
    const elemLeft = current.x * w;
    const elemTop = current.y * h;
    const offsetX = clientX - rect.left - elemLeft;
    const offsetY = clientY - rect.top - elemTop;
    setDragState({ target, type: 'move', offsetX, offsetY, startBox: { ...current } });
  };
  const handleResizeStart = (target, handle, e) => {
    e.stopPropagation();
    const current = target === 'qr' ? qr : barcode;
    setDragState({ target, type: 'resize', handle, startBox: { ...current } });
  };
  const handleMouseMove = (e) => {
    if (!dragState || !onUpdateLayout) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const clientX = e.clientX;
    const clientY = e.clientY;
    const current =
      dragState.target === 'qr' ? (t.layout?.qr || qr) :
      dragState.target === 'barcode' ? (t.layout?.barcode || barcode) :
      dragState.target === 'title' ? (t.layout?.title || title) :
      dragState.target === 'subtitle' ? (t.layout?.subtitle || subtitle) :
      (t.layout?.info || info);
    if (dragState.type === 'move') {
      const leftPx = clientX - rect.left - dragState.offsetX;
      const topPx = clientY - rect.top - dragState.offsetY;
      const newX = clamp(leftPx / w, 0, 1 - (current.w || 0));
      const newY = clamp(topPx / h, 0, 1 - (current.h || 0));
      onUpdateLayout(dragState.target, { x: Number(newX.toFixed(4)), y: Number(newY.toFixed(4)) });
    } else if (dragState.type === 'resize') {
      const minW = 0.05;
      const minH = 0.05;
      const start = dragState.startBox;
      const left = start.x * w;
      const top = start.y * h;
      const right = (start.x + start.w) * w;
      const bottom = (start.y + start.h) * h;
      let newX = start.x;
      let newY = start.y;
      let newW = start.w;
      let newH = start.h;
      const relX = clientX - rect.left;
      const relY = clientY - rect.top;
      if (dragState.handle === 'se') {
        newW = clamp((relX - left) / w, minW, 1 - start.x);
        newH = clamp((relY - top) / h, minH, 1 - start.y);
      } else if (dragState.handle === 'ne') {
        newW = clamp((relX - left) / w, minW, 1 - start.x);
        newH = clamp((bottom - relY) / h, minH, start.y + start.h);
        newY = clamp(relY / h, 0, start.y + start.h - minH);
      } else if (dragState.handle === 'sw') {
        newW = clamp((right - relX) / w, minW, start.x + start.w);
        newH = clamp((relY - top) / h, minH, 1 - start.y);
        newX = clamp(relX / w, 0, start.x + start.w - minW);
      } else if (dragState.handle === 'nw') {
        newW = clamp((right - relX) / w, minW, start.x + start.w);
        newH = clamp((bottom - relY) / h, minH, start.y + start.h);
        newX = clamp(relX / w, 0, start.x + start.w - minW);
        newY = clamp(relY / h, 0, start.y + start.h - minH);
      }
      onUpdateLayout(dragState.target, {
        x: Number(newX.toFixed(4)),
        y: Number(newY.toFixed(4)),
        w: Number(newW.toFixed(4)),
        h: Number(newH.toFixed(4))
      });
    }
  };
  const endDrag = () => setDragState(null);

  return (
      <div
        ref={containerRef}
        className="relative"
        style={{
          width: w,
          height: h,
          backgroundColor: '#ffffff',
          backgroundImage: `
            repeating-linear-gradient(to right, ${gridColorMinor} 0, ${gridColorMinor} 1px, transparent 1px, transparent ${gridMinor}px),
            repeating-linear-gradient(to bottom, ${gridColorMinor} 0, ${gridColorMinor} 1px, transparent 1px, transparent ${gridMinor}px),
            repeating-linear-gradient(to right, ${gridColorMajor} 0, ${gridColorMajor} 2px, transparent 2px, transparent ${gridMajor}px),
            repeating-linear-gradient(to bottom, ${gridColorMajor} 0, ${gridColorMajor} 2px, transparent 2px, transparent ${gridMajor}px)
          `
        }}
        onMouseMove={handleMouseMove}
        onMouseUp={endDrag}
        onMouseLeave={endDrag}
      >
        {/* Tytuł */}
        <div
          style={{ position: 'absolute', ...pos(title), transform: 'translate(-50%, -50%)', fontSize: Math.round((title.fontSize || 26) * fontScale), fontWeight: 700, cursor: 'move' }}
          className="text-slate-900"
          onMouseDown={(e) => handleDragStart('title', e)}
        >
          {sampleTitle || 'Przykładowe narzędzie'}
        </div>
        {/* Podtytuł */}
        <div
          style={{ position: 'absolute', ...pos(subtitle), transform: 'translate(-50%, -50%)', fontSize: Math.round((subtitle.fontSize || 18) * fontScale), cursor: 'move' }}
          className="text-slate-900"
          onMouseDown={(e) => handleDragStart('subtitle', e)}
        >
          {skuLabel}: {sampleValue || 'DEMO-001'}
        </div>
        {/* QR */}
        {mode !== 'barcode' && (
          <div
            style={{ position: 'absolute', ...box(qr), cursor: 'move' }}
            className="rounded group"
            onMouseDown={(e) => handleDragStart('qr', e)}
          >
            {qrSrc ? (
              <img src={qrSrc} alt="QR" className="w-full h-full border border-slate-200 rounded" style={{ imageRendering: 'crisp-edges' }} draggable={false} />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-slate-600 dark:text-slate-300">QR</div>
            )}
            {/* Resize handles */}
            {['nw','ne','sw','se'].map(h => (
              <div
                key={`qr-h-${h}`}
                onMouseDown={(e) => handleResizeStart('qr', h, e)}
                className="absolute w-2 h-2 bg-indigo-600 dark:bg-indigo-400 rounded-sm border border-white shadow-sm opacity-0 group-hover:opacity-100"
                style={{
                  left: h.includes('w') ? '-3px' : 'calc(100% - 5px)',
                  top: h.includes('n') ? '-3px' : 'calc(100% - 5px)'
                }}
              />
            ))}
          </div>
        )}
        {/* Barcode */}
        {mode !== 'qr' && (
          <div
            style={{ position: 'absolute', ...box(barcode), cursor: 'move' }}
            className="rounded group"
            onMouseDown={(e) => handleDragStart('barcode', e)}
          >
            <canvas ref={barcodeCanvasRef} className="w-full h-full border border-slate-200 rounded" />
            {/* Resize handles */}
            {['nw','ne','sw','se'].map(h => (
              <div
                key={`bc-h-${h}`}
                onMouseDown={(e) => handleResizeStart('barcode', h, e)}
                className="absolute w-2 h-2 bg-indigo-600 dark:bg-indigo-400 rounded-sm border border-white shadow-sm opacity-0 group-hover:opacity-100"
                style={{
                  left: h.includes('w') ? '-3px' : 'calc(100% - 5px)',
                  top: h.includes('n') ? '-3px' : 'calc(100% - 5px)'
                }}
              />
            ))}
          </div>
        )}
        {/* Info */}
        <div
          style={{ position: 'absolute', ...pos(info), transform: 'translate(-50%, -50%)', fontSize: Math.round((info.fontSize || 14) * fontScale), cursor: 'move' }}
          className="text-slate-900"
          onMouseDown={(e) => handleDragStart('info', e)}
        >
          {scanInfo}
        </div>
        {/* Logo */}
        {t.options?.logoVisible !== false && (
          <div style={{ position: 'absolute', ...box(logo) }} className="rounded overflow-hidden">
            {t.logoUrl && isValidHttpUrl(t.logoUrl) ? (
              <img src={t.logoUrl} alt="logo" className="w-full h-full object-contain" />
            ) : (
              <div className="w-full h-full bg-white flex items-center justify-center text-[12px] text-slate-900">LOGO</div>
            )}
          </div>
        )}
        {/* Obramowanie podglądu */}
        <div className="absolute inset-0 border border-slate-300 rounded pointer-events-none" />
      </div>
  );
}

export default LabelsManager;