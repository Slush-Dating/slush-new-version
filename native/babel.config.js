const path = require('path');

module.exports = function (api) {
    api.cache(true);
    // Set absolute path for EXPO_ROUTER_APP_ROOT to work in monorepo
    process.env.EXPO_ROUTER_APP_ROOT = process.env.EXPO_ROUTER_APP_ROOT || path.resolve(__dirname, 'app');
    return {
        presets: ['babel-preset-expo'],
        plugins: ['react-native-reanimated/plugin'],
    };
};
