import { createNeonAuth } from '@neondatabase/auth/next/server';

// Neon Auth (Better Auth gerenciado): usuários e sessões ficam no schema neon_auth do banco.
export const auth = createNeonAuth({
    baseUrl: process.env.NEON_AUTH_BASE_URL!,
    cookies: { secret: process.env.NEON_AUTH_COOKIE_SECRET! },
});
