import { execFileSync, execSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const ENV_PATH = path.join(ROOT, '.env');
const LOCAL_CONFIG_PATH = path.join(ROOT, '.theme-release.json');
const RELEASES_DIR = path.join(ROOT, 'releases');
const THEME_PATH = path.join(ROOT, 'theme-files');

function loadEnvFile(filePath) {
  const env = {};
  if (!existsSync(filePath)) return env;
  for (const rawLine of readFileSync(filePath, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!match) continue;
    env[match[1]] = match[2];
  }
  return env;
}

function loadLocalConfig() {
  if (!existsSync(LOCAL_CONFIG_PATH)) return {};
  try {
    return JSON.parse(readFileSync(LOCAL_CONFIG_PATH, 'utf8'));
  } catch (error) {
    throw new Error(`Invalid ${path.basename(LOCAL_CONFIG_PATH)}: ${error.message}`);
  }
}

function saveLocalConfig(config) {
  writeFileSync(LOCAL_CONFIG_PATH, `${JSON.stringify(config, null, 2)}\n`);
}

function normalizeThemeId(value) {
  if (value === undefined || value === null || value === '') return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    throw new Error(`Invalid theme id: ${value}`);
  }
  return numeric;
}

function loadConfig() {
  const env = loadEnvFile(ENV_PATH);
  const local = loadLocalConfig();
  return {
    store: local.store || env.SHOPIFY_STORE || '',
    storeUrl: local.storeUrl || env.STORE_URL || '',
    token: env.SHOPIFY_ACCESS_TOKEN || '',
    liveThemeId: normalizeThemeId(local.liveThemeId ?? env.SHOPIFY_LIVE_THEME_ID),
    stagingThemeId: normalizeThemeId(local.stagingThemeId ?? env.SHOPIFY_STAGING_THEME_ID),
    sandboxThemeId: normalizeThemeId(local.sandboxThemeId ?? env.SHOPIFY_SANDBOX_THEME_ID),
    githubRepo: local.githubRepo || env.GITHUB_REPO || '',
    releaseOperator: local.releaseOperator || env.RELEASE_OPERATOR || process.env.USER || 'unknown',
    stagingThemeName: local.stagingThemeName || 'TT360 Staging',
  };
}

function requireConfig(config, fields) {
  for (const field of fields) {
    if (!config[field]) throw new Error(`Missing required config: ${field}`);
  }
}

function git(args, options = {}) {
  return execFileSync('git', args, {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  }).trim();
}

function shopify(args, config) {
  requireConfig(config, ['store']);
  const tokenArgs = config.token ? ['--password', config.token] : [];
  return execFileSync('shopify', [...args, '--store', config.store, ...tokenArgs], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
}

function shopifyJson(args, config) {
  const raw = shopify([...args, '--json'], config);
  return raw ? JSON.parse(raw) : {};
}

function ensureWorkingTreeClean(context) {
  const status = git(['status', '--short']);
  if (!status) return;
  throw new Error(`${context} requires a clean working tree.\nCurrent changes:\n${status}`);
}

function ensureThemePath() {
  if (!existsSync(THEME_PATH)) {
    throw new Error(`Theme path not found: ${THEME_PATH}`);
  }
}

function ensureStagingIsNotLive(config) {
  if (config.liveThemeId && config.stagingThemeId && config.liveThemeId === config.stagingThemeId) {
    throw new Error('Refusing to continue: staging theme matches live theme.');
  }
}

function buildPreviewUrl(config, targetPath = '') {
  requireConfig(config, ['storeUrl', 'stagingThemeId']);
  const base = config.storeUrl.replace(/\/+$/, '');
  const cleanPath = targetPath ? `/${targetPath.replace(/^\/+/, '')}` : '';
  return `${base}${cleanPath}?preview_theme_id=${config.stagingThemeId}`;
}

function nextReleaseTag() {
  mkdirSync(RELEASES_DIR, { recursive: true });
  const stamp = new Date().toISOString().slice(0, 10);
  const prefix = `theme-v${stamp}-`;
  const candidates = existsSync(RELEASES_DIR)
    ? execSync(`find "${RELEASES_DIR}" -maxdepth 1 -type f -name '${prefix}*.md' -print`, { encoding: 'utf8' })
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
    : [];
  const nextIndex = candidates.length + 1;
  return `${prefix}${nextIndex}`;
}

function getCurrentBranch() {
  return git(['rev-parse', '--abbrev-ref', 'HEAD']);
}

function getCurrentSha() {
  return git(['rev-parse', 'HEAD']);
}

function getRemoteUrl() {
  try {
    return git(['remote', 'get-url', 'origin']);
  } catch {
    return '';
  }
}

function status(config) {
  const branch = getCurrentBranch();
  const sha = getCurrentSha();
  const gitStatus = git(['status', '--short']);
  const remote = getRemoteUrl();

  console.log(`repo: ${ROOT}`);
  console.log(`branch: ${branch}`);
  console.log(`sha: ${sha}`);
  console.log(`origin: ${remote || '(not configured)'}`);
  console.log(`store: ${config.store || '(missing)'}`);
  console.log(`store url: ${config.storeUrl || '(missing)'}`);
  console.log(`live theme: ${config.liveThemeId || '(missing)'}`);
  console.log(`staging theme: ${config.stagingThemeId || '(missing)'}`);
  console.log(`sandbox theme: ${config.sandboxThemeId || '(not set)'}`);
  console.log(`github repo: ${config.githubRepo || '(not set)'}`);
  console.log(`operator: ${config.releaseOperator}`);
  if (config.stagingThemeId && config.storeUrl) {
    console.log(`preview: ${buildPreviewUrl(config)}`);
  }
  console.log('');
  console.log(gitStatus ? `working tree:\n${gitStatus}` : 'working tree: clean');
}

function listThemes(config) {
  const data = shopifyJson(['theme', 'list'], config);
  console.log(JSON.stringify(data, null, 2));
}

function initStaging(config, args) {
  requireConfig(config, ['store', 'token', 'liveThemeId']);
  const existingStaging = config.stagingThemeId;
  if (existingStaging) {
    throw new Error(`Staging theme already configured: ${existingStaging}`);
  }
  const requestedName = args[0] || 'TT360 Staging';
  const result = shopifyJson([
    'theme',
    'duplicate',
    '--theme',
    String(config.liveThemeId),
    '--name',
    requestedName,
    '--force',
  ], config);
  const theme = result.theme;
  if (!theme?.id) {
    throw new Error(`Failed to create staging theme: ${JSON.stringify(result)}`);
  }
  const merged = { ...loadLocalConfig(), ...config, stagingThemeId: theme.id, stagingThemeName: theme.name };
  saveLocalConfig(merged);
  console.log(`created staging theme ${theme.id} (${theme.name})`);
}

function pullStaging(config) {
  requireConfig(config, ['stagingThemeId']);
  ensureStagingIsNotLive(config);
  ensureWorkingTreeClean('Pulling staging theme');
  ensureThemePath();
  const output = shopify([
    'theme',
    'pull',
    '--theme',
    String(config.stagingThemeId),
    '--path',
    './theme-files',
  ], config);
  console.log(output);
}

function checkTheme() {
  ensureThemePath();
  const output = execFileSync('shopify', ['theme', 'check', '--path', './theme-files'], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
  console.log(output);
}

function pushStaging(config, args) {
  requireConfig(config, ['stagingThemeId']);
  ensureStagingIsNotLive(config);
  ensureThemePath();
  const onlyFlags = [];
  for (const item of args) {
    onlyFlags.push('--only', item);
  }
  const output = shopify([
    'theme',
    'push',
    '--theme',
    String(config.stagingThemeId),
    '--path',
    './theme-files',
    '--nodelete',
    ...onlyFlags,
  ], config);
  console.log(output);
}

function publishStaging(config) {
  requireConfig(config, ['stagingThemeId']);
  ensureStagingIsNotLive(config);
  const output = shopify([
    'theme',
    'publish',
    '--theme',
    String(config.stagingThemeId),
    '--force',
  ], config);
  console.log(output);
}

function preview(config, args) {
  const targetPath = args[0] || '';
  console.log(buildPreviewUrl(config, targetPath));
}

function releaseNote(config, args) {
  requireConfig(config, ['stagingThemeId']);
  mkdirSync(RELEASES_DIR, { recursive: true });
  const summary = args.join(' ').trim() || 'Theme release candidate';
  const tag = nextReleaseTag();
  const branch = getCurrentBranch();
  const sha = getCurrentSha();
  const filePath = path.join(RELEASES_DIR, `${tag}.md`);
  const content = `# ${tag}

## Summary
- ${summary}

## Release Metadata
- Branch: \`${branch}\`
- Commit SHA: \`${sha}\`
- Store: \`${config.store}\`
- Live theme ID: \`${config.liveThemeId || 'pending'}\`
- Staging theme ID: \`${config.stagingThemeId}\`
- Preview URL: ${config.storeUrl ? buildPreviewUrl(config) : 'pending'}
- Rollback target theme ID: \`${config.liveThemeId || 'pending'}\`
- GitHub repo: \`${config.githubRepo || 'pending'}\`
- Operator: \`${config.releaseOperator}\`

## Validation
- [ ] Pull gate passed
- [ ] Local diff reviewed
- [ ] \`shopify theme check --path theme-files\` passed
- [ ] Preview tested on desktop
- [ ] Preview tested on mobile
- [ ] Changed surface smoke tested

## Publish
- [ ] PR approved
- [ ] Merged to \`dev\`
- [ ] Staging theme pushed
- [ ] Release tag created
- [ ] GitHub Release created
- [ ] Staging theme published

## Rollback
- Immediate rollback: republish theme \`${config.liveThemeId || 'pending'}\`
- Controlled rollback: checkout tag prior to \`${tag}\`, push to staging, verify, publish
`;
  writeFileSync(filePath, content);
  console.log(filePath);
}

function printHelp() {
  console.log(`Usage: node scripts/theme-release.mjs <command> [args]

Commands:
  status                Show repo + theme pipeline status
  list                  List remote Shopify themes
  init-staging [name]   Duplicate live theme into a staging theme and save config
  pull-staging          Pull staging theme into ./theme-files (requires clean git)
  check                 Run shopify theme check on ./theme-files
  push-staging [files]  Push all or selected files to staging theme only
  publish-staging       Publish the configured staging theme
  preview [path]        Print a preview URL for the staging theme
  release-note [text]   Generate a Markdown release note in ./releases
`);
}

const config = loadConfig();
const [, , command, ...args] = process.argv;

try {
  switch (command) {
    case 'status':
      status(config);
      break;
    case 'list':
      listThemes(config);
      break;
    case 'init-staging':
      initStaging(config, args);
      break;
    case 'pull-staging':
      pullStaging(config);
      break;
    case 'check':
      checkTheme();
      break;
    case 'push-staging':
      pushStaging(config, args);
      break;
    case 'publish-staging':
      publishStaging(config);
      break;
    case 'preview':
      preview(config, args);
      break;
    case 'release-note':
      releaseNote(config, args);
      break;
    case undefined:
    case '--help':
    case '-h':
    case 'help':
      printHelp();
      break;
    default:
      throw new Error(`Unknown command: ${command}`);
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
