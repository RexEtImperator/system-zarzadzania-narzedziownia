import React, { useState, useEffect } from 'react';
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
  onError 
}) => {
  const [hasPermission, setHasPermission] = useState(null);
  const [stopStream, setStopStream] = useState(false);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [scanningAnimation, setScanningAnimation] = useState(false);

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
            onError("Twoja przeglądarka nie obsługuje dostępu do kamery. Spróbuj użyć nowszej wersji przeglądarki lub innej przeglądarki (Chrome, Firefox, Safari).");
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
          onError("Funkcja dostępu do kamery nie jest dostępna w tej przeglądarce. Spróbuj użyć nowszej przeglądarki.");
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
    if (result) {
      console.log('Zeskanowano kod:', result.text);
      setIsScanning(false);
      setScanningAnimation(false);
      onScan(result.text);
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
        onError("Brak dostępu do kamery. Proszę zezwolić na dostęp do kamery w ustawieniach przeglądarki.");
      }
    } else if (error.name === "NotFoundError") {
      if (onError) {
        onError("Nie znaleziono kamery. Upewnij się, że urządzenie ma kamerę.");
      }
    } else if (error.name === "NotSupportedError") {
      if (onError) {
        onError("Przeglądarka nie obsługuje dostępu do kamery. Spróbuj użyć innej przeglądarki.");
      }
    } else if (error.name === "NotReadableError") {
      if (onError) {
        onError("Kamera jest używana przez inną aplikację. Zamknij inne aplikacje używające kamery.");
      }
    } else if (error.name === "OverconstrainedError") {
      if (onError) {
        onError("Nie można uruchomić kamery z wybranymi ustawieniami. Spróbuj ponownie.");
      }
    } else {
      if (onError) {
        onError(`Wystąpił błąd podczas uruchamiania kamery: ${error.message || 'Nieznany błąd'}`);
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
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-4 max-w-md w-full mx-4">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Skanuj kod kreskowy
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
              <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h4 className="text-lg font-semibold text-gray-900 mb-2">
              Przeglądarka nie obsługuje kamery
            </h4>
            <p className="text-gray-700 mb-4">
              Twoja przeglądarka nie obsługuje skanowania kodów. 
            </p>
            <div className="text-sm text-gray-600 mb-4">
              <p className="mb-2">Spróbuj:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Użyć nowszej wersji przeglądarki</li>
                <li>Przełączyć się na Chrome, Firefox lub Safari</li>
                <li>Sprawdzić czy używasz HTTPS (wymagane dla kamery)</li>
                <li>Wprowadzić kod ręcznie</li>
              </ul>
            </div>
            <button
              onClick={handleClose}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
            >
              Zamknij
            </button>
          </div>
        ) : hasPermission === false ? (
          <div className="text-center py-8">
            <div className="text-red-600 mb-4">
              <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
              </svg>
            </div>
            <p className="text-gray-700 mb-4">
              Brak dostępu do kamery. Proszę zezwolić na dostęp do kamery w ustawieniach przeglądarki.
            </p>
            <button
              onClick={handleClose}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded"
            >
              Zamknij
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
                delay={50} // Zwiększona czułość - zmniejszony delay z 100ms do 50ms
                constraints={{
                  video: {
                    facingMode: 'environment',
                    width: { ideal: 1920, min: 1280 }, // Wyższa rozdzielczość dla małych kodów
                    height: { ideal: 1080, min: 720 },
                    frameRate: { ideal: 30, min: 15 }, // Wyższa częstotliwość klatek
                    focusMode: 'continuous',
                    focusDistance: 'auto',
                    // Automatyczne dostosowanie jasności i kontrastu
                    brightness: { ideal: 0.7 },
                    contrast: { ideal: 1.2 },
                    saturation: { ideal: 1.1 },
                    sharpness: { ideal: 1.3 }, // Zwiększona ostrość dla małych kodów
                    // Zaawansowane ustawienia ostrości dla małych kodów
                    advanced: [
                      { focusMode: 'continuous' },
                      { focusDistance: 0.1 }, // Bliższa ostrość dla małych naklejek
                      { torch: torchEnabled },
                      { zoom: 1.2 }, // Lekkie przybliżenie dla lepszej czytelności
                      { exposureMode: 'continuous' },
                      { exposureCompensation: 0.3 }, // Lekkie prześwietlenie
                      { whiteBalanceMode: 'continuous' },
                      { iso: { min: 100, max: 800 } } // Kontrola ISO dla lepszej jakości
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
                        <span>Skanowanie...</span>
                      </div>
                    ) : (
                      <span>Gotowy do skanowania</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center">
              <button
                onClick={toggleTorch}
                className="flex items-center space-x-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                <span>{torchEnabled ? 'Wyłącz' : 'Włącz'} latarkę</span>
              </button>

              <button
                onClick={handleClose}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded"
              >
                Anuluj
              </button>
            </div>

            <div className="mt-4 text-sm text-gray-600 text-center">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                <div className="flex items-center justify-center mb-2">
                  <svg className="w-5 h-5 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="font-medium text-blue-700">Wskazówki skanowania</span>
                </div>
                <ul className="text-xs text-blue-600 space-y-1">
                  <li>• Trzymaj telefon stabilnie nad kodem</li>
                  <li>• Upewnij się, że kod jest dobrze oświetlony</li>
                  <li>• Kod powinien wypełniać ramkę skanowania</li>
                  <li>• Poczekaj na automatyczne rozpoznanie</li>
                </ul>
              </div>
              
              {/* Dodatkowe wskazówki dla naklejek z drukarki etykiet */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3">
                <div className="flex items-center justify-center mb-2">
                  <svg className="w-5 h-5 text-yellow-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  <span className="font-medium text-yellow-700">Naklejki z drukarki etykiet</span>
                </div>
                <ul className="text-xs text-yellow-700 space-y-1">
                  <li>• Unikaj odbić światła - nachyl telefon lekko</li>
                  <li>• Trzymaj telefon bliżej (5-10 cm od naklejki)</li>
                  <li>• Włącz latarkę dla lepszego kontrastu</li>
                  <li>• Poczekaj 2-3 sekundy na rozpoznanie</li>
                  <li>• Sprawdź czy naklejka nie jest uszkodzona</li>
                </ul>
              </div>
              
              <p>Skieruj kamerę na kod kreskowy lub kod QR</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BarcodeScannerComponent;