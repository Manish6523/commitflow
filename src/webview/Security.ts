import * as crypto from 'crypto';

export class Security {
  public static getNonce(): string {
    return crypto.randomBytes(16).toString('base64');
  }

  public static getCSP(webviewCspSource: string, nonce: string): string {
    return [
      `default-src 'none'`,
      `img-src ${webviewCspSource} https: data: blob:`,
      `script-src ${webviewCspSource} 'nonce-${nonce}' 'unsafe-eval' 'unsafe-inline'`,
      `style-src ${webviewCspSource} 'unsafe-inline'`,
      `worker-src blob:`,
      `font-src ${webviewCspSource} https: data:`,
      `connect-src ${webviewCspSource} https: data: blob:`,
    ].join('; ');
  }
}
