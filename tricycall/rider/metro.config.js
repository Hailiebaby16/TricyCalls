const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const config = getDefaultConfig(projectRoot);

const localModules = [
  '@expo/metro-runtime',
  'expo',
  'react',
  'react-dom',
  'react-native',
  'react-native-web'
];

config.resolver.extraNodeModules = {
  ...config.resolver.extraNodeModules,
  ...Object.fromEntries(
    localModules.map(moduleName => [
      moduleName,
      path.join(projectRoot, 'node_modules', moduleName)
    ])
  )
};

module.exports = config;
