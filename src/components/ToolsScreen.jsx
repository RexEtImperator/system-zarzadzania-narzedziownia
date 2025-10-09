import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import api from '../api';
import BarcodeScanner from './BarcodeScanner';
import QRCode from 'qrcode';
import JsBarcode from 'jsbarcode';
import * as XLSX from 'xlsx';

function ToolsScreen({ initialSearchTerm = '' }) {
  const [tools, setTools] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTool, setEditingTool] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    serial_number: '',
    serial_unreadable: false,
    category: '',
    location: '',
    quantity: 1,
    status: 'dostępne',
    description: '',
    inventory_number: ''
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedTool, setSelectedTool] = useState(null);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [serviceTool, setServiceTool] = useState(null);
  const [serviceQuantity, setServiceQuantity] = useState(1);
  const [serviceOrderNumber, setServiceOrderNumber] = useState('');

  // Powiadomienia o nadchodzących przeglądach dla narzędzi spawalniczych
  const notifiedUpcomingRef = useRef(new Set());
  const didNotifyUpcomingRef = useRef(false);

  const daysUntil = (dateString) => {
    if (!dateString) return null;
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return null;
    const now = new Date();
    const startOfNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffMs = startOfDate - startOfNow;
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  };

  const notifyUpcomingSpawalnicze = (list) => {
    const arr = Array.isArray(list) ? list : [];
    arr.forEach(t => {
      const isSpawalnicze = String(t.category || '').toLowerCase() === 'spawalnicze'.toLowerCase();
      if (!isSpawalnicze) return;
      const d = daysUntil(t.inspection_date);
      if (d === null) return;
      // Tylko przyszłe terminy: 0-30 dni
      if (d < 0 || d > 30) return;
      const key = `${t.id || t.name}-${t.inspection_date || ''}`;
      if (notifiedUpcomingRef.current.has(key)) return;
      notifiedUpcomingRef.current.add(key);

      const label = t.inventory_number || t.name || 'narzędzie';
      const message = d <= 7
        ? `Przegląd spawalniczy: ${label} za ${d} dni`
        : `Przegląd spawalniczy: ${label} za ${d} dni (<=30 dni)`;
      if (d <= 7) {
        toast.warn(message);
      } else {
        toast.info(message);
      }
    });
  };

  // Get unique categories and statuses for filters
  const categories = [...new Set((tools || []).map(tool => tool.category).filter(Boolean))];
  const statuses = [...new Set((tools || []).map(tool => tool.status).filter(Boolean))];
  // Kategorie z backendu do formularza dodawania/edycji
  const [availableCategories, setAvailableCategories] = useState([]);

  // Filter tools based on search and filters
  const filteredTools = (tools || []).filter(Boolean).filter(tool => {
    const matchesSearch = !searchTerm || 
      tool.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tool.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tool.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tool.inventory_number?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = !selectedCategory || tool.category === selectedCategory;
    const computedStatus = (tool.quantity === 1 && (tool.service_quantity || 0) > 0) ? 'serwis' : (tool.status || 'dostępne');
    const matchesStatus = !selectedStatus || computedStatus === selectedStatus;
    
    return matchesSearch && matchesCategory && matchesStatus;
  });

  useEffect(() => {
    fetchTools();
  }, []);

  // Po załadowaniu narzędzi, raz wyświetl toasty nadchodzących przeglądów dla kategorii Spawalnicze
  useEffect(() => {
    if (!didNotifyUpcomingRef.current && (tools || []).length > 0) {
      try {
        notifyUpcomingSpawalnicze(tools);
      } finally {
        didNotifyUpcomingRef.current = true;
      }
    }
  }, [tools]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const resp = await api.get('/api/categories');
        const names = Array.isArray(resp) ? resp.map(c => c.name).filter(Boolean) : [];
        setAvailableCategories(names);
      } catch (err) {
        console.warn('Nie udało się pobrać kategorii:', err?.message || err);
        // Fallback na stałe kategorie, jeśli backend niedostępny
        setAvailableCategories(['Ręczne', 'Elektronarzędzia', 'Spawalnicze', 'Pneumatyczne', 'Akumulatorowe']);
      }
    };
    fetchCategories();
  }, []);

  // Ustaw wstępny filtr z deep-linka, jeśli przekazano
  useEffect(() => {
    if (initialSearchTerm) {
      setSearchTerm(initialSearchTerm);
    }
  }, [initialSearchTerm]);

  // As-you-type walidacja unikalności numeru ewidencyjnego
  const inventoryCheckTimer = useRef(null);
  useEffect(() => {
    if (inventoryCheckTimer.current) {
      clearTimeout(inventoryCheckTimer.current);
    }
    inventoryCheckTimer.current = setTimeout(() => {
      const inv = (formData.inventory_number || '').trim();
      if (!inv) {
        setErrors(prev => ({ ...prev, inventory_number: null }));
        return;
      }
      const conflict = (tools || []).some(t => (
        t?.inventory_number &&
        t.inventory_number.toLowerCase() === inv.toLowerCase() &&
        t.id !== (editingTool?.id)
      ));
      setErrors(prev => ({
        ...prev,
        inventory_number: conflict ? 'Numer ewidencyjny jest już używany' : null
      }));
    }, 300);

    return () => {
      if (inventoryCheckTimer.current) {
        clearTimeout(inventoryCheckTimer.current);
      }
    };
  }, [formData.inventory_number, editingTool, tools]);

  // As-you-type walidacja unikalności SKU
  const skuCheckTimer = useRef(null);
  useEffect(() => {
    if (skuCheckTimer.current) {
      clearTimeout(skuCheckTimer.current);
    }
    skuCheckTimer.current = setTimeout(() => {
      const sku = (formData.sku || '').trim();
      if (!sku) {
        setErrors(prev => ({ ...prev, sku: null }));
        return;
      }
      const conflict = (tools || []).some(t => (
        t?.sku &&
        String(t.sku).toLowerCase() === sku.toLowerCase() &&
        t.id !== (editingTool?.id)
      ));
      setErrors(prev => ({
        ...prev,
        sku: conflict ? 'Narzędzie o tym SKU już istnieje' : null
      }));
    }, 300);

    return () => {
      if (skuCheckTimer.current) {
        clearTimeout(skuCheckTimer.current);
      }
    };
  }, [formData.sku, editingTool, tools]);

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
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
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

    // Sprawdzenie duplikatu numeru ewidencyjnego na submit
    const inv = (formData.inventory_number || '').trim();
    if (inv) {
      const conflict = (tools || []).some(t => (
        t?.inventory_number &&
        String(t.inventory_number).toLowerCase() === inv.toLowerCase() &&
        t.id !== (editingTool?.id)
      ));
      if (conflict) {
        newErrors.inventory_number = 'Numer ewidencyjny jest już używany';
      }
    }
    
    // Sprawdzenie duplikatu SKU na submit
    const sku = (formData.sku || '').trim();
    if (sku) {
      const conflictSku = (tools || []).some(t => (
        t?.sku &&
        String(t.sku).toLowerCase() === sku.toLowerCase() &&
        t.id !== (editingTool?.id)
      ));
      if (conflictSku) {
        newErrors.sku = 'Narzędzie o tym SKU już istnieje';
      }
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
        await api.put(`/api/tools/${editingTool.id}`, dataToSubmit);
        setTools(prevTools => 
          prevTools.map(tool => 
            tool.id === editingTool.id ? { ...tool, ...dataToSubmit } : tool
          )
        );
        toast.success('Pomyślnie zaktualizowano dane narzędzia');
      } else {
        const response = await api.post('/api/tools', dataToSubmit);
        // API client zwraca bezpośrednio obiekt narzędzia, nie { data }
        setTools(prevTools => [...prevTools, response]);
      }

      handleCloseModal();
    } catch (error) {
      console.error('Error saving tool:', error);
      let apiMsg = 'Wystąpił błąd podczas zapisywania narzędzia';
      if (error && typeof error.message === 'string' && error.message.trim().length > 0) {
        apiMsg = error.message;
      }
      const normalized = (apiMsg || '').toLowerCase();
      if (normalized.includes('sku') || normalized.includes('unique constraint')) {
        const msg = 'Narzędzie o tym SKU już istnieje';
        setErrors(prev => ({ ...prev, sku: msg }));
        toast.error(msg);
      } else if (normalized.includes('numerze ewidencyjnym') || normalized.includes('inventory')) {
        setErrors(prev => ({ ...prev, inventory_number: apiMsg }));
        toast.error(apiMsg);
      } else if (normalized.includes('fabryczny') || normalized.includes('serial')) {
        setErrors(prev => ({ ...prev, serial_number: apiMsg }));
        toast.error(apiMsg);
      } else {
        setErrors(prev => ({ ...prev, submit: apiMsg }));
        if (apiMsg) toast.error(apiMsg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenModal = (tool = null) => {
    setEditingTool(tool);
    setFormData(tool ? { ...tool, serial_unreadable: !!tool.serial_unreadable, inspection_date: tool.inspection_date || '' } : {
      name: '',
      sku: '',
      serial_number: '',
      serial_unreadable: false,
      inventory_number: '',
      category: '',
      location: '',
      quantity: 1,
      status: 'dostępne',
      description: '',
      inspection_date: ''
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
      serial_number: '',
      serial_unreadable: false,
      inventory_number: '',
      category: '',
      location: '',
      quantity: 1,
      status: 'dostępne',
      description: '',
      inspection_date: ''
    });
    setErrors({});
  };

  const handleDelete = async (toolId) => {
    if (!window.confirm('Czy na pewno chcesz usunąć to narzędzie?')) {
      return;
    }

    try {
      await api.delete(`/api/tools/${toolId}`);
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

  const handleOpenServiceModal = (tool) => {
    setServiceTool(tool);
    setServiceQuantity(1);
    setServiceOrderNumber(tool?.service_order_number || '');
    setShowServiceModal(true);
  };

  const handleCloseServiceModal = () => {
    setShowServiceModal(false);
    setServiceTool(null);
    setServiceQuantity(1);
    setServiceOrderNumber('');
  };

  const handleConfirmService = async () => {
    if (!serviceTool) return;
    const maxQty = (serviceTool.quantity || 0) - (serviceTool.service_quantity || 0);
    if (serviceQuantity < 1 || serviceQuantity > maxQty) {
      toast.error(`Wybierz ilość od 1 do ${maxQty}`);
      return;
    }
    try {
      const resp = await api.post(`/api/tools/${serviceTool.id}/service`, { quantity: serviceQuantity, service_order_number: (serviceOrderNumber || '').trim() || null });
      const updated = resp?.tool || resp; // w zależności od kształtu odpowiedzi
      setTools(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t));
      if (selectedTool?.id === updated.id) {
        setSelectedTool(prev => ({ ...prev, ...updated }));
      }
      toast.success(resp?.message || 'Wysłano narzędzia na serwis');
      handleCloseServiceModal();
    } catch (err) {
      const msg = err?.response?.data?.message || 'Nie udało się wysłać na serwis';
      toast.error(msg);
    }
  };

  const handleServiceReceive = async () => {
    if (!selectedTool) return;
    const current = selectedTool.service_quantity || 0;
    if (current <= 0) {
      toast.info('Brak sztuk w serwisie do odebrania');
      return;
    }
    try {
      const resp = await api.post(`/api/tools/${selectedTool.id}/service/receive`, { quantity: current });
      const updated = resp?.tool || resp;
      setTools(prev => prev.map(t => t.id === updated.id ? { ...t, ...updated } : t));
      setSelectedTool(prev => ({ ...prev, ...updated }));
      toast.success(resp?.message || 'Odebrano z serwisu');
    } catch (err) {
      const msg = err?.response?.data?.message || 'Nie udało się odebrać z serwisu';
      toast.error(msg);
    }
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

  // Download only-QR label (name + SKU + QR)
  const downloadQrLabel = async (tool) => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      const scale = 4;
      canvas.width = 400 * scale;
      canvas.height = 300 * scale;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Title: name
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      ctx.font = `bold ${26 * scale}px Arial`;
      ctx.fillText(tool.name || '', canvas.width / 2, 40 * scale);

      // Subtitle: SKU
      ctx.font = `${18 * scale}px Arial`;
      ctx.fillText(`SKU: ${tool.sku || ''}`, canvas.width / 2, 70 * scale);

      const qrCodeUrl = await generateQRCode(tool.sku || '', 800);
      if (qrCodeUrl) {
        const qrImg = new Image();
        qrImg.onload = () => {
          const size = 200 * scale;
          const x = (canvas.width - size) / 2;
          const y = 90 * scale;
          ctx.drawImage(qrImg, x, y, size, size);

          const link = document.createElement('a');
          link.download = `etykieta-qr-${tool.sku || 'narzędzie'}.png`;
          link.href = canvas.toDataURL('image/png', 1.0);
          link.click();
        };
        qrImg.src = qrCodeUrl;
      }
    } catch (error) {
      console.error('Error generating QR-only label:', error);
      alert('Wystąpił błąd podczas generowania etykiety (QR)');
    }
  };

  // Download only-barcode label (name + SKU + barcode)
  const downloadBarcodeLabel = async (tool) => {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      const scale = 4;
      canvas.width = 400 * scale;
      canvas.height = 300 * scale;

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Title: name
      ctx.fillStyle = '#000000';
      ctx.textAlign = 'center';
      ctx.font = `bold ${26 * scale}px Arial`;
      ctx.fillText(tool.name || '', canvas.width / 2, 40 * scale);

      // Subtitle: SKU
      ctx.font = `${18 * scale}px Arial`;
      ctx.fillText(`SKU: ${tool.sku || ''}`, canvas.width / 2, 70 * scale);

      const barcodeUrl = generateBarcode(tool.sku || '');
      if (barcodeUrl) {
        const barcodeImg = new Image();
        barcodeImg.onload = () => {
          const w = 300 * scale;
          const h = 110 * scale;
          const x = (canvas.width - w) / 2;
          const y = 110 * scale;
          ctx.drawImage(barcodeImg, x, y, w, h);

          const link = document.createElement('a');
          link.download = `etykieta-kreskowy-${tool.sku || 'narzędzie'}.png`;
          link.href = canvas.toDataURL('image/png', 1.0);
          link.click();
        };
        barcodeImg.src = barcodeUrl;
      }
    } catch (error) {
      console.error('Error generating barcode-only label:', error);
      alert('Wystąpił błąd podczas generowania etykiety (kod kreskowy)');
    }
  };

  // ===== Eksport listy i szczegółów =====
  const downloadBlob = (filename, mime, content) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportListToPDF = () => {
    const stamp = new Date().toLocaleString('pl-PL');
    const itemsArr = filteredTools || [];

    const headerCells = [
      'Nazwa',
      'Numer fabryczny',
      'Kategoria',
      'Status',
      'Lokalizacja',
      'SKU',
      'Ilość',
      'Opis',
      'Data przeglądu'
    ];
    const headerHtml = headerCells.map(h => `<th>${h}</th>`).join('');

    const tableRows = itemsArr.map(item => {
      const isSpawalnicze = String(item.category || '').trim().toLowerCase() === 'spawalnicze';
      const insp = (isSpawalnicze && item.inspection_date) ? new Date(item.inspection_date).toLocaleDateString('pl-PL') : '';
      const cells = [
        `<td>${item.name || ''}</td>`,
        `<td>${item.serial_unreadable ? 'nieczytelny' : (item.serial_number || '')}</td>`,
        `<td>${item.category || ''}</td>`,
        `<td>${item.status || ''}</td>`,
        `<td>${item.location || ''}</td>`,
        `<td>${item.sku || ''}</td>`,
        `<td>${item.quantity ?? ''}</td>`,
        `<td>${item.description || ''}</td>`,
        `<td>${insp}</td>`
      ];
      return `<tr>${cells.join('')}</tr>`;
    }).join('');

    const html = `
      <html>
      <head>
        <meta charset=\"utf-8\" />
        <title>Eksport Narzędzia — lista</title>
        <style>
          body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; padding: 24px; }
          h1 { font-size: 18px; margin: 0 0 8px; }
          .meta { color: #555; font-size: 12px; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          thead th { background: #f3f4f6; color: #111827; text-align: left; padding: 8px; border-bottom: 1px solid #ddd; }
          tbody td { padding: 8px; border-bottom: 1px solid #eee; vertical-align: top; }
          tbody tr:nth-child(even) td { background: #fafafa; }
          @page { size: A4; margin: 12mm; }
        </style>
      </head>
      <body>
        <h1>Lista narzędzi</h1>
        <div class=\"meta\">Wygenerowano: ${stamp}</div>
        <table>
          <thead><tr>${headerHtml}</tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </body>
      </html>`;

    const w = window.open('', '_blank');
    if (!w) return alert('Pop-up został zablokowany przez przeglądarkę');
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };

  const exportListToXLSX = () => {
    const itemsArr = filteredTools || [];
    const headers = [
      'Nazwa',
      'Numer fabryczny',
      'Kategoria',
      'Status',
      'Lokalizacja',
      'SKU',
      'Ilość',
      'Opis',
      'Data przeglądu'
    ];
    const rows = itemsArr.map(item => {
      const isSpawalnicze = String(item.category || '').trim().toLowerCase() === 'spawalnicze';
      const insp = (isSpawalnicze && item.inspection_date) ? new Date(item.inspection_date).toLocaleDateString('pl-PL') : '';
      return [
        item.name || '',
        (item.serial_unreadable ? 'nieczytelny' : (item.serial_number || '')),
        item.category || '',
        item.status || '',
        item.location || '',
        item.sku || '',
        item.quantity ?? '',
        item.description || '',
        insp
      ];
    });
    const aoa = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Narzędzia');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
    downloadBlob(`narzedzia_lista_${stamp}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', wbout);
  };

  const exportDetailsToPDF = () => {
    if (!selectedTool) return;
    const stamp = new Date().toLocaleString('pl-PL');
    const rows = [
      ['Nazwa', selectedTool.name || '-'],
      ['SKU', selectedTool.sku || '-'],
      ['Numer fabryczny', selectedTool.serial_unreadable ? 'nieczytelny' : (selectedTool.serial_number || '-')],
      ['Kategoria', selectedTool.category || '-'],
      ...(String(selectedTool.category || '').trim().toLowerCase() === 'spawalnicze' && selectedTool.inspection_date ? [[
        'Data przeglądu', new Date(selectedTool.inspection_date).toLocaleDateString('pl-PL')
      ]] : []),
      ['Lokalizacja', selectedTool.location || '-'],
      ['Status', selectedTool.status || '-'],
      ['Ilość', selectedTool.quantity ?? '-'],
      ['Opis', selectedTool.description || '-']
    ];

    // Dodaj dane serwisowe, jeśli dostępne
    if ((selectedTool.service_quantity || 0) > 0) {
      rows.push(['W serwisie', String(selectedTool.service_quantity)]);
    }
    if (selectedTool.service_order_number) {
      rows.push(['Nr zlecenia serwisowego', selectedTool.service_order_number]);
    }
    if (selectedTool.service_sent_at) {
      const sent = new Date(selectedTool.service_sent_at).toLocaleString('pl-PL');
      rows.push(['Data wysłania na serwis', sent]);
    }

    const tableRowsHtml = rows.map(([label, value]) => `<tr><td>${label}</td><td>${value}</td></tr>`).join('');

    const html = `
      <html><head><meta charset=\"utf-8\" />
      <title>Eksport Narzędzia — szczegóły ${selectedTool.name || ''}</title>
      <style>
        body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; padding: 24px; }
        h1 { font-size: 18px; margin: 0 0 8px; }
        .meta { color: #555; font-size: 12px; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; }
        thead th { background: #f3f4f6; color: #111827; text-align: left; padding: 8px; border-bottom: 1px solid #ddd; }
        tbody td { padding: 8px; border-bottom: 1px solid #eee; }
        tbody tr:nth-child(even) td { background: #fafafa; }
        @page { size: A4; margin: 12mm; }
      </style>
      </head>
      <body>
        <h1>Szczegóły narzędzia</h1>
        <div class=\"meta\">Wygenerowano: ${stamp}</div>
        <table>
          <thead><tr><th>Pole</th><th>Wartość</th></tr></thead>
          <tbody>${tableRowsHtml}</tbody>
        </table>
      </body></html>`;

    const w = window.open('', '_blank');
    if (!w) return alert('Pop-up został zablokowany przez przeglądarkę');
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };

  const exportDetailsToXLSX = () => {
    if (!selectedTool) return;
    const headers = ['Pole', 'Wartość'];
    const fields = [
      ['Nazwa', selectedTool.name || ''],
      ['SKU', selectedTool.sku || ''],
      ['Numer fabryczny', selectedTool.serial_unreadable ? 'nieczytelny' : (selectedTool.serial_number || '')],
      ['Kategoria', selectedTool.category || ''],
      ...(String(selectedTool.category || '').trim().toLowerCase() === 'spawalnicze' && selectedTool.inspection_date ? [[
        'Data przeglądu', new Date(selectedTool.inspection_date).toLocaleDateString('pl-PL')
      ]] : []),
      ['Lokalizacja', selectedTool.location || ''],
      ['Status', selectedTool.status || ''],
      ['Ilość', selectedTool.quantity ?? ''],
      ['Opis', selectedTool.description || '']
    ];
    if ((selectedTool.service_quantity || 0) > 0) {
      fields.push(['W serwisie', String(selectedTool.service_quantity)]);
    }
    if (selectedTool.service_order_number) {
      fields.push(['Nr zlecenia serwisowego', selectedTool.service_order_number]);
    }
    if (selectedTool.service_sent_at) {
      const sent = new Date(selectedTool.service_sent_at).toLocaleString('pl-PL');
      fields.push(['Data wysłania na serwis', sent]);
    }
    const aoa = [headers, ...fields];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Narzędzie');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
    downloadBlob(`narzedzie_${(selectedTool.sku || selectedTool.name || 'pozycja')}_${stamp}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', wbout);
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
      <div className="flex items-center justify-center min-h-screen dark:bg-slate-900">
        <span className="text-slate-500 dark:text-slate-400">Ładowanie...</span>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white dark:bg-slate-900 min-h-screen">


      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 sharp-text">Zarządzanie narzędziami</h1>
          <p className="text-slate-600 dark:text-slate-400 sharp-text">Dodawaj, edytuj i śledź narzędzia w systemie</p>
        </div>
        <button
          onClick={() => handleOpenModal()}
          className="bg-blue-600 dark:bg-blue-700 text-white px-4 py-2 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800 transition-colors sharp-text"
        >
          Dodaj narzędzie
        </button>
      </div>

      {/* Search and Filter Section */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 sharp-text">
              Wyszukaj narzędzie
            </label>
            <input
              type="text"
              placeholder="Nazwa, SKU, kategoria, numer ewidencyjny..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sharp-text"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 sharp-text">
              Kategoria
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sharp-text"
            >
              <option value="">Wszystkie kategorie</option>
              {categories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 sharp-text">
              Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sharp-text"
            >
              <option value="">Wszystkie statusy</option>
              {statuses.map(status => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={exportListToPDF}
            className="px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg hover:opacity-90 sharp-text"
          >
            Eksportuj jako PDF
          </button>
          <button
            type="button"
            onClick={exportListToXLSX}
            className="px-4 py-2 bg-emerald-600 dark:bg-emerald-700 text-white rounded-lg hover:bg-emerald-700 dark:hover:bg-emerald-800 sharp-text"
          >
            Eksportuj jako EXCEL
          </button>
        </div>
      </div>

      {/* Tools List */}
      {loading ? (
        <div className="p-8 text-center">
          <div className="text-slate-400 dark:text-slate-500 text-6xl mb-4">🔧</div>
          <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2 sharp-text">Ładowanie narzędzi...</h3>
          <p className="text-slate-600 dark:text-slate-400 sharp-text">
            Proszę czekać...
          </p>
        </div>
      ) : filteredTools.length === 0 ? (
        <div className="p-8 text-center">
          <div className="text-slate-400 dark:text-slate-500 text-6xl mb-4">🔧</div>
          <h3 className="text-lg font-medium text-slate-900 dark:text-slate-100 mb-2 sharp-text">Brak narzędzi</h3>
          <p className="text-slate-600 dark:text-slate-400 sharp-text">
            {searchTerm || selectedCategory || selectedStatus 
              ? 'Nie znaleziono narzędzi spełniających kryteria wyszukiwania.'
              : 'Dodaj pierwsze narzędzie, aby rozpocząć zarządzanie.'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden md:block bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-700">
                <tr>
                  <th className="text-left p-4 font-semibold text-slate-900 dark:text-slate-100 sharp-text">Nr. ew.</th>
                  <th className="text-left p-4 font-semibold text-slate-900 dark:text-slate-100 sharp-text">Nazwa</th>
                  <th className="text-left p-4 font-semibold text-slate-900 dark:text-slate-100 sharp-text">Numer fabryczny</th>
                  <th className="text-left p-4 font-semibold text-slate-900 dark:text-slate-100 sharp-text">Kategoria</th>
                  <th className="text-left p-4 font-semibold text-slate-900 dark:text-slate-100 sharp-text">Status</th>
                  <th className="text-left p-4 font-semibold text-slate-900 dark:text-slate-100 sharp-text">Lokalizacja</th>
                  <th className="text-left p-4 font-semibold text-slate-900 dark:text-slate-100 sharp-text">SKU</th>
                  <th className="text-left p-4 font-semibold text-slate-900 dark:text-slate-100 sharp-text">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-600">
                {filteredTools.map((tool) => (
                  <tr 
                    key={tool.id} 
                    className="hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
                    onClick={() => handleRowClick(tool)}
                  >
                    <td className="p-4 text-slate-600 dark:text-slate-300 font-mono text-sm sharp-text">{tool.inventory_number || '-'}</td>
                    <td className="p-4">
                      <div className="font-medium text-slate-900 dark:text-slate-100 sharp-text">{tool.name}</div>
                      {tool.description && (
                        <div className="text-sm text-slate-500 dark:text-slate-400 sharp-text">{tool.description}</div>
                      )}
                    </td>
                    <td className="p-4 text-slate-600 dark:text-slate-300 font-mono text-sm sharp-text">{tool.serial_number || (tool.serial_unreadable ? 'nieczytelny' : '-')}</td>
                    <td className="p-4 text-slate-600 dark:text-slate-300 sharp-text">{tool.category || '-'}</td>
                    <td className="p-4">
                      {(() => {
                        const displayStatus = (tool.quantity === 1 && (tool.service_quantity || 0) > 0) ? 'serwis' : (tool.status || 'nieznany');
                        const cls = displayStatus === 'dostępne' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300' :
                          displayStatus === 'wydane' ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-300' :
                          displayStatus === 'serwis' ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-300' :
                          'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-300';
                        return (
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full sharp-text ${cls}`}>
                            {displayStatus}
                          </span>
                        );
                      })()}
                    </td>
                    <td className="p-4 text-slate-600 dark:text-slate-300 sharp-text">{tool.location || '-'}</td>
                    <td className="p-4 text-slate-600 dark:text-slate-300 font-mono text-sm sharp-text">{tool.sku || '-'}</td>
                    <td className="p-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleOpenServiceModal(tool)}
                          className="text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-300 text-sm font-medium sharp-text"
                        >
                          Serwis
                        </button>
                        <button
                          onClick={() => handleOpenModal(tool)}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium sharp-text"
                        >
                          Edytuj
                        </button>
                        <button
                          onClick={() => handleDelete(tool.id)}
                          className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm font-medium sharp-text"
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
          <div className="md:hidden divide-y divide-slate-200 dark:divide-slate-600">
            {filteredTools.map((tool) => (
              <div 
                key={tool.id} 
                className="p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-800"
                onClick={() => handleRowClick(tool)}
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="font-medium text-slate-900 dark:text-slate-100 sharp-text">{tool.name}</div>
                    {tool.description && (
                      <div className="text-sm text-slate-500 dark:text-slate-400 mt-1 sharp-text">{tool.description}</div>
                    )}
                  </div>
                  {(() => {
                    const displayStatus = (tool.quantity === 1 && (tool.service_quantity || 0) > 0) ? 'serwis' : (tool.status || 'nieznany');
                    const cls = displayStatus === 'dostępne' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300' :
                      displayStatus === 'wydane' ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-300' :
                      displayStatus === 'serwis' ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-300' :
                      'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-300';
                    return (
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full sharp-text ${cls}`}>
                        {displayStatus}
                      </span>
                    );
                  })()}
                </div>
                
                <div className="space-y-2 text-sm mb-4">
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400 sharp-text">Numer ewidencyjny:</span>
                    <span className="text-slate-900 dark:text-slate-100 font-mono text-xs sharp-text">{tool.inventory_number || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400 sharp-text">Numer fabryczny:</span>
                    <span className="text-slate-900 dark:text-slate-100 font-mono text-xs sharp-text">{tool.serial_number || (tool.serial_unreadable ? 'nieczytelny' : '-')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400 sharp-text">Kategoria:</span>
                    <span className="text-slate-900 dark:text-slate-100 sharp-text">{tool.category || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400 sharp-text">Lokalizacja:</span>
                    <span className="text-slate-900 dark:text-slate-100 sharp-text">{tool.location || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400 sharp-text">SKU:</span>
                    <span className="text-slate-900 dark:text-slate-100 font-mono text-xs sharp-text">{tool.sku || '-'}</span>
                  </div>
                </div>
                
                <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-600" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleOpenServiceModal(tool)}
                    className="flex-1 bg-rose-50 dark:bg-rose-900 text-rose-600 dark:text-rose-300 py-2 px-3 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-800 transition-colors text-sm font-medium sharp-text"
                  >
                    Serwis
                  </button>
                  <button
                    onClick={() => handleOpenModal(tool)}
                    className="flex-1 bg-blue-50 dark:bg-blue-900 text-blue-600 dark:text-blue-300 py-2 px-3 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-800 transition-colors text-sm font-medium sharp-text"
                  >
                    Edytuj
                  </button>
                  <button
                    onClick={() => handleDelete(tool.id)}
                    className="flex-1 bg-red-50 dark:bg-red-900 text-red-600 dark:text-red-300 py-2 px-3 rounded-lg hover:bg-red-100 dark:hover:bg-red-800 transition-colors text-sm font-medium sharp-text"
                  >
                    Usuń
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {/* Service Modal */}
      {showServiceModal && serviceTool && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={(e) => { if (e.target === e.currentTarget) handleCloseServiceModal(); }}
        >
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 sharp-text">Wyślij na serwis</h2>
                <button
                  onClick={handleCloseServiceModal}
                  className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  <span className="text-2xl">×</span>
                </button>
              </div>
              <div className="space-y-3">
                <p className="text-sm text-slate-600 dark:text-slate-300 sharp-text">Narzędzie: <span className="font-medium">{serviceTool.name}</span></p>
                <p className="text-sm text-slate-600 dark:text-slate-300 sharp-text">Dostępne do serwisu: <span className="font-medium">{(serviceTool.quantity || 0) - (serviceTool.service_quantity || 0)}</span> szt.</p>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 sharp-text">Ilość do serwisu</label>
                <input
                  type="number"
                  min={1}
                  max={(serviceTool.quantity || 0) - (serviceTool.service_quantity || 0)}
                  value={serviceQuantity}
                  onChange={(e) => setServiceQuantity(parseInt(e.target.value || '1', 10))}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 sharp-text"
                />
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 sharp-text">Numer zlecenia serwisowego</label>
                <input
                  type="text"
                  value={serviceOrderNumber}
                  onChange={(e) => setServiceOrderNumber(e.target.value)}
                  placeholder="Np. SER-2025-00123"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-rose-500 sharp-text"
                />
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button
                  onClick={handleCloseServiceModal}
                  className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100 rounded-lg text-sm hover:bg-slate-200 dark:hover:bg-slate-600 sharp-text"
                >
                  Anuluj
                </button>
                <button
                  onClick={handleConfirmService}
                  className="px-3 py-1.5 bg-rose-600 dark:bg-rose-700 text-white rounded-lg text-sm hover:bg-rose-700 dark:hover:bg-rose-800 sharp-text"
                >
                  Wyślij
                </button>
              </div>
            </div>
          </div>
        </div>
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
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={(e) => { if (e.target === e.currentTarget) handleCloseModal(); }}
        >
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 sharp-text">
                  {editingTool ? 'Edytuj narzędzie' : 'Dodaj narzędzie'}
                </h2>
                <button
                  onClick={handleCloseModal}
                  className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  <span className="text-2xl">×</span>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* First row - Name and SKU */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 sharp-text">
                      Nazwa *
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100 sharp-text ${
                        errors.name ? 'border-red-300 dark:border-red-600' : 'border-slate-300 dark:border-slate-600'
                      }`}
                      placeholder="Nazwa narzędzia"
                    />
                    {errors.name && (
                      <p className="text-red-600 dark:text-red-400 text-sm mt-1 sharp-text">{errors.name}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 sharp-text">
                      SKU {!editingTool && <span className="text-slate-500 dark:text-slate-400 text-xs">(auto)</span>}
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        name="sku"
                        value={formData.sku}
                        onChange={handleInputChange}
                        className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100 sharp-text ${
                          errors.sku ? 'border-red-300 dark:border-red-600' : 'border-slate-300 dark:border-slate-600'
                        }`}
                        placeholder={editingTool ? "SKU narzędzia" : "SKU (opcjonalne)"}
                      />
                      {formData.sku && errors.sku && (
                        <span className="px-2 py-1 text-xs bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300 border border-red-200 dark:border-red-700 rounded self-center whitespace-nowrap sharp-text">
                          Zajęte
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => setShowBarcodeScanner(true)}
                        className="px-3 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
                        title="Skanuj kod kreskowy/QR"
                      >
                        📷
                      </button>
                    </div>
                    {errors.sku && (
                      <p className="text-red-600 dark:text-red-400 text-sm mt-1 sharp-text">{errors.sku}</p>
                    )}
                  </div>
                </div>

                {/* Inventory and Serial side-by-side */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 sharp-text">
                      Numer ewidencyjny
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        name="inventory_number"
                        value={formData.inventory_number || ''}
                        onChange={handleInputChange}
                        className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-slate-100 sharp-text ${
                          errors.inventory_number ? 'border-red-300 dark:border-red-600' : 'border-slate-300 dark:border-slate-600'
                        }`}
                        placeholder="Np. NE-000123"
                      />
                      {formData.inventory_number && errors.inventory_number && (
                        <span className="px-2 py-1 text-xs bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300 border border-red-200 dark:border-red-700 rounded self-center whitespace-nowrap sharp-text">
                          Zajęte
                        </span>
                      )}
                    </div>
                    {errors.inventory_number && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400 sharp-text">{errors.inventory_number}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 sharp-text">
                      Numer fabryczny *
                    </label>
                    <input
                      type="text"
                      name="serial_number"
                      value={formData.serial_number || ''}
                      onChange={handleInputChange}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-slate-100 sharp-text ${
                        errors.serial_number ? 'border-red-300 dark:border-red-600' : 'border-slate-300 dark:border-slate-600'
                      }`}
                      placeholder="Np. SN-123456"
                      disabled={formData.serial_unreadable}
                    />
                    {errors.serial_number && (
                      <p className="mt-1 text-sm text-red-600 dark:text-red-400 sharp-text">{errors.serial_number}</p>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        id="serial_unreadable"
                        type="checkbox"
                        name="serial_unreadable"
                        checked={!!formData.serial_unreadable}
                        onChange={handleInputChange}
                        className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-blue-600 focus:ring-blue-500"
                      />
                      <label htmlFor="serial_unreadable" className="text-sm text-slate-700 dark:text-slate-300 sharp-text">Numer nieczytelny</label>
                    </div>
                  </div>
                </div>

                {/* Second row - Category and Location */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 sharp-text">
                      Kategoria *
                    </label>
                    <select
                      name="category"
                      value={formData.category}
                      onChange={handleInputChange}
                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100 sharp-text ${
                        errors.category ? 'border-red-300 dark:border-red-600' : 'border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      <option value="">Wybierz kategorię</option>
                      {availableCategories.map(opt => (
                        <option key={opt} value={opt}>{opt}</option>
                      ))}
                      {formData.category && !availableCategories.includes(formData.category) && (
                        <option value={formData.category}>{formData.category} (istniejąca)</option>
                      )}
                    </select>
                    {errors.category && (
                      <p className="text-red-600 dark:text-red-400 text-sm mt-1 sharp-text">{errors.category}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 sharp-text">
                      Lokalizacja
                    </label>
                    <input
                      type="text"
                      name="location"
                      value={formData.location}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-slate-100 sharp-text"
                      placeholder="Lokalizacja narzędzia"
                    />
                  </div>
                </div>

                {/* Review Date tile for Spawalnicze/Spalawnicze */}
                {(() => {
                  const cat = (formData.category || '').trim().toLowerCase();
                  const isCombustion = cat === 'spawalnicze' || cat === 'spalawnicze';
                  if (!isCombustion) return null;
                  return (
                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-700 p-4">
                      <label className="block text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2 sharp-text">Data przeglądu</label>
                      <input
                        type="date"
                        name="inspection_date"
                        value={formData.inspection_date || ''}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-slate-100 sharp-text"
                      />
                    </div>
                  );
                })()}

                {/* Third row - Quantity */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 sharp-text">
                    Ilość *
                  </label>
                  <input
                    type="number"
                    name="quantity"
                    value={formData.quantity}
                    onChange={handleInputChange}
                    min="1"
                    className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:border-slate-600 dark:text-slate-100 sharp-text ${
                      errors.quantity ? 'border-red-300 dark:border-red-600' : 'border-slate-300 dark:border-slate-600'
                    }`}
                  />
                  {errors.quantity && (
                    <p className="text-red-600 dark:text-red-400 text-sm mt-1 sharp-text">{errors.quantity}</p>
                  )}
                </div>

                {/* Description - full width */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 sharp-text">
                    Opis
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-slate-700 dark:text-slate-100 sharp-text"
                    placeholder="Opis narzędzia"
                  />
                </div>

                {errors.submit && (
                  <div className="text-red-600 dark:text-red-400 text-sm sharp-text">{errors.submit}</div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="flex-1 px-4 py-2 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors sharp-text"
                  >
                    Anuluj
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800 transition-colors disabled:opacity-50 sharp-text"
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
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={(e) => { if (e.target === e.currentTarget) setShowDetailsModal(false); }}
        >
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 flex justify-between items-center border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 sharp-text">
                Szczegóły narzędzia: {selectedTool.name}
              </h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={exportDetailsToPDF}
                  className="px-3 py-1.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg text-sm hover:opacity-90 sharp-text"
                >
                  Eksportuj do PDF
                </button>
                <button
                  onClick={exportDetailsToXLSX}
                  className="px-3 py-1.5 bg-emerald-600 dark:bg-emerald-700 text-white rounded-lg text-sm hover:bg-emerald-700 dark:hover:bg-emerald-800 sharp-text"
                >
                  Eksportuj do EXCEL
                </button>
                <button
                  onClick={() => setShowDetailsModal(false)}
                  className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  <span className="text-2xl">×</span>
                </button>
              </div>
            </div>

            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Tool Information */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3 sharp-text">Informacje o narzędziu</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400 sharp-text">Nazwa:</span>
                        <span className="text-slate-900 dark:text-slate-100 font-medium sharp-text">{selectedTool.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400 sharp-text">Numer ewidencyjny:</span>
                        <span className="text-slate-900 dark:text-slate-100 font-mono sharp-text">{selectedTool.inventory_number || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400 sharp-text">Numer fabryczny:</span>
                        <span className="text-slate-900 dark:text-slate-100 font-mono sharp-text">{selectedTool.serial_unreadable ? 'nieczytelny' : (selectedTool.serial_number || '-')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400 sharp-text">SKU:</span>
                        <span className="text-slate-900 dark:text-slate-100 font-mono sharp-text">{selectedTool.sku}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400 sharp-text">Kategoria:</span>
                        <span className="text-slate-900 dark:text-slate-100 sharp-text">{selectedTool.category || '-'}</span>
                      </div>
                      {String(selectedTool.category || '').trim().toLowerCase() === 'spawalnicze' && (
                        <div className="flex justify-between">
                          <span className="text-slate-500 dark:text-slate-400 sharp-text">Data przeglądu:</span>
                          <span className="text-slate-900 dark:text-slate-100 sharp-text">{selectedTool.inspection_date ? new Date(selectedTool.inspection_date).toLocaleDateString('pl-PL') : '-'}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400 sharp-text">Lokalizacja:</span>
                        <span className="text-slate-900 dark:text-slate-100 sharp-text">{selectedTool.location || '-'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400 sharp-text">Status:</span>
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full sharp-text ${
                          selectedTool.status === 'dostępne' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300' :
                          selectedTool.status === 'wydane' ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-300' :
                          selectedTool.status === 'serwis' ? 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-300' :
                          'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-300'
                        }`}>
                          {selectedTool.status || 'nieznany'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500 dark:text-slate-400 sharp-text">Ilość:</span>
                        <span className="text-slate-900 dark:text-slate-100 font-medium sharp-text">{selectedTool.quantity ?? '-'}</span>
                      </div>
                      {selectedTool.description && (
                        <div>
                          <span className="text-slate-500 dark:text-slate-400 sharp-text">Opis:</span>
                          <p className="text-slate-900 dark:text-slate-100 mt-1 sharp-text">{selectedTool.description}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Informacja o serwisie nad Eksport */}
                  {(selectedTool.service_quantity || 0) > 0 && (
                    <div className="pt-2">
                      <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 bg-slate-50 dark:bg-slate-700">
                        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2 sharp-text">Serwis</h3>
                        <p className="text-sm text-slate-700 dark:text-slate-200 sharp-text">W serwisie: <span className="font-medium">{selectedTool.service_quantity}</span> szt.</p>
                        {selectedTool.service_order_number && (
                          <p className="text-sm text-slate-700 dark:text-slate-200 sharp-text">Nr zlecenia: <span className="font-mono">{selectedTool.service_order_number}</span></p>
                        )}
                        {selectedTool.status === 'serwis' && selectedTool.service_sent_at && (
                          <p className="text-xs text-slate-500 dark:text-slate-300 mt-1 sharp-text">Data wysłania: {new Date(selectedTool.service_sent_at).toLocaleString()}</p>
                        )}
                        <div className="pt-2">
                          <button
                            onClick={handleServiceReceive}
                            className="px-3 py-1.5 bg-green-600 dark:bg-green-700 text-white rounded-lg text-sm hover:bg-green-700 dark:hover:bg-green-800 sharp-text"
                          >
                            Odebrano
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Sekcja eksportu przeniesiona do nagłówka modala */}
                </div>

                {/* QR Code and Barcode */}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3 sharp-text">Kod QR</h3>
                    <div className="flex justify-center">
                      <QRCodeDisplay text={selectedTool.sku} />
                    </div>
                    <div className="pt-2">
                      <button
                        onClick={() => downloadQrLabel(selectedTool)}
                        className="w-full bg-blue-600 dark:bg-blue-700 text-white px-4 py-2 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800 transition-colors flex items-center justify-center gap-2 sharp-text"
                      >
                        Pobierz etykietę (tylko QR)
                      </button>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3 sharp-text">Kod kreskowy</h3>
                    <div className="flex justify-center">
                      <BarcodeDisplay text={selectedTool.sku} />
                    </div>
                    <div className="pt-2">
                      <button
                        onClick={() => downloadBarcodeLabel(selectedTool)}
                        className="w-full bg-blue-600 dark:bg-blue-700 text-white px-4 py-2 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800 transition-colors flex items-center justify-center gap-2 sharp-text"
                      >
                        Pobierz etykietę (tylko kod kreskowy)
                      </button>
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