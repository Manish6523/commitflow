import React, { useEffect, useState } from 'react';
import { Check, AlertCircle, ExternalLink, KeyRound, Sparkles } from 'lucide-react';
import { AIProvider, AIStatus } from '../types';
import { vscode } from '../vscode';
import { ghostButton, primaryButton, textInput } from './ui/styles';

const PROVIDERS: { id: AIProvider; label: string; keyUrl?: string; keyHint: string }[] = [
  { id: 'openai', label: 'OpenAI', keyUrl: 'https://platform.openai.com/api-keys', keyHint: 'sk-...' },
  { id: 'anthropic', label: 'Anthropic', keyUrl: 'https://console.anthropic.com/settings/keys', keyHint: 'sk-ant-...' },
  { id: 'gemini', label: 'Google Gemini', keyUrl: 'https://aistudio.google.com/apikey', keyHint: 'AIza...' },
  { id: 'custom', label: 'Custom server', keyHint: 'Optional for local servers' },
];

const Field: React.FC<{ label: string; hint?: React.ReactNode; children: React.ReactNode }> = ({
  label,
  hint,
  children,
}) => (
  <label className="block">
    <span className="block text-xs font-medium text-gray-200 mb-1">{label}</span>
    {children}
    {hint && <span className="block text-[11px] text-gray-400 mt-1">{hint}</span>}
  </label>
);

interface Result {
  ok: boolean;
  message: string;
}

export const SettingsView: React.FC = () => {
  const [status, setStatus] = useState<AIStatus | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [models, setModels] = useState<string[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    vscode.request<AIStatus>({ type: 'GET_AI_SETTINGS' }).then((settings) => setStatus(settings));

  useEffect(() => {
    load();
  }, []);

  if (!status) {
    return (
      <div className="max-w-xl mx-auto p-6 space-y-3" aria-label="Loading settings">
        <div className="cf-skeleton rounded h-4 w-1/3" />
        <div className="cf-skeleton rounded h-8 w-full" />
        <div className="cf-skeleton rounded h-8 w-full" />
      </div>
    );
  }

  const provider = PROVIDERS.find((p) => p.id === status.provider) ?? PROVIDERS[0];
  const isCustom = status.provider === 'custom';
  const canUse = status.hasKey || apiKey.trim().length > 0 || isCustom;

  const update = (changes: Partial<AIStatus>) => {
    setStatus({ ...status, ...changes });
    setResult(null);
  };

  const settings = () => ({
    enabled: status.enabled,
    provider: status.provider,
    model: status.model,
    baseUrl: status.baseUrl,
    ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
  });

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setResult(null);
    try {
      await action();
    } catch (err: any) {
      setResult({ ok: false, message: err.message });
    } finally {
      setBusy(false);
    }
  };

  const changeProvider = (id: AIProvider) =>
    run(async () => {
      const saved = await vscode.request<AIStatus>({
        type: 'SAVE_AI_SETTINGS',
        settings: { enabled: status.enabled, provider: id, model: '', baseUrl: status.baseUrl },
      });
      setStatus(saved);
      setApiKey('');
      setModels([]);
    });

  const save = () =>
    run(async () => {
      const saved = await vscode.request<AIStatus>({
        type: 'SAVE_AI_SETTINGS',
        settings: { ...settings(), enabled: status.enabled || apiKey.trim().length > 0 },
      });
      setStatus(saved);
      setApiKey('');
      setResult({ ok: true, message: 'Saved.' });
    });

  const test = () =>
    run(async () => {
      const res = await vscode.request<Result & { models: string[] }>(
        { type: 'TEST_AI_CONNECTION', settings: settings() },
        120000
      );
      setModels(res.models);
      setResult(res);
    });

  const removeKey = () =>
    run(async () => {
      const saved = await vscode.request<AIStatus>({
        type: 'SAVE_AI_SETTINGS',
        settings: { ...settings(), apiKey: '', enabled: isCustom && status.enabled },
      });
      setStatus(saved);
      setApiKey('');
      setResult({ ok: true, message: 'API key removed.' });
    });

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-xl mx-auto px-6 py-5 space-y-4">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-gray-100">
            <Sparkles className="w-4 h-4 text-purple-500" />
            AI
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Use your own API key for AI Insights and Smart Search. Without one, CommitFlow uses basic
            built-in analysis.
          </p>
        </div>

        <Field label="Provider">
          <select
            value={status.provider}
            disabled={busy}
            onChange={(e) => changeProvider(e.target.value as AIProvider)}
            className={`${textInput} cursor-pointer`}
          >
            {PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>

        {isCustom && (
          <Field
            label="Server URL"
            hint="Any OpenAI-compatible server. Must use https unless it runs on this machine."
          >
            <input
              value={status.baseUrl}
              onChange={(e) => update({ baseUrl: e.target.value })}
              placeholder="http://localhost:11434/v1"
              className={`${textInput} font-mono`}
            />
          </Field>
        )}

        <Field
          label="API key"
          hint={
            provider.keyUrl ? (
              <a href={provider.keyUrl} className="inline-flex items-center gap-1 text-blue-500 hover:underline">
                Get a {provider.label} key
                <ExternalLink className="w-3 h-3" />
              </a>
            ) : undefined
          }
        >
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <KeyRound className="w-3 h-3 absolute left-2 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="password"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setResult(null);
                }}
                placeholder={status.hasKey ? 'Saved. Paste a new key to replace it' : provider.keyHint}
                autoComplete="off"
                spellCheck={false}
                className={`${textInput} pl-6 font-mono`}
              />
            </div>
            {status.hasKey && (
              <button onClick={removeKey} disabled={busy} className={ghostButton}>
                Remove
              </button>
            )}
          </div>
        </Field>

        <Field label="Model" hint="Chosen for you when you save a key. Test connection lists what your key can use.">
          <input
            list="cf-ai-models"
            value={status.model}
            onChange={(e) => update({ model: e.target.value })}
            placeholder="Chosen automatically"
            spellCheck={false}
            className={`${textInput} font-mono`}
          />
          <datalist id="cf-ai-models">
            {models.map((model) => (
              <option key={model} value={model} />
            ))}
          </datalist>
        </Field>

        <label className="flex items-center gap-2 text-xs text-gray-200 cursor-pointer">
          <input
            type="checkbox"
            checked={status.enabled}
            onChange={(e) => update({ enabled: e.target.checked })}
            className="accent-blue-600"
          />
          Use AI for AI Insights and Smart Search
        </label>

        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={save} disabled={busy} className={primaryButton}>
            Save
          </button>
          <button onClick={test} disabled={busy || !canUse} className={ghostButton}>
            {busy ? 'Working…' : 'Test connection'}
          </button>
          {result && (
            <span
              role="status"
              className={`flex items-center gap-1 text-xs animate-in fade-in duration-150 ${
                result.ok ? 'text-emerald-500' : 'text-rose-500'
              }`}
            >
              {result.ok ? <Check className="w-3.5 h-3.5 shrink-0" /> : <AlertCircle className="w-3.5 h-3.5 shrink-0" />}
              {result.message}
            </span>
          )}
        </div>

        <div className="text-[11px] text-gray-400 border-t border-vscode-border pt-3 space-y-1">
          <p>
            Your key is stored in VS Code's encrypted secret storage, and it's only sent to the provider you
            chose.
          </p>
          <p>
            When AI is on, commit messages, file names and diffs are sent to {provider.label}, and usage is
            billed to your account. Files like .env and private keys are left out of diffs.
          </p>
        </div>
      </div>
    </div>
  );
};
