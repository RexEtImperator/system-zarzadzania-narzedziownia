import React, { useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import api from '../api';
import { toast } from 'react-toastify';
import { PERMISSIONS } from '../constants';

function BhpScreen({ employees = [], user, initialSearchTerm = '' }) {
  const formatDateForInput = (value) => {
    if (!value) return '';
    try {
      const str = String(value).trim();
      // ISO date or ISO with time -> take first 10 chars
      if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
        return str.slice(0, 10);
      }
      // Handle DD-MM-YYYY, DD/MM/YYYY, DD.MM.YYYY
      const dmy = str.match(/^(\d{2})[.\/-](\d{2})[.\/-](\d{4})/);
      if (dmy) {
        const [, dd, mm, yyyy] = dmy;
        return `${yyyy}-${mm}-${dd}`;
      }
      // Fallback: try Date parsing
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
      return '';
    } catch (_) {
      return '';
    }
  };
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [formData, setFormData] = useState({
    inventory_number: '',
    manufacturer: '',
    model: '',
    serial_number: '',
    catalog_number: '',
    production_date: '',
    inspection_date: '',
    is_set: false,
    has_shock_absorber: false,
    has_srd: false,
    harness_start_date: '',
    shock_absorber_serial: '',
    shock_absorber_name: '',
    shock_absorber_model: '',
    shock_absorber_catalog_number: '',
    shock_absorber_production_date: '',
    shock_absorber_start_date: '',
    srd_manufacturer: '',
    srd_model: '',
    srd_serial_number: '',
    srd_catalog_number: '',
    srd_production_date: '',
    status: 'dostępne'
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [reviewsFilter, setReviewsFilter] = useState(false);
  const [detailsItem, setDetailsItem] = useState(null);
  const [detailsData, setDetailsData] = useState(null);
  const [issueModal, setIssueModal] = useState(false);
  const [returnModal, setReturnModal] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [activeIssueId, setActiveIssueId] = useState('');
  const [sortBy, setSortBy] = useState('inspection');

  // Podpowiedzi z istniejących pozycji BHP (bez numerów seryjnych i ewidencyjnych)
  const uniqueValues = (field) => {
    try {
      const vals = (items || []).map(i => i?.[field]).filter(v => !!v && String(v).trim() !== '');
      return Array.from(new Set(vals)).slice(0, 100);
    } catch (_) {
      return [];
    }
  };

  const manufacturerOptions = useMemo(() => uniqueValues('manufacturer'), [items]);
  const modelOptions = useMemo(() => uniqueValues('model'), [items]);
  const catalogOptions = useMemo(() => uniqueValues('catalog_number'), [items]);
  const shockAbsorberManufacturerOptions = useMemo(() => uniqueValues('shock_absorber_name'), [items]);
  const shockAbsorberModelOptions = useMemo(() => uniqueValues('shock_absorber_model'), [items]);
  const shockAbsorberCatalogOptions = useMemo(() => uniqueValues('shock_absorber_catalog_number'), [items]);
  const srdManufacturerOptions = useMemo(() => uniqueValues('srd_manufacturer'), [items]);
  const srdModelOptions = useMemo(() => uniqueValues('srd_model'), [items]);
  const srdCatalogOptions = useMemo(() => uniqueValues('srd_catalog_number'), [items]);

  // Ustaw wstępny filtr z deep-linka, jeśli przekazano
  useEffect(() => {
    if (initialSearchTerm) {
      setSearchTerm(initialSearchTerm);
    }
  }, [initialSearchTerm]);

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

  const formatDate = (val) => (val ? new Date(val).toLocaleDateString('pl-PL') : '');

  const exportListToCSV = () => {
    const headers = [
      'Nr ewidencyjny',
      'Producent',
      'Model',
      'Nr seryjny',
      'Nr katalogowy',
      'Data produkcji',
      'Data przeglądu',
      'Status',
      'Przypisany (imię)',
      'Przypisany (nazwisko)'
    ];
    const rows = (filteredItems || []).map(item => [
      item.inventory_number || '',
      item.manufacturer || '',
      item.model || '',
      item.serial_number || '',
      item.catalog_number || '',
      formatDate(item.production_date),
      formatDate(item.inspection_date),
      item.status || '',
      item.assigned_employee_first_name || '',
      item.assigned_employee_last_name || ''
    ]);
    const csv = [headers.join(';'), ...rows.map(r => r.map(v => String(v).replace(/;/g, ',')).join(';'))].join('\n');
    const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
    downloadBlob(`bhp_lista_${stamp}.csv`, 'text/csv;charset=utf-8;', csv);
  };

  const exportListToPDF = () => {
    const stamp = new Date().toLocaleString('pl-PL');
    const itemsArr = filteredItems || [];
    const hasAnyShock = itemsArr.some(it => it.shock_absorber_name || it.shock_absorber_model || it.shock_absorber_serial || it.shock_absorber_catalog_number || it.shock_absorber_production_date);
    const hasAnySrd = itemsArr.some(it => it.srd_manufacturer || it.srd_model || it.srd_serial_number || it.srd_catalog_number || it.srd_production_date);

    const headerCells = [
      'Nr ewidencyjny',
      'Producent / Model',
      'Nr seryjny',
      'Nr katalogowy',
      'Data produkcji',
      'Data przeglądu',
      'Status',
      'Przypisany'
    ];
    if (hasAnyShock) {
      headerCells.push('Amortyzator: Producent', 'Amortyzator: Model', 'Amortyzator: S/N', 'Amortyzator: Kat.', 'Amortyzator: Data prod.');
    }
    if (hasAnySrd) {
      headerCells.push('SRD: Producent', 'SRD: Model', 'SRD: S/N', 'SRD: Kat.', 'SRD: Data prod.');
    }

    const headerHtml = headerCells.map(h => `<th>${h}</th>`).join('');

    const tableRows = itemsArr.map(item => {
      const cells = [
        `<td>${item.inventory_number || ''}</td>`,
        `<td>${(item.manufacturer || '')} ${item.model ? '— ' + item.model : ''}</td>`,
        `<td>${item.serial_number || ''}</td>`,
        `<td>${item.catalog_number || ''}</td>`,
        `<td>${formatDate(item.production_date) || ''}</td>`,
        `<td>${formatDate(item.inspection_date) || ''}</td>`,
        `<td>${item.status || ''}</td>`,
        `<td>${[(item.assigned_employee_first_name || ''),(item.assigned_employee_last_name || '')].join(' ').trim()}</td>`
      ];
      if (hasAnyShock) {
        const shockName = item.shock_absorber_name || '-';
        const shockModel = item.shock_absorber_model || '-';
        const shockSerial = item.shock_absorber_serial || '-';
        const shockCatalog = item.shock_absorber_catalog_number || '-';
        const shockProdDate = item.shock_absorber_production_date ? formatDate(item.shock_absorber_production_date) : '-';
        cells.push(
          `<td>${shockName}</td>`,
          `<td>${shockModel}</td>`,
          `<td>${shockSerial}</td>`,
          `<td>${shockCatalog}</td>`,
          `<td>${shockProdDate}</td>`
        );
      }
      if (hasAnySrd) {
        const srdMan = item.srd_manufacturer || '-';
        const srdModel = item.srd_model || '-';
        const srdSerial = item.srd_serial_number || '-';
        const srdCatalog = item.srd_catalog_number || '-';
        const srdProdDate = item.srd_production_date ? formatDate(item.srd_production_date) : '-';
        cells.push(
          `<td>${srdMan}</td>`,
          `<td>${srdModel}</td>`,
          `<td>${srdSerial}</td>`,
          `<td>${srdCatalog}</td>`,
          `<td>${srdProdDate}</td>`
        );
      }
      return `<tr>${cells.join('')}</tr>`;
    }).join('');

    const html = `
      <html>
      <head>
        <meta charset=\"utf-8\" />
        <title>Eksport BHP — lista</title>
        <style>
          body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; padding: 24px; }
          h1 { font-size: 18px; margin: 0 0 8px; }
          .meta { color: #555; font-size: 12px; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th, td { border: 1px solid #999; padding: 6px 8px; text-align: left; vertical-align: top; }
          th { background: #eee; }
          .muted { color: #666; }
          @page { size: A4; margin: 10mm; }
        </style>
      </head>
      <body>
        <h1>Sprzęt BHP — lista</h1>
        <div class=\"meta\">Wygenerowano: ${stamp}</div>
        <table>
          <thead>
            <tr>
              ${headerHtml}
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </body>
      </html>`;
    const w = window.open('', '_blank');
    if (!w) return alert('Pop-up zablokowany — zezwól na otwieranie nowych okien');
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };

  const exportListToXLSX = () => {
    const itemsArr = filteredItems || [];
    const hasAnyShock = itemsArr.some(it => it.shock_absorber_name || it.shock_absorber_model || it.shock_absorber_serial || it.shock_absorber_catalog_number || it.shock_absorber_production_date);
    const hasAnySrd = itemsArr.some(it => it.srd_manufacturer || it.srd_model || it.srd_serial_number || it.srd_catalog_number || it.srd_production_date);

    const headers = [
      'Nr ewidencyjny',
      'Producent',
      'Model',
      'Nr seryjny',
      'Nr katalogowy',
      'Data produkcji',
      'Data przeglądu',
      'Status',
      'Przypisany (imię)',
      'Przypisany (nazwisko)'
    ];
    if (hasAnyShock) headers.push('Amortyzator');
    if (hasAnySrd) headers.push('Urządzenie samohamowne');

    const rows = itemsArr.map(item => {
      const base = [
        item.inventory_number || '',
        item.manufacturer || '',
        item.model || '',
        item.serial_number || '',
        item.catalog_number || '',
        formatDate(item.production_date) || '',
        formatDate(item.inspection_date) || '',
        item.status || '',
        item.assigned_employee_first_name || '',
        item.assigned_employee_last_name || ''
      ];
      if (hasAnyShock) {
        const shockParts = [];
        if (item.shock_absorber_name) shockParts.push(`Prod.: ${item.shock_absorber_name}`);
        if (item.shock_absorber_model) shockParts.push(`Model: ${item.shock_absorber_model}`);
        if (item.shock_absorber_serial) shockParts.push(`S/N: ${item.shock_absorber_serial}`);
        if (item.shock_absorber_catalog_number) shockParts.push(`Kat.: ${item.shock_absorber_catalog_number}`);
        if (item.shock_absorber_production_date) shockParts.push(`Prod. data: ${formatDate(item.shock_absorber_production_date)}`);
        base.push(shockParts.length ? shockParts.join(' • ') : '');
      }
      if (hasAnySrd) {
        const srdParts = [];
        if (item.srd_manufacturer) srdParts.push(`Prod.: ${item.srd_manufacturer}`);
        if (item.srd_model) srdParts.push(`Model: ${item.srd_model}`);
        if (item.srd_serial_number) srdParts.push(`S/N: ${item.srd_serial_number}`);
        if (item.srd_catalog_number) srdParts.push(`Kat.: ${item.srd_catalog_number}`);
        if (item.srd_production_date) srdParts.push(`Prod. data: ${formatDate(item.srd_production_date)}`);
        base.push(srdParts.length ? srdParts.join(' • ') : '');
      }
      return base;
    });
    const aoa = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'BHP');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
    downloadBlob(`bhp_lista_${stamp}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', wbout);
  };

  const exportDetailsToCSV = () => {
    if (!detailsItem || !detailsData) return;
    const headers = ['Pole', 'Wartość'];
    const fields = [
      ['Nr ewidencyjny', detailsItem.inventory_number || ''],
      ['Producent', detailsData.manufacturer || ''],
      ['Model', detailsData.model || ''],
      ['Nr seryjny', detailsData.serial_number || ''],
      ['Nr katalogowy', detailsData.catalog_number || ''],
      ['Data produkcji', formatDate(detailsData.production_date) || ''],
      ['Rozpoczęcie użytkowania', formatDate(detailsData.harness_start_date) || ''],
      ['Data przeglądu', formatDate(detailsData.inspection_date) || ''],
      ['Status', detailsItem.status || ''],
      ['Przypisany', `${(detailsItem.assigned_employee_first_name || '')} ${(detailsItem.assigned_employee_last_name || '')}`.trim()]
    ];
    const csv = [headers.join(';'), ...fields.map(([k,v]) => `${String(k).replace(/;/g, ',')};${String(v).replace(/;/g, ',')}`)].join('\n');
    const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
    downloadBlob(`bhp_${detailsItem.inventory_number || 'pozycja'}_${stamp}.csv`, 'text/csv;charset=utf-8;', csv);
  };

  const exportDetailsToPDF = () => {
    if (!detailsItem || !detailsData) return;
    const stamp = new Date().toLocaleString('pl-PL');
    const hasShock = !!(detailsData.shock_absorber_name || detailsData.shock_absorber_model || detailsData.shock_absorber_serial || detailsData.shock_absorber_catalog_number || detailsData.shock_absorber_production_date);
    const hasSrd = !!(detailsData.srd_manufacturer || detailsData.srd_model || detailsData.srd_serial_number || detailsData.srd_catalog_number || detailsData.srd_production_date);

    const rows = [
      ['Nr ewidencyjny', detailsItem.inventory_number || '-'],
      ['Producent', detailsData.manufacturer || '-'],
      ['Model', detailsData.model || '-'],
      ['Nr seryjny', detailsData.serial_number || '-'],
      ['Nr katalogowy', detailsData.catalog_number || '-'],
      ['Data produkcji', formatDate(detailsData.production_date) || '-'],
      ['Rozpoczęcie użytkowania', formatDate(detailsData.harness_start_date) || '-'],
      ['Data przeglądu', formatDate(detailsData.inspection_date) || '-'],
      ['Status', detailsItem.status || '-'],
      ['Przypisany', `${(detailsItem.assigned_employee_first_name || '')} ${(detailsItem.assigned_employee_last_name || '')}`.trim() || '-']
    ];

    if (hasShock) {
      rows.push(
        ['Amortyzator: Producent', detailsData.shock_absorber_name || '-'],
        ['Amortyzator: Model', detailsData.shock_absorber_model || '-'],
        ['Amortyzator: S/N', detailsData.shock_absorber_serial || '-'],
        ['Amortyzator: Nr katalogowy', detailsData.shock_absorber_catalog_number || '-'],
        ['Amortyzator: Data produkcji', detailsData.shock_absorber_production_date ? formatDate(detailsData.shock_absorber_production_date) : '-']
      );
    }

    if (hasSrd) {
      rows.push(
        ['SRD: Producent', detailsData.srd_manufacturer || '-'],
        ['SRD: Model', detailsData.srd_model || '-'],
        ['SRD: S/N', detailsData.srd_serial_number || '-'],
        ['SRD: Nr katalogowy', detailsData.srd_catalog_number || '-'],
        ['SRD: Data produkcji', detailsData.srd_production_date ? formatDate(detailsData.srd_production_date) : '-']
      );
    }

    const tableRowsHtml = rows.map(([label, value]) => `<tr><td>${label}</td><td>${value}</td></tr>`).join('');

    const html = `
      <html><head><meta charset=\"utf-8\" />
      <title>Eksport BHP — szczegóły ${detailsItem.inventory_number || ''}</title>
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
        <h1>Szczegóły BHP: ${detailsItem.inventory_number || ''}</h1>
        <div class=\"meta\">Wygenerowano: ${stamp}</div>
        <table>
          <thead>
            <tr>
              <th>Pole</th>
              <th>Wartość</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
        </table>
      </body></html>`;
    const w = window.open('', '_blank');
    if (!w) return alert('Pop-up zablokowany — zezwól na otwieranie nowych okien');
    w.document.write(html);
    w.document.close();
    w.focus();
    w.print();
  };

  const exportDetailsToXLSX = () => {
    if (!detailsItem || !detailsData) return;
    const rows = [
      ['Nr ewidencyjny', detailsItem.inventory_number || ''],
      ['Producent', detailsData.manufacturer || ''],
      ['Model', detailsData.model || ''],
      ['Nr seryjny', detailsData.serial_number || ''],
      ['Nr katalogowy', detailsData.catalog_number || ''],
      ['Data produkcji', formatDate(detailsData.production_date) || ''],
      ['Rozpoczęcie użytkowania', formatDate(detailsData.harness_start_date) || ''],
      ['Data przeglądu', formatDate(detailsData.inspection_date) || ''],
      ['Status', detailsItem.status || ''],
      ['Przypisany', `${(detailsItem.assigned_employee_first_name || '')} ${(detailsItem.assigned_employee_last_name || '')}`.trim()]
    ];

    const hasShock = !!(detailsData.shock_absorber_name || detailsData.shock_absorber_model || detailsData.shock_absorber_serial || detailsData.shock_absorber_catalog_number || detailsData.shock_absorber_production_date);
    const hasSrd = !!(detailsData.srd_manufacturer || detailsData.srd_model || detailsData.srd_serial_number || detailsData.srd_catalog_number || detailsData.srd_production_date);

    if (hasShock) {
      rows.push(
        ['Amortyzator: Producent', detailsData.shock_absorber_name || ''],
        ['Amortyzator: Model', detailsData.shock_absorber_model || ''],
        ['Amortyzator: S/N', detailsData.shock_absorber_serial || ''],
        ['Amortyzator: Nr katalogowy', detailsData.shock_absorber_catalog_number || ''],
        ['Amortyzator: Data produkcji', detailsData.shock_absorber_production_date ? formatDate(detailsData.shock_absorber_production_date) : '']
      );
    }

    if (hasSrd) {
      rows.push(
        ['SRD: Producent', detailsData.srd_manufacturer || ''],
        ['SRD: Model', detailsData.srd_model || ''],
        ['SRD: S/N', detailsData.srd_serial_number || ''],
        ['SRD: Nr katalogowy', detailsData.srd_catalog_number || ''],
        ['SRD: Data produkcji', detailsData.srd_production_date ? formatDate(detailsData.srd_production_date) : '']
      );
    }

    const ws = XLSX.utils.aoa_to_sheet([['Pole', 'Wartość'], ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Szczegóły');
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,'-');
    const base = detailsItem.inventory_number || 'pozycja';
    downloadBlob(`bhp_${base}_${stamp}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', wbout);
  };

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const result = await api.get('/api/bhp');
      setItems(result || []);
      notifyInspections(result || []);
    } catch (e) {
      console.error('Błąd pobierania BHP:', e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  const notifiedRef = useRef(new Set());
  // Odmiana jednostki dni: 1 dzień, pozostałe dni
  const dayWord = (n) => (Math.abs(n) === 1 ? 'dzień' : 'dni');
  const notifyInspections = (list) => {
    (list || []).forEach(item => {
      if (!item?.inspection_date) return;
      const insp = new Date(item.inspection_date);
      const now = new Date();
      const diffDays = Math.ceil((insp - now) / (1000 * 60 * 60 * 24));
      const key = `${item.id}-${diffDays}`;
      if (notifiedRef.current.has(key)) return;
      if (diffDays <= 7 && diffDays >= 0) {
        toast.warn(`Przegląd w ciągu 7 dni: ${item.inventory_number} (za ${diffDays} ${dayWord(diffDays)})`, { toastId: key });
        notifiedRef.current.add(key);
      } else if (diffDays <= 30 && diffDays >= 0) {
        toast.info(`Przegląd w ciągu 30 dni: ${item.inventory_number} (za ${diffDays} ${dayWord(diffDays)})`, { toastId: key });
        notifiedRef.current.add(key);
      }
    });
  };

  const openModal = (item = null) => {
    setEditingItem(item);
    if (item) {
      const hasShock = !!(item.shock_absorber_name || item.shock_absorber_model || item.shock_absorber_serial || item.shock_absorber_catalog_number || item.shock_absorber_production_date);
      const hasSrd = !!(item.srd_manufacturer || item.srd_model || item.srd_catalog_number || item.srd_production_date || item.srd_serial_number);
      setFormData({
        ...item,
        is_set: !!item.is_set,
        has_shock_absorber: hasShock,
        has_srd: hasSrd,
        production_date: formatDateForInput(item.production_date),
        harness_start_date: formatDateForInput(item.harness_start_date),
        shock_absorber_name: item.shock_absorber_name || '',
        shock_absorber_model: item.shock_absorber_model || '',
        shock_absorber_serial: item.shock_absorber_serial || '',
        shock_absorber_catalog_number: item.shock_absorber_catalog_number || '',
        shock_absorber_production_date: formatDateForInput(item.shock_absorber_production_date),
        shock_absorber_start_date: formatDateForInput(item.shock_absorber_start_date),
        srd_manufacturer: item.srd_manufacturer || '',
        srd_model: item.srd_model || '',
        srd_serial_number: item.srd_serial_number || '',
        srd_catalog_number: item.srd_catalog_number || '',
        srd_production_date: formatDateForInput(item.srd_production_date)
      });
    } else {
      setFormData({
        inventory_number: '',
        manufacturer: '',
        model: '',
        serial_number: '',
        catalog_number: '',
        production_date: '',
        inspection_date: '',
        is_set: false,
        has_shock_absorber: false,
        has_srd: false,
        harness_start_date: '',
        shock_absorber_serial: '',
        shock_absorber_name: '',
        shock_absorber_model: '',
        shock_absorber_catalog_number: '',
        shock_absorber_production_date: '',
        shock_absorber_start_date: '',
        srd_manufacturer: '',
        srd_model: '',
        srd_serial_number: '',
        srd_catalog_number: '',
        srd_production_date: '',
        status: 'dostępne'
      });
    }
    setShowModal(true);
  };

  const saveItem = async (e) => {
    e.preventDefault();
    try {
      if (formData.has_shock_absorber && formData.has_srd) {
        alert('Nie można zaznaczyć jednocześnie „Amortyzator” i „Urządzenie samohamowne”. Wybierz jedno.');
        return;
      }
      const normalizeDate = (v) => {
        if (!v) return null;
        const str = String(v).trim();
        if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0, 10);
        const dmy = str.match(/^(\d{2})[.\/-](\d{2})[.\/-](\d{4})/);
        if (dmy) {
          const [, dd, mm, yyyy] = dmy;
          return `${yyyy}-${mm}-${dd}`;
        }
        const d = new Date(str);
        if (!isNaN(d.getTime())) {
          const year = d.getFullYear();
          const month = String(d.getMonth() + 1).padStart(2, '0');
          const day = String(d.getDate()).padStart(2, '0');
          return `${year}-${month}-${day}`;
        }
        return null;
      };

      const payload = { 
        ...formData, 
        is_set: (formData.has_shock_absorber || formData.has_srd) ? 1 : 0,
        production_date: normalizeDate(formData.production_date),
        harness_start_date: normalizeDate(formData.harness_start_date),
        inspection_date: normalizeDate(formData.inspection_date),
        shock_absorber_production_date: normalizeDate(formData.shock_absorber_production_date),
        shock_absorber_start_date: normalizeDate(formData.shock_absorber_start_date),
        srd_production_date: normalizeDate(formData.srd_production_date)
      };
      let savedId = null;
      if (editingItem) {
        await api.put(`/api/bhp/${editingItem.id}`, payload);
        // Natychmiast zaktualizuj lokalny stan, aby ponowne otwarcie edycji pokazywało nowe wartości
        setItems(prev => prev.map(i => i.id === editingItem.id ? { ...i, ...payload } : i));
        savedId = editingItem.id;
      } else {
        const created = await api.post('/api/bhp', payload);
        setItems(prev => [...prev, created]);
        savedId = created?.id;
      }
      setShowModal(false);
      setEditingItem(null);
      // Natychmiast odśwież listę z API, aby widok był spójny z bazą
      await fetchItems();

      // Jeśli okno szczegółów jest otwarte dla edytowanej pozycji, przeładuj jego dane natychmiast
      if (detailsItem && savedId && detailsItem.id === savedId) {
        try {
          const freshDetails = await api.get(`/api/bhp/${savedId}/details`);
          setDetailsData(freshDetails);
          // Zsynchronizuj nagłówek szczegółów z najnowszymi danymi
          setDetailsItem(prev => (prev ? { ...prev, ...payload } : prev));
        } catch (err) {
          console.error('Błąd odświeżania szczegółów po zapisie:', err);
        }
      }

      // Potwierdzenie zapisu jako toast
      toast.success('Dane sprzętu zostały zaktualizowane');
    } catch (e) {
      console.error('Błąd zapisu BHP:', e);
      alert('Wystąpił błąd podczas zapisywania wpisu');
    }
  };

  const canManageBhp = (user?.role === 'administrator' || user?.role === 'manager');

  const deleteItem = async (id) => {
    if (!canManageBhp) {
      return alert('Brak uprawnień do usuwania BHP');
    }
    if (!window.confirm('Na pewno usunąć ten wpis BHP?')) return;
    try {
      await api.delete(`/api/bhp/${id}`);
      setItems(prev => prev.filter(i => i.id !== id));
    } catch (e) {
      console.error('Błąd usuwania BHP:', e);
      alert('Wystąpił błąd podczas usuwania');
    }
  };

  const openDetails = async (item) => {
    try {
      setDetailsItem(item);
      const data = await api.get(`/api/bhp/${item.id}/details`);
      setDetailsData(data);
    } catch (e) {
      console.error('Błąd pobierania szczegółów:', e);
      alert('Nie udało się pobrać szczegółów');
    }
  };

  const openIssue = (item) => {
    setDetailsItem(item);
    setSelectedEmployeeId('');
    setIssueModal(true);
  };

  const confirmIssue = async () => {
    if (!canManageBhp) {
      return alert('Brak uprawnień do wydawania BHP');
    }
    if (!selectedEmployeeId) return alert('Wybierz pracownika');
    try {
      await api.post(`/api/bhp/${detailsItem.id}/issue`, { employee_id: Number(selectedEmployeeId) });
      setIssueModal(false);
      fetchItems();
    } catch (e) {
      console.error('Błąd wydania:', e);
      alert('Nie udało się wydać');
    }
  };

  const openReturn = async (item) => {
    setDetailsItem(item);
    try {
      const data = await api.get(`/api/bhp/${item.id}/details`);
      const active = (data.issues || []).find(issue => issue.status === 'wydane');
      setActiveIssueId(active ? active.id : '');
      setReturnModal(true);
    } catch (e) {
      console.error('Błąd przygotowania zwrotu:', e);
      alert('Nie udało się pobrać danych zwrotu');
    }
  };

  const confirmReturn = async () => {
    if (!canManageBhp) {
      return alert('Brak uprawnień do zwrotu BHP');
    }
    if (!activeIssueId) return alert('Brak aktywnego wydania');
    try {
      await api.post(`/api/bhp/${detailsItem.id}/return`, { issue_id: Number(activeIssueId) });
      setReturnModal(false);
      fetchItems();
    } catch (e) {
      console.error('Błąd zwrotu:', e);
      alert('Nie udało się zwrócić');
    }
  };

  const filteredItemsBase = (items || []).filter(item => {
    const matchesSearch = !searchTerm || (
      item.inventory_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.manufacturer?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.model?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.serial_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.catalog_number?.toLowerCase().includes(searchTerm.toLowerCase())
    );
    const matchesStatus = !selectedStatus || item.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  const getDiffDays = (dateStr) => {
    if (!dateStr) return null;
    const today = new Date();
    const date = new Date(dateStr);
    const diffMs = date.setHours(0,0,0,0) - today.setHours(0,0,0,0);
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  };

  const filteredItems = (() => {
    if (sortBy === 'inventory') {
      const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
      const arr = [...filteredItemsBase];
      arr.sort((a, b) => {
        const ai = a.inventory_number || '';
        const bi = b.inventory_number || '';
        if (!ai && !bi) return 0;
        if (!ai) return 1;
        if (!bi) return -1;
        return collator.compare(ai, bi);
      });
      return arr;
    }
    const upcoming = [];
    const overdue = [];
    const noDate = [];
    filteredItemsBase.forEach(item => {
      const d = getDiffDays(item.inspection_date);
      if (d === null) {
        noDate.push(item);
      } else if (d >= 0) {
        upcoming.push({ item, d });
      } else {
        overdue.push({ item, d });
      }
    });
    if (reviewsFilter) {
      upcoming.sort((a, b) => a.d - b.d);
      overdue.sort((a, b) => a.d - b.d);
    } else {
      upcoming.sort((a, b) => b.d - a.d);
      overdue.sort((a, b) => b.d - a.d);
    }
    return [...upcoming.map(x => x.item), ...overdue.map(x => x.item), ...noDate];
  })();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen dark:bg-slate-900">
        <span className="text-slate-500 dark:text-slate-400">Ładowanie...</span>
      </div>
    );
  }

  const renderReminderBadge = (inspection_date) => {
    if (!inspection_date) return null;
    const now = new Date();
    const insp = new Date(inspection_date);
    const diffDays = Math.ceil((insp - now) / (1000 * 60 * 60 * 24));
    const statusClass = diffDays < 0
      ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
      : (diffDays <= 30
        ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
        : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300');
    const label = diffDays < 0
      ? `Po terminie (${Math.abs(diffDays)} ${dayWord(diffDays)})`
      : `Przegląd za ${diffDays} ${dayWord(diffDays)}`;
    return (
      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${statusClass}`}>
        {label}
      </span>
    );
  };

  return (
    <div className="p-6 bg-white dark:bg-slate-900 min-h-screen">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Sprzęt BHP</h1>
          <p className="text-slate-600 dark:text-slate-400">Zarządzaj wyposażeniem BHP (wydania, zwroty, przeglądy)</p>
        </div>
        {canManageBhp ? (
          <button
            onClick={() => openModal()}
            className="bg-blue-600 dark:bg-blue-700 text-white px-4 py-2 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800"
          >
            Dodaj sprzęt
          </button>
        ) : null}
      </div>

      {/* Filtry */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Wyszukaj</label>
            <input
              type="text"
              placeholder="nr ewid., producent, model, seryjny..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Status</label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Wszystkie</option>
              <option value="dostępne">Dostępne</option>
              <option value="wydane">Wydane</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Sortowanie</label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="inspection">Data przeglądu</option>
              <option value="inventory">Nr ewidencyjny</option>
            </select>
          </div>
          {sortBy === 'inspection' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Przeglądy</label>
              <button
                type="button"
                onClick={() => setReviewsFilter(prev => !prev)}
                className={`w-full px-3 py-2 rounded-lg border ${reviewsFilter ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600'}`}
              >
                {reviewsFilter ? 'Najbliższy przegląd' : 'Najdalszy przegląd'}
              </button>
            </div>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={exportListToPDF}
            className="px-4 py-2 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg hover:opacity-90"
          >
            Eksportuj jako PDF
          </button>
          <button
            type="button"
            onClick={exportListToXLSX}
            className="px-4 py-2 bg-emerald-600 dark:bg-emerald-700 text-white rounded-lg hover:bg-emerald-700 dark:hover:bg-emerald-800"
          >
            Eksportuj jako EXCEL
          </button>
        </div>
      </div>

      {/* Widok desktop (tabela) */}
      <div className="hidden md:block bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-700">
            <tr>
              <th className="text-left p-4 font-semibold text-slate-900 dark:text-slate-100">Nr. ew.</th>
              <th className="text-left p-4 font-semibold text-slate-900 dark:text-slate-100">Producent / Model</th>
              <th className="text-left p-4 font-semibold text-slate-900 dark:text-slate-100">Seryjny / Katalogowy</th>
              <th className="text-left p-4 font-semibold text-slate-900 dark:text-slate-100">Przegląd</th>
              <th className="text-left p-4 font-semibold text-slate-900 dark:text-slate-100">Status</th>
              <th className="text-left p-4 font-semibold text-slate-900 dark:text-slate-100">Akcje</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-600">
            {filteredItems.map(item => (
              <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer" onClick={() => openDetails(item)}>
                <td className="p-4 font-mono text-sm text-slate-700 dark:text-slate-200">{item.inventory_number}</td>
                <td className="p-4 text-slate-700 dark:text-slate-200">
                  <div className="font-medium">{item.manufacturer || '-'} {item.model ? `— ${item.model}` : ''}</div>
                  {item.is_set ? (
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      Zestaw: amortyzator {item.shock_absorber_name || '-'} {item.shock_absorber_model || ''} • nr {item.shock_absorber_serial || '-'} • kat. {item.shock_absorber_catalog_number || '-'}
                    </div>
                  ) : null}
                  {item.assigned_employee_first_name || item.assigned_employee_last_name ? (
                    <div className="text-xs text-slate-500 dark:text-slate-400">Przypisano: {item.assigned_employee_first_name || ''} {item.assigned_employee_last_name || ''}</div>
                  ) : null}
                </td>
                <td className="p-4 text-slate-700 dark:text-slate-200">
                  <div>{item.serial_number || '-'}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400">Kat.: {item.catalog_number || '-'}</div>
                </td>
                <td className="p-4">
                  <div className="text-slate-700 dark:text-slate-200">{item.inspection_date ? new Date(item.inspection_date).toLocaleDateString('pl-PL') : '-'}</div>
                  <div className="mt-1">{renderReminderBadge(item.inspection_date)}</div>
                </td>
                <td className="p-4">
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                    item.status === 'dostępne' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300' :
                    item.status === 'wydane' ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-300' :
                    'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-300'
                  }`}>
                    {item.status || 'nieznany'}
                  </span>
                </td>
                <td className="p-4" onClick={(e) => e.stopPropagation()}>
                  <div className="flex gap-3">
                    {canManageBhp ? (
                      <>
                        <button onClick={() => openModal(item)} className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium">Edytuj</button>
                        <button onClick={() => deleteItem(item.id)} className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm font-medium">Usuń</button>
                        {item.status !== 'wydane' ? (
                          <button onClick={() => openIssue(item)} className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 text-sm font-medium">Wydaj</button>
                        ) : (
                          <button onClick={() => openReturn(item)} className="text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-300 text-sm font-medium">Zwrot</button>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-slate-500 dark:text-slate-400">Brak uprawnień do akcji</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Widok mobilny (karty) */}
      <div className="md:hidden divide-y divide-slate-200 dark:divide-slate-600">
        {filteredItems.map((item) => (
          <div
            key={item.id}
            className="p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 dark:bg-slate-800"
            onClick={() => openDetails(item)}
          >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="font-medium text-slate-900 dark:text-slate-100">
                    {item.manufacturer || '-'} {item.model ? `— ${item.model}` : ''}
                  </div>
                  {item.is_set ? (
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Zestaw: amortyzator {item.shock_absorber_name || '-'} {item.shock_absorber_model || ''} • nr {item.shock_absorber_serial || '-'} • kat. {item.shock_absorber_catalog_number || '-'}
                    </div>
                  ) : null}
                  {item.assigned_employee_first_name || item.assigned_employee_last_name ? (
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Przypisano: {item.assigned_employee_first_name || ''} {item.assigned_employee_last_name || ''}
                    </div>
                  ) : null}
                </div>
                <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                  item.status === 'dostępne' ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-300' :
                  item.status === 'wydane' ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-300' :
                  'bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-300'
                }`}>
                  {item.status || 'nieznany'}
                </span>
              </div>

            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Nr ewidencyjny:</span>
                <span className="text-slate-900 dark:text-slate-100 font-mono text-xs">{item.inventory_number || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Seryjny:</span>
                <span className="text-slate-900 dark:text-slate-100">{item.serial_number || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Katalogowy:</span>
                <span className="text-slate-900 dark:text-slate-100">{item.catalog_number || '-'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500 dark:text-slate-400">Przegląd:</span>
                <span className="text-slate-900 dark:text-slate-100">{item.inspection_date ? new Date(item.inspection_date).toLocaleDateString('pl-PL') : '-'}</span>
              </div>
              <div>
                {renderReminderBadge(item.inspection_date)}
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-600" onClick={(e) => e.stopPropagation()}>
              {canManageBhp ? (
                <>
                  <button onClick={() => openModal(item)} className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 text-sm font-medium">Edytuj</button>
                  <button onClick={() => deleteItem(item.id)} className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 text-sm font-medium">Usuń</button>
                  {item.status !== 'wydane' ? (
                    <button onClick={() => openIssue(item)} className="text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 text-sm font-medium">Wydaj</button>
                  ) : (
                    <button onClick={() => openReturn(item)} className="text-orange-600 dark:text-orange-400 hover:text-orange-800 dark:hover:text-orange-300 text-sm font-medium">Zwrot</button>
                  )}
                </>
              ) : (
                <span className="text-xs text-slate-500 dark:text-slate-400">Brak uprawnień do akcji</span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal dodawania/edycji */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">{editingItem ? 'Edytuj pozycję BHP' : 'Dodaj pozycję BHP'}</h2>
            </div>
            <form onSubmit={saveItem} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nr ewidencyjny *</label>
                  <input type="text" value={formData.inventory_number} onChange={(e) => setFormData({ ...formData, inventory_number: e.target.value })} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Producent</label>
                  <input type="text" list="manufacturerOptions" value={formData.manufacturer} onChange={(e) => setFormData({ ...formData, manufacturer: e.target.value })} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Model</label>
                  <input type="text" list="modelOptions" value={formData.model} onChange={(e) => setFormData({ ...formData, model: e.target.value })} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Numer seryjny</label>
                  <input type="text" value={formData.serial_number} onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Numer katalogowy</label>
                  <input type="text" list="catalogOptions" value={formData.catalog_number} onChange={(e) => setFormData({ ...formData, catalog_number: e.target.value })} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Data produkcji (szelek)</label>
                  <input type="date" value={formData.production_date || ''} onChange={(e) => setFormData({ ...formData, production_date: e.target.value })} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Data rozpoczęcia użytkowania</label>
                  <input type="date" value={formData.harness_start_date || ''} onChange={(e) => setFormData({ ...formData, harness_start_date: e.target.value })} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Data przeglądu</label>
                  <input type="date" value={formData.inspection_date || ''} onChange={(e) => setFormData({ ...formData, inspection_date: e.target.value })} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Zestaw</div>
                  <div className="flex items-center gap-6">
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                      <input type="checkbox" className="accent-blue-600 dark:accent-blue-400" checked={formData.has_shock_absorber} onChange={(e) => {
                        const checked = e.target.checked;
                        setFormData({ ...formData, has_shock_absorber: checked, has_srd: checked ? false : formData.has_srd });
                      }} />
                      Amortyzator
                    </label>
                    <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                      <input type="checkbox" className="accent-blue-600 dark:accent-blue-400" checked={formData.has_srd} onChange={(e) => {
                        const checked = e.target.checked;
                        setFormData({ ...formData, has_srd: checked, has_shock_absorber: checked ? false : formData.has_shock_absorber });
                      }} />
                      Urządzenie samohamowne
                    </label>
                  </div>
                </div>
              </div>

              {/* Amortyzator — pola po zaznaczeniu */}
              {formData.has_shock_absorber && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Amortyzator - producent</label>
                      <input type="text" list="shockAbsorberManufacturerOptions" value={formData.shock_absorber_name} onChange={(e) => setFormData({ ...formData, shock_absorber_name: e.target.value })} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Amortyzator - model</label>
                      <input type="text" list="shockAbsorberModelOptions" value={formData.shock_absorber_model} onChange={(e) => setFormData({ ...formData, shock_absorber_model: e.target.value })} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Amortyzator - nr seryjny</label>
                      <input type="text" value={formData.shock_absorber_serial} onChange={(e) => setFormData({ ...formData, shock_absorber_serial: e.target.value })} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Amortyzator - numer katalogowy</label>
                      <input type="text" list="shockAbsorberCatalogOptions" value={formData.shock_absorber_catalog_number} onChange={(e) => setFormData({ ...formData, shock_absorber_catalog_number: e.target.value })} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Amortyzator - data produkcji</label>
                      <input type="date" value={formData.shock_absorber_production_date || ''} onChange={(e) => setFormData({ ...formData, shock_absorber_production_date: e.target.value })} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                  </div>
                </div>
              )}

              {/* Urządzenie samohamowne — pola po zaznaczeniu */}
              {formData.has_srd && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Urządzenie samohamowne - producent</label>
                      <input type="text" list="srdManufacturerOptions" value={formData.srd_manufacturer} onChange={(e) => setFormData({ ...formData, srd_manufacturer: e.target.value })} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Urządzenie samohamowne - model</label>
                      <input type="text" list="srdModelOptions" value={formData.srd_model} onChange={(e) => setFormData({ ...formData, srd_model: e.target.value })} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Urządzenie samohamowne - nr seryjny</label>
                      <input type="text" value={formData.srd_serial_number} onChange={(e) => setFormData({ ...formData, srd_serial_number: e.target.value })} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Urządzenie samohamowne - numer katalogowy</label>
                      <input type="text" list="srdCatalogOptions" value={formData.srd_catalog_number} onChange={(e) => setFormData({ ...formData, srd_catalog_number: e.target.value })} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Urządzenie samohamowne - data produkcji</label>
                      <input type="date" value={formData.srd_production_date || ''} onChange={(e) => setFormData({ ...formData, srd_production_date: e.target.value })} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                  </div>
                </div>
              )}

              {/* Usunięte: Amortyzator - data rozpoczęcia użytkowania (globalne pole wyżej) */}
              {/* Datalisty z podpowiedziami */}
              <datalist id="manufacturerOptions">
                {manufacturerOptions.map((v) => (<option key={v} value={v} />))}
              </datalist>
              <datalist id="modelOptions">
                {modelOptions.map((v) => (<option key={v} value={v} />))}
              </datalist>
              <datalist id="catalogOptions">
                {catalogOptions.map((v) => (<option key={v} value={v} />))}
              </datalist>
              <datalist id="shockAbsorberManufacturerOptions">
                {shockAbsorberManufacturerOptions.map((v) => (<option key={v} value={v} />))}
              </datalist>
              <datalist id="shockAbsorberModelOptions">
                {shockAbsorberModelOptions.map((v) => (<option key={v} value={v} />))}
              </datalist>
              <datalist id="shockAbsorberCatalogOptions">
                {shockAbsorberCatalogOptions.map((v) => (<option key={v} value={v} />))}
              </datalist>
              <datalist id="srdManufacturerOptions">
                {srdManufacturerOptions.map((v) => (<option key={v} value={v} />))}
              </datalist>
              <datalist id="srdModelOptions">
                {srdModelOptions.map((v) => (<option key={v} value={v} />))}
              </datalist>
              <datalist id="srdCatalogOptions">
                {srdCatalogOptions.map((v) => (<option key={v} value={v} />))}
              </datalist>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 px-4 py-2 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600">Anuluj</button>
                <button type="submit" className="flex-1 px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800">Zapisz</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal szczegółów */}
      {detailsItem && detailsData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={(e) => { if (e.target === e.currentTarget) { setDetailsItem(null); setDetailsData(null); } }}>
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 flex justify-between items-center border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Szczegóły BHP: {detailsItem.inventory_number}</h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={exportDetailsToPDF}
                  className="px-3 py-1.5 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 rounded-lg text-sm hover:opacity-90"
                >
                  Eksportuj do PDF
                </button>
                <button
                  onClick={exportDetailsToXLSX}
                  className="px-3 py-1.5 bg-emerald-600 dark:bg-emerald-700 text-white rounded-lg text-sm hover:bg-emerald-700 dark:hover:bg-emerald-800"
                >
                  Eksportuj do EXCEL
                </button>
                <button onClick={() => { setDetailsItem(null); setDetailsData(null); }} className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"><span className="text-2xl">×</span></button>
              </div>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Producent:</span><span className="text-slate-900 dark:text-slate-100 font-medium">{detailsData.manufacturer || '-'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Model:</span><span className="text-slate-900 dark:text-slate-100">{detailsData.model || '-'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Seryjny:</span><span className="text-slate-900 dark:text-slate-100">{detailsData.serial_number || '-'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Katalogowy:</span><span className="text-slate-900 dark:text-slate-100">{detailsData.catalog_number || '-'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Data produkcji:</span><span className="text-slate-900 dark:text-slate-100">{detailsData.production_date ? new Date(detailsData.production_date).toLocaleDateString('pl-PL') : '-'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Rozpoczęcie użytkowania:</span><span className="text-slate-900 dark:text-slate-100">{detailsData.harness_start_date ? new Date(detailsData.harness_start_date).toLocaleDateString('pl-PL') : '-'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Przegląd:</span><span className="text-slate-900 dark:text-slate-100">{detailsData.inspection_date ? new Date(detailsData.inspection_date).toLocaleDateString('pl-PL') : '-'}</span></div>
                <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Przypisany:</span><span className="text-slate-900 dark:text-slate-100">{(detailsItem?.assigned_employee_first_name || detailsItem?.assigned_employee_last_name) ? `${detailsItem?.assigned_employee_first_name || ''} ${detailsItem?.assigned_employee_last_name || ''}`.trim() : '-'}</span></div>

                {(() => {
                  const hasShock = !!(detailsData.shock_absorber_name || detailsData.shock_absorber_model || detailsData.shock_absorber_serial || detailsData.shock_absorber_catalog_number || detailsData.shock_absorber_production_date);
                  const hasSrd = !!(detailsData.srd_manufacturer || detailsData.srd_model || detailsData.srd_catalog_number || detailsData.srd_production_date || detailsData.srd_serial_number);
                  return (
                    <>
                      {hasShock ? (
                        <div className="mt-4">
                          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Amortyzator</div>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Producent:</span><span className="text-slate-900 dark:text-slate-100">{detailsData.shock_absorber_name || '-'}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Model:</span><span className="text-slate-900 dark:text-slate-100">{detailsData.shock_absorber_model || '-'}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Nr seryjny:</span><span className="text-slate-900 dark:text-slate-100">{detailsData.shock_absorber_serial || '-'}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Numer katalogowy:</span><span className="text-slate-900 dark:text-slate-100">{detailsData.shock_absorber_catalog_number || '-'}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Data produkcji:</span><span className="text-slate-900 dark:text-slate-100">{detailsData.shock_absorber_production_date ? new Date(detailsData.shock_absorber_production_date).toLocaleDateString('pl-PL') : '-'}</span></div>
                          </div>
                        </div>
                      ) : null}
                      {hasSrd ? (
                        <div className="mt-4">
                          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">Urządzenie samohamowne</div>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Producent:</span><span className="text-slate-900 dark:text-slate-100">{detailsData.srd_manufacturer || '-'}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Model:</span><span className="text-slate-900 dark:text-slate-100">{detailsData.srd_model || '-'}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Nr seryjny:</span><span className="text-slate-900 dark:text-slate-100">{detailsData.srd_serial_number || '-'}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Numer katalogowy:</span><span className="text-slate-900 dark:text-slate-100">{detailsData.srd_catalog_number || '-'}</span></div>
                            <div className="flex justify-between"><span className="text-slate-500 dark:text-slate-400">Data produkcji:</span><span className="text-slate-900 dark:text-slate-100">{detailsData.srd_production_date ? new Date(detailsData.srd_production_date).toLocaleDateString('pl-PL') : '-'}</span></div>
                          </div>
                        </div>
                      ) : null}
                    </>
                  );
                })()}

                <div className="mt-2">{renderReminderBadge(detailsData.inspection_date)}</div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-3">Historia wydań/zwrotów</h3>
                <div className="space-y-2">
                  {(detailsData.issues || []).length === 0 ? (
                    <div className="text-sm text-slate-500 dark:text-slate-400">Brak wpisów</div>
                  ) : (
                    detailsData.issues.map((issue) => (
                      <div key={issue.id} className="p-2 bg-slate-50 dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600">
                        <div className="text-sm text-slate-900 dark:text-slate-100">
                          {issue.status === 'wydane' ? 'Wydano' : 'Zwrócono'} — {issue.employee_first_name} {issue.employee_last_name}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">{issue.issued_at ? new Date(issue.issued_at).toLocaleString('pl-PL') : '-'}{issue.returned_at ? ` • Zwrot: ${new Date(issue.returned_at).toLocaleString('pl-PL')}` : ''}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal wydania */}
      {issueModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={(e) => { if (e.target === e.currentTarget) setIssueModal(false); }}>
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Wydaj sprzęt BHP</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Pracownik</label>
                <select value={selectedEmployeeId} onChange={(e) => setSelectedEmployeeId(e.target.value)} className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
                  <option value="">— wybierz —</option>
                  {(employees || []).map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setIssueModal(false)} className="flex-1 px-4 py-2 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg">Anuluj</button>
                <button onClick={confirmIssue} className="flex-1 px-4 py-2 bg-emerald-600 dark:bg-emerald-700 text-white rounded-lg">Wydaj</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal zwrotu */}
      {returnModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={(e) => { if (e.target === e.currentTarget) setReturnModal(false); }}>
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Zwrot sprzętu BHP</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                {!activeIssueId ? (
                  <div className="text-sm text-slate-500 dark:text-slate-400">Brak aktywnego wydania do zwrotu</div>
                ) : (
                  <div className="text-sm text-slate-700 dark:text-slate-200">Wydanie ID: {activeIssueId}</div>
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setReturnModal(false)} className="flex-1 px-4 py-2 text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg">Anuluj</button>
                <button onClick={confirmReturn} disabled={!activeIssueId} className="flex-1 px-4 py-2 bg-orange-600 dark:bg-orange-700 text-white rounded-lg disabled:opacity-50">Zwróć</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default BhpScreen;