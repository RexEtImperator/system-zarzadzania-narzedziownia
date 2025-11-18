import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { ShieldExclamationIcon, LockClosedIcon, LightBulbIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import BarcodeScanner from 'react-qr-barcode-scanner';

// Dodaj polyfill dla getSupportedConstraints natychmiast po załadowaniu modułu
if (typeof navigator !== 'undefined' && navigator.mediaDevices && !navigator.mediaDevices.getSupportedConstraints) {
  console.warn('getSupportedConstraints nie jest dostępne, dodaję polyfill');
  navigator.mediaDevices.getSupportedConstraints = function() {
    return {
      width: true,
      height: true,
      aspectRatio: true,
      frameRate: true,
      facingMode: true,
      resizeMode: true,
      deviceId: true,
      groupId: true,
      torch: true,
      zoom: true
    };
  };
}

const BarcodeScannerComponent = ({ 
  isOpen, 
  onClose, 
  onScan, 
  onError,
  displayQuantity
}) => {
  const { t } = useLanguage();
  const [hasPermission, setHasPermission] = useState(null);
  const [stopStream, setStopStream] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [scanningAnimation, setScanningAnimation] = useState(false);
  const [lastScannedCode, setLastScannedCode] = useState('');
  const [lastScanTime, setLastScanTime] = useState(0);
  const [scanLocked, setScanLocked] = useState(false);

  // Sprawdź kompatybilność przeglądarki
  useEffect(() => {
    const checkBrowserSupport = () => {
      // Dodaj polyfill dla getUserMedia jeśli nie istnieje
      if (!navigator.mediaDevices) {
        console.warn('navigator.mediaDevices nie jest dostępne, dodaję polyfill');
        
        // Polyfill dla starszych przeglądarek
        navigator.mediaDevices = {};
        
        // Sprawdź czy istnieją starsze API
        if (navigator.getUserMedia) {
          navigator.mediaDevices.getUserMedia = function(constraints) {
            return new Promise(function(resolve, reject) {
              navigator.getUserMedia.call(navigator, constraints, resolve, reject);
            });
          };
        } else if (navigator.webkitGetUserMedia) {
          navigator.mediaDevices.getUserMedia = function(constraints) {
            return new Promise(function(resolve, reject) {
              navigator.webkitGetUserMedia.call(navigator, constraints, resolve, reject);
            });
          };
        } else if (navigator.mozGetUserMedia) {
          navigator.mediaDevices.getUserMedia = function(constraints) {
            return new Promise(function(resolve, reject) {
              navigator.mozGetUserMedia.call(navigator, constraints, resolve, reject);
            });
          };
        } else if (navigator.msGetUserMedia) {
          navigator.mediaDevices.getUserMedia = function(constraints) {
            return new Promise(function(resolve, reject) {
              navigator.msGetUserMedia.call(navigator, constraints, resolve, reject);
            });
          };
        } else {
          console.error('getUserMedia nie jest dostępne w tej przeglądarce');
          setIsSupported(false);
          if (onError) {
            onError(t('scanner.browserNotSupported.message'));
          }
          return false;
        }
        
        // Dodaj getSupportedConstraints do nowo utworzonego mediaDevices
        if (!navigator.mediaDevices.getSupportedConstraints) {
          navigator.mediaDevices.getSupportedConstraints = function() {
            return {
              width: true,
              height: true,
              aspectRatio: true,
              frameRate: true,
              facingMode: true,
              resizeMode: true,
              deviceId: true,
              groupId: true,
              torch: true,
              zoom: true
            };
          };
        }
      }

      // Sprawdź czy getUserMedia jest dostępne po dodaniu polyfill
      if (!navigator.mediaDevices.getUserMedia) {
        console.error('getUserMedia nie jest dostępne');
        setIsSupported(false);
        if (onError) {
          onError(t('scanner.browserNotSupported.message'));
        }
        return false;
      }

      return true;
    };

    if (isOpen) {
      const supported = checkBrowserSupport();
      setIsSupported(supported);
    }
  }, [isOpen, onError]);

  useEffect(() => {
    if (isOpen) {
      setStopStream(false);
      setIsScanning(true);
      setScanningAnimation(true);
      // Włącz latarkę po 2 sekundach jeśli jest dostępna
      setTimeout(() => {
        setTorchEnabled(true);
      }, 2000);
    } else {
      setIsScanning(false);
      setScanningAnimation(false);
    }
  }, [isOpen]);

  const handleScan = (err, result) => {
    if (result && result.text) {
      const now = Date.now();
      // Ignoruj duplikaty tego samego kodu przez 2s lub gdy blokada aktywna
      if (scanLocked || (lastScannedCode === result.text && (now - lastScanTime) < 2000)) {
        return;
      }
      setLastScannedCode(result.text);
      setLastScanTime(now);
      console.log('Zeskanowano kod:', result.text);
      setIsScanning(false);
      setScanningAnimation(false);
      setScanLocked(true);
      setStopStream(true);
      try {
        onScan(result.text);
      } finally {
        // Zamknij modal po krótkiej chwili, aby uniknąć wielokrotnych wywołań
        setTimeout(() => {
          setScanLocked(false);
          // Zamknij jeśli nadal otwarty
          try { onClose(); } catch (_) {}
        }, 250);
      }
    } else if (err) {
      console.error('Błąd skanowania:', err);
    }
  };

  const handleError = (error) => {
    console.error('Błąd kamery:', error);
    
    // Różne typy błędów i ich obsługa
    if (error.name === "NotAllowedError") {
      setHasPermission(false);
      if (onError) {
        onError(t('scanner.errors.permissionDenied'));
      }
    } else if (error.name === "NotFoundError") {
      if (onError) {
        onError(t('scanner.errors.notFound'));
      }
    } else if (error.name === "NotSupportedError") {
      if (onError) {
        onError(t('scanner.errors.notSupported'));
      }
    } else if (error.name === "NotReadableError") {
      if (onError) {
        onError(t('scanner.errors.notReadable'));
      }
    } else if (error.name === "OverconstrainedError") {
      if (onError) {
        onError(t('scanner.errors.overconstrained'));
      }
    } else {
      if (onError) {
        onError(t('scanner.errors.generic', { message: error.message || 'Unknown error' }));
      }
    }
  };

  const handleClose = () => {
    // Zatrzymaj strumień przed zamknięciem (workaround dla błędu zamrażania przeglądarki)
    setStopStream(true);
    setTorchEnabled(false);
    setTimeout(() => {
      onClose();
    }, 100);
  };

  const toggleTorch = () => {
    setTorchEnabled(!torchEnabled);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className="bg-white rounded-lg p-4 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {t('scanner.title')}
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {!isSupported ? (
          <div className="text-center py-8">
            <div className="text-red-600 mb-4">
              <ShieldExclamationIcon className="w-16 h-16 mx-auto mb-4" aria-hidden="true" />
            </div>
            <h4 className="text-lg font-semibold text-gray-900 mb-2">
              {t('scanner.browserNotSupported.title')}
            </h4>
            <p className="text-gray-700 mb-4">
              {t('scanner.browserNotSupported.message')}
            </p>
            <div className="text-sm text-gray-600 mb-4">
              <p className="mb-2">{t('scanner.browserNotSupported.tipsTitle')}</p>
              <ul className="list-disc list-inside space-y-1">
                <li>{t('scanner.browserNotSupported.tips.useNewer')}</li>
                <li>{t('scanner.browserNotSupported.tips.switchBrowser')}</li>
                <li>{t('scanner.browserNotSupported.tips.useHttps')}</li>
                <li>{t('scanner.browserNotSupported.tips.enterManually')}</li>
              </ul>
            </div>
            <button
              onClick={handleClose}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
            >
              {t('scanner.close')}
            </button>
          </div>
        ) : hasPermission === false ? (
          <div className="text-center py-8">
            <div className="text-red-600 mb-4">
              <LockClosedIcon className="w-16 h-16 mx-auto mb-4" aria-hidden="true" />
            </div>
            <p className="text-gray-700 mb-4">
              {t('scanner.permissionDenied')}
            </p>
            <button
              onClick={handleClose}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
            >
              {t('scanner.close')}
            </button>
          </div>
        ) : (
          <div>
            <div className="relative bg-black rounded-lg overflow-hidden mb-4" style={{ height: '300px' }}>
              <BarcodeScanner
                width="100%"
                height="100%"
                onUpdate={handleScan}
                onError={handleError}
                facingMode="environment" // Tylna kamera
                torch={torchEnabled}
                stopStream={stopStream}
                formats={[
                  'code_128',
                  'code_39',
                  'ean_13',
                  'ean_8',
                  'upc_a',
                  'upc_e',
                  'qr_code',
                  'data_matrix',
                  'aztec',
                  'pdf_417'
                ]}
                delay={300}
                constraints={{
                  video: {
                    facingMode: 'environment',
                    width: { ideal: 1920, min: 1280 },
                    height: { ideal: 1080, min: 720 },
                    frameRate: { ideal: 30, min: 15 },
                    focusMode: 'continuous',
                    focusDistance: 'auto',
                    advanced: [
                      { focusMode: 'continuous' },
                      { focusDistance: 0.1 },
                      { torch: torchEnabled },
                      { zoom: 1.2 },
                      { exposureMode: 'continuous' },
                      { exposureCompensation: 0.3 },
                      { whiteBalanceMode: 'continuous' },
                      { iso: { min: 100, max: 800 } }
                    ]
                  }
                }}
              />
              
              {/* Nakładka z ramką skanowania */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="border-2 border-white border-dashed rounded-lg relative" 
                     style={{ width: '250px', height: '150px' }}>
                  <div className="w-full h-full border-2 border-transparent relative">
                    {/* Rogi ramki */}
                    <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-green-400"></div>
                    <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-green-400"></div>
                    <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-green-400"></div>
                    <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-green-400"></div>
                    
                    {/* Animowana linia skanowania */}
                    {scanningAnimation && (
                      <div 
                        className="absolute left-0 right-0 h-0.5 bg-green-400 shadow-lg"
                        style={{
                          animation: 'scan 2s linear infinite',
                          boxShadow: '0 0 10px #4ade80'
                        }}
                      />
                    )}
                  </div>
                  
                  {/* Status skanowania */}
                  <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-white text-sm font-medium">
                    {isScanning ? (
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                        <span>{t('scanner.overlay.scanning')}</span>
                      </div>
                    ) : (
                      <span>{t('scanner.overlay.ready')}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Ostatnio zeskanowany kod */}
            {lastScannedCode && (
              <div className="mb-3 text-center text-sm text-gray-700">
                {t('scanner.lastCode')}: <span className="font-mono">{lastScannedCode}</span>
                {typeof displayQuantity !== 'undefined' && displayQuantity !== null && (
                  <span className="ml-2">| {t('scanner.quantity')}: <span className="font-semibold">{displayQuantity}</span></span>
                )}
              </div>
            )}

            <div className="flex justify-between items-center">
              <button
                onClick={toggleTorch}
                className="flex items-center space-x-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded"
              >
                <LightBulbIcon className="w-5 h-5" aria-hidden="true" />
                <span>{torchEnabled ? t('scanner.torch.off') : t('scanner.torch.on')}</span>
              </button>

              <button
                onClick={handleClose}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
              >
                {t('scanner.buttons.cancel')}
              </button>
            </div>

            <div className="mt-4 text-sm text-gray-600 text-center">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                <div className="flex items-center justify-center mb-2">
                  <InformationCircleIcon className="w-5 h-5 text-blue-500 mr-2" aria-hidden="true" />
                  <span className="font-medium text-blue-700">{t('scanner.tips.title')}</span>
                </div>
                <ul className="text-xs text-blue-600 space-y-1">
                  <li>• {t('scanner.tips.holdSteady')}</li>
                  <li>• {t('scanner.tips.wellLit')}</li>
                  <li>• {t('scanner.tips.fillFrame')}</li>
                  <li>• {t('scanner.tips.waitRecognition')}</li>
                </ul>
              </div>
              
              {/* Dodatkowe wskazówki dla naklejek z drukarki etykiet */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3">
                <div className="flex items-center justify-center mb-2">
                  <LightBulbIcon className="w-5 h-5 text-yellow-600 mr-2" aria-hidden="true" />
                  <span className="font-medium text-yellow-700">{t('scanner.tips.labels.title')}</span>
                </div>
                <ul className="text-xs text-yellow-700 space-y-1">
                  <li>• {t('scanner.tips.labels.avoidGlare')}</li>
                  <li>• {t('scanner.tips.labels.closerDistance')}</li>
                  <li>• {t('scanner.tips.labels.useTorch')}</li>
                  <li>• {t('scanner.tips.labels.waitSeconds')}</li>
                  <li>• {t('scanner.tips.labels.checkSticker')}</li>
                </ul>
              </div>
              
              <p>{t('scanner.tips.finalInstruction')}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BarcodeScannerComponent;