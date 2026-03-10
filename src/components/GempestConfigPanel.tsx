import React, { useState, useCallback } from 'react';
import { Save, AlertCircle, CheckCircle, HelpCircle, Loader2 } from 'lucide-react';
import { gempestService, type GempestConfig, GEMINI_MODELS, type GeminiModel } from '../services/gempestService';

export const GempestConfigPanel: React.FC = () => {
  const [config, setConfig] = useState<GempestConfig>(gempestService.getConfig());
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      gempestService.saveConfig(config);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  }, [config]);

  const handleTestAPI = async () => {
    if (!config.apiKey) return;
    setTestStatus('testing');
    try {
      const ok = await gempestService.testGemini(config.apiKey);
      setTestStatus(ok ? 'success' : 'error');
    } catch (e) {
      setTestStatus('error');
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
          ✨ Gempest Configuration
        </h3>
        <p className="text-sm text-gray-600 mb-6">
          Gempest runs automatically over your emails, identifies newsletters, determines if they are full-text or a list of links, and summarizes them using Google's Gemini API instead of a local model.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Google AI Studio API Key
            </label>
            <div className="flex gap-2">
              <input
                type="password"
                value={config.apiKey}
                onChange={(e) => {
                  setConfig(prev => ({ ...prev, apiKey: e.target.value }));
                  setTestStatus('idle');
                }}
                placeholder="AIzaSy..."
                className="flex-1 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
              />
              <button
                onClick={handleTestAPI}
                disabled={!config.apiKey || testStatus === 'testing'}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {testStatus === 'testing' ? <Loader2 size={16} className="animate-spin" /> : 'Test API'}
              </button>
            </div>
            
            {testStatus === 'success' && (
               <p className="mt-2 text-sm text-green-600 flex items-center gap-1">
                 <CheckCircle size={14} /> Connection strictly verified.
               </p>
            )}
            {testStatus === 'error' && (
               <p className="mt-2 text-sm text-red-600 flex items-center gap-1">
                 <AlertCircle size={14} /> Connection failed. Please check your key.
               </p>
            )}

            <div className="mt-3 p-3 bg-blue-50 rounded-lg text-sm text-blue-800 flex items-start gap-2">
              <HelpCircle size={18} className="mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-medium mb-1">How to get a Gemini API Key:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Go to <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="underline hover:text-blue-900">Google AI Studio</a>.</li>
                  <li>Sign in with your Google account.</li>
                  <li>Click "Create API key" and copy the key into the field above.</li>
                </ol>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Gemini Model
            </label>
            <select
              value={config.model || 'gemini-2.5-flash'}
              onChange={(e) => setConfig(prev => ({ ...prev, model: e.target.value as GeminiModel }))}
              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              {GEMINI_MODELS.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Action after successful processing
            </label>
            <select
              value={config.postAction}
              onChange={(e) => setConfig(prev => ({ ...prev, postAction: e.target.value as 'mark_read' | 'delete' | 'none' }))}
              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="none">Do Nothing</option>
              <option value="mark_read">Mark As Read</option>
              <option value="delete">Delete Automatically</option>
            </select>
            <p className="mt-1 text-sm text-gray-500">What to do with the original email after generating summaries.</p>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Prompts</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Type Identification Prompt
            </label>
            <textarea
              value={config.newsletterTypePrompt || ''}
              onChange={(e) => setConfig(prev => ({ ...prev, newsletterTypePrompt: e.target.value }))}
              rows={4}
              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 font-mono text-sm"
              placeholder='Determine the type of the following email. If it is NOT a newsletter, reply with "OTHER". If it is a newsletter and contains mostly a full article, reply with "NL_FULL". If it is a newsletter but is mostly a list of links to articles, reply with "NL_LINK". Only reply with one of these three exact words.'
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Summary Prompt
            </label>
            <textarea
              value={config.emailSummaryPrompt}
              onChange={(e) => setConfig(prev => ({ ...prev, emailSummaryPrompt: e.target.value }))}
              rows={2}
              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 font-mono text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Link Summary Prompt
            </label>
            <textarea
              value={config.linkSummaryPrompt}
              onChange={(e) => setConfig(prev => ({ ...prev, linkSummaryPrompt: e.target.value }))}
              rows={2}
              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 font-mono text-sm"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`flex items-center gap-2 px-6 py-2 rounded-lg font-medium transition-colors ${
            saveSuccess
              ? 'bg-green-500 text-white'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isSaving ? (
            <Loader2 size={20} className="animate-spin" />
          ) : saveSuccess ? (
            <CheckCircle size={20} />
          ) : (
            <Save size={20} />
          )}
          {saveSuccess ? 'Saved!' : 'Save Configuration'}
        </button>
      </div>
    </div>
  );
};