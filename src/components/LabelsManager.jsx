import { useState } from 'react';

// Komponent zarządzania etykietami
function LabelsManager({ tools, user }) {
  const [selectedTools, setSelectedTools] = useState([]);

  return (
    <div className="p-4 lg:p-8 bg-slate-50 min-h-screen">
      <div className="mb-8">
        <h1 className="text-2xl lg:text-3xl font-bold text-slate-900 mb-2">Etykiety</h1>
        <p className="text-slate-600">Generuj i drukuj etykiety dla narzędzi</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Generator etykiet</h3>
        <p className="text-slate-600 mb-6">Wybierz narzędzia, dla których chcesz wygenerować etykiety.</p>
        
        <div className="space-y-4">
          {tools.map(tool => (
            <div key={tool.id} className="flex items-center gap-3 p-3 border border-slate-200 rounded-lg">
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
                className="w-4 h-4 text-blue-600"
              />
              <div className="flex-1">
                <p className="font-medium text-slate-900">{tool.name}</p>
                <p className="text-sm text-slate-600">SKU: {tool.sku}</p>
              </div>
            </div>
          ))}
        </div>

        {selectedTools.length > 0 && (
          <div className="mt-6 pt-6 border-t border-slate-200">
            <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors">
              Generuj etykiety ({selectedTools.length})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default LabelsManager;