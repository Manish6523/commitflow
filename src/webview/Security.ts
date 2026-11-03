import * as crypto from 'crypto';

export class Security {
  public static getNonce(): string {
    return crypto.randomBytes(16).toString('base64');
  }

  public static getCSP(webviewCspSource: string, nonce: string): string {
    return [
      `default-src 'none'`,
      `img-src ${webviewCspSource} https: data:`,
      `script-src 'nonce-${nonce}'`,
      `style-src ${webviewCspSource} 'unsafe-inline'`,
      `font-src ${webviewCspSource}`,
      `connect-src ${webviewCspSource} https:`,
    ].join('; ');
  }
}
