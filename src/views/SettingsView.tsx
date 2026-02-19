import { useState, useEffect } from 'react';
import { Save, Key, Cpu } from 'lucide-react';

export const SettingsView = () => {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState('flash');

  useEffect(() => {
    setApiKey(localStorage.getItem('GEMINI_API_KEY') || '');
    setModel(localStorage.getItem('AI_MODEL') || 'flash');
  }, []);

  const handleSave = () => {
    localStorage.setItem('GEMINI_API_KEY', apiKey);
    localStorage.setItem('AI_MODEL', model);
    alert('Inställningar sparade!');
  };

  return (
    <div className="min-h-screen bg-white p-6 pb-24">
      <h1 className="text-2xl font-bold mb-6">Inställningar</h1>

      <div className="space-y-6">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <Key size={20} />
            </div>
            <h2 className="font-bold text-gray-900">API Nyckel</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            För att använda AI-analysen behöver du en API-nyckel från Google AI Studio.
          </p>
          <input 
            type="password" 
            value={apiKey}
            onChange={e => setApiKey(e.target.value)}
            placeholder="Klistra in din Gemini API Key"
            className="w-full bg-gray-50 border-gray-200 rounded-xl text-sm mb-4"
          />
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 bg-purple-50 rounded-lg text-purple-600">
              <Cpu size={20} />
            </div>
            <h2 className="font-bold text-gray-900">AI Modell</h2>
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-3 p-3 border rounded-xl cursor-pointer hover:bg-gray-50">
              <input 
                type="radio" 
                name="model" 
                value="flash" 
                checked={model === 'flash'} 
                onChange={e => setModel(e.target.value)}
                className="text-blue-600 focus:ring-blue-500"
              />
              <div>
                <div className="font-medium text-sm">Gemini Flash</div>
                <div className="text-xs text-gray-500">Snabbare, billigare</div>
              </div>
            </label>
            <label className="flex items-center gap-3 p-3 border rounded-xl cursor-pointer hover:bg-gray-50">
              <input 
                type="radio" 
                name="model" 
                value="pro" 
                checked={model === 'pro'} 
                onChange={e => setModel(e.target.value)}
                className="text-blue-600 focus:ring-blue-500"
              />
              <div>
                <div className="font-medium text-sm">Gemini Pro</div>
                <div className="text-xs text-gray-500">Bättre analys, långsammare</div>
              </div>
            </label>
          </div>
        </div>

        <button 
          onClick={handleSave}
          className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
        >
          <Save size={20} /> Spara Ändringar
        </button>
      </div>
    </div>
  );
};
