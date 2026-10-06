"""Cliente da PokéAPI com cache em memória, timeout e erros tratados."""

import time
from concurrent.futures import ThreadPoolExecutor

import requests

from .models import montar_personagem, montar_resumo

BASE_URL = "https://pokeapi.co/api/v2"
TIMEOUT = 10

_session = requests.Session()
_session.headers.update({"User-Agent": "pokedex-api/1.0"})

# Cache simples com TTL: {chave: (expira_em, valor)}
_cache: dict = {}
CACHE_TTL = 3600


class PokemonNaoEncontrado(Exception):
    pass


class PokeApiIndisponivel(Exception):
    pass


def _cache_get(chave):
    item = _cache.get(chave)
    if not item:
        return None
    expira_em, valor = item
    if time.time() > expira_em:
        _cache.pop(chave, None)
        return None
    return valor


def _cache_set(chave, valor, ttl= CACHE_TTL):
    if len(_cache) > 500:
        _cache.clear()
    _cache[chave] = (time.time() + ttl, valor)


def _get_json(url):
    cached = _cache_get(url)
    if cached is not None:
        return cached
    try:
        resposta = _session.get(url, timeout=TIMEOUT)
    except requests.RequestException as exc:
        raise PokeApiIndisponivel(f"Não foi possível contatar a PokéAPI: {exc}") from exc
    if resposta.status_code == 404:
        raise PokemonNaoEncontrado("Pokémon não encontrado.")
    if not resposta.ok:
        raise PokeApiIndisponivel(f"PokéAPI respondeu com status {resposta.status_code}.")
    try:
        dados = resposta.json()
    except ValueError as exc:
        raise PokeApiIndisponivel("Resposta inválida da PokéAPI.") from exc
    _cache_set(url, dados)
    return dados


def _descricao_pt_ou_en(species_json) -> str | None:
    entradas = species_json.get("flavor_text_entries") or []
    for idioma in ("pt", "es", "en"):
        for item in entradas:
            if item.get("language", {}).get("name") == idioma:
                texto = " ".join(item.get("flavor_text", "").split())
                if texto:
                    return texto
    return None


def buscar_personagem(nome):
    """Compat: busca um Pokémon por nome (mantida do Dia 1, agora robusta)."""
    ident = str(nome).strip().lower()
    if not ident:
        raise PokemonNaoEncontrado("Pokémon não encontrado.")
    dados = _get_json(f"{BASE_URL}/pokemon/{ident}")
    return montar_personagem(dados)


def detalhar_pokemon(ident):
    ident = str(ident).strip().lower()
    if not ident:
        raise PokemonNaoEncontrado("Pokémon não encontrado.")
    dados = _get_json(f"{BASE_URL}/pokemon/{ident}")
    descricao = None
    evolucoes: list[dict] = []
    try:
        species = _get_json(f"{BASE_URL}/pokemon-species/{dados['id']}")
        descricao = _descricao_pt_ou_en(species)
        evolucoes = obter_evolucoes(species)
    except (PokemonNaoEncontrado, PokeApiIndisponivel, KeyError):
        descricao = None
    return montar_personagem(dados, descricao=descricao, evolucoes=evolucoes)


def _id_da_url(url: str) -> int | None:
    """Extrai o id numérico do final de URLs como .../pokemon-species/25/."""
    try:
        return int(str(url).rstrip("/").split("/")[-1])
    except (ValueError, IndexError):
        return None


def extrair_evolucao(chain_json: dict) -> list[dict]:
    """Achata a cadeia evolutiva (pré-ordem) em [{id, nome, imagem}]."""
    ordem: list[dict] = []
    vistos = set()

    def visitar(no):
        especie = (no or {}).get("species") or {}
        nome = especie.get("name")
        pid = _id_da_url(especie.get("url", ""))
        if nome and pid and pid not in vistos:
            vistos.add(pid)
            ordem.append({
                "id": pid,
                "nome": nome,
                "imagem": (
                    "https://raw.githubusercontent.com/PokeAPI/sprites/"
                    f"master/sprites/pokemon/other/official-artwork/{pid}.png"
                ),
            })
        for filho in (no or {}).get("evolves_to") or []:
            visitar(filho)

    visitar((chain_json or {}).get("chain"))
    return ordem


def obter_evolucoes(species_json) -> list[dict]:
    url = (species_json.get("evolution_chain") or {}).get("url")
    if not url:
        return []
    chain_json = _get_json(url)
    return extrair_evolucao(chain_json)


def _resumo_por_url(url):
    dados = _get_json(url)
    return montar_resumo(dados)


def listar_pokemons(limit: int = 24, offset: int = 0):
    limit = max(1, min(limit, 60))
    offset = max(0, offset)
    pagina = _get_json(f"{BASE_URL}/pokemon?limit={limit}&offset={offset}")
    resultados = pagina.get("results", [])
    total = pagina.get("count", 0)
    urls = [item["url"] for item in resultados if item.get("url")]
    with ThreadPoolExecutor(max_workers=8) as pool:
        detalhes = list(pool.map(_resumo_por_url, urls))
    return {"total": total, "limit": limit, "offset": offset, "resultados": detalhes}


def listar_por_tipo(tipo: str, limit: int = 24, offset: int = 0):
    tipo = str(tipo).strip().lower()
    dados = _get_json(f"{BASE_URL}/type/{tipo}")
    entradas = dados.get("pokemon", [])
    total = len(entradas)
    fatia = entradas[offset : offset + limit]
    urls = [item["pokemon"]["url"] for item in fatia if item.get("pokemon", {}).get("url")]
    with ThreadPoolExecutor(max_workers=8) as pool:
        detalhes = list(pool.map(_resumo_por_url, urls))
    return {"total": total, "limit": limit, "offset": offset, "resultados": detalhes}


def listar_tipos():
    dados = _get_json(f"{BASE_URL}/type")
    tipos = []
    for item in dados.get("results", []):
        url = item.get("url", "")
        # URL termina com /type/<id>/ — ignoramos "unknown" e "shadow"
        nome = item.get("name", "")
        if nome in ("unknown", "shadow"):
            continue
        tipos.append({"nome": nome, "url": url})
    return tipos
