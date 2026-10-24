// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Bundle 3D body models (.glb) as assets.
config.resolver.assetExts.push('glb');

module.exports = config;
