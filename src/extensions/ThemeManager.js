import type * as monaco from 'monaco-editor';
import type { Theme } from './types';

export class ThemeManager {
  private themes: Map<string, Theme> = new Map();
  private currentTheme: string = 'vs-dark';
  private customThemes: { [key: string]: monaco.editor.IStandaloneThemeData } = {};

  constructor() {
    this.registerBuiltInThemes();
  }

  registerBuiltInThemes(): void {
    // Register popular themes
    const builtInThemes: monaco.editor.IStandaloneThemeData[] = [
      {
        base: 'vs-dark',
        inherit: true,
        rules: [],
        colors: {
          'editor.background': '#1e1e1e',
          'editor.foreground': '#d4d4d4',
          'editorLineNumber.foreground': '#858585',
          'editor.selectionBackground': '#264f78',
          'editor.inactiveSelectionBackground': '#3a3d41',
        },
      },
      {
        base: 'vs',
        inherit: true,
        rules: [],
        colors: {
          'editor.background': '#ffffff',
          'editor.foreground': '#333333',
          'editorLineNumber.foreground': '#237893',
          'editor.selectionBackground': '#add6ff',
          'editor.inactiveSelectionBackground': '#e5ebf1',
        },
      },
      {
        base: 'hc-black',
        inherit: true,
        rules: [],
        colors: {
          'editor.background': '#000000',
          'editor.foreground': '#ffffff',
          'editorLineNumber.foreground': '#ffffff',
          'editor.selectionBackground': '#ffff00',
        },
      },
    ];

    // Register custom VOID theme
    this.customThemes['void-dark'] = {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { background: '0a0a0f', token: '' },
        { foreground: '7c3aed', token: 'keyword' },
        { foreground: '22d3ee', token: 'string' },
        { foreground: 'f472b6', token: 'number' },
        { foreground: 'a78bfa', token: 'function' },
        { foreground: 'fbbf24', token: 'variable.parameter' },
      ],
      colors: {
        'editor.background': '#0a0a0f',
        'editor.lineHighlightBackground': '#12121a',
        'editorLineNumber.foreground': '#4b5563',
        'editorIndentGuide.background': '#1f1f2e',
        'editorIndentGuide.activeBackground': '#374151',
        'editor.selectionBackground': '#7c3aed40',
        'editorCursor.foreground': '#22d3ee',
        'editor.lineHighlightBorder': '#1f1f2e00',
      },
    };

    this.customThemes['void-light'] = {
      base: 'vs',
      inherit: true,
      rules: [
        { foreground: '7c3aed', token: 'keyword' },
        { foreground: '0891b2', token: 'string' },
        { foreground: 'db2777', token: 'number' },
        { foreground: '6366f1', token: 'function' },
      ],
      colors: {
        'editor.background': '#ffffff',
        'editor.lineHighlightBackground': '#f8fafc',
        'editorLineNumber.foreground': '#64748b',
        'editor.selectionBackground': '#c7d2fe80',
      },
    };
  }

  registerBuiltInThemes(monacoInstance: typeof monaco): void {
    for (const [name, themeData] of Object.entries(this.customThemes)) {
      monacoInstance.editor.defineTheme(name, themeData);
    }
  }

  async registerTheme(theme: Theme, monacoInstance?: typeof monaco): Promise<void> {
    this.themes.set(theme.id, theme);

    if (monacoInstance) {
      const monacoTheme: monaco.editor.IStandaloneThemeData = {
        base: theme.type === 'light' ? 'vs' : theme.type === 'hc' ? 'hc-black' : 'vs-dark',
        inherit: true,
        rules: [],
        colors: theme.colors,
      };
      monacoInstance.editor.defineTheme(theme.id, monacoTheme);
    }
  }

  setTheme(themeName: string, monacoInstance?: typeof monaco): void {
    if (!this.themeExists(themeName) && !this.customThemes[themeName]) {
      console.warn(`Theme '${themeName}' not found, falling back to vs-dark`);
      themeName = 'vs-dark';
    }

    this.currentTheme = themeName;

    if (monacoInstance) {
      monacoInstance.editor.setTheme(themeName);
    }

    // Apply theme to document
    this.applyThemeToDocument(themeName);
  }

  getCurrentTheme(): string {
    return this.currentTheme;
  }

  getAvailableThemes(): string[] {
    return [
      ...Object.keys(this.customThemes),
      ...Array.from(this.themes.keys()),
    ];
  }

  themeExists(themeName: string): boolean {
    return this.customThemes[themeName] !== undefined || this.themes.has(themeName);
  }

  getTheme(themeName: string): Theme | undefined {
    return this.themes.get(themeName);
  }

  getAllThemes(): Theme[] {
    return Array.from(this.themes.values());
  }

  private applyThemeToDocument(themeName: string): void {
    const theme = themeName === 'void-dark' ? 'dark' : 'light';

    document.documentElement.setAttribute('data-theme', theme);

    // Update CSS custom properties
    const root = document.documentElement;
    if (theme === 'dark') {
      root.style.setProperty('--void-bg', '#0a0a0f');
      root.style.setProperty('--void-panel', '#12121a');
      root.style.setProperty('--void-border', '#1f1f2e');
      root.style.setProperty('--void-violet', '#7c3aed');
      root.style.setProperty('--void-cyan', '#22d3ee');
    } else {
      root.style.setProperty('--void-bg', '#ffffff');
      root.style.setProperty('--void-panel', '#f8fafc');
      root.style.setProperty('--void-border', '#e2e8f0');
      root.style.setProperty('--void-violet', '#7c3aed');
      root.style.setProperty('--void-cyan', '#0891b2');
    }
  }

  // Generate theme from color palette
  generateThemeFromPalette(
    name: string,
    base: 'vs' | 'vs-dark' | 'hc-black',
    colors: { [key: string]: string }
  ): Theme {
    const theme: Theme = {
      id: name,
      name,
      type: base === 'vs' ? 'light' : base === 'hc-black' ? 'hc' : 'dark',
      colors,
    };

    this.themes.set(name, theme);
    return theme;
  }
}
