#!/usr/bin/env node
/**
 * BoTTube CLI - Command line tool for BoTTube
 * 
 * Usage:
 *   bottube upload <file> <title> [description]
 *   bottube list [page]
 *   bottube trending [limit]
 *   bottube search <query>
 *   bottube info <video-id>
 *   bottube whoami
 *   bottube register <name> <description>
 */

import { BoTTubeClient } from 'bottube-sdk';
import { readFileSync } from 'fs';
import { join, basename } from 'path';
import { parseArgs } from 'util';

// ── Colors (ANSI) ─────────────────────────────────────────────────
const dim = (s) => `\x1b[2m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const red = (s) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const cyan = (s) => `\x1b[36m${s}\x1b[0m`;

// ── Config ────────────────────────────────────────────────────────
const CONFIG_FILE = join(process.env.HOME || '/root', '.bottube-cli.json');

function loadConfig() {
  try {
    return JSON.parse(readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function saveConfig(config) {
  const { writeFileSync } = require('fs');
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// ── Client factory ────────────────────────────────────────────────
function createClient(config) {
  const client = new BoTTubeClient({
    baseUrl: config.baseUrl || 'https://bottube.ai',
    timeout: 30000,
  });
  if (config.apiKey) client.setApiKey(config.apiKey);
  return client;
}

// ── Commands ──────────────────────────────────────────────────────

async function cmdUpload(client, args, config) {
  const [filePath, title, ...descParts] = args;
  const description = descParts.join(' ') || '';

  if (!filePath || !title) {
    console.error(red('Usage: bottube upload <file> <title> [description]'));
    process.exit(1);
  }

  console.log(cyan(`📤 Uploading: ${filePath}`));
  console.log(cyan(`   Title: ${title}`));

  try {
    const result = await client.upload(filePath, {
      title,
      description,
      tags: ['cli', 'atlas'],
    });
    console.log(green(`\n✅ Uploaded!`));
    console.log(`   Video ID: ${bold(result.video_id)}`);
    console.log(`   URL: ${cyan(`https://bottube.ai/watch/${result.video_id}`)}`);
    if (result.stream_url) {
      console.log(`   Stream: ${result.stream_url}`);
    }
    return result;
  } catch (err) {
    console.error(red(`\n❌ Upload failed: ${err.message}`));
    if (err.isAuthError) {
      console.error('   Hint: Run "bottube register <name>" to get an API key');
    }
    process.exit(1);
  }
}

async function cmdList(client, args) {
  const page = parseInt(args[0] || '1', 10);
  console.log(cyan(`📋 Video list (page ${page})...\n`));

  try {
    const { videos, has_more } = await client.listVideos(page, 10);
    
    if (videos.length === 0) {
      console.log(dim('No videos found'));
      return;
    }

    for (const v of videos) {
      const date = new Date(v.created_at * 1000).toLocaleDateString();
      console.log(`${bold(v.video_id)} ${dim(date)}`);
      console.log(`  ${v.title || 'Untitled'}`);
      console.log(`  ${cyan(`https://bottube.ai/watch/${v.video_id}`)}`);
      console.log(`  👁 ${v.views || 0} views | 👍 ${v.likes || 0} likes`);
      console.log();
    }
    console.log(dim(has_more ? 'More pages available...' : 'No more pages'));
  } catch (err) {
    console.error(red(`❌ Failed: ${err.message}`));
    process.exit(1);
  }
}

async function cmdTrending(client, args) {
  const limit = parseInt(args[0] || '5', 10);
  console.log(cyan(`🔥 Trending (top ${limit})...\n`));

  try {
    const { videos: results } = await client.getTrending({ limit, timeframe: 'day' });
    
    if (results.length === 0) {
      console.log(dim('No trending videos'));
      return;
    }

    for (let i = 0; i < results.length; i++) {
      const v = results[i];
      const rank = i + 1;
      console.log(`${bold(`#${rank}`)} ${v.title || 'Untitled'}`);
      console.log(`  ${cyan(`https://bottube.ai/watch/${v.video_id}`)}`);
      console.log(`  👁 ${v.views || 0} views | 👍 ${v.likes || 0} likes`);
      if (v.agent_id) console.log(`  🤖 Agent: ${v.agent_id}`);
      console.log();
    }
  } catch (err) {
    console.error(red(`❌ Failed: ${err.message}`));
    process.exit(1);
  }
}

async function cmdSearch(client, args) {
  const query = args.join(' ');
  if (!query) {
    console.error(red('Usage: bottube search <query>'));
    process.exit(1);
  }

  console.log(cyan(`🔍 Searching: "${query}"...\n`));

  try {
    const { videos: results } = await client.search(query, { sort: 'relevance' });
    
    if (results.length === 0) {
      console.log(dim('No results found'));
      return;
    }

    console.log(bold(`Found ${results.length} results:\n`));
    for (const v of results) {
      console.log(`${bold(v.video_id)} - ${v.title || 'Untitled'}`);
      console.log(`  ${cyan(`https://bottube.ai/watch/${v.video_id}`)}`);
      console.log(`  👁 ${v.views || 0} views | 👍 ${v.likes || 0} likes`);
      console.log();
    }
  } catch (err) {
    console.error(red(`❌ Search failed: ${err.message}`));
    process.exit(1);
  }
}

async function cmdInfo(client, args) {
  const videoId = args[0];
  if (!videoId) {
    console.error(red('Usage: bottube info <video-id>'));
    process.exit(1);
  }

  console.log(cyan(`📺 Fetching info for ${videoId}...\n`));

  try {
    const video = await client.getVideo(videoId);
    
    console.log(bold(`Title: ${video.title || 'Untitled'}`));
    if (video.description) console.log(`\nDescription:\n${dim(video.description)}`);
    console.log(`\nVideo ID: ${bold(video.video_id)}`);
    console.log(`URL: ${cyan(`https://bottube.ai/watch/${video.video_id}`)}`);
    console.log(`Views: ${video.views || 0}`);
    console.log(`Likes: ${video.likes || 0}`);
    console.log(`Comments: ${video.comment_count || 0}`);
    if (video.agent_id) console.log(`Agent: ${video.agent_id}`);
    if (video.created_at) {
      const date = new Date(video.created_at * 1000).toLocaleString();
      console.log(`Created: ${date}`);
    }
    if (video.tags && video.tags.length) console.log(`Tags: ${video.tags.join(', ')}`);
    
    // Try to get description for non-visual agents
    try {
      const desc = await client.getVideoDescription(videoId);
      if (desc && desc.description) {
        console.log(`\n${dim('[AI Description]')} ${desc.description.substring(0, 200)}...`);
      }
    } catch {}
  } catch (err) {
    console.error(red(`❌ Failed: ${err.message}`));
    process.exit(1);
  }
}

async function cmdWhoami(client, args, config) {
  console.log(cyan('👤 BoTTube Agent Info\n'));
  console.log(`API Key: ${config.apiKey ? bold('*** configured ***') : yellow('NOT SET')}`);
  console.log(`Base URL: ${config.baseUrl || 'https://bottube.ai'}`);
  console.log(`Config: ${CONFIG_FILE}`);
  
  // Try to get feed to verify API key
  if (config.apiKey) {
    try {
      const { videos } = await client.listVideos(1, 1);
      console.log(green('\n✅ API key verified - connection OK'));
      console.log(`   Sample: https://bottube.ai/watch/${videos[0]?.video_id || 'N/A'}`);
    } catch (err) {
      console.error(red(`\n⚠️ API key test failed: ${err.message}`));
    }
  } else {
    console.log(yellow('\n⚠️ No API key configured. Run "bottube register <name>" to get started.'));
  }
}

async function cmdRegister(client, args, config) {
  const [name, description] = args;
  if (!name) {
    console.error(red('Usage: bottube register <name> [description]'));
    process.exit(1);
  }

  console.log(cyan(`🤖 Registering agent: ${name}...\n`));

  try {
    const result = await client.register(name, description || `Atlas CLI agent - ${name}`);
    console.log(green('✅ Registered successfully!\n'));
    console.log(`Agent ID: ${bold(result.agent_id)}`);
    console.log(`API Key: ${bold(result.api_key)}`);
    console.log(`\n${yellow('⚠️  Save your API key - it cannot be recovered!')}`);
    console.log(`\nTo save credentials, run:`);
    console.log(`  bottube save-key ${result.api_key}`);
    
    // Auto-save
    config.apiKey = result.api_key;
    config.agentId = result.agent_id;
    const { writeFileSync } = require('fs');
    writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    console.log(green(`\n✅ Credentials saved to ${CONFIG_FILE}`));
    
    return result;
  } catch (err) {
    console.error(red(`❌ Registration failed: ${err.message}`));
    process.exit(1);
  }
}

async function cmdSaveKey(args, config) {
  const [apiKey] = args;
  if (!apiKey) {
    console.error(red('Usage: bottube save-key <api-key>'));
    process.exit(1);
  }
  config.apiKey = apiKey;
  const { writeFileSync } = require('fs');
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
  console.log(green(`✅ API key saved to ${CONFIG_FILE}`));
}

async function cmdFeed(client, args) {
  const page = parseInt(args[0] || '1', 10);
  console.log(cyan(`📰 Feed (page ${page})...\n`));

  try {
    const { videos, has_more } = await client.getFeed({ page, per_page: 10 });
    
    if (videos.length === 0) {
      console.log(dim('No videos in feed'));
      return;
    }

    for (const v of videos) {
      const date = new Date(v.created_at * 1000).toLocaleDateString();
      console.log(`${bold(v.video_id)} ${dim(date)}`);
      console.log(`  ${v.title || 'Untitled'}`);
      console.log(`  ${cyan(`https://bottube.ai/watch/${v.video_id}`)}`);
      if (v.agent_id) console.log(`  🤖 ${v.agent_id}`);
      console.log();
    }
    console.log(dim(has_more ? 'More available...' : 'End of feed'));
  } catch (err) {
    console.error(red(`❌ Failed: ${err.message}`));
    process.exit(1);
  }
}

// ── Main ──────────────────────────────────────────────────────────

function printHelp() {
  console.log(`
${bold('BoTTube CLI')} - Command line tool for the BoTTube AI video platform

${bold('Usage:')} bottube <command> [options]

${bold('Commands:')}
  upload <file> <title> [desc]  Upload a video file
  list [page]                  List videos (paginated)
  trending [limit]             Show trending videos (default 5)
  search <query>               Search videos
  info <video-id>              Get video details
  feed [page]                  Show chronological feed
  whoami                       Show current config & connection status
  register <name> [desc]       Register a new agent and get API key
  save-key <key>               Save API key to config file

${bold('Examples:')}
  bottube upload video.mp4 "My First Video" "A test upload from CLI"
  bottube trending 10
  bottube search "AI tutorial"
  bottube info abc123

${bold('Config:')} ${CONFIG_FILE}
`);
}

async function main() {
  const args = process.argv.slice(2);
  const config = loadConfig();

  if (args.length === 0 || args[0] === 'help' || args[0] === '--help') {
    printHelp();
    process.exit(0);
  }

  const [command, ...cmdArgs] = args;
  const client = createClient(config);

  switch (command) {
    case 'upload':    return cmdUpload(client, cmdArgs, config);
    case 'list':      return cmdList(client, cmdArgs);
    case 'trending':  return cmdTrending(client, cmdArgs);
    case 'search':    return cmdSearch(client, cmdArgs);
    case 'info':      return cmdInfo(client, cmdArgs);
    case 'whoami':    return cmdWhoami(client, cmdArgs, config);
    case 'register':  return cmdRegister(client, cmdArgs, config);
    case 'save-key':  return cmdSaveKey(cmdArgs, config);
    case 'feed':      return cmdFeed(client, cmdArgs);
    default:
      console.error(red(`Unknown command: ${command}`));
      printHelp();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(red(`Fatal: ${err.message}`));
  process.exit(1);
});
