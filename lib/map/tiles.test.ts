import { describe, expect, it } from 'vitest';
import { BASE_TILES } from './tiles';

describe('BASE_TILES', () => {
    it('usa um provedor que não exige chave de API', () => {
        expect(BASE_TILES.url).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
        expect(BASE_TILES.url).not.toMatch(/cartocdn|key=|token=/);
    });
    it('mostra o crédito exigido pelo OpenStreetMap', () => {
        expect(BASE_TILES.options.attribution).toContain('OpenStreetMap');
        expect(BASE_TILES.options.maxZoom).toBe(19);
    });
});
