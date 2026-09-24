import type { NextRequest } from 'next/server';
import { auth } from '@/lib/auth/server';

// Páginas que exigem login; o resto do app (feed, mapa, posts) é público.
// Quem não está logado vai para /login?next=<página>, e volta para ela depois de entrar.
export default function proxy(request: NextRequest) {
    const next = encodeURIComponent(request.nextUrl.pathname);
    return auth.middleware({ loginUrl: `/login?next=${next}` })(request);
}

export const config = {
    matcher: ['/posts/new', '/profile'],
};
