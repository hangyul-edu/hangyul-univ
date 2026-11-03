// Metro config for an Expo app inside the npm-workspaces monorepo.
// - watchFolders: the monorepo root, so edits in packages/* hot-reload.
// - nodeModulesPaths: app first, then the hoisted root node_modules.
// - extraNodeModules: resolves @hangyul/mobile-ui straight from packages/ even before `npm install`
//   has created its workspace symlink (fallback only — normal resolution wins when the link exists).
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  '@hangyul/mobile-ui': path.resolve(monorepoRoot, 'packages/mobile-ui'),
};
// Keep Metro from crawling large non-JS trees in the monorepo (themes, Python server, web build outputs).
const esc = (p) => p.replace(/[/\\^$.*+?()[\]{}|]/g, '\\$&');
const existing = config.resolver.blockList;
config.resolver.blockList = [
  ...(Array.isArray(existing) ? existing : existing ? [existing] : []),
  new RegExp(`^${esc(path.join(monorepoRoot, 'themeforest-'))}.*`),
  new RegExp(`^${esc(path.join(monorepoRoot, 'server'))}[/\\\\].*`),
  new RegExp(`^${esc(path.join(monorepoRoot, 'apps'))}[/\\\\][^/\\\\]+-web[/\\\\](dist|coverage)[/\\\\].*`),
];

module.exports = config;
