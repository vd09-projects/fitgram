module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
  plugins: [
    ['module:react-native-dotenv', {
      "moduleName": "@env",
      "path": ".env",
      "blacklist": null,
      "whitelist": null,
      "safe": false,
      "allowUndefined": true
    }],
    '@babel/plugin-transform-optional-catch-binding',
    '@babel/plugin-transform-numeric-separator',
    '@babel/plugin-transform-async-generator-functions',
    '@babel/plugin-transform-object-rest-spread'
  ]
};
