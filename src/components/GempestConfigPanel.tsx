import React, { useState, useCallback, useEffect } from 'react';
import { Save, AlertCircle, CheckCircle, HelpCircle, Loader2, Pencil, Trash2, Check, X } from 'lucide-react';
import { gempestService, fetchGeminiModels, type GempestConfig, type GeminiModel } from '../services/gempestService';
import { memoryService } from '../services/memoryService';

interface MemorySectionProps {
  title: string;
  subtitle: string;
  clearLabel: string;
  list: string[];
  editingIndex: number | null;
  editingValue: string;
  onStartEdit: (index: number, phrase: string) => void;
  onCancelEdit: () => void;
  onEditingValueChange: (value: string) => void;
  onSaveEdit: (index: number) => void;
  onDelete: (index: number) => void;
  onClearAll: () => void;
}

const MemorySection: React.FC<MemorySectionProps> = ({
  title, subtitle, clearLabel, list,
  editingIndex, editingValue,
  onStartEdit, onCancelEdit, onEditingValueChange, onSaveEdit, onDelete, onClearAll,
}) => (
  <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
    <h3 className="text-lg font-medium text-gray-900 mb-1 flex items-center gap-2">{title}</h3>
    <p className="text-sm text-gray-500 mb-4">{subtitle}</p>

    {list.length === 0 ? (
      <p className="text-sm text-gray-400 italic">No memory phrases yet. Accept phrases from summaries to build your list.</p>
    ) : (
      <ul className="space-y-2">
        {list.map((phrase, index) => (
          <li key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
            {editingIndex === index ? (
              <>
                <input
                  type="text"
                  value={editingValue}
                  onChange={(e) => onEditingValueChange(e.target.value)}
                  className="flex-1 rounded border-gray-300 text-sm focus:border-indigo-500 focus:ring-indigo-500"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onSaveEdit(index);
                    else if (e.key === 'Escape') onCancelEdit();
                  }}
                />
                <button onClick={() => onSaveEdit(index)} className="p-1 text-green-600 hover:text-green-800" title="Save">
                  <Check size={16} />
                </button>
                <button onClick={onCancelEdit} className="p-1 text-gray-400 hover:text-gray-600" title="Cancel">
                  <X size={16} />
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 text-sm text-gray-700">{phrase}</span>
                <button onClick={() => onStartEdit(index, phrase)} className="p-1 text-gray-400 hover:text-indigo-600" title="Edit">
                  <Pencil size={14} />
                </button>
                <button onClick={() => onDelete(index)} className="p-1 text-gray-400 hover:text-red-600" title="Delete">
                  <Trash2 size={14} />
                </button>
              </>
            )}
          </li>
        ))}
      </ul>
    )}

    {list.length > 0 && (
      <button onClick={onClearAll} className="mt-4 text-sm text-red-600 hover:text-red-800 underline">
        {clearLabel}
      </button>
    )}
  </div>
);

export const GempestConfigPanel: React.FC = () => {
  const [config, setConfig] = useState<GempestConfig>(gempestService.getConfig());
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  const [geminiModels, setGeminiModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [memoryList, setMemoryList] = useState<string[]>(() => memoryService.getMemoryList('reductive'));
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [reinforcingList, setReinforcingList] = useState<string[]>(() => memoryService.getMemoryList('reinforcing'));
  const [reinforcingEditingIndex, setReinforcingEditingIndex] = useState<number | null>(null);
  const [reinforcingEditingValue, setReinforcingEditingValue] = useState('');

  const loadModels = useCallback(async (apiKey: string) => {
    if (!apiKey) return;
    setLoadingModels(true);
    try {
      const models = await fetchGeminiModels(apiKey);
      setGeminiModels(models);
    } catch (e) {
      console.error('Failed to load Gemini models', e);
    } finally {
      setLoadingModels(false);
    }
  }, []);

  useEffect(() => {
    loadModels(config.apiKey);
  // Only run on mount with the initial key
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      if (ok) loadModels(config.apiKey);
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
                onBlur={(e) => loadModels(e.target.value)}
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
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              Model Selection (per task)
              {loadingModels && <Loader2 size={14} className="animate-spin text-gray-400" />}
            </label>
            {geminiModels.length === 0 && !loadingModels && (
              <p className="text-xs text-gray-400 mb-2">
                {config.apiKey ? 'Could not load models. Check your API key.' : 'Enter your API key above to load available models.'}
              </p>
            )}
            <div className="space-y-3">
              {([
                { label: 'Classification (newsletter detection)', field: 'classificationModel' },
                { label: 'Email Summary', field: 'emailSummaryModel' },
                { label: 'Link Summary', field: 'linkSummaryModel' },
              ] as { label: string; field: keyof GempestConfig }[]).map(({ label, field }) => (
                <div key={field}>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
                  <select
                    value={(config[field] as GeminiModel) || ''}
                    onChange={(e) => setConfig(prev => ({ ...prev, [field]: e.target.value as GeminiModel }))}
                    disabled={geminiModels.length === 0}
                    className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 disabled:opacity-50"
                  >
                    {config[field] && !geminiModels.includes(config[field] as string) && (
                      <option value={config[field] as string}>{config[field] as string}</option>
                    )}
                    {geminiModels.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="flex items-center gap-3 cursor-pointer">
              <div className="relative">
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={!!config.memoryEnabled}
                  onChange={(e) => setConfig(prev => ({ ...prev, memoryEnabled: e.target.checked }))}
                />
                <div
                  className={`w-10 h-6 rounded-full transition-colors ${config.memoryEnabled ? 'bg-blue-600' : 'bg-gray-300'}`}
                />
                <div
                  className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${config.memoryEnabled ? 'translate-x-4' : 'translate-x-0'}`}
                />
              </div>
              <span className="text-sm font-medium text-gray-700">Enable Memory Feature</span>
            </label>
            <p className="mt-1 text-sm text-gray-500">
              When enabled, after each summary Gemini generates a short phrase representing what was read.
              You can accept it to build memory lists: <strong>Reductive</strong> to deprioritize familiar topics, or <strong>Reinforcing</strong> to boost topics of interest in future summaries.
            </p>
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Delay between emails (seconds)
            </label>
            <input
              type="number"
              min={0}
              step={1}
              value={config.delayBetweenEmails ?? 0}
              onChange={(e) => setConfig(prev => ({ ...prev, delayBetweenEmails: Math.max(0, parseInt(e.target.value, 10) || 0) }))}
              className="w-32 rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
            <p className="mt-1 text-sm text-gray-500">Add a pause between processing each email to avoid hitting API rate limits (RPM). Set to 0 for no delay.</p>
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
            {config.memoryEnabled && (
              <p className="text-xs text-indigo-600 mt-1">
                💡 Use <code>[MEMORY_LIST]</code> or <code>[REDUCTIVE_MEMORY]</code> to inject topics the user already knows (deprioritized), and <code>[REINFORCING_MEMORY]</code> to inject topics the user wants to see more of (boosted).
              </p>
            )}
            <p className="text-xs text-blue-600 mt-1">💡 Use <code>[SENDER_EMAIL]</code> in this prompt to inject the sender's email address (e.g. to boost or lower priority for specific senders).</p>
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
            {config.memoryEnabled && (
              <p className="text-xs text-indigo-600 mt-1">
                💡 Use <code>[MEMORY_LIST]</code> or <code>[REDUCTIVE_MEMORY]</code> to inject topics the user already knows (deprioritized), and <code>[REINFORCING_MEMORY]</code> to inject topics the user wants to see more of (boosted).
              </p>
            )}
            <p className="text-xs text-blue-600 mt-1">💡 Use <code>[SENDER_EMAIL]</code> in this prompt to inject the sender's email address (e.g. to boost or lower priority for specific senders).</p>
          </div>
          {config.memoryEnabled && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Memory Phrase Generator Prompt
              </label>
              <p className="text-xs text-gray-500 mb-1">Used to distill each summary into a short 5–30 word phrase representing a concept from the email. The generated phrase can be filed as either <strong>Reductive</strong> (to deprioritize familiar topics) or <strong>Reinforcing</strong> (to boost topics of interest).</p>
              <textarea
                value={config.memoryPhraseGeneratorPrompt || ''}
                onChange={(e) => setConfig(prev => ({ ...prev, memoryPhraseGeneratorPrompt: e.target.value }))}
                rows={3}
                className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 font-mono text-sm"
              />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email Useful Link Identification Prompt
            </label>
            <p className="text-xs text-gray-500 mb-1">Used to batch-filter links in newsletters before summarizing — the model returns only the URLs worth reading.</p>
            <textarea
              value={config.linkFilterPrompt || ''}
              onChange={(e) => setConfig(prev => ({ ...prev, linkFilterPrompt: e.target.value }))}
              rows={4}
              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 font-mono text-sm"
            />
            <p className="text-xs text-blue-600 mt-1">💡 Use <code>[SENDER_EMAIL]</code> in this prompt to inject the sender's email address (e.g. to boost or lower priority for specific senders).</p>
          </div>
        </div>
      </div>

      {config.memoryEnabled && (
        <>
          <MemorySection
            title="⬇ Reductive Memory"
            subtitle="Topics you already know — deprioritized in future summaries."
            clearLabel="Clear All Reductive Memory"
            list={memoryList}
            editingIndex={editingIndex}
            editingValue={editingValue}
            onStartEdit={(index, phrase) => { setEditingIndex(index); setEditingValue(phrase); }}
            onCancelEdit={() => setEditingIndex(null)}
            onEditingValueChange={setEditingValue}
            onSaveEdit={(index) => {
              memoryService.updateMemoryItem(index, editingValue, 'reductive');
              setMemoryList(memoryService.getMemoryList('reductive'));
              setEditingIndex(null);
            }}
            onDelete={(index) => {
              memoryService.removeMemoryItem(index, 'reductive');
              setMemoryList(memoryService.getMemoryList('reductive'));
            }}
            onClearAll={() => {
              memoryService.clearAll('reductive');
              setMemoryList([]);
            }}
          />
          <MemorySection
            title="⬆ Reinforcing Memory"
            subtitle="Topics you want to see more of — boosted in future summaries."
            clearLabel="Clear All Reinforcing Memory"
            list={reinforcingList}
            editingIndex={reinforcingEditingIndex}
            editingValue={reinforcingEditingValue}
            onStartEdit={(index, phrase) => { setReinforcingEditingIndex(index); setReinforcingEditingValue(phrase); }}
            onCancelEdit={() => setReinforcingEditingIndex(null)}
            onEditingValueChange={setReinforcingEditingValue}
            onSaveEdit={(index) => {
              memoryService.updateMemoryItem(index, reinforcingEditingValue, 'reinforcing');
              setReinforcingList(memoryService.getMemoryList('reinforcing'));
              setReinforcingEditingIndex(null);
            }}
            onDelete={(index) => {
              memoryService.removeMemoryItem(index, 'reinforcing');
              setReinforcingList(memoryService.getMemoryList('reinforcing'));
            }}
            onClearAll={() => {
              memoryService.clearAll('reinforcing');
              setReinforcingList([]);
            }}
          />
        </>
      )}

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