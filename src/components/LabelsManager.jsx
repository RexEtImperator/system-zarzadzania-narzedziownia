import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import api from '../api';
import { PERMISSIONS, hasPermission } from '../constants';

// Komponent zarządzania etykietami
function LabelsManager({ tools = [], user }) {
  const [selectedTools, setSelectedTools] = useState([]);
  const [toolsData, setToolsData] = useState(Array.isArray(tools) ? tools : []);
  const [toolsCodePrefix, setToolsCodePrefix] = useState('');
  const [toolCategoryPrefixes, setToolCategoryPrefixes] = useState({});
  const [expandedIds, setExpandedIds] = useState([]);
  const [previews, setPreviews] = useState({}); // { [id]: { qr: string|null, barcode: string|null } }
  const [selectedSizes, setSelectedSizes] = useState({}); // { [id]: '70x40' | '51x32' | '110x60' }

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
      // tytuł
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      ctx.font = `${Math.max(12, Math.floor(h * 0.14))}px Arial`;
      ctx.fillText(tool.name, w / 2, Math.floor(h * 0.16));
      // QR rozmiar
      const qrSize = Math.min(Math.floor(w * 0.6), Math.floor(h * 0.62));
      const qrUrl = await generateQRCode(codeText, qrSize);
      if (qrUrl) {
        const img = new Image();
        img.onload = () => {
          const x = Math.floor((w - qrSize) / 2);
          const y = Math.floor(h * 0.2);
          ctx.drawImage(img, x, y, qrSize, qrSize);
          ctx.font = `${Math.max(10, Math.floor(h * 0.12))}px Arial`;
          ctx.fillText(codeText, w / 2, Math.floor(h * 0.92));
          const link = document.createElement('a');
          link.download = `etykieta-qr-${codeText}-${sizeKey}.png`;
          link.href = canvas.toDataURL('image/png', 1.0);
          link.click();
        };
        img.src = qrUrl;
      }
    } catch (error) {
      console.error('Błąd generowania etykiety QR:', error);
      alert('Wystąpił błąd podczas generowania etykiety QR');
    }
  };

  // Pobieranie etykiety kodu kreskowego w wybranym rozmiarze
  const downloadBarcodeLabelSized = async (tool, sizeKey) => {
    try {
      const { w, h } = LABEL_SIZES[sizeKey] || LABEL_SIZES['70x40'];
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
      // nagłówek
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      ctx.font = `${Math.max(12, Math.floor(h * 0.14))}px Arial`;
      ctx.fillText(tool.name, w / 2, Math.floor(h * 0.16));
      // przygotuj kod kreskowy jako osobny canvas
      const barcodeCanvas = document.createElement('canvas');
      // Dobór grubości kreski w zależności od szerokości etykiety
      const barWidth = w >= 1000 ? 3 : w >= 800 ? 3 : w >= 600 ? 2 : 2;
      const barHeight = Math.floor(h * 0.5);
      JsBarcode(barcodeCanvas, codeText, {
        format: 'CODE128',
        width: barWidth,
        height: barHeight,
        fontSize: Math.max(10, Math.floor(h * 0.12)),
        margin: 10,
        font: 'Arial',
        fontOptions: 'bold'
      });
      const img = new Image();
      img.onload = () => {
        const targetW = Math.min(w - 20, barcodeCanvas.width);
        const x = Math.floor((w - targetW) / 2);
        const y = Math.floor(h * 0.22);
        ctx.drawImage(img, x, y, targetW, barHeight + 40);
        const link = document.createElement('a');
        link.download = `etykieta-barcode-${codeText}-${sizeKey}.png`;
        link.href = canvas.toDataURL('image/png', 1.0);
        link.click();
      };
      img.src = barcodeCanvas.toDataURL('image/png', 1.0);
    } catch (error) {
      console.error('Błąd generowania etykiety kreskowej:', error);
      alert('Wystąpił błąd podczas generowania etykiety kreskowej');
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
      
      // Tool name (larger font)
      ctx.fillStyle = '#000000';
      ctx.font = `bold ${26 * scale}px Arial`;
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.1)';
      ctx.shadowBlur = 2;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;
      ctx.fillText(tool.name, canvas.width / 2, 40 * scale);
      
      // SKU (larger font)
      ctx.font = `${18 * scale}px Arial`;
      ctx.shadowColor = 'transparent';
      ctx.fillText(`SKU: ${tool.sku}`, canvas.width / 2, 70 * scale);
      
      // Generate and draw QR code
      const qrCodeUrl = await generateQRCode(codeText, 400);
      if (qrCodeUrl) {
        const qrImg = new Image();
        qrImg.onload = () => {
          ctx.drawImage(qrImg, 20 * scale, 90 * scale, 160 * scale, 160 * scale);
          
          // Generate and draw barcode
          const barcodeUrl = generateBarcode(codeText);
          if (barcodeUrl) {
            const barcodeImg = new Image();
            barcodeImg.onload = () => {
              ctx.drawImage(barcodeImg, 200 * scale, 90 * scale, 200 * scale, 100 * scale);
              
              // Add informational text
              ctx.font = `${14 * scale}px Arial`;
              ctx.textAlign = 'center';
              ctx.fillText('Zeskanuj kod aby sprawdzić status', canvas.width / 2, 280 * scale);
              
              // Download the image
              const link = document.createElement('a');
              link.download = `etykieta-${codeText}.png`;
              link.href = canvas.toDataURL('image/png', 1.0);
              link.click();
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

  return (
    <div className="p-4 lg:p-8 bg-slate-50 dark:bg-slate-900 min-h-screen">
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-2">Etykiety</h1>
        <p className="text-slate-600 dark:text-slate-400">Generuj i drukuj etykiety dla narzędzi</p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-4">Generator etykiet</h3>
        <p className="text-slate-600 dark:text-slate-400 mb-6">Wybierz narzędzia, dla których chcesz wygenerować etykiety.</p>
        
        {/* Checkbox "Zaznacz wszystkie" */}
        {toolsData.length > 0 && (
          <div className="mb-4 pb-4 border-b border-slate-200 dark:border-slate-700">
            <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700/60 transition-colors">
              <input
                type="checkbox"
                checked={isAllSelected}
                ref={(el) => {
                  if (el) el.indeterminate = isIndeterminate;
                }}
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
          </div>
        )}
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {toolsData.map(tool => {
          const isSelected = selectedTools.includes(tool.id);
          const toggleSelect = (id, checked = null) => {
            setSelectedTools(prev => {
              const currentlySelected = prev.includes(id);
              const shouldSelect = checked !== null ? checked : !currentlySelected;
              if (shouldSelect) return [...prev, id];
              return prev.filter(x => x !== id);
            });
          };
          return (
            <div
              key={tool.id}
              onClick={() => toggleSelect(tool.id)}
              className={`cursor-pointer rounded-xl border p-4 transition-shadow shadow-sm 
                ${isSelected 
                  ? 'border-blue-500 dark:border-blue-600 ring-2 ring-blue-200 dark:ring-blue-500/40 bg-blue-50/50 dark:bg-blue-900/25' 
                  : 'border-slate-200 dark:border-slate-700 hover:shadow-md hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
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
      </div>

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
  );
}

export default LabelsManager;