import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'src/admin', 'src/components', 'src/hooks', 'src/routes', 'src/router.tsx', 'src/lib/config.server.ts', 'src/lib/utils.ts']),
  {
    files: ['src/main.tsx', 'src/App.tsx', 'src/lib/supabase.ts', 'src/lib/store.ts'],
    extends: [js.configs.recommended, tseslint.configs.recommended, reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
    languageOptions: { globals: globals.browser },
    rules: { '@typescript-eslint/no-explicit-any': 'off', 'react-hooks/set-state-in-effect': 'off' },
  },
])
