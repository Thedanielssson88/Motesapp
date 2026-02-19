import { useState, useEffect } from 'react';

export const SettingsView = () => {
  const [apiKey, setApiKey] = useState('');
  const [aiModel, setAiModel] = useState('flash');
  const [regions, setRegions] = useState<string[]>([]);
  const [newRegion, setNewRegion] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const savedKey = localStorage.getItem('GEMINI_API_KEY');
    const savedModel = localStorage.getItem('GEMINI_MODEL');
    const savedRegions = JSON.parse(localStorage.getItem('GLOBAL_REGIONS') || '[]');
    
    if (savedKey) setApiKey(savedKey);
    if (savedModel) setAiModel(savedModel);
    setRegions(savedRegions);
  }, []);

  const handleSaveSettings = () => {
    localStorage.setItem('GEMINI_API_KEY', apiKey);
    localStorage.setItem('GEMINI_MODEL', aiModel);
    localStorage.setItem('GLOBAL_REGIONS', JSON.stringify(regions));
    
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const addRegion = () => {
    if (!newRegion.trim() || regions.includes(newRegion.trim())) return;
    setRegions([...regions, newRegion.trim()]);
    setNewRegion('');
  };

  const removeRegion = (regionToRemove: string) => {
    setRegions(regions.filter(r => r !== regionToRemove));
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen pb-24 space-y-6">
      <h1 className="text-3xl font-bold text-gray-900">Inställningar</h1>

      {/* AI-INSTÄLLNINGAR */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">🤖 AI-inställningar</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">API Nyckel (Gemini)</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
              placeholder="AIzaSy..."
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Modell</label>
            <select
              value={aiModel}
              onChange={(e) => setAiModel(e.target.value)}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
            >
              <option value="flash">Gemini 1.5 Flash</option>
              <option value="pro">Gemini 1.5 Pro</option>
            </select>
          </div>
        </div>
      </div>

      {/* REGIONER / AVDELNINGAR */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">📍 Avdelningar / Regioner</h2>
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={newRegion}
              onChange={(e) => setNewRegion(e.target.value)}
              className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
              placeholder="T.ex. Stockholm eller IT-avdelningen"
            />
            <button onClick={addRegion} className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors">
              Lägg till
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {regions.map(r => (
              <span key={r} className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 border border-gray-200">
                {r}
                <button onClick={() => removeRegion(r)} className="text-gray-400 hover:text-red-500">×</button>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8 flex items-center justify-end gap-4">
        {isSaved && <span className="text-green-600 font-bold text-sm">✓ Sparat!</span>}
        <button onClick={handleSaveSettings} className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition-all">
          Spara alla inställningar
        </button>
      </div>
    </div>
  );
};