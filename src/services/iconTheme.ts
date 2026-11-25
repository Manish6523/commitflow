import * as fs from 'fs';
import * as path from 'path';
import { FileIcon, IconFont } from '../types/protocol';

// Icons are small; anything bigger isn't worth sending to the sidebar.
const MAX_ICON_BYTES = 256 * 1024;
const MAX_FONT_BYTES = 2 * 1024 * 1024;

interface IconDefinition {
  iconPath?: string;
  fontCharacter?: string;
  fontColor?: string;
  fontId?: string;
  fontSize?: string;
}

interface Associations {
  file?: string;
  fileExtensions?: Record<string, string>;
  fileNames?: Record<string, string>;
  languageIds?: Record<string, string>;
}

export interface IconThemeJson extends Associations {
  iconDefinitions?: Record<string, IconDefinition>;
  fonts?: { id: string; src: { path: string; format?: string }[]; size?: string }[];
  light?: Associations;
  highContrast?: Associations;
}

/** Which language a file belongs to, by name and by extension without its dot. All lower case. */
export interface LanguageMap {
  names: Record<string, string>;
  extensions: Record<string, string>;
}

const own = (map: Record<string, string> | undefined, key: string): string | undefined =>
  map && Object.prototype.hasOwnProperty.call(map, key) ? map[key] : undefined;

const lowerKeys = (map: Record<string, string> | undefined): Record<string, string> =>
  Object.fromEntries(Object.entries(map ?? {}).map(([key, value]) => [key.toLowerCase(), value]));

/** "a.test.ts" gives "test.ts" then "ts", most specific first. */
function extensionsOf(name: string): string[] {
  const parts = name.split('.');
  return parts.slice(1).map((_part, i) => parts.slice(i + 1).join('.'));
}

/** Collect languages from extensions' `contributes.languages`. */
export function buildLanguageMap(
  languages: { id?: string; extensions?: string[]; filenames?: string[] }[]
): LanguageMap {
  const map: LanguageMap = { names: {}, extensions: {} };
  for (const { id, extensions, filenames } of languages) {
    if (!id) continue;
    for (const name of filenames ?? []) map.names[name.toLowerCase()] = id;
    for (const ext of extensions ?? []) map.extensions[ext.toLowerCase().replace(/^\./, '')] = id;
  }
  return map;
}

/** One loaded file icon theme, picking icons in the order VS Code does. */
export class IconTheme {
  private readonly layers: Required<Pick<Associations, 'fileNames' | 'fileExtensions' | 'languageIds'>>[];
  private readonly defaults: (string | undefined)[];
  private readonly images = new Map<string, string | null>();

  /** `directory` holds the theme's JSON; icons outside `root`, its extension's folder, are never read. */
  constructor(
    private readonly theme: IconThemeJson,
    private readonly directory: string,
    private readonly root: string,
    private readonly languages: LanguageMap,
    variant: 'dark' | 'light' | 'highContrast'
  ) {
    const override = variant === 'dark' ? undefined : theme[variant];
    const sources: Associations[] = override ? [override, theme] : [theme];
    this.layers = sources.map((s) => ({
      fileNames: lowerKeys(s.fileNames),
      fileExtensions: lowerKeys(s.fileExtensions),
      languageIds: s.languageIds ?? {},
    }));
    this.defaults = sources.map((s) => s.file);
  }

  /** The name of a file's icon definition: by name, then extension, then language, then the default. */
  public definitionFor(filePath: string): string | undefined {
    const parts = filePath.toLowerCase().split('/');
    const name = parts[parts.length - 1];
    const extensions = extensionsOf(name);
    const language =
      own(this.languages.names, name) ??
      extensions.map((ext) => own(this.languages.extensions, ext)).find((id) => id !== undefined);

    const find = (pick: (layer: IconTheme['layers'][number]) => string | undefined) =>
      this.layers.map(pick).find((id) => id !== undefined);

    // A theme can name a file inside a folder, such as ".github/labeler.yml".
    for (let i = 0; i < parts.length; i++) {
      const found = find((layer) => own(layer.fileNames, parts.slice(i).join('/')));
      if (found) return found;
    }
    for (const ext of extensions) {
      const found = find((layer) => own(layer.fileExtensions, ext));
      if (found) return found;
    }
    return (
      (language && find((layer) => own(layer.languageIds, language))) ||
      this.defaults.find((id) => id !== undefined)
    );
  }

  /** A file's icon, ready to show, or undefined if the theme has none for it. */
  public iconFor(filePath: string): FileIcon | undefined {
    const id = this.definitionFor(filePath);
    const definition = id ? this.theme.iconDefinitions?.[id] : undefined;
    if (!definition) return undefined;

    if (definition.iconPath) {
      const image = this.readImage(definition.iconPath);
      return image ? { image } : undefined;
    }
    if (definition.fontCharacter) {
      const font = this.theme.fonts?.find((f) => f.id === definition.fontId) ?? this.theme.fonts?.[0];
      const code = parseInt(definition.fontCharacter.replace(/^\\/, ''), 16);
      if (!font || Number.isNaN(code) || code > 0x10ffff) return undefined;
      return {
        character: String.fromCodePoint(code),
        color: definition.fontColor,
        font: font.id,
        size: definition.fontSize ?? font.size,
      };
    }
    return undefined;
  }

  /** The fonts the theme draws icons with, embedded. */
  public fonts(): IconFont[] {
    return (this.theme.fonts ?? []).flatMap((font) => {
      const source = font.src?.[0];
      const data = source && this.readInside(source.path, MAX_FONT_BYTES);
      if (!data) return [];
      const format = /^[a-z0-9]+$/i.test(source.format ?? '') ? source.format! : 'woff';
      return [{ id: font.id, src: `data:font/${format};base64,${data.toString('base64')}` }];
    });
  }

  private readImage(relative: string): string | null {
    let image = this.images.get(relative);
    if (image === undefined) {
      const ext = path.extname(relative).toLowerCase();
      const type = ext === '.svg' ? 'svg+xml' : ext === '.png' ? 'png' : ext === '.jpg' || ext === '.jpeg' ? 'jpeg' : null;
      const data = type ? this.readInside(relative, MAX_ICON_BYTES) : null;
      image = data ? `data:image/${type};base64,${data.toString('base64')}` : null;
      this.images.set(relative, image);
    }
    return image;
  }

  private readInside(relative: string, maxBytes: number): Buffer | null {
    const full = path.resolve(this.directory, relative);
    if (!full.startsWith(path.resolve(this.root) + path.sep)) return null;
    try {
      return fs.statSync(full).size <= maxBytes ? fs.readFileSync(full) : null;
    } catch {
      return null;
    }
  }
}
