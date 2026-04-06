const { withRorkMetro } = require("@rork-ai/toolkit-sdk/metro");
const {
  getSentryExpoConfig
} = require("@sentry/react-native/metro");

const config = getSentryExpoConfig(__dirname);

module.exports = withRorkMetro(config);