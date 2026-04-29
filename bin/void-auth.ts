#!/usr/bin/env bun

/**
 * VOID IDE Authentication CLI
 * Handles Google OAuth flow for Colab/Drive access
 */

import * as http from 'http';
import * as open from 'open';
import { googleAuth, generateAuthUrl, getTokenFromCode, setCredentials } from '../src/services/googleAuth';
import * as fs from 'fs';
import * as path from 'path';

const PORT = 3001;
const CALLBACK_PATH = '/auth/google/callback';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === 'login' || command === 'auth-login') {
    await performOAuthFlow();
  } else if (command === 'logout') {
    await logout();
  } else if (command === 'status') {
    await checkStatus();
  } else {
    console.log(`
VOID Auth CLI
=============

Commands:
  void-auth login         - Authenticate with Google (Colab/Drive)
  void-auth logout        - Revoke Google access
  void-auth status        - Check authentication status

Usage: void-auth <command>
    `);
  }
}

async function performOAuthFlow() {
  console.log('🔐 VOID Google Authentication');
  console.log('   This will allow Colab sessions and Drive sync.\n');

  try {
    // In production, this would use your real OAuth client
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUrl = `http://localhost:${PORT}${CALLBACK_PATH}`;

    if (!clientId || !clientSecret) {
      console.error('❌ Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET');
      console.error('   Set these in your .env file or environment.\n');
      process.exit(1);
    }

    // Start local server to receive callback
    const server = http.createServer(async (req, res) => {
      if (req.url === CALLBACK_PATH) {
        const url = new URL(req.url || '', `http://localhost:${PORT}`);
        const code = url.searchParams.get('code');
        
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
          <html><body style="font-family: sans-serif; padding: 40px;">
            <h1>✓ Authentication Successful</h1>
            <p>You can close this window and return to the terminal.</p>
            <script>setTimeout(() => window.close(), 3000);</script>
          </body></html>
        `);

        if (code) {
          try {
            const tokens = await getTokenFromCode(code);
            await saveCredentials(tokens);
            console.log('✓ Authentication complete!');
            console.log('  Access token saved to ~/.void/credentials.json\n');
          } catch (error) {
            console.error('❌ Failed to exchange code:', error.message);
          }
        }

        server.close();
      }
    });

    server.listen(PORT, () => {
      const authUrl = generateAuthUrl();
      console.log(`1. Opening browser for Google authorization...`);
      console.log(`   ${authUrl}\n`);
      
      open(authUrl);
    });

  } catch (error: any) {
    console.error('❌ OAuth flow failed:', error.message);
    process.exit(1);
  }
}

async function saveCredentials(tokens: any) {
  const credDir = path.join(process.env.HOME || process.env.USERPROFILE || '', '.void');
  if (!fs.existsSync(credDir)) {
    fs.mkdirSync(credDir, { recursive: true });
  }

  const credPath = path.join(credDir, 'credentials.json');
  fs.writeFileSync(credPath, JSON.stringify(tokens, null, 2));
  fs.chmodSync(credPath, 0o600);
}

async function logout() {
  const credPath = path.join(process.env.HOME || '', '.void', 'credentials.json');
  if (fs.existsSync(credPath)) {
    fs.unlinkSync(credPath);
    console.log('✓ Logged out. Credentials removed.\n');
  } else {
    console.log('Not logged in.\n');
  }
}

async function checkStatus() {
  const credPath = path.join(process.env.HOME || '', '.void', 'credentials.json');
  if (fs.existsSync(credPath)) {
    const creds = JSON.parse(fs.readFileSync(credPath, 'utf-8'));
    const expiry = new Date(creds.expiry || 0);
    console.log(`✓ Logged in as: ${creds.email || 'Google user'}`);
    console.log(`  Token expires: ${expiry.toLocaleString()}`);
    console.log(`  Scopes: ${creds.scope?.slice(0, 50) || 'N/A'}...\n`);
  } else {
    console.log('Not logged in. Run "void-auth login" to authenticate.\n');
  }
}

main();
