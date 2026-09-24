import { auth } from './server';

/** Id do usuário logado, ou null. Usado pelas rotas que escrevem no banco. */
export async function currentUserId(): Promise<string | null> {
    const { data: session } = await auth.getSession();
    return session?.user?.id ?? null;
}
