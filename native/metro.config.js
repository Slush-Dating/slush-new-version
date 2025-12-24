const { getDefaultConfig } = require('@expo/metro-config');
const path = require('path');

// Get the workspace root (parent directory)
const workspaceRoot = path.resolve(__dirname, '..');
const projectRoot = __dirname;

// Set EXPO_ROUTER_APP_ROOT before anything else - must be absolute path for monorepo
process.env.EXPO_ROUTER_APP_ROOT = path.resolve(projectRoot, 'app');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

// Watch all files within the monorepo
config.watchFolders = [workspaceRoot];

// Let Metro know where to resolve packages, and in what order
config.resolver.nodeModulesPaths = [
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(workspaceRoot, 'node_modules'),
];

// Ensure we're using the right project root
config.projectRoot = projectRoot;

module.exports = config;
