import { useState, useEffect } from 'react';
import { db } from '../services/db';
import { Setting } from '../types';

export const SettingsView = () => {
  const [apiKey, setApiKey] = useState('');
  const [aiModel, setAiModel] = useState('flash');
  
  const [isSaved, setIsSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Ny state för att hantera laddning

  // Använd en useEffect som körs enbart en gång för att hämta initiala data.
  // Detta förhindrar race conditions där live-data skriver över användarens input.
  useEffect(() => {
    const fetchInitialSettings = async () => {
      try {
        // Hämta båda inställningarna med bulkGet
        const settings = await db.settings.bulkGet(['geminiApiKey', 'aiModel']);
        const apiKeySetting = settings[0];
        const aiModelSetting = settings[1];

        if (apiKeySetting) {
          setApiKey(apiKeySetting.value);
        }
        if (aiModelSetting) {
          setAiModel(aiModelSetting.value);
        }
      } catch (error) {
        console.error("Kunde inte ladda inställningar:", error);
      } finally {
        setIsLoading(false); // Sätt laddning till false oavsett resultat
      }
    };

    fetchInitialSettings();
  }, []); // Tom dependency array säkerställer att effekten bara körs en gång

  const handleSaveSettings = async () => {
    setIsSaved(false);
    try {
      // Använd individuella `put`-anrop för maximal säkerhet. `put` skapar eller uppdaterar.
      await db.settings.put({ id: 'geminiApiKey', value: apiKey });
      await db.settings.put({ id: 'aiModel', value: aiModel });

      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (error) {
      console.error("Kunde inte spara inställningar:", error);
    }
  };

  if (isLoading) {
    return <div className="p-6">Laddar inställningar...</div>;
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <h1 className="text-3xl font-bold mb-8">Inställningar</h1>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <h2 className="text-xl font-bold mb-4">AI-inställningar</h2>
        
        <div className="space-y-4">
          <div>
            <label htmlFor="apiKey" className="block text-sm font-medium text-gray-700 mb-1">
              API Nyckel (Gemini)
            </label>
            <input
              type="password"
              id="apiKey"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
              placeholder="Ange din Google Gemini API-nyckel"
            />
          </div>

          <div>
            <label htmlFor="aiModel" className="block text-sm font-medium text-gray-700 mb-1">
              Modell
            </label>
            <select
              id="aiModel"
              value={aiModel}
              onChange={(e) => setAiModel(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="flash">Gemini 1.5 Flash (Snabb & Kostnadseffektiv)</option>
              <option value="pro">Gemini 1.5 Pro (Högst kvalitet)</option>
            </select>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end">
          {isSaved && (
            <p className="text-green-600 text-sm mr-4 transition-opacity duration-300">
              Sparat!
            </p>
          )}
          <button
            onClick={handleSaveSettings}
            className="btn btn-primary"
          >
            Spara inställningar
          </button>
        </div>
      </div>
    </div>
  );
};
