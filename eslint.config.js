import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      prettier,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // Downgraded to a warning: our Firestore-subscription hooks and countdown timers
      // legitimately call setState synchronously inside effects (set loading before
      // subscribing, reset on user change, seed an initial tick). The React-Compiler-era
      // rule is useful signal but should not fail the build for these idiomatic cases.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
])
