// Mensagens de erro do login em português (códigos do Better Auth).
const MESSAGES: Record<string, string> = {
    INVALID_EMAIL_OR_PASSWORD: 'Email ou senha incorretos',
    INVALID_EMAIL: 'Email inválido',
    INVALID_PASSWORD: 'Email ou senha incorretos',
    USER_ALREADY_EXISTS: 'Já existe uma conta com esse email',
    USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'Já existe uma conta com esse email',
    PASSWORD_TOO_SHORT: 'A senha precisa ter pelo menos 8 caracteres',
    PASSWORD_TOO_LONG: 'Senha longa demais',
    EMAIL_NOT_VERIFIED: 'Confirme seu email antes de entrar',
    // Códigos depois da normalização do cliente @neondatabase/auth (estilo Supabase)
    invalid_credentials: 'Email ou senha incorretos',
    user_not_found: 'Email ou senha incorretos',
    user_already_exists: 'Já existe uma conta com esse email',
    weak_password: 'A senha precisa ter pelo menos 8 caracteres',
    email_address_invalid: 'Email inválido',
    email_not_confirmed: 'Confirme seu email antes de entrar',
};

type AuthErrorLike = { code?: string; message?: string; status?: number } | null | undefined;

/**
 * Serve tanto para o `{ error }` devolvido quanto para o erro lançado pelo cliente
 * do Neon Auth (AuthApiError tem code/status/message) e para falha de rede.
 */
export function authErrorMessage(error: AuthErrorLike | unknown): string {
    const e = (error ?? {}) as { code?: string; message?: string; status?: number; name?: string };
    if (e.code && MESSAGES[e.code]) return MESSAGES[e.code];
    const msg = e.message ?? '';
    if (e.code === 'VALIDATION_ERROR' && /email/i.test(msg)) return 'Email inválido';
    if (e.code === 'VALIDATION_ERROR' && /password/i.test(msg)) return 'A senha precisa ter pelo menos 8 caracteres';
    if (/invalid origin/i.test(msg)) return 'Endereço não permitido para login. Abra o app em http://localhost:3001';
    if (error instanceof TypeError || /failed to fetch|network/i.test(msg)) return 'Sem conexão com o servidor. Tente de novo.';
    return 'Não foi possível concluir. Tente de novo.';
}

/** Destino depois do login: só caminhos do próprio app (evita redirecionar para outro site). */
export function safeNext(next: string | null | undefined): string {
    if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/feed';
    return next;
}
