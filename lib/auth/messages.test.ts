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

describe('authErrorMessage com erro lançado pelo cliente', () => {
    it('usa o code de um erro lançado (AuthApiError)', () => {
        const e = Object.assign(new Error('Invalid email or password'), { status: 401, code: 'INVALID_EMAIL_OR_PASSWORD' });
        expect(authErrorMessage(e)).toBe('Email ou senha incorretos');
    });
    it('erro de validação de email', () => {
        expect(authErrorMessage({ code: 'VALIDATION_ERROR', message: '[body.email] Invalid email address' })).toBe('Email inválido');
    });
    it('origem não permitida explica o endereço', () => {
        expect(authErrorMessage({ message: 'Invalid origin', status: 403 })).toBe('Endereço não permitido para login. Abra o app em http://localhost:3001');
    });
    it('códigos normalizados pelo cliente do Neon (estilo Supabase)', () => {
        expect(authErrorMessage({ code: 'invalid_credentials', status: 401 })).toBe('Email ou senha incorretos');
        expect(authErrorMessage({ code: 'user_already_exists', status: 422 })).toBe('Já existe uma conta com esse email');
        expect(authErrorMessage({ code: 'weak_password', status: 422 })).toBe('A senha precisa ter pelo menos 8 caracteres');
        expect(authErrorMessage({ code: 'email_address_invalid', status: 400, message: '[body.email] Invalid email address' })).toBe('Email inválido');
    });
    it('falha de rede de verdade', () => {
        expect(authErrorMessage(new TypeError('Failed to fetch'))).toBe('Sem conexão com o servidor. Tente de novo.');
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
