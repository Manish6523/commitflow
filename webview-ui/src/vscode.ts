// Type declaration for VS Code Webview API
declare function acquireVsCodeApi(): any;

let vscodeApiInstance: any = null;
try {
  if (typeof acquireVsCodeApi === 'function') {
    vscodeApiInstance = acquireVsCodeApi();
  }
} catch (e) {
  if (typeof window !== 'undefined' && (window as any).__vscode_api__) {
    vscodeApiInstance = (window as any).__vscode_api__;
  }
}

if (!vscodeApiInstance) {
  vscodeApiInstance = {
    postMessage: (msg: any) => console.log('[Mock VSCode PostMessage]', msg),
    getState: () => ({}),
    setState: () => {},
  };
}

if (typeof window !== 'undefined') {
  (window as any).__vscode_api__ = vscodeApiInstance;
}

class VsCodeApi {
  private readonly vscode: any;
  private responseHandlers = new Map<string, (response: any) => void>();

  constructor() {
    this.vscode = vscodeApiInstance;

    if (typeof window !== 'undefined') {
      window.addEventListener('message', (event) => {
        const message = event.data;
        if (message && message.requestId && this.responseHandlers.has(message.requestId)) {
          const handler = this.responseHandlers.get(message.requestId)!;
          handler(message);
          this.responseHandlers.delete(message.requestId);
        }
      });
    }
  }

  public postMessage(message: any): void {
    try {
      this.vscode.postMessage(message);
    } catch (e) {
      console.error('Failed to post message to extension host:', e);
    }
  }

  public request<T = any>(message: any): Promise<T> {
    const id = `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    return new Promise((resolve) => {
      this.responseHandlers.set(id, (res) => resolve(res));
      this.postMessage({ ...message, id });
      // 10s fallback timeout
      setTimeout(() => {
        if (this.responseHandlers.has(id)) {
          this.responseHandlers.delete(id);
        }
      }, 10000);
    });
  }
}

export const vscode = new VsCodeApi();
