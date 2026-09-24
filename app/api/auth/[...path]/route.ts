import { auth } from '@/lib/auth/server';

// Repassa /api/auth/* para o Neon Auth (cadastro, login, sessão, Google).
export const { GET, POST, PUT, DELETE, PATCH } = auth.handler();
