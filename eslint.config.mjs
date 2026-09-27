import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'

const eslintConfig = [
  ...nextCoreWebVitals,
  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts', 'src/types/database.generated.ts', 'supabase/functions/**'],
  },
]

export default eslintConfig
