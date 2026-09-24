// Mapa base: Esri "Light Gray Canvas" — cinza claro, sem lojas/pontos de interesse,
// para os pins dos pets serem o destaque. Sem chave de API; exige o crédito da Esri.
// (O CARTO passou a exigir chave; o raster do OpenStreetMap tinha informação demais.)
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas';

export const BASE_TILES = {
    url: `${ESRI}/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`,
    options: {
        maxNativeZoom: 16, // imagens existem até o 16; acima disso o Leaflet amplia
        maxZoom: 19,
        attribution: 'Tiles &copy; Esri &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors',
    },
};

// Só os nomes de ruas e bairros, numa camada transparente por cima da base.
export const LABEL_TILES = {
    url: `${ESRI}/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}`,
    options: {
        maxNativeZoom: 16,
        maxZoom: 19,
    },
};
