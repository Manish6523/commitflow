export type AIProvider = 'openai' | 'anthropic' | 'gemini' | 'custom';

export interface AIConnection {
  provider: AIProvider;
  model: string;
  apiKey?: string;
  baseUrl?: string;
}

interface CompletionRequest {
  system: string;
  prompt: string;
  maxTokens: number;
}

const REQUEST_TIMEOUT_MS = 180000;
const ANTHROPIC_VERSION = '2023-06-01';

const ENDPOINTS = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta',
};

/** Plain HTTP would send the key and code in the clear, so it's for this machine only. */
export function normalizeBaseUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    throw new Error('Enter a full server URL, such as http://localhost:11434/v1.');
  }

  const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocal)) {
    throw new Error('The server URL must use https, unless it is on this machine.');
  }
  // People often paste the full endpoint, but requests add these paths themselves.
  return url
    .toString()
    .replace(/\/+$/, '')
    .replace(/\/(chat\/completions|completions|models)$/, '');
}

/** Remove the reasoning some models put before their answer. */
export function stripReasoning(text: string): string {
  return text.replace(/<think(ing)?>[\s\S]*?<\/think(ing)?>/gi, '').trim();
}

function failure(status: number, detail: string): Error {
  if (status === 401 || status === 403) {
    return new Error('The provider rejected this API key. Check that it is correct and active.');
  }
  if (status === 404) {
    return new Error(`The provider could not find that model or address. ${detail}`.trim());
  }
  if (status === 429) {
    return new Error('The provider reports a rate limit or used-up quota on this account.');
  }
  return new Error(`The provider returned an error (${status}). ${detail}`.trim());
}

async function send(url: string, init: RequestInit): Promise<any> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  } catch (err: any) {
    if (err?.name === 'TimeoutError') {
      throw new Error('The provider took too long to respond.');
    }
    throw new Error(`Could not reach the provider at ${new URL(url).host}.`);
  }

  const text = await res.text();
  let body: any;
  try {
    body = JSON.parse(text);
  } catch {
    body = undefined;
  }

  if (!res.ok) {
    const detail = body?.error?.message ?? body?.message ?? '';
    throw failure(res.status, String(detail).slice(0, 200));
  }
  if (body === undefined) {
    throw new Error('The provider sent a response CommitFlow could not read.');
  }
  return body;
}

function bearer(apiKey?: string): Record<string, string> {
  return apiKey ? { Authorization: `Bearer ${apiKey}` } : {};
}

function anthropicHeaders(apiKey?: string): Record<string, string> {
  return { 'x-api-key': apiKey ?? '', 'anthropic-version': ANTHROPIC_VERSION };
}

function geminiHeaders(apiKey?: string): Record<string, string> {
  return { 'x-goog-api-key': apiKey ?? '' };
}

function openAiBase(connection: AIConnection): string {
  return connection.provider === 'custom' ? normalizeBaseUrl(connection.baseUrl ?? '') : ENDPOINTS.openai;
}

/** Send one prompt and return the model's text. */
export async function complete(connection: AIConnection, request: CompletionRequest): Promise<string> {
  const { provider, model, apiKey } = connection;
  const json = { 'Content-Type': 'application/json' };
  let text: string | undefined;

  if (provider === 'anthropic') {
    const body = await send(`${ENDPOINTS.anthropic}/messages`, {
      method: 'POST',
      headers: { ...json, ...anthropicHeaders(apiKey) },
      body: JSON.stringify({
        model,
        max_tokens: request.maxTokens,
        system: request.system,
        messages: [{ role: 'user', content: request.prompt }],
      }),
    });
    text = body.content
      ?.filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('');
  } else if (provider === 'gemini') {
    const body = await send(`${ENDPOINTS.gemini}/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { ...json, ...geminiHeaders(apiKey) },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: request.system }] },
        contents: [{ role: 'user', parts: [{ text: request.prompt }] }],
      }),
    });
    text = body.candidates?.[0]?.content?.parts?.map((part: any) => part.text ?? '').join('');
  } else {
    // No token limit here: the parameter's name differs across OpenAI models and
    // compatible servers, and these replies are short anyway.
    const body = await send(`${openAiBase(connection)}/chat/completions`, {
      method: 'POST',
      headers: { ...json, ...bearer(apiKey) },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: request.system },
          { role: 'user', content: request.prompt },
        ],
      }),
    });
    text = body.choices?.[0]?.message?.content;
  }

  const answer = stripReasoning(text ?? '');
  if (!answer) {
    throw new Error('The model returned an empty response.');
  }
  return answer;
}

const NON_CHAT_MODEL = /embed|audio|realtime|tts|transcribe|whisper|image|dall-e|moderation|search|sora|vision|aqa/i;

/** List the models this key can use, newest first where the provider says. */
export async function listModels(connection: AIConnection): Promise<string[]> {
  const { provider, apiKey } = connection;

  if (provider === 'anthropic') {
    const body = await send(`${ENDPOINTS.anthropic}/models?limit=100`, { headers: anthropicHeaders(apiKey) });
    return (body.data ?? []).map((model: any) => model.id);
  }

  if (provider === 'gemini') {
    const body = await send(`${ENDPOINTS.gemini}/models?pageSize=200`, { headers: geminiHeaders(apiKey) });
    return (body.models ?? [])
      .filter((model: any) => model.supportedGenerationMethods?.includes('generateContent'))
      .map((model: any) => String(model.name).replace(/^models\//, ''))
      .filter((id: string) => !NON_CHAT_MODEL.test(id))
      .sort((a: string, b: string) => b.localeCompare(a, undefined, { numeric: true }));
  }

  const body = await send(`${openAiBase(connection)}/models`, { headers: bearer(apiKey) });
  return (body.data ?? [])
    .slice()
    .sort((a: any, b: any) => (b.created ?? 0) - (a.created ?? 0))
    .map((model: any) => model.id)
    .filter((id: string) => provider === 'custom' || !NON_CHAT_MODEL.test(id));
}

/** Choose a starting model from what the key can access. */
export function pickDefaultModel(provider: AIProvider, models: string[]): string {
  if (provider === 'anthropic') {
    return models.find((id) => id.startsWith('claude-opus')) ?? models[0] ?? '';
  }
  if (provider === 'openai') {
    return models.find((id) => /^gpt-/.test(id)) ?? models[0] ?? '';
  }
  if (provider === 'gemini') {
    const stable = models.filter((id) => /^gemini-/.test(id) && !/preview|exp/i.test(id));
    return stable.find((id) => id.includes('pro')) ?? stable[0] ?? models[0] ?? '';
  }
  return models.find((id) => id === 'auto') ?? models[0] ?? '';
}
