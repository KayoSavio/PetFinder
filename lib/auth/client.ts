'use client';

import { createAuthClient } from '@neondatabase/auth/next';

// Fala com a rota /api/auth do próprio app (mesma origem).
export const authClient = createAuthClient();
