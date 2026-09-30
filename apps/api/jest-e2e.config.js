/** Integration tests against a real Postgres database (clientos_test). */
module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: ".",
  testRegex: ".e2e-spec\\.ts$",
  transform: {
    "^.+\\.ts$": "ts-jest",
  },
  // @clientos/shared and @clientos/database ship pre-compiled dist/*.js
  // (see their package.json "main") — run them as plain JS, don't re-transform.
  transformIgnorePatterns: ["/node_modules/", "packages/(shared|database)/dist"],
  testEnvironment: "node",
  testTimeout: 30000,
};
