import { useState } from 'react';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';

// Komponent zarządzania etykietami
function LabelsManager({ tools, user }) {
  const [selectedTools, setSelectedTools] = useState([]);

  // Funkcja zaznaczania/odznaczania wszystkich narzędzi
  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedTools(tools.map(tool => tool.id));
    } else {
      setSelectedTools([]);
    }
  };

  // Sprawdź czy wszystkie narzędzia są zaznaczone
  const isAllSelected = tools.length > 0 && selectedTools.length === tools.length;
  const isIndeterminate = selectedTools.length > 0 && selectedTools.length < tools.length;

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

  // Download label function for a single tool
  const downloadSingleLabel = async (tool) => {
    try {
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
      const qrCodeUrl = await generateQRCode(tool.sku, 400);
      if (qrCodeUrl) {
        const qrImg = new Image();
        qrImg.onload = () => {
          ctx.drawImage(qrImg, 20 * scale, 90 * scale, 160 * scale, 160 * scale);
          
          // Generate and draw barcode
          const barcodeUrl = generateBarcode(tool.sku);
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
              link.download = `etykieta-${tool.sku}.png`;
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

    const selectedToolsData = tools.filter(tool => selectedTools.includes(tool.id));
    
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
        {tools.length > 0 && (
          <div className="mb-4 pb-4 border-b border-slate-200 dark:border-slate-700">
            <label className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
              <input
                type="checkbox"
                checked={isAllSelected}
                ref={(el) => {
                  if (el) el.indeterminate = isIndeterminate;
                }}
                onChange={(e) => handleSelectAll(e.target.checked)}
                className="w-4 h-4 text-blue-600 dark:text-blue-400"
              />
              <div className="flex-1">
                <p className="font-medium text-slate-900 dark:text-slate-100">
                  {isAllSelected ? 'Odznacz wszystkie' : 'Zaznacz wszystkie'}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {selectedTools.length} z {tools.length} narzędzi zaznaczonych
                </p>
              </div>
            </label>
          </div>
        )}
        
        <div className="space-y-4">
          {tools.map(tool => (
            <div key={tool.id} className="flex items-center gap-3 p-3 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
              <input
                type="checkbox"
                checked={selectedTools.includes(tool.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedTools([...selectedTools, tool.id]);
                  } else {
                    setSelectedTools(selectedTools.filter(id => id !== tool.id));
                  }
                }}
                className="w-4 h-4 text-blue-600 dark:text-blue-400"
              />
              <div className="flex-1">
                <p className="font-medium text-slate-900 dark:text-slate-100">{tool.name}</p>
                <p className="text-sm text-slate-600 dark:text-slate-400">SKU: {tool.sku}</p>
                {tool.category && (
                  <p className="text-sm text-slate-500 dark:text-slate-500">Kategoria: {tool.category}</p>
                )}
              </div>
            </div>
          ))}
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

        {tools.length === 0 && (
          <div className="text-center py-8">
            <p className="text-slate-500 dark:text-slate-400">Brak narzędzi do wyświetlenia</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default LabelsManager;