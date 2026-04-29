#!/usr/bin/env bun

/**
 * VOID IDE Skill CLI
 * 
 * Provides gstack-style slash commands for Google Cloud operations.
 * Usage: void-skill <skill> [args...]
 * 
 * Examples:
 *   void-skill colab-start --gpu --hours=12
 *   void-skill colab-status
 *   void-skill drive-mount my-project
 *   void-skill gpu-recommend
 */

import { skillRegistry, SkillContext } from './src/services/skillRegistry';
import { colabSessionManager } from './src/services/colabSessionManager';
import { googleAuth } from './src/services/googleAuth';
import * as fs from 'fs';
import * as path from 'path';

const args = process.argv.slice(2);
const skillName = args[0];
const skillArgs = args.slice(1);

if (!skillName) {
  console.log(`
VOID IDE Skill CLI
==================

Available skills:
  Colab:
    /colab-start [workspace] [--gpu] [--hours=N]
    /colab-status
    /colab-extend [hours]
    /colab-backup
    /colab-stop

  Drive:
    /drive-mount [workspace]
    /drive-sync [direction]
    /drive-list [folder]

  Resources:
    /resource-check
    /gpu-status
    /gpu-recommend

  Workflow:
    /auto-session
    /project-init [name]

Usage: void-skill <skill> [args...]
  `);
  process.exit(0);
}

// Create context from environment/config
async function buildContext(): Promise<SkillContext> {
  const configPath = path.join(process.env.HOME || process.env.USERPROFILE || '', '.void', 'config.json');
  let config = { userId: 'local-user', accessToken: '', workspacePath: process.cwd() };

  if (fs.existsSync(configPath)) {
    try {
      config = { ...config, ...JSON.parse(fs.readFileSync(configPath, 'utf-8')) };
    } catch {}
  }

  // Try to get stored credentials
  const credPath = path.join(process.env.HOME || '', '.void', 'credentials.json');
  if (fs.existsSync(credPath)) {
    try {
      const creds = JSON.parse(fs.readFileSync(credPath, 'utf-8'));
      config.accessToken = creds.access_token || '';
    } catch {}
  }

  return {
    userId: config.userId,
    accessToken: config.accessToken,
    workspacePath: config.workspacePath,
    commandHistory: [],
  };
}

async function main() {
  try {
    const context = await buildContext();
    
    // For colab-start, if no access token, prompt for auth
    if (skillName === 'colab-start' && !context.accessToken) {
      console.log('⚠️  No Google access token found.');
      console.log('   Run: void-skill auth-login to authenticate, or pass --token=xxx');
      
      const tokenArg = skillArgs.find(a => a.startsWith('--token='));
      if (tokenArg) {
        context.accessToken = tokenArg.split('=')[1];
      } else {
        process.exit(1);
      }
    }

    const result = await skillRegistry.execute(skillName, skillArgs, context);

    console.log('\n' + '='.repeat(60));
    console.log(result.output);
    console.log('='.repeat(60));

    if (result.suggestions && result.suggestions.length > 0) {
      console.log('\n💡 Suggestions:');
      for (const suggestion of result.suggestions) {
        console.log(`   ${suggestion}`);
      }
    }

    if (!result.success) {
      console.error(`\n❌ Error: ${result.output}`);
      process.exit(1);
    }

    console.log(`\n✓ Skill '${skillName}' completed successfully`);
  } catch (error: any) {
    console.error(`\n❌ Failed to execute skill: ${error.message}`);
    process.exit(1);
  }
}

main();
