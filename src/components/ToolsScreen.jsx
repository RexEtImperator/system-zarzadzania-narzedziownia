import React, { useState } from 'react';
import api from '../api';
import { toast } from 'react-toastify';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';

function ToolsScreen({ tools, setTools, employees, user }) {
  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [editingTool, setEditingTool] = useState(null);
  const [selectedTool, setSelectedTool] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    category: '',
    description: '',
    location: '',
    quantity: 1,
    status: 'dostępne'
  });
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const filteredTools = tools.filter(tool => {
    const matchesSearch = tool.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         tool.sku?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !filterCategory || tool.category === filterCategory;
    const matchesStatus = !filterStatus || tool.status === filterStatus;
    
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const categories = [...new Set(tools.map(tool => tool.category).filter(Boolean))];
  const statuses = [...new Set(tools.map(tool => tool.status).filter(Boolean))];

  const handleOpenModal = (tool = null) => {
    setEditingTool(tool);
    if (tool) {
      setFormData({
        name: tool.name || '',
        sku: tool.sku || '',
        category: tool.category || '',
        description: tool.description || '',
        location: tool.location || '',
        quantity: tool.quantity || 1,
        status: tool.status || 'dostępne'
      });
    } else {
      setFormData({
        name: '',
        sku: '',
        category: '',
        description: '',
        location: '',
        quantity: 1,
        status: 'dostępne'
      });
    }
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
      description: '',
      location: '',
      quantity: 1,
      status: 'dostępne'
    });
    setErrors({});
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Nazwa jest wymagana';
    }
    
    // SKU is only required for editing existing tools
    if (editingTool && !formData.sku.trim()) {
      newErrors.sku = 'SKU jest wymagane';
    }
    
    if (!formData.category.trim()) {
      newErrors.category = 'Kategoria jest wymagana';
    }
    
    if (formData.quantity < 1) {
      newErrors.quantity = 'Ilość musi być większa od 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const generateSKU = () => {
    const timestamp = Date.now().toString().slice(-6);
    const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `SKU${timestamp}${randomNum}`;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);
    
    try {
      let dataToSubmit = { ...formData };
      
      // Generate SKU automatically for new tools if not provided
      if (!editingTool && (!formData.sku || formData.sku.trim() === '')) {
        dataToSubmit.sku = generateSKU();
      }
      
      if (editingTool) {
        // Update existing tool
        const updatedTool = await api.put(`/api/tools/${editingTool.id}`, dataToSubmit);
        setTools(prevTools => 
          prevTools.map(tool => 
            tool.id === editingTool.id ? { ...tool, ...dataToSubmit } : tool
          )
        );
        toast.success('Narzędzie zostało zaktualizowane');
      } else {
        // Create new tool
        const newTool = await api.post('/api/tools', dataToSubmit);
        setTools(prevTools => [...prevTools, newTool]);
        toast.success('Narzędzie zostało dodane');
      }
      
      handleCloseModal();
    } catch (error) {
      console.error('Error saving tool:', error);
      toast.error(editingTool ? 'Błąd podczas aktualizacji narzędzia' : 'Błąd podczas dodawania narzędzia');
      setErrors({ submit: error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (toolId) => {
    if (window.confirm('Czy na pewno chcesz usunąć to narzędzie?')) {
      try {
        await api.delete(`/api/tools/${toolId}`);
        setTools(tools.filter(t => t.id !== toolId));
        toast.success('Narzędzie zostało usunięte');
      } catch (error) {
        console.error('Error deleting tool:', error);
        toast.error('Błąd podczas usuwania narzędzia');
      }
    }
  };

  const handleRowClick = (tool) => {
    setSelectedTool(tool);
    setShowDetailsModal(true);
  };

  const generateQRCode = async (text) => {
    try {
      return await QRCode.toDataURL(text, {
        width: 200,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
    } catch (error) {
      console.error('Error generating QR code:', error);
      return null;
    }
  };

  const generateBarcode = (sku) => {
    try {
      const canvas = document.createElement('canvas');
      JsBarcode(canvas, sku, {
        format: "CODE128",
        width: 2,
        height: 100,
        displayValue: true
      });
      return canvas.toDataURL();
    } catch (error) {
      console.error('Error generating barcode:', error);
      return null;
    }
  };

  const downloadLabel = async (tool) => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Set canvas size
      canvas.width = 400;
      canvas.height = 300;
      
      // White background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Tool name
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 18px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(tool.name, canvas.width / 2, 30);
      
      // SKU
      ctx.font = '14px Arial';
      ctx.fillText(`SKU: ${tool.sku}`, canvas.width / 2, 55);
      
      // Generate and draw QR code
      const qrCodeUrl = await generateQRCode(tool.sku);
      if (qrCodeUrl) {
        const qrImg = new Image();
        qrImg.onload = () => {
          ctx.drawImage(qrImg, 50, 80, 120, 120);
          
          // Generate and draw barcode
          const barcodeUrl = generateBarcode(tool.sku);
          if (barcodeUrl) {
            const barcodeImg = new Image();
            barcodeImg.onload = () => {
              ctx.drawImage(barcodeImg, 200, 120, 150, 80);
              
              // Download the label
              const link = document.createElement('a');
              link.download = `etykieta_${tool.name.replace(/\s+/g, '_')}_${tool.sku}.png`;
              link.href = canvas.toDataURL();
              link.click();
            };
            barcodeImg.src = barcodeUrl;
          }
        };
        qrImg.src = qrCodeUrl;
      }
    } catch (error) {
      console.error('Error generating label:', error);
      toast.error('Błąd podczas generowania etykiety');
    }
  };

  // QR Code Component
  function QRCodeDisplay({ sku }) {
    const [qrCodeUrl, setQrCodeUrl] = useState('');
  
    React.useEffect(() => {
      const generateQR = async () => {
        try {
          const url = await QRCode.toDataURL(sku, {
            width: 150,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            }
          });
          setQrCodeUrl(url);
        } catch (error) {
          console.error('Error generating QR code:', error);
        }
      };
  
      if (sku) {
        generateQR();
      }
    }, [sku]);
  
    return qrCodeUrl ? (
      <img src={qrCodeUrl} alt="QR Code" className="border border-slate-200 rounded" />
    ) : (
      <div className="w-[150px] h-[150px] bg-slate-100 border border-slate-200 rounded flex items-center justify-center">
        <span className="text-slate-500">Ładowanie...</span>
      </div>
    );
  }
  
  // Barcode Component
  function BarcodeDisplay({ sku }) {
    const [barcodeUrl, setBarcodeUrl] = useState('');
  
    React.useEffect(() => {
      const generateBarcode = () => {
        try {
          const canvas = document.createElement('canvas');
          JsBarcode(canvas, sku, {
            format: "CODE128",
            width: 2,
            height: 80,
            displayValue: true,
            fontSize: 14,
            margin: 10
          });
          setBarcodeUrl(canvas.toDataURL());
        } catch (error) {
          console.error('Error generating barcode:', error);
        }
      };
  
      if (sku) {
        generateBarcode();
      }
    }, [sku]);
  
    return barcodeUrl ? (
      <img src={barcodeUrl} alt="Barcode" className="border border-slate-200 rounded" />
    ) : (
      <div className="w-[200px] h-[100px] bg-slate-100 border border-slate-200 rounded flex items-center justify-center">
        <span className="text-slate-500">Ładowanie...</span>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Zarządzanie narzędziami</h1>
          <p className="text-slate-600">Dodawaj, edytuj i zarządzaj narzędziami</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <span className="text-lg">+</span>
          Dodaj narzędzie
        </button>
      </div>

      {/* Filtry */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Szukaj
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Nazwa lub SKU..."
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Kategoria
            </label>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Wszystkie kategorie</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Status
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Wszystkie statusy</option>
              {statuses.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Lista narzędzi */}
      <div className="bg-white rounded-lg shadow-sm border border-slate-200">
        {filteredTools.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-slate-400 text-6xl mb-4">🔧</div>
            <h3 className="text-lg font-medium text-slate-900 mb-2">Brak narzędzi</h3>
            <p className="text-slate-600">
              {tools.length === 0 
                ? "Nie dodano jeszcze żadnych narzędzi."
                : "Nie znaleziono narzędzi spełniających kryteria wyszukiwania."
              }
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left p-4 font-semibold text-slate-900">Nazwa</th>
                    <th className="text-left p-4 font-semibold text-slate-900">Kategoria</th>
                    <th className="text-left p-4 font-semibold text-slate-900">Status</th>
                    <th className="text-left p-4 font-semibold text-slate-900">Lokalizacja</th>
                    <th className="text-left p-4 font-semibold text-slate-900">SKU</th>
                    <th className="text-left p-4 font-semibold text-slate-900">Akcje</th>
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
                        <div className="font-medium text-slate-900">{tool.name}</div>
                        {tool.description && (
                          <div className="text-sm text-slate-500">{tool.description}</div>
                        )}
                      </td>
                      <td className="p-4 text-slate-600">{tool.category || '-'}</td>
                      <td className="p-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          tool.status === 'dostępne' ? 'bg-green-100 text-green-800' :
                          tool.status === 'wydane' ? 'bg-yellow-100 text-yellow-800' :
                          tool.status === 'serwis' ? 'bg-red-100 text-red-800' :
                          'bg-slate-100 text-slate-800'
                        }`}>
                          {tool.status || 'nieznany'}
                        </span>
                      </td>
                      <td className="p-4 text-slate-600">{tool.location || '-'}</td>
                      <td className="p-4 text-slate-600 font-mono text-sm">{tool.sku || '-'}</td>
                      <td className="p-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleOpenModal(tool)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            Edytuj
                          </button>
                          <button
                            onClick={() => handleDelete(tool.id)}
                            className="text-red-600 hover:text-red-800 text-sm font-medium"
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
                      <div className="font-medium text-slate-900">{tool.name}</div>
                      {tool.description && (
                        <div className="text-sm text-slate-500 mt-1">{tool.description}</div>
                      )}
                    </div>
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
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
                      <span className="text-slate-500">Kategoria:</span>
                      <span className="text-slate-900">{tool.category || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Lokalizacja:</span>
                      <span className="text-slate-900">{tool.location || '-'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">SKU:</span>
                      <span className="text-slate-900 font-mono text-xs">{tool.sku || '-'}</span>
                    </div>
                  </div>
                  
                  <div className="flex gap-2 pt-2 border-t border-slate-100" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleOpenModal(tool)}
                      className="flex-1 bg-blue-50 text-blue-600 py-2 px-3 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                    >
                      Edytuj
                    </button>
                    <button
                      onClick={() => handleDelete(tool.id)}
                      className="flex-1 bg-red-50 text-red-600 py-2 px-3 rounded-lg hover:bg-red-100 transition-colors text-sm font-medium"
                    >
                      Usuń
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto">
            <div className="p-4">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-slate-900">
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
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Nazwa *
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        errors.name ? 'border-red-300' : 'border-slate-300'
                      }`}
                      placeholder="Nazwa narzędzia"
                    />
                    {errors.name && (
                      <p className="text-red-600 text-sm mt-1">{errors.name}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      SKU {!editingTool && <span className="text-slate-500 text-xs">(auto)</span>}
                    </label>
                    <input
                      type="text"
                      name="sku"
                      value={formData.sku}
                      onChange={handleInputChange}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        errors.sku ? 'border-red-300' : 'border-slate-300'
                      }`}
                      placeholder={editingTool ? "SKU narzędzia" : "SKU (opcjonalne)"}
                    />
                    {errors.sku && (
                      <p className="text-red-600 text-sm mt-1">{errors.sku}</p>
                    )}
                  </div>
                </div>

                {/* Second row - Category and Location */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Kategoria *
                    </label>
                    <input
                      type="text"
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        errors.category ? 'border-red-300' : 'border-slate-300'
                      }`}
                      placeholder="Kategoria narzędzia"
                    />
                    {errors.category && (
                      <p className="text-red-600 text-sm mt-1">{errors.category}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Lokalizacja
                    </label>
                    <input
                      type="text"
                      name="location"
                      value={formData.location}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Lokalizacja narzędzia"
                    />
                  </div>
                </div>

                {/* Third row - Quantity and Status */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Ilość *
                    </label>
                    <input
                      type="number"
                      name="quantity"
                      value={formData.quantity}
                      onChange={handleInputChange}
                      min="1"
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        errors.quantity ? 'border-red-300' : 'border-slate-300'
                      }`}
                    />
                    {errors.quantity && (
                      <p className="text-red-600 text-sm mt-1">{errors.quantity}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Status
                    </label>
                    <select
                      name="status"
                      value={formData.status}
                      onChange={handleInputChange}
                      disabled={editingTool}
                      className={`w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
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
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Opis
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Opis narzędzia"
                  />
                </div>

                {errors.submit && (
                  <div className="text-red-600 text-sm">{errors.submit}</div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="flex-1 px-4 py-2 text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                  >
                    Anuluj
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
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
                <h2 className="text-xl font-bold text-slate-900">
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
                    <h3 className="text-lg font-semibold text-slate-900 mb-3">Informacje o narzędziu</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Nazwa:</span>
                        <span className="text-slate-900 font-medium">{selectedTool.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">SKU:</span>
                        <span className="text-slate-900 font-mono">{selectedTool.sku}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Kategoria:</span>
                        <span className="text-slate-900">{selectedTool.category || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Lokalizacja:</span>
                        <span className="text-slate-900">{selectedTool.location || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Status:</span>
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
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
                          <span className="text-slate-500">Opis:</span>
                          <p className="text-slate-900 mt-1">{selectedTool.description}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-4">
                    <button
                      onClick={() => downloadLabel(selectedTool)}
                      className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <span>📥</span>
                      Pobierz etykietę
                    </button>
                  </div>
                </div>

                {/* QR Code and Barcode */}
                <div className="space-y-6">
                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-slate-900 mb-3">Kod QR</h3>
                    <div className="flex justify-center">
                      <QRCodeDisplay sku={selectedTool.sku} />
                    </div>
                  </div>

                  <div className="text-center">
                    <h3 className="text-lg font-semibold text-slate-900 mb-3">Kod kreskowy</h3>
                    <div className="flex justify-center">
                      <BarcodeDisplay sku={selectedTool.sku} />
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