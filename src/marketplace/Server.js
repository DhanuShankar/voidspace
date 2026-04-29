import express from 'express';
import fs from 'fs';
import path from 'path';
import type { MarketplaceExtension } from '../extensions/types';

const app = express();
const PORT = process.env.MARKETPLACE_PORT || 3001;

app.use(express.json());

// Mock extensions database
let extensions: MarketplaceExtension[] = [
  {
    id: 'prettier',
    name: 'Prettier - Code formatter',
    publisher: 'Prettier',
    version: '10.2.1',
    description: 'Opinionated code formatter for consistent style',
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
    description: 'Integrates ESLint JavaScript into your workflow',
    downloads: 30000000,
    rating: 4.8,
    installCount: 30000000,
    averageRating: 4.8,
    averageRatingBreakdown: { 1: 500, 2: 200, 3: 1000, 4: 3000, 5: 20000 },
    file: { size: 3072000 },
    lastUpdated: new Date('2024-01-10'),
    categories: ['Linters'],
    tags: ['eslint', 'lint', 'javascript', 'typescript', 'Quality'],
  },
  {
    id: 'python',
    name: 'Python',
    publisher: 'Microsoft',
    version: '2024.2.0',
    description: 'IntelliSense, Linting, Debugging, Jupyter Notebooks, and more',
    downloads: 100000000,
    rating: 4.6,
    installCount: 100000000,
    averageRating: 4.6,
    averageRatingBreakdown: { 1: 2000, 2: 1000, 3: 5000, 4: 10000, 5: 50000 },
    file: { size: 10240000 },
    lastUpdated: new Date('2024-01-20'),
    categories: ['Programming Languages'],
    tags: ['python', 'jupyter', 'pylance', 'debugging', 'data science'],
  },
  {
    id: 'gitlens',
    name: 'GitLens — Git supercharged',
    publisher: 'GitKraken',
    version: '13.4.0',
    description: 'Visualize code authorship, explore repositories, gain insights',
    downloads: 25000000,
    rating: 4.9,
    installCount: 25000000,
    averageRating: 4.9,
    averageRatingBreakdown: { 1: 300, 2: 100, 3: 500, 4: 2000, 5: 25000 },
    file: { size: 4096000 },
    lastUpdated: new Date('2024-01-18'),
    categories: ['Git'],
    tags: ['git', 'gitlens', 'blame', 'history', 'annotate'],
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
    tags: ['live server', 'http', 'reload', 'web development'],
  },
];

// Search extensions
app.get('/api/extensions/search', (req, res) => {
  const { q, category, sortBy = 'relevance', page = 1, pageSize = 20 } = req.query;

  let results = [...extensions];

  // Filter by query
  if (q) {
    const query = q.toString().toLowerCase();
    results = results.filter(ext =>
      ext.name.toLowerCase().includes(query) ||
      ext.description.toLowerCase().includes(query) ||
      ext.publisher.toLowerCase().includes(query) ||
      (ext.tags && ext.tags.some((tag: string) => tag.toLowerCase().includes(query)))
    );
  }

  // Filter by category
  if (category) {
    results = results.filter(ext =>
      ext.categories && ext.categories.some(c => c.toLowerCase().includes(category.toString().toLowerCase()))
    );
  }

  // Sort
  switch (sortBy.toString()) {
    case 'downloads':
      results.sort((a, b) => b.downloads - a.downloads);
      break;
    case 'rating':
      results.sort((a, b) => b.rating - a.rating);
      break;
    case 'updated':
      results.sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());
      break;
    default:
      // relevance - keep as is
      break;
  }

  // Paginate
  const start = ((page as number) - 1) * (pageSize as number);
  const paged = results.slice(start, start + (pageSize as number));

  res.json({
    extensions: paged,
    total: results.length,
    page,
    pageSize,
    totalPages: Math.ceil(results.length / (pageSize as number)),
  });
});

// Get featured extensions
app.get('/api/extensions/featured', (req, res) => {
  // Return top-rated and most downloaded
  const featured = [...extensions]
    .sort((a, b) => (b.rating * b.installCount) - (a.rating * a.installCount))
    .slice(0, 10);
  res.json({ extensions: featured });
});

// Get extension details
app.get('/api/extensions/:id', (req, res) => {
  const extension = extensions.find(ext => ext.id === req.params.id);
  if (!extension) {
    return res.status(404).json({ error: 'Extension not found' });
  }
  res.json(extension);
});

// Download extension
app.get('/api/extensions/:id/download', (req, res) => {
  const extension = extensions.find(ext => ext.id === req.params.id);
  if (!extension) {
    return res.status(404).json({ error: 'Extension not found' });
  }

  // In a real implementation, this would serve the actual extension package
  // For demo, we'll create a mock VSIX package
  const vsixContent = createMockVSIX(extension);
  res.set({
    'Content-Type': 'application/octet-stream',
    'Content-Disposition': `${extension.id}-${extension.version}.vsix`,
    'Content-Length': vsixContent.length,
  });
  res.send(Buffer.from(vsixContent));
});

// Rate extension
app.post('/api/extensions/:id/rate', (req, res) => {
  const { rating } = req.body;
  const extension = extensions.find(ext => ext.id === req.params.id);
  if (!extension) {
    return res.status(404).json({ error: 'Extension not found' });
  }

  // Update rating (simplified averaging)
  const oldTotal = extension.averageRating * Math.floor(Math.random() * 10000);
  const newTotal = oldTotal + rating;
  const newCount = Math.floor(Math.random() * 10000) + 1;
  extension.averageRating = newTotal / newCount;

  res.json({ success: true, newRating: extension.averageRating });
});

// Submit review
app.post('/api/extensions/:id/reviews', (req, res) => {
  const { review, rating } = req.body;
  console.log(`New review for ${req.params.id}: ${rating} stars`);
  res.json({ success: true });
});

// Report extension usage
app.post('/api/extensions/:id/usage', (req, res) => {
  const { action } = req.body;
  console.log(`Usage reported for ${req.params.id}: ${action}`);
  res.json({ success: true });
});

// Get categories
app.get('/api/extensions/categories', (req, res) => {
  const categories = [
    'Programming Languages',
    'Linters',
    'Formatters',
    'Themes',
    'Snippets',
    'Debuggers',
    'Testing',
    'Git',
    'Cloud',
    'Tools',
    'AI & Machine Learning',
    'Data Science',
    'Web',
    'Mobile',
  ];
  res.json({ categories });
});

// Check for updates
app.get('/api/extensions/updates', (req, res) => {
  const { installed } = req.query;

  // Return any newer versions
  const updates = extensions.map(ext => ({
    id: ext.id,
    version: ext.version,
    downloadUrl: `${req.baseUrl}/api/extensions/${ext.id}/download`,
    changelog: `Update ${ext.version} - Various improvements and bug fixes`,
    publishedDate: ext.lastUpdated,
  }));

  res.json({ updates });
});

// Extension store statistics
app.get('/api/stats', (req, res) => {
  res.json({
    totalExtensions: extensions.length,
    totalDownloads: extensions.reduce((sum, ext) => sum + ext.downloads, 0),
    averageRating: extensions.reduce((sum, ext) => sum + ext.rating, 0) / extensions.length,
  });
});

// Helper to create mock VSIX package
function createMockVSIX(extension: MarketplaceExtension): string {
  // Create a simple VSIX-like package (actually a zip in real implementation)
  const content = `{"extension":${JSON.stringify(extension)},"manifest":{"version":"${extension.version}","main":"dist/extension.js"}}`;
  return content;
}

// Extension bundle serving
app.get('/extensions/:id/:version/:file(*)', (req, res) => {
  // Serve extension files from disk or CDN
  const { id, version, file } = req.params;
  const extPath = path.join(process.cwd(), 'extensions', id, version, file);

  if (fs.existsSync(extPath)) {
    res.sendFile(extPath);
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

app.listen(PORT, () => {
  console.log(`Extension marketplace server running on port ${PORT}`);
  console.log(`Available at http://localhost:${PORT}`);
  console.log(`API endpoints:`);
  console.log(`  GET    /api/extensions/search  - Search extensions`);
  console.log(`  GET    /api/extensions/featured - Get featured extensions`);
  console.log(`  GET    /api/extensions/:id     - Get extension details`);
  console.log(`  GET    /api/extensions/:id/download - Download extension`);
  console.log(`  POST   /api/extensions/:id/rate - Rate extension`);
  console.log(`  POST   /api/extensions/:id/reviews - Submit review`);
  console.log(`  POST   /api/extensions/:id/usage - Report usage`);
  console.log(`  GET    /api/extensions/categories - Get all categories`);
});

export default app;
