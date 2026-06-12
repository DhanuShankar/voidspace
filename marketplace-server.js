#!/usr/bin/env node
// Marketplace server entry point — delegates to the TypeScript source via tsx
import { createRequire } from 'module';
import { register } from 'node:module';

// Use tsx to run the TypeScript marketplace server
// Run with: node --import tsx/esm marketplace-server.js
// Or simply: npx tsx src/marketplace/Server.ts

import('./src/marketplace/Server.ts').catch((err) => {
  console.error('Failed to start marketplace server:', err.message);
  console.error('Tip: run "npm run marketplace" which uses tsx automatically');
  process.exit(1);
});
