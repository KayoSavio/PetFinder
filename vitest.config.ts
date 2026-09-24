import path from 'node:path';
import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';

// Testes rodam contra o branch Neon "test" (TEST_DATABASE_URL)
const env = loadEnv('test', process.cwd(), '');

export default defineConfig({
    resolve: { alias: { '@': path.resolve(__dirname) } },
    test: {
        environment: 'node',
        env: { ...env, DATABASE_URL: env.TEST_DATABASE_URL ?? '' },
        fileParallelism: false,
    },
});
