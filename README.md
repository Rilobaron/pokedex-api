# Pokédex

Aplicação web de Pokédex construída com **FastAPI** e **JavaScript puro**, consumindo a [PokéAPI](https://pokeapi.co). O backend funciona como camada intermediária que agrega, normaliza e cacheia os dados externos; o frontend entrega a experiência completa — Pokémon em destaque, stats visíveis, filtros, favoritos e detalhes — sem frameworks, sem build e com responsividade de ponta a ponta.

## Demo

`Deploy público: em breve` — o repositório já está preparado para o Render (Blueprint em `render.yaml`).

| Desktop | Detalhes | Mobile |
|---|---|---|
| ![Pokédex no desktop](docs/screenshot-desktop.png) | ![Detalhes do Pokémon](docs/screenshot-detail.png) | ![Pokédex no mobile](docs/screenshot-mobile.png) |

## Funcionalidades

- **Listagem paginada** com "Carregar mais" (24 por página)
- **Busca por nome ou número** (ex.: `pikachu`, `25`) com debounce
- **Filtro por tipo** na toolbar, com dots coloridos e scroll horizontal
- **Ordenação** por número crescente/decrescente e nome A-Z/Z-A
- **Pokémon em destaque (hero)** com artwork oficial, tipos, descrição, altura/peso e **6 stats em barras visíveis sem abrir o modal**
- **Sidebar de navegação** (Explorar, Favoritos, Tipos) com total de espécies
- **Detalhes completos** em modal: descrição, altura e peso, habilidades, stats, sprite **shiny** (alternável) e **cadeia evolutiva clicável**
- **Artwork oficial** com fallback automático de sprite
- **Favoritos persistidos** em `localStorage`, com filtro "somente favoritos"
- **Deep-link** direto (ex.: `#/pokemon/25`), funciona após refresh
- **Estados de interface**: skeleton de loading, estado vazio e estado de erro com retry
- **Resiliência na integração**: cache no backend, timeout e tratamento de indisponibilidade da PokéAPI
- **Responsivo** (sidebar vira header no mobile; breakpoints em 768/1024/1199px)
- **Acessibilidade básica**: foco visível, `aria` nos controles, `Esc` fecha o modal, `prefers-reduced-motion` respeitado
- **Interface em português (PT-BR)**; descrição do Pokémon em português quando disponível, com fallback para inglês

## Tecnologias

### Backend
- **Python 3.12** · **FastAPI** · **Uvicorn**
- **Requests** (cliente HTTP real usado pelo projeto)
- Modelagem com `dataclasses` (sem ORM, sem banco)

### Frontend
- **HTML5** · **CSS3** (design tokens, media queries, `color-mix`) · **JavaScript vanilla**
- Nenhum bundler, framework ou etapa de build

### Integração
- **[PokéAPI](https://pokeapi.co/api/v2)**

### Qualidade / Deploy
- **pytest** + TestClient (**httpx**) — testes offline com HTTP mockado
- **Render** (Blueprint) · **Docker**

## Arquitetura

```text
navegador ──────► FastAPI ──────► pokeapi.py ──────► PokéAPI
   ▲                │                 │
   │                │                 ├─ cache em memória (TTL 1h)
   │                │                 ├─ timeout de 10 s
   │                │                 └─ buscas paralelas (8 workers)
   └── static/ ◄────┘
       + JSON
```

- O **frontend estático é servido pelo próprio FastAPI** — deploy único, sem etapa de build.
- O backend atua como **camada de abstração** da PokéAPI: agrega `/pokemon`, `/pokemon-species` e `/evolution-chain` em uma única resposta normalizada.
- **Tratamento de erros**: `404` quando o Pokémon não existe, `502` quando a PokéAPI está indisponível; a cadeia evolutiva é opcional — se falhar, o detalhe continua funcionando sem ela.
- **Cache**: TTL de 1 hora no servidor (limite de 500 entradas) reduz chamadas repetidas à API externa.
- **Listagem paralela**: os detalhes da página são buscados com `ThreadPoolExecutor` (8 workers).
- No frontend, um **`detailCache`** evita refazer requisições de Pokémon já visitados (hero, cards e modal compartilham o mesmo cache).

## API

| Rota | Descrição |
|---|---|
| `GET /` | Frontend da Pokédex |
| `GET /api/health` | Healthcheck (`{"status": "ok"}`), sem dependências externas |
| `GET /api/types` | Tipos disponíveis (exclui `unknown` e `shadow`) |
| `GET /api/pokemon` | Lista paginada com resumo dos Pokémon |
| `GET /api/pokemon/{id_ou_nome}` | Detalhe completo de um Pokémon |
| `GET /personagens/{nome}` | Rota legada do projeto original, mantida por compatibilidade |

**Parâmetros de `GET /api/pokemon`:**

| Parâmetro | Padrão | Observação |
|---|---|---|
| `limit` | `24` | Entre 1 e 60 |
| `offset` | `0` | Deslocamento da página |
| `type` | — | Filtra por tipo (ex.: `fire`) |

Exemplo: `GET /api/pokemon?limit=24&offset=0&type=fire`

Documentação interativa (Swagger): `http://127.0.0.1:8000/docs`

### Exemplo de resposta

`GET /api/pokemon/pikachu` (campos principais):

```json
{
  "id": 25,
  "nome": "pikachu",
  "altura": 4,
  "peso": 60,
  "tipos": ["electric"],
  "habilidades": ["static", "lightning-rod"],
  "stats": [
    { "nome": "hp", "valor": 35 },
    { "nome": "attack", "valor": 55 },
    { "nome": "defense", "valor": 40 },
    { "nome": "special-attack", "valor": 50 },
    { "nome": "special-defense", "valor": 50 },
    { "nome": "speed", "valor": 90 }
  ],
  "experiencia_base": 112,
  "imagem": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png",
  "sprite_shiny": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/shiny/25.png",
  "descricao": "When several of these POKéMON gather, their electricity could build and cause lightning storms.",
  "evolucoes": [
    { "id": 172, "nome": "pichu", "imagem": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/172.png" },
    { "id": 25, "nome": "pikachu", "imagem": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png" },
    { "id": 26, "nome": "raichu", "imagem": "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/26.png" }
  ]
}
```

> `altura` está em decímetros e `peso` em hectogramas (unidades brutas da PokéAPI); a conversão para m/kg é feita no frontend.

## Como executar

```bash
git clone https://github.com/Rilobaron/pokedex-api.git
cd pokedex-api

python -m venv .venv

# Windows
.venv\Scripts\activate

# Linux / macOS
source .venv/bin/activate

pip install -r requirements.txt

uvicorn app.main:app --reload
```

Abra `http://127.0.0.1:8000`. Nenhuma variável de ambiente é necessária.

## Testes

```bash
pytest -q
```

**8 testes automatizados**, todos offline (HTTP mockado), cobrindo: modelo, healthcheck, 404, listagem, rota legada e a cadeia evolutiva (linear, ramificada e inclusão no detalhe).

Checagem de sintaxe do JavaScript (opcional): `node --check static/app.js`

## Deploy

### Render

O projeto inclui um **Blueprint** (`render.yaml`) que já configura tudo:

- **Build:** `pip install -r requirements.txt`
- **Start:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- **Health check:** `/api/health`
- **`PYTHON_VERSION`:** `3.12.6` (injetado pelo próprio blueprint)

No [dashboard do Render](https://dashboard.render.com): **New → Blueprint** e selecione o repositório. Nenhuma variável de ambiente precisa ser criada manualmente — o Render injeta `$PORT`.

### Docker

Há também um `Dockerfile` (imagem `python:3.12-slim`):

```bash
docker build -t pokedex-api .
docker run -p 8000:8000 pokedex-api
```

A aplicação fica disponível em `http://127.0.0.1:8000`.

## Estrutura

```text
pokedex-api/
├── app/
│   ├── main.py          # Rotas /api/*, rota legada e frontend estático
│   ├── pokeapi.py       # Cliente da PokéAPI: cache, timeout, erros, concorrência
│   └── models.py        # Modelo de dados e montadores (resumo/detalhe)
├── static/
│   ├── index.html       # Layout: sidebar, hero, toolbar, grid, modal
│   ├── styles.css       # Design system dark e responsivo
│   ├── app.js           # Busca, filtros, favoritos, modal, evolução, deep-link
│   └── favicon.svg
├── tests/
│   └── test_api.py      # Testes offline com HTTP mockado
├── docs/                # Screenshots
├── requirements.txt
├── render.yaml          # Blueprint do Render
├── Dockerfile
└── README.md
```

## Decisões técnicas

- **FastAPI como backend leve** — uma única aplicação serve API e frontend, sem infraestrutura extra.
- **Frontend vanilla** — dependências mínimas e zero etapas de build; o deploy é um `pip install`.
- **Backend como proxy da PokéAPI** — o navegador nunca fala com a API externa diretamente; isso centraliza cache, normalização e tratamento de erro.
- **Resiliência** — timeout de 10 s, `404` para inexistente, `502` para indisponibilidade e cadeia evolutiva opcional.
- **Cache TTL de 1 h** — reduz chamadas repetidas à PokéAPI em uma aplicação sem banco de dados.
- **Rota legada preservada** — `GET /personagens/{nome}` mantém compatibilidade com a primeira versão do projeto.
- **Responsividade sem framework** — media queries e design tokens em CSS puro.
- **Escopo deliberado** — sem banco de dados e sem autenticação: as escolhas foram mantidas simples de propósito.

## Origem

O projeto nasceu como exercício do **#7DaysOfCode** (Alura), começando por um endpoint simples de consulta de Pokémon. A partir daí foi expandido até uma aplicação completa de portfólio: API estruturada, frontend próprio, testes, cache, tratamento de erros, cadeia evolutiva, favoritos, responsividade e preparação de deploy.

## Próximos passos

> Roadmap — nenhuma das itens abaixo é funcionalidade atual.

- Comparação lado a lado de Pokémon (item "Comparar" já reservado na interface)
- Suporte a PWA com modo offline
- Internacionalização (PT-BR / EN)

## Créditos

- Dados fornecidos pela [PokéAPI](https://pokeapi.co).
- Pokémon e nomes relacionados pertencem a Nintendo, Creatures Inc. e GAME FREAK inc.
