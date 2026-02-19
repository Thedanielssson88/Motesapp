import { useState, useEffect } from 'react';

export const SettingsView = () => {
  const [apiKey, setApiKey] = useState('');
  const [aiModel, setAiModel] = useState('flash');
  const [isSaved, setIsSaved] = useState(false);

  // Hämta inställningar direkt när sidan laddas
  useEffect(() => {
    const savedKey = localStorage.getItem('GEMINI_API_KEY');
    const savedModel = localStorage.getItem('GEMINI_MODEL');
    if (savedKey) setApiKey(savedKey);
    if (savedModel) setAiModel(savedModel);
  }, []);

  // Spara synkront till webbläsaren
  const handleSaveSettings = () => {
    localStorage.setItem('GEMINI_API_KEY', apiKey);
    localStorage.setItem('GEMINI_MODEL', aiModel);
    
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen pb-24">
      <h1 className="text-3xl font-bold mb-8 text-gray-900">Inställningar</h1>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          🤖 AI-inställningar
        </h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              API Nyckel (Google Gemini)
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
              placeholder="AIzaSy..."
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">
              Modell
            </label>
            <select
              value={aiModel}
              onChange={(e) => setAiModel(e.target.value)}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            >
              <option value="flash">Gemini 1.5 Flash (Snabb & Kostnadseffektiv)</option>
              <option value="pro">Gemini 1.5 Pro (Högst kvalitet, bäst för stora möten)</option>
            </select>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-end gap-4">
          {isSaved && (
            <span className="text-green-600 font-bold text-sm animate-pulse">
              ✓ Sparat!
            </span>
          )}
          <button
            onClick={handleSaveSettings}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl transition-all active:scale-95"
          >
            Spara inställningar
          </button>
        </div>
      </div>
    </div>
  );
};
