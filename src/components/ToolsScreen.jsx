import React, { useState, useEffect } from 'react';
import api from '../api';
import BarcodeScanner from './BarcodeScanner';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';

function ToolsScreen() {
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTool, setEditingTool] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category: '',
    location: '',
    quantity: 1,
    status: 'dostępne',
    description: ''
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedTool, setSelectedTool] = useState(null);

  // Get unique categories and statuses for filters
  const categories = [...new Set((tools || []).map(tool => tool.category).filter(Boolean))];
  const statuses = [...new Set((tools || []).map(tool => tool.status).filter(Boolean))];

  // Filter tools based on search and filters
  const filteredTools = (tools || []).filter(tool => {
    const matchesSearch = !searchTerm || 
      tool.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tool.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tool.category?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = !selectedCategory || tool.category === selectedCategory;
    const matchesStatus = !selectedStatus || tool.status === selectedStatus;
    
    return matchesSearch && matchesCategory && matchesStatus;
  });

  useEffect(() => {
    fetchTools();
  }, []);

  const fetchTools = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/tools');
      setTools(response || []);
    } catch (error) {
      console.error('Error fetching tools:', error);
      setTools([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Nazwa jest wymagana';
    }
    
    if (!formData.category.trim()) {
      newErrors.category = 'Kategoria jest wymagana';
    }
    
    if (!formData.quantity || formData.quantity < 1) {
      newErrors.quantity = 'Ilość musi być większa od 0';
    }
    
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const newErrors = validateForm();
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      let dataToSubmit = { ...formData };
      
      // Generate SKU if not provided and not editing
      if (!editingTool && !dataToSubmit.sku) {
        const timestamp = Date.now().toString().slice(-6);
        const namePrefix = dataToSubmit.name.substring(0, 3).toUpperCase();
        dataToSubmit.sku = `${namePrefix}${timestamp}`;
      }

      if (editingTool) {
        await api.put(`/tools/${editingTool.id}`, dataToSubmit);
        setTools(prevTools => 
          prevTools.map(tool => 
            tool.id === editingTool.id ? { ...tool, ...dataToSubmit } : tool
          )
        );
      } else {
        const response = await api.post('/api/tools', dataToSubmit);
        setTools(prevTools => [...prevTools, response.data]);
      }

      handleCloseModal();
    } catch (error) {
      console.error('Error saving tool:', error);
      setErrors({ submit: 'Wystąpił błąd podczas zapisywania narzędzia' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (tool = null) => {
    setEditingTool(tool);
    setFormData(tool ? { ...tool } : {
      name: '',
      sku: '',
      category: '',
      location: '',
      quantity: 1,
      status: 'dostępne',
      description: ''
    });
    setErrors({});
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingTool(null);
    setFormData({
      name: '',
      sku: '',
      category: '',
      location: '',
      quantity: 1,
      status: 'dostępne',
      description: ''
    });
    setErrors({});
  };

  const handleDelete = async (toolId) => {
    if (!window.confirm('Czy na pewno chcesz usunąć to narzędzie?')) {
      return;
    }

    try {
      await api.delete(`/tools/${toolId}`);
      setTools(prevTools => prevTools.filter(tool => tool.id !== toolId));
    } catch (error) {
      console.error('Error deleting tool:', error);
      alert('Wystąpił błąd podczas usuwania narzędzia');
    }
  };

  const handleRowClick = (tool) => {
    setSelectedTool(tool);
    setShowDetailsModal(true);
  };

  const handleScanResult = (result) => {
    setFormData(prev => ({ ...prev, sku: result }));
    setShowBarcodeScanner(false);
  };

  const handleScanError = (error) => {
    console.error('Scan error:', error);
    setShowBarcodeScanner(false);
  };

  // Generate QR Code
  const generateQRCode = async (text, width = 400) => {
    try {
      return await QRCode.toDataURL(text, {
        width: width,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'H',
        quality: 1
      });
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

  // Download label function with improved quality
  const downloadLabel = async (tool) => {
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

  // QR Code Display Component
  const QRCodeDisplay = ({ text }) => {
    const [qrCodeUrl, setQrCodeUrl] = useState('');

    useEffect(() => {
      const generateQR = async () => {
        try {
          const url = await QRCode.toDataURL(text, {
            width: 300,
            margin: 1,
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            },
            errorCorrectionLevel: 'H',
            quality: 1
          });
          setQrCodeUrl(url);
        } catch (error) {
          console.error('Error generating QR code:', error);
        }
      };

      if (text) {
        generateQR();
      }
    }, [text]);

    if (!qrCodeUrl) return <div>Generowanie kodu QR...</div>;

    return (
      <img 
        src={qrCodeUrl} 
        alt="QR Code" 
        className="w-32 h-32 border border-slate-200 rounded"
        style={{ imageRendering: 'crisp-edges' }}
      />
    );
  };

  // Barcode Display Component
  const BarcodeDisplay = ({ text }) => {
    const [barcodeUrl, setBarcodeUrl] = useState('');

    useEffect(() => {
      const generateBC = () => {
        try {
          const canvas = document.createElement('canvas');
          JsBarcode(canvas, text, {
            format: 'CODE128',
            width: 4,
            height: 100,
            fontSize: 16,
            margin: 10,
            font: 'Arial',
            fontOptions: 'bold'
          });
          setBarcodeUrl(canvas.toDataURL('image/png', 1.0));
        } catch (error) {
          console.error('Error generating barcode:', error);
        }
      };

      if (text) {
        generateBC();
      }
    }, [text]);

    if (!barcodeUrl) return <div>Generowanie kodu kreskowego...</div>;

    return (
      <img 
        src={barcodeUrl} 
        alt="Barcode" 
        className="border border-slate-200 rounded"
        style={{ imageRendering: 'crisp-edges' }}
      />
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <span className="text-slate-500">Ładowanie...</span>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white min-h-screen">
      <style jsx>{`
        /* Optymalizacja renderowania tekstu dla lepszej ostrości */
        .sharp-text {
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: optimizeLegibility;
          font-feature-settings: "liga" 1, "kern" 1;
        }
        
        /* Optymalizacja obrazów dla lepszej jakości */
        .sharp-image {
          image-rendering: -webkit-optimize-contrast;
          image-rendering: crisp-edges;
          image-rendering: pixelated;
        }
        
        /* Poprawa kontrastu dla elementów drukowanych */
        .print-optimized {
          color: #000000 !important;
          background: #ffffff !important;
        }
        
        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          
          .sharp-text {
            font-weight: bolder !important;
            letter-spacing: 0.025em !important;
          }
        }
      `}</style>

      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 sharp-text">Zarządzanie narzędziami</h1>
          <p className="text-slate-600 sharp-text">Dodawaj, edytuj i śledź narzędzia w systemie</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors sharp-text"
        >
          Dodaj narzędzie
        </button>
      </div>

      {/* Search and Filter Section */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2 sharp-text">
              Wyszukaj narzędzie
            </label>
            <input
              type="text"
              placeholder="Nazwa, SKU, kategoria..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sharp-text"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2 sharp-text">
              Kategoria
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sharp-text"
            >
              <option value="">Wszystkie kategorie</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2 sharp-text">
              Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sharp-text"
            >
              <option value="">Wszystkie statusy</option>
              {statuses.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Tools List */}
      {loading ? (
        <div className="p-8 text-center">
          <div className="text-slate-400 text-6xl mb-4">🔧</div>
          <h3 className="text-lg font-medium text-slate-900 mb-2 sharp-text">Ładowanie narzędzi...</h3>
          <p className="text-slate-600 sharp-text">
            Proszę czekać...
          </p>
        </div>
      ) : filteredTools.length === 0 ? (
        <div className="p-8 text-center">
          <div className="text-slate-400 text-6xl mb-4">🔧</div>
          <h3 className="text-lg font-medium text-slate-900 mb-2 sharp-text">Brak narzędzi</h3>
          <p className="text-slate-600 sharp-text">
            {searchTerm || selectedCategory || selectedStatus 
              ? 'Nie znaleziono narzędzi spełniających kryteria wyszukiwania.'
              : 'Dodaj pierwsze narzędzie, aby rozpocząć zarządzanie.'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-lg shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left p-4 font-semibold text-slate-900 sharp-text">Nazwa</th>
                  <th className="text-left p-4 font-semibold text-slate-900 sharp-text">Kategoria</th>
                  <th className="text-left p-4 font-semibold text-slate-900 sharp-text">Status</th>
                  <th className="text-left p-4 font-semibold text-slate-900 sharp-text">Lokalizacja</th>
                  <th className="text-left p-4 font-semibold text-slate-900 sharp-text">SKU</th>
                  <th className="text-left p-4 font-semibold text-slate-900 sharp-text">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredTools.map((tool) => (
                  <tr 
                    key={tool.id} 
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => handleRowClick(tool)}
                  >
                    <td className="p-4">
                      <div className="font-medium text-slate-900 sharp-text">{tool.name}</div>
                      {tool.description && (
                        <div className="text-sm text-slate-500 sharp-text">{tool.description}</div>
                      )}
                    </td>
                    <td className="p-4 text-slate-600 sharp-text">{tool.category || '-'}</td>
                    <td className="p-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full sharp-text ${
                        tool.status === 'dostępne' ? 'bg-green-100 text-green-800' :
                        tool.status === 'wydane' ? 'bg-yellow-100 text-yellow-800' :
                        tool.status === 'serwis' ? 'bg-red-100 text-red-800' :
                        'bg-slate-100 text-slate-800'
                      }`}>
                        {tool.status || 'nieznany'}
                      </span>
                    </td>
                    <td className="p-4 text-slate-600 sharp-text">{tool.location || '-'}</td>
                    <td className="p-4 text-slate-600 font-mono text-sm sharp-text">{tool.sku || '-'}</td>
                    <td className="p-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleOpenModal(tool)}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium sharp-text"
                        >
                          Edytuj
                        </button>
                        <button
                          onClick={() => handleDelete(tool.id)}
                          className="text-red-600 hover:text-red-800 text-sm font-medium sharp-text"
                        >
                          Usuń
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden divide-y divide-slate-200">
            {filteredTools.map((tool) => (
              <div 
                key={tool.id} 
                className="p-4 cursor-pointer hover:bg-slate-50"
                onClick={() => handleRowClick(tool)}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="font-medium text-slate-900 sharp-text">{tool.name}</div>
                    {tool.description && (
                      <div className="text-sm text-slate-500 mt-1 sharp-text">{tool.description}</div>
                    )}
                  </div>
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full sharp-text ${
                    tool.status === 'dostępne' ? 'bg-green-100 text-green-800' :
                    tool.status === 'wydane' ? 'bg-yellow-100 text-yellow-800' :
                    tool.status === 'serwis' ? 'bg-red-100 text-red-800' :
                    'bg-slate-100 text-slate-800'
                  }`}>
                    {tool.status || 'nieznany'}
                  </span>
                </div>
                
                <div className="space-y-2 text-sm mb-4">
                  <div className="flex justify-between">
                    <span className="text-slate-500 sharp-text">Kategoria:</span>
                    <span className="text-slate-900 sharp-text">{tool.category || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 sharp-text">Lokalizacja:</span>
                    <span className="text-slate-900 sharp-text">{tool.location || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 sharp-text">SKU:</span>
                    <span className="text-slate-900 font-mono text-xs sharp-text">{tool.sku || '-'}</span>
                  </div>
                </div>
                
                <div className="flex gap-2 pt-2 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleOpenModal(tool)}
                    className="flex-1 bg-blue-50 text-blue-600 py-2 px-3 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium sharp-text"
                  >
                    Edytuj
                  </button>
                  <button
                    onClick={() => handleDelete(tool.id)}
                    className="flex-1 bg-red-50 text-red-600 py-2 px-3 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium sharp-text"
                  >
                    Usuń
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Barcode Scanner */}
      {showBarcodeScanner && (
        <BarcodeScanner
          onScanResult={handleScanResult}
          onError={handleScanError}
        />
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-slate-900 sharp-text">
                  {editingTool ? 'Edytuj narzędzie' : 'Dodaj narzędzie'}
                </h2>
                <button
                  onClick={handleCloseModal}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <span className="text-2xl">×</span>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* First row - Name and SKU */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1 sharp-text">
                      Nazwa *
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sharp-text ${
                        errors.name ? 'border-red-300' : 'border-slate-300'
                      }`}
                      placeholder="Nazwa narzędzia"
                    />
                    {errors.name && (
                      <p className="text-red-600 text-sm mt-1 sharp-text">{errors.name}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1 sharp-text">
                      SKU {!editingTool && <span className="text-slate-500 text-xs">(auto)</span>}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        name="sku"
                        value={formData.sku}
                        onChange={handleInputChange}
                        className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sharp-text ${
                          errors.sku ? 'border-red-300' : 'border-slate-300'
                        }`}
                        placeholder={editingTool ? "SKU narzędzia" : "SKU (opcjonalne)"}
                      />
                      <button
                        type="button"
                        onClick={() => setShowBarcodeScanner(true)}
                        className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                        title="Skanuj kod kreskowy/QR"
                      >
                        📷
                      </button>
                    </div>
                    {errors.sku && (
                      <p className="text-red-600 text-sm mt-1 sharp-text">{errors.sku}</p>
                    )}
                  </div>
                </div>

                {/* Second row - Category and Location */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1 sharp-text">
                      Kategoria *
                    </label>
                    <input
                      type="text"
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sharp-text ${
                        errors.category ? 'border-red-300' : 'border-slate-300'
                      }`}
                      placeholder="Kategoria narzędzia"
                    />
                    {errors.category && (
                      <p className="text-red-600 text-sm mt-1 sharp-text">{errors.category}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1 sharp-text">
                      Lokalizacja
                    </label>
                    <input
                      type="text"
                      name="location"
                      value={formData.location}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sharp-text"
                      placeholder="Lokalizacja narzędzia"
                    />
                  </div>
                </div>

                {/* Third row - Quantity and Status */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1 sharp-text">
                      Ilość *
                    </label>
                    <input
                      type="number"
                      name="quantity"
                      value={formData.quantity}
                      onChange={handleInputChange}
                      min="1"
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sharp-text ${
                        errors.quantity ? 'border-red-300' : 'border-slate-300'
                      }`}
                    />
                    {errors.quantity && (
                      <p className="text-red-600 text-sm mt-1 sharp-text">{errors.quantity}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1 sharp-text">
                      Status
                    </label>
                    <select
                      name="status"
                      value={formData.status}
                      onChange={handleInputChange}
                      disabled={!!editingTool}
                      className={`w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sharp-text ${
                        editingTool ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : ''
                      }`}
                    >
                      <option value="dostępne">Dostępne</option>
                      <option value="wydane">Wydane</option>
                      <option value="serwis">Serwis</option>
                    </select>
                  </div>
                </div>

                {/* Description - full width */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1 sharp-text">
                    Opis
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sharp-text"
                    placeholder="Opis narzędzia"
                  />
                </div>

                {errors.submit && (
                  <div className="text-red-600 text-sm sharp-text">{errors.submit}</div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="flex-1 px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors sharp-text"
                  >
                    Anuluj
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 sharp-text"
                  >
                    {isLoading ? 'Zapisywanie...' : (editingTool ? 'Zaktualizuj' : 'Dodaj')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Tool Details Modal */}
      {showDetailsModal && selectedTool && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-slate-900 sharp-text">
                  Szczegóły narzędzia: {selectedTool.name}
                </h2>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <span className="text-2xl">×</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Tool Information */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-3 sharp-text">Informacje o narzędziu</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500 sharp-text">Nazwa:</span>
                        <span className="text-slate-900 font-medium sharp-text">{selectedTool.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 sharp-text">SKU:</span>
                        <span className="text-slate-900 font-mono sharp-text">{selectedTool.sku}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 sharp-text">Kategoria:</span>
                        <span className="text-slate-900 sharp-text">{selectedTool.category || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 sharp-text">Lokalizacja:</span>
                        <span className="text-slate-900 sharp-text">{selectedTool.location || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 sharp-text">Status:</span>
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full sharp-text ${
                          selectedTool.status === 'dostępne' ? 'bg-green-100 text-green-800' :
                          selectedTool.status === 'wydane' ? 'bg-yellow-100 text-yellow-800' :
                          selectedTool.status === 'serwis' ? 'bg-red-100 text-red-800' :
                          'bg-slate-100 text-slate-800'
                        }`}>
                          {selectedTool.status || 'nieznany'}
                        </span>
                      </div>
                      {selectedTool.description && (
                        <div>
                          <span className="text-slate-500 sharp-text">Opis:</span>
                          <p className="text-slate-900 mt-1 sharp-text">{selectedTool.description}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-4">
                    <button
                      onClick={() => downloadLabel(selectedTool)}
                      className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 sharp-text"
                    >
                      Pobierz etykietę
                    </button>
                  </div>
                </div>

                {/* QR Code and Barcode */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-3 sharp-text">Kod QR</h3>
                    <div className="flex justify-center">
                      <QRCodeDisplay text={selectedTool.sku} />
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-3 sharp-text">Kod kreskowy</h3>
                    <div className="flex justify-center">
                      <BarcodeDisplay text={selectedTool.sku} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ToolsScreen;