import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

let client: NeonQueryFunction<false, false> | null = null;

// Cliente Neon (HTTP) criado sob demanda — lê DATABASE_URL na primeira chamada.
export function sql(): NeonQueryFunction<false, false> {
    if (!client) {
        const url = process.env.DATABASE_URL;
        if (!url) throw new Error('DATABASE_URL não configurada');
        client = neon(url);
    }
    return client;
}
