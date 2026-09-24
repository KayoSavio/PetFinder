import { describe, expect, it } from 'vitest';
import { BASE_TILES, LABEL_TILES } from './tiles';

describe('mapa base', () => {
    it('cinza claro sem pontos de interesse, sem chave de API', () => {
        expect(BASE_TILES.url).toBe('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}');
        expect(BASE_TILES.url).not.toMatch(/key=|token=|cartocdn/);
        expect(BASE_TILES.options.attribution).toContain('Esri');
        expect(BASE_TILES.options.maxNativeZoom).toBe(16);
        expect(BASE_TILES.options.maxZoom).toBe(19);
    });
    it('nomes de ruas e bairros numa camada separada por cima', () => {
        expect(LABEL_TILES.url).toContain('World_Light_Gray_Reference');
        expect(LABEL_TILES.options.maxNativeZoom).toBe(16);
    });
});
