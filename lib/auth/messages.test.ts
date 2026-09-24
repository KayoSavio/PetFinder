import { describe, expect, it } from 'vitest';
import { authErrorMessage, safeNext } from './messages';

describe('authErrorMessage', () => {
    it('traduz os erros comuns do Better Auth', () => {
        expect(authErrorMessage({ code: 'INVALID_EMAIL_OR_PASSWORD' })).toBe('Email ou senha incorretos');
        expect(authErrorMessage({ code: 'USER_ALREADY_EXISTS' })).toBe('Já existe uma conta com esse email');
        expect(authErrorMessage({ code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL' })).toBe('Já existe uma conta com esse email');
        expect(authErrorMessage({ code: 'PASSWORD_TOO_SHORT' })).toBe('A senha precisa ter pelo menos 8 caracteres');
    });
    it('erro desconhecido usa mensagem genérica', () => {
        expect(authErrorMessage({ code: 'XYZ', message: 'boom' })).toBe('Não foi possível concluir. Tente de novo.');
        expect(authErrorMessage(null)).toBe('Não foi possível concluir. Tente de novo.');
    });
});

describe('safeNext', () => {
    it('só aceita caminhos internos', () => {
        expect(safeNext('/posts/new')).toBe('/posts/new');
        expect(safeNext('//evil.com')).toBe('/feed');
        expect(safeNext('https://evil.com')).toBe('/feed');
        expect(safeNext('/\\evil.com')).toBe('/feed');
        expect(safeNext(null)).toBe('/feed');
    });
});
