// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier/flat');

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: [
      'dist/*',
      'android/*',
      'ios/*',
      '.expo/*',
      'node_modules/*',
      // Deno code: `npm:` imports and the Deno global. The portable files in
      // supabase/functions/_shared are still linted, because the app imports them.
      'supabase/functions/_shared/deno/*',
      'supabase/functions/coach-sessions/*',
      'supabase/functions/invitation/*',
      'supabase/.temp/*',
      'web/*',
    ],
  },
]);
