import { useState, useEffect } from 'react';

export const SettingsView = () => {
  const [apiKey, setApiKey] = useState('');
  const [aiModel, setAiModel] = useState('flash');
  
  // State för Regioner
  const [regions, setRegions] = useState<string[]>([]);
  const [newRegion, setNewRegion] = useState('');

  // State för Avdelningar
  const [departments, setDepartments] = useState<string[]>([]);
  const [newDepartment, setNewDepartment] = useState('');

  // Hämta sparad data när sidan laddas
  useEffect(() => {
    const savedKey = localStorage.getItem('GEMINI_API_KEY');
    const savedModel = localStorage.getItem('GEMINI_MODEL');
    const savedRegions = JSON.parse(localStorage.getItem('GLOBAL_REGIONS') || '[]');
    const savedDepartments = JSON.parse(localStorage.getItem('GLOBAL_DEPARTMENTS') || '[]');
    
    if (savedKey) setApiKey(savedKey);
    if (savedModel) setAiModel(savedModel);
    
    setRegions(Array.isArray(savedRegions) ? savedRegions : []);
    setDepartments(Array.isArray(savedDepartments) ? savedDepartments : []);
  }, []);

  // --- AUTOSAVE FUNKTIONER ---

  const handleApiKeyChange = (val: string) => {
    setApiKey(val);
    localStorage.setItem('GEMINI_API_KEY', val); // Sparar direkt i minnet
  };

  const handleAiModelChange = (val: string) => {
    setAiModel(val);
    localStorage.setItem('GEMINI_MODEL', val); // Sparar direkt i minnet
  };

  const addRegion = () => {
    if (!newRegion.trim() || regions.includes(newRegion.trim())) return;
    const updatedRegions = [...regions, newRegion.trim()];
    setRegions(updatedRegions);
    localStorage.setItem('GLOBAL_REGIONS', JSON.stringify(updatedRegions)); // Autosave
    setNewRegion('');
  };

  const removeRegion = (regionToRemove: string) => {
    const updatedRegions = regions.filter(r => r !== regionToRemove);
    setRegions(updatedRegions);
    localStorage.setItem('GLOBAL_REGIONS', JSON.stringify(updatedRegions)); // Autosave
  };

  const addDepartment = () => {
    if (!newDepartment.trim() || departments.includes(newDepartment.trim())) return;
    const updatedDepartments = [...departments, newDepartment.trim()];
    setDepartments(updatedDepartments);
    localStorage.setItem('GLOBAL_DEPARTMENTS', JSON.stringify(updatedDepartments)); // Autosave
    setNewDepartment('');
  };

  const removeDepartment = (deptToRemove: string) => {
    const updatedDepartments = departments.filter(d => d !== deptToRemove);
    setDepartments(updatedDepartments);
    localStorage.setItem('GLOBAL_DEPARTMENTS', JSON.stringify(updatedDepartments)); // Autosave
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen pb-24 space-y-6">
      <div className="flex justify-between items-end">
        <h1 className="text-3xl font-bold text-gray-900">Inställningar</h1>
        <span className="text-sm font-medium text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-200">
          ✓ Sparar automatiskt
        </span>
      </div>

      {/* AI-INSTÄLLNINGAR */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">🤖 AI-inställningar</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">API Nyckel (Gemini)</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => handleApiKeyChange(e.target.value)}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
              placeholder="AIzaSy..."
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Modell</label>
            <select
              value={aiModel}
              onChange={(e) => handleAiModelChange(e.target.value)}
              className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
            >
              <option value="flash">Gemini 1.5 Flash</option>
              <option value="pro">Gemini 1.5 Pro</option>
            </select>
          </div>
        </div>
      </div>

      {/* REGIONER */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">🌍 Regioner</h2>
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={newRegion}
              onChange={(e) => setNewRegion(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addRegion()}
              className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
              placeholder="T.ex. Stockholm eller Skåne"
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
            {regions.length === 0 && <span className="text-gray-400 text-sm italic">Inga regioner tillagda.</span>}
          </div>
        </div>
      </div>

      {/* AVDELNINGAR */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">🏢 Avdelningar</h2>
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={newDepartment}
              onChange={(e) => setNewDepartment(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addDepartment()}
              className="flex-1 p-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
              placeholder="T.ex. IT, HR eller Marknad"
            />
            <button onClick={addDepartment} className="p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors">
              Lägg till
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {departments.map(d => (
              <span key={d} className="bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-2 border border-gray-200">
                {d}
                <button onClick={() => removeDepartment(d)} className="text-gray-400 hover:text-red-500">×</button>
              </span>
            ))}
            {departments.length === 0 && <span className="text-gray-400 text-sm italic">Inga avdelningar tillagda.</span>}
          </div>
        </div>
      </div>
    </div>
  );
};