// Type declaration for VS Code Webview API
declare function acquireVsCodeApi(): {
  postMessage(message: any): void;
  getState(): any;
  setState(state: any): void;
};

class VsCodeApi {
  private readonly vscode: any;
  private responseHandlers = new Map<string, (response: any) => void>();

  constructor() {
    this.vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : {
      postMessage: (msg: any) => console.log('[Mock VSCode PostMessage]', msg),
      getState: () => ({}),
      setState: () => {},
    };

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
    this.vscode.postMessage(message);
  }

  public request<T = any>(message: any): Promise<T> {
    const id = `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    return new Promise((resolve) => {
      this.responseHandlers.set(id, (res) => resolve(res));
      this.vscode.postMessage({ ...message, id });
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

