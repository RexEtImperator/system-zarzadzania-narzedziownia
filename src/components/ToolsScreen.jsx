import React, { useState } from 'react';

function ToolsScreen({ tools, setTools, employees, user }) {
  const [showModal, setShowModal] = useState(false);
  const [editingTool, setEditingTool] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const filteredTools = tools.filter(tool => {
    const matchesSearch = tool.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         tool.sku?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !filterCategory || tool.category === filterCategory;
    const matchesStatus = !filterStatus || tool.status === filterStatus;
    
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const categories = [...new Set(tools.map(tool => tool.category).filter(Boolean))];
  const statuses = [...new Set(tools.map(tool => tool.status).filter(Boolean))];

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Zarządzanie narzędziami</h1>
          <p className="text-slate-600">Dodawaj, edytuj i zarządzaj narzędziami</p>
        </div>
        <button
          onClick={() => {
            setEditingTool(null);
            setShowModal(true);
          }}
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
                    <tr key={tool.id} className="hover:bg-slate-50">
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
                      <td className="p-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setEditingTool(tool);
                              setShowModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            Edytuj
                          </button>
                          <button
                            onClick={() => {
                              if (window.confirm('Czy na pewno chcesz usunąć to narzędzie?')) {
                                setTools(tools.filter(t => t.id !== tool.id));
                              }
                            }}
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
                <div key={tool.id} className="p-4">
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
                  
                  <div className="flex gap-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => {
                        setEditingTool(tool);
                        setShowModal(true);
                      }}
                      className="flex-1 bg-blue-50 text-blue-600 py-2 px-3 rounded-lg hover:bg-blue-100 transition-colors text-sm font-medium"
                    >
                      Edytuj
                    </button>
                    <button
                      onClick={() => {
                        if (window.confirm('Czy na pewno chcesz usunąć to narzędzie?')) {
                          setTools(tools.filter(t => t.id !== tool.id));
                        }
                      }}
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
    </div>
  );
}

export default ToolsScreen;