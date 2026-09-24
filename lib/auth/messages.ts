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
};

export function authErrorMessage(error: { code?: string; message?: string } | null | undefined): string {
    return (error?.code && MESSAGES[error.code]) || 'Não foi possível concluir. Tente de novo.';
}

/** Destino depois do login: só caminhos do próprio app (evita redirecionar para outro site). */
export function safeNext(next: string | null | undefined): string {
    if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/feed';
    return next;
}
