from pathlib import Path

from fastapi import FastAPI, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .models import Personagem
from .pokeapi import (
    PokeApiIndisponivel,
    PokemonNaoEncontrado,
    buscar_personagem,
    detalhar_pokemon,
    listar_pokemons,
    listar_por_tipo,
    listar_tipos,
)

app = FastAPI(
    title="Pokedex API",
    description="API de personagens da franquia Pokémon (dados: PokéAPI).",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).resolve().parent.parent
STATIC_DIR = BASE_DIR / "static"


@app.exception_handler(PokemonNaoEncontrado)
async def _nao_encontrado(_, exc: PokemonNaoEncontrado):
    return JSONResponse(status_code=404, content={"detail": str(exc)})


@app.exception_handler(PokeApiIndisponivel)
async def _indisponivel(_, exc: PokeApiIndisponivel):
    return JSONResponse(status_code=502, content={"detail": str(exc)})


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/types")
def tipos():
    return {"resultados": listar_tipos()}


@app.get("/api/pokemon")
def pokemons(
    limit: int = Query(default=24, ge=1, le=60),
    offset: int = Query(default=0, ge=0),
    type: str | None = Query(default=None),
):
    if type:
        return listar_por_tipo(type, limit=limit, offset=offset)
    return listar_pokemons(limit=limit, offset=offset)


@app.get("/api/pokemon/{ident}")
def pokemon_detalhe(ident: str):
    return detalhar_pokemon(ident).to_dict()


# Rota legada do Dia 1 — mantida por compatibilidade.
@app.get("/personagens/{nome}", response_model=None)
def personagem_por_nome(nome: str):
    personagem: Personagem = buscar_personagem(nome)
    return personagem.to_dict()


# Frontend (fase full-stack): servido pelo próprio FastAPI, sem build.
if STATIC_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

    @app.get("/", include_in_schema=False)
    def index():
        return FileResponse(str(STATIC_DIR / "index.html"))

    @app.middleware("http")
    async def _frontend_sem_cache_obsoleto(request: Request, call_next):
        """Revalidação obrigatória de HTML/CSS/JS (ETag -> 304).

        Sem Cache-Control, o navegador aplica cache heurístico e pode servir
        um index.html antigo junto com app.js/styles.css novos. Nesse estado
        misto, o JS novo aborta em IDs que não existem no HTML antigo
        (TypeError em app.js:463/#sortSelect) e a UI inteira deixa de montar.
        """
        response = await call_next(request)
        if request.url.path == "/" or request.url.path.startswith("/static/"):
            response.headers["Cache-Control"] = "no-cache"
        return response
