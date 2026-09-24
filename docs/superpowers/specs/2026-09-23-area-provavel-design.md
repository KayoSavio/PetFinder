# Área Provável + Modo Busca — Design

Data: 2026-09-23
Status: aguardando revisão

## Contexto e objetivo

Quando alguém perde um cachorro, o app deve responder: **"onde ele provavelmente está agora?"**
e ajudar o dono a **sair procurando** na rua com essa informação.

A ideia completa do produto tem três partes. Elas viram sub-projetos separados:

| # | Sub-projeto | Depende de | Status |
|---|-------------|-----------|--------|
| 1 | **Área provável + modo busca** (este spec) | dados que já existem | este documento |
| 2 | XP / gamificação para quem fotografa cachorros na rua | auth real + persistência no Supabase (hoje as rotas Next usam `lib/mock-data.ts`) | spec futuro |
| 3 | Migrar rotas Next de mock → Supabase | — | pré-requisito do #2 |

### O que já existe e será reaproveitado
- `posts` (lost / found / help_request) com local e `event_datetime`.
- `sightings` (avistamentos de um post), hoje servidos por mock em `app/api/posts/[id]/sightings/route.ts`.
- Match visual: `ai-service` (YOLO + DINOv2) → `GET /match/by-post/{id}`, com proxy em `app/api/posts/[id]/matches/route.ts`. Retorna posts `found` parecidos, com `similarity` e `distance_km`.
- `components/matches/MatchesPanel.tsx` + `MatchMap.tsx` (Leaflet) na página do post.

## O que o usuário vê

1. **Na página de um post `lost`**: o mapa de matches passa a mostrar:
   - um **círculo da área provável** (centro + raio), com legenda "Provável área agora · raio X km · atualizado há Y";
   - a **trilha**: linha ligando ponto de perda → avistamentos → matches fortes, em ordem de tempo;
   - pinos numerados por ordem cronológica.
2. **Botão "Sair procurando"** → abre `/posts/[id]/buscar`:
   - mapa em tela cheia centrado na posição do usuário (GPS via `navigator.geolocation.watchPosition`);
   - a área provável desenhada;
   - pinos de avistamentos/matches; os que estão a **≤ 300 m** do usuário ficam destacados e aparecem num card fixo embaixo ("Possível avistamento a 120 m · 78% parecido · há 2h");
   - botão "Vi um cachorro parecido" → abre o formulário de avistamento já com a posição atual.

## Algoritmo da área provável

Função pura em `lib/geo/probable-area.ts`, sem dependência de rede ou DB — fácil de testar.

### Entrada
```ts
interface EvidencePoint {
  lat: number; lng: number;
  at: string;                 // ISO datetime
  kind: 'origin' | 'sighting' | 'match';
  confidence: number;         // origin=1, sighting=0.9, match=similarity (0–1)
}
computeProbableArea(points: EvidencePoint[], now: Date, opts?: Partial<AreaOptions>): ProbableArea
```

### Regras
1. **Filtrar**: descarta `match` com `confidence < 0.70` (`minMatchConfidence`) e pontos com data no futuro.
2. **Âncora** = o ponto mais recente entre os que sobraram. Se houver mais de um ponto nas últimas
   `clusterWindowHours` (6 h) antes da âncora, o **centro** é a média ponderada desses pontos
   (peso = `confidence`); senão, o centro é a própria âncora.
3. **Raio** cresce com o tempo desde a âncora:
   `raio_km = clamp(baseRadiusKm + speedKmPerHour × horas_desde_ancora, baseRadiusKm, maxRadiusKm)`
   Padrões: `baseRadiusKm = 0.5`, `speedKmPerHour = 0.15`, `maxRadiusKm = 5`.
   (≈ 0,5 km logo após o evento, ≈ 4 km depois de 24 h, teto de 5 km.) Todos configuráveis em `opts`.
4. **Confiança da área**: `high` se a âncora é um avistamento/match com confiança ≥ 0.8 e tem < 12 h;
   `medium` se tem < 48 h; senão `low`. Exibida como texto na legenda.
5. **Trilha** = pontos filtrados ordenados por `at` ascendente.

### Saída
```ts
interface ProbableArea {
  center: { lat: number; lng: number };
  radius_km: number;
  confidence: 'high' | 'medium' | 'low';
  anchor: EvidencePoint;
  trail: EvidencePoint[];
  computed_at: string;
}
```

Sem ponto de origem válido (post sem local) → a função lança erro; a rota responde 422.

## API

`GET /api/posts/[id]/probable-area`
1. Carrega o post (mesma fonte que `app/api/posts/[id]/route.ts` usa hoje — mock).
2. Carrega avistamentos do post (mesma fonte da rota de sightings).
3. Busca matches no ai-service (`/match/by-post/{id}`). **Se o ai-service estiver fora, segue sem matches**
   e responde com `matches_available: false` — a área ainda é calculada com origem + avistamentos.
4. Monta `EvidencePoint[]` e chama `computeProbableArea`.
5. Responde `ProbableArea & { matches_available: boolean }`.

Só para posts `lost` / `help_request`; para `found` responde 400.

Para evitar duplicação, a leitura de post/avistamentos vira helpers em `lib/data/posts.ts`
(`getPost(id)`, `getSightings(postId)`) usados pelas rotas existentes e pela nova. Quando o
sub-projeto 3 migrar para Supabase, só esses helpers mudam.

## Componentes

| Arquivo | Responsabilidade |
|---------|------------------|
| `lib/geo/probable-area.ts` | algoritmo puro (acima) + `haversineKm` |
| `lib/data/posts.ts` | `getPost`, `getSightings` (hoje sobre mock) |
| `app/api/posts/[id]/probable-area/route.ts` | orquestra dados + algoritmo |
| `components/map/ProbableAreaLayer.tsx` | desenha círculo + trilha num `L.Map` recebido por prop |
| `components/matches/MatchMap.tsx` | passa a usar `ProbableAreaLayer` quando recebe `area` |
| `components/matches/MatchesPanel.tsx` | busca `/probable-area`, repassa ao mapa, botão "Sair procurando" |
| `app/posts/[id]/buscar/page.tsx` | modo busca (GPS, proximidade ≤ 300 m, card, atalho p/ avistamento) |

## Erros e bordas
- GPS negado/indisponível: modo busca funciona sem a bolinha do usuário e mostra aviso "Ative a localização para ver o que está perto de você"; sem destaque por proximidade.
- ai-service fora: área calculada sem matches, legenda diz "sem comparação por foto no momento".
- Post sem avistamentos nem matches: área = origem + raio pelo tempo desde `event_datetime`.
- Post `resolved`: não mostra área nem botão.

## Testes
- Adicionar **Vitest** (hoje o projeto não tem framework de teste JS) com script `npm test`.
- `lib/geo/probable-area.test.ts`: só origem; raio cresce com o tempo e respeita teto; match fraco é ignorado; âncora é o ponto mais recente; centro ponderado dentro da janela de 6 h; confiança high/medium/low; data futura descartada; erro sem origem.
- `haversineKm` com par de coordenadas conhecido.
- Rota e UI: verificação manual com `npm run dev` (post mock com avistamentos) e com o ai-service desligado.

## Fora do escopo
- XP / gamificação (sub-projeto 2).
- Migração para Supabase (sub-projeto 3).
- Modelos de ML de movimentação, mapas de calor, notificações push para quem está perto.
