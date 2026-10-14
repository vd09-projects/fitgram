// Metro already applies babel-preset-expo when no config exists, so this file
// changes nothing for the app build. It exists for Jest: babel-jest only
// transforms with a config it can find, and without one no file is transformed.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ["babel-preset-expo"],
  };
};
