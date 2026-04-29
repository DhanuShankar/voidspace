import type { MarketplaceExtension, MarketplaceSearchOptions, ExtensionUpdate } from './types';

export class MarketplaceClient {
  private baseUrl: string;
  private installedExtensions: Set<string> = new Set();

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async searchExtensions(
    options: MarketplaceSearchOptions = {}
  ): Promise<MarketplaceExtension[]> {
    try {
      const params = new URLSearchParams();

      if (options.text) params.append('q', options.text);
      if (options.category) params.append('category', options.category);
      if (options.sortBy) params.append('sortBy', options.sortBy);
      if (options.sortOrder) params.append('sortOrder', options.sortOrder);
      if (options.page) params.append('page', options.page.toString());
      if (options.pageSize) params.append('pageSize', options.pageSize.toString());

      const response = await fetch(`${this.baseUrl}/api/extensions/search?${params}`);

      if (!response.ok) {
        throw new Error(`Marketplace request failed: ${response.status}`);
      }

      const data = await response.json();
      return this.normalizeExtensions(data.extensions || []);
    } catch (error) {
      console.error('Marketplace search error:', error);
      // Return mock data for development
      return this.getMockExtensions();
    }
  }

  async getExtension(extensionId: string): Promise<MarketplaceExtension | null> {
    try {
      const response = await fetch(`${this.baseUrl}/api/extensions/${extensionId}`);

      if (!response.ok) {
        throw new Error(`Failed to get extension: ${response.status}`);
      }

      const data = await response.json();
      return this.normalizeExtension(data);
    } catch (error) {
      console.error('Failed to get extension:', error);
      return null;
    }
  }

  async getFeaturedExtensions(): Promise<MarketplaceExtension[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/extensions/featured`);

      if (!response.ok) {
        throw new Error(`Failed to get featured extensions: ${response.status}`);
      }

      const data = await response.json();
      return this.normalizeExtensions(data.extensions || []);
    } catch (error) {
      console.error('Failed to get featured extensions:', error);
      return this.getMockFeaturedExtensions();
    }
  }

  async getCategories(): Promise<string[]> {
    try {
      const response = await fetch(`${this.baseUrl}/api/extensions/categories`);

      if (!response.ok) {
        throw new Error(`Failed to get categories: ${response.status}`);
      }

      const data = await response.json();
      return data.categories || [];
    } catch (error) {
      return [
        'Programming Languages',
        'Linters',
        'Formatters',
        'Themes',
        'Snippets',
        'Debuggers',
        'Testing',
        'Git',
        'Cloud',
      ];
    }
  }

  async downloadExtension(extensionId: string): Promise<Blob> {
    try {
      const response = await fetch(`${this.baseUrl}/api/extensions/${extensionId}/download`);

      if (!response.ok) {
        throw new Error(`Failed to download extension: ${response.status}`);
      }

      return await response.blob();
    } catch (error) {
      console.error('Download error:', error);
      throw error;
    }
  }

  async checkForUpdates(): Promise<ExtensionUpdate[]> {
    const updates: ExtensionUpdate[] = [];

    try {
      // Get installed extensions from storage
      const installed = await this.getInstalledExtensions();

      for (const extension of installed) {
        // Check if update available
        const latest = await this.getExtension(extension.id);
        if (latest && latest.version !== extension.version) {
          updates.push({
            id: extension.id,
            version: latest.version,
            downloadUrl: `${this.baseUrl}/api/extensions/${extension.id}/download`,
            changelog: latest.versionHistory?.[0],
            publishedDate: latest.lastUpdated,
          });
        }
      }

      return updates;
    } catch (error) {
      console.error('Update check error:', error);
      return [];
    }
  }

  async getLatestVersion(extensionId: string): Promise<{ version: string }> {
    const ext = await this.getExtension(extensionId);
    if (!ext) {
      throw new Error(`Extension not found: ${extensionId}`);
    }
    return { version: ext.version };
  }

  async reportExtensionUsage(extensionId: string, action: 'install' | 'uninstall' | 'use'): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/api/extensions/${extensionId}/usage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, timestamp: new Date().toISOString() }),
      });
    } catch (error) {
      // Ignore reporting errors
    }
  }

  async rateExtension(extensionId: string, rating: number): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/api/extensions/${extensionId}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating }),
      });
    } catch (error) {
      console.error('Rating failed:', error);
    }
  }

  async reviewExtension(
    extensionId: string,
    review: string,
    rating: number
  ): Promise<void> {
    try {
      await fetch(`${this.baseUrl}/api/extensions/${extensionId}/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ review, rating }),
      });
    } catch (error) {
      console.error('Review failed:', error);
    }
  }

  private normalizeExtension(data: any): MarketplaceExtension {
    return {
      id: data.identifier?.value || data.id,
      name: data.name || data.extensionName,
      publisher: data.publisher?.displayName || data.publisher,
      version: data.version || '1.0.0',
      description: data.shortDescription || data.description || '',
      downloads: data.downloadCount || 0,
      rating: data.averageRating || 0,
      iconUrl: data.icons?.['default'] || data.iconUrl,
      versionHistory: data.versions || [],
      installCount: data.installCount || data.downloadCount || 0,
      averageRating: data.averageRating || 0,
      averageRatingBreakdown: data.ratingBreakdown || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      file: {
        size: data.fileSize || 0,
        ...data.file,
      },
      lastUpdated: new Date(data.lastUpdated || data.publishedAt),
      categories: data.categories || [],
      tags: data.tags || data.keywords || [],
      screenshots: data.screenshots,
      repository: data.repository?.url || data.repository,
      license: data.license,
      sponsor: data.sponsor?.url,
    };
  }

  private normalizeExtensions(data: any[]): MarketplaceExtension[] {
    return data.map(item => this.normalizeExtension(item));
  }

  private getMockExtensions(): MarketplaceExtension[] {
    return [
      {
        id: 'prettier',
        name: 'Prettier - Code formatter',
        publisher: 'Prettier',
        version: '10.2.1',
        description: 'Code formatter that enforces consistent style',
        downloads: 38000000,
        rating: 4.5,
        installCount: 38000000,
        averageRating: 4.5,
        averageRatingBreakdown: { 1: 1000, 2: 500, 3: 2000, 4: 5000, 5: 15000 },
        file: { size: 2048000 },
        lastUpdated: new Date('2024-01-15'),
        categories: ['Formatters'],
        tags: ['prettier', 'format', 'code style'],
      },
      {
        id: 'eslint',
        name: 'ESLint',
        publisher: 'Microsoft',
        version: '2.3.1',
        description: 'Integrates ESLint JavaScript into VS Code',
        downloads: 30000000,
        rating: 4.8,
        installCount: 30000000,
        averageRating: 4.8,
        averageRatingBreakdown: { 1: 500, 2: 200, 3: 1000, 4: 3000, 5: 20000 },
        file: { size: 3072000 },
        lastUpdated: new Date('2024-01-10'),
        categories: ['Linters'],
        tags: ['eslint', 'lint', 'javascript', 'typescript'],
      },
      {
        id: 'python',
        name: 'Python',
        publisher: 'Microsoft',
        version: '2024.2.0',
        description: 'IntelliSense, Linting, Debugging, Jupyter Notebooks',
        downloads: 100000000,
        rating: 4.6,
        installCount: 100000000,
        averageRating: 4.6,
        averageRatingBreakdown: { 1: 2000, 2: 1000, 3: 5000, 4: 10000, 5: 50000 },
        file: { size: 10240000 },
        lastUpdated: new Date('2024-01-20'),
        categories: ['Programming Languages'],
        tags: ['python', 'jupyter', 'pylance', 'debugging'],
      },
      {
        id: 'gitlens',
        name: 'GitLens — Git supercharged',
        publisher: 'GitKraken',
        version: '13.4.0',
        description: 'Supercharge Git within VS Code',
        downloads: 25000000,
        rating: 4.9,
        installCount: 25000000,
        averageRating: 4.9,
        averageRatingBreakdown: { 1: 300, 2: 100, 3: 500, 4: 2000, 5: 25000 },
        file: { size: 4096000 },
        lastUpdated: new Date('2024-01-18'),
        categories: ['Git'],
        tags: ['git', 'gitlens', 'blame', 'history'],
      },
      {
        id: 'live-server',
        name: 'Live Server',
        publisher: 'Ritwick Dey',
        version: '5.7.9',
        description: 'Launch a local dev server with live reload',
        downloads: 35000000,
        rating: 4.7,
        installCount: 35000000,
        averageRating: 4.7,
        averageRatingBreakdown: { 1: 800, 2: 400, 3: 1500, 4: 4000, 5: 18000 },
        file: { size: 1024000 },
        lastUpdated: new Date('2024-01-05'),
        categories: ['Tools'],
        tags: ['live server', 'http', 'reload'],
      },
    ];
  }

  private getMockFeaturedExtensions(): MarketplaceExtension[] {
    return [
      {
        id: 'material-icon-theme',
        name: 'Material Icon Theme',
        publisher: 'PKief',
        version: '4.4.0',
        description: 'Material Design Icons for Visual Studio Code',
        downloads: 28000000,
        rating: 4.8,
        installCount: 28000000,
        averageRating: 4.8,
        averageRatingBreakdown: { 1: 400, 2: 200, 3: 800, 4: 3000, 5: 20000 },
        file: { size: 3072000 },
        lastUpdated: new Date('2024-01-12'),
        categories: ['Themes'],
        tags: ['icons', 'material design'],
      },
      {
        id: 'indent-rainbow',
        name: 'Indent Rainbow',
        publisher: 'oderwat',
        version: '1.3.0',
        description: 'Makes indentation easier to read',
        downloads: 12000000,
        rating: 4.5,
        installCount: 12000000,
        averageRating: 4.5,
        averageRatingBreakdown: { 1: 200, 2: 100, 3: 400, 4: 1200, 5: 8000 },
        file: { size: 204800 },
        lastUpdated: new Date('2024-01-01'),
        categories: ['Tools'],
        tags: ['indentation', 'rainbow', 'formatting'],
      },
    ];
  }

  private async getInstalledExtensions(): Promise<{ id: string; version: string }[]> {
    try {
      const stored = localStorage.getItem('monaco_extensions');
      if (stored) {
        const parsed = JSON.parse(stored);
        return Array.from(parsed).map((ext: any) => ({
          id: ext.id,
          version: ext.version,
        }));
      }
    } catch (error) {
      console.error('Failed to get installed extensions:', error);
    }
    return [];
  }
}
