// Camada base dos mapas (Leaflet). OpenStreetMap: sem chave de API, mas exige o crédito
// visível e uso moderado (https://operations.osmfoundation.org/policies/tiles/).
// O CARTO passou a exigir chave e mostrava "API KEY REQUIRED" sobre o mapa.
export const BASE_TILES = {
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    options: {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    },
};
