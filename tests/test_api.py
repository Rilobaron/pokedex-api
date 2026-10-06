"""Testes básicos da Pokedex API (offline: monkeypatch na camada HTTP)."""

from fastapi.testclient import TestClient

from app import pokeapi
from app.main import app
from app.models import montar_personagem

client = TestClient(app)

BULBASSAURO = {
    "id": 1,
    "name": "bulbasaur",
    "height": 7,
    "weight": 69,
    "base_experience": 64,
    "abilities": [{"ability": {"name": "overgrow"}}],
    "types": [{"type": {"name": "grass"}}, {"type": {"name": "poison"}}],
    "stats": [{"stat": {"name": "hp"}, "base_stat": 45}],
    "sprites": {"front_default": "https://x/bulba.png", "front_shiny": None,
                "other": {"official-artwork": {"front_default": "https://x/bulba-art.png"}}},
}


def test_montar_personagem():
    p = montar_personagem(BULBASSAURO)
    assert p.id == 1
    assert p.nome == "bulbasaur"
    assert p.tipos == ["grass", "poison"]
    assert p.imagem == "https://x/bulba-art.png"
    assert p.habilidades == ["overgrow"]
    assert p.stats == [{"nome": "hp", "valor": 45}]


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_detalhe_404(monkeypatch):
    def fake_get(url, timeout=10):
        class Resp:
            status_code = 404
            ok = False

            def json(self):
                return {}
        return Resp()
    monkeypatch.setattr(pokeapi._session, "get", fake_get)
    pokeapi._cache.clear()
    r = client.get("/api/pokemon/inexistente-xyz")
    assert r.status_code == 404


def test_listagem(monkeypatch):
    pagina = {"count": 2, "results": [
        {"name": "bulbasaur", "url": "https://pokeapi.co/api/v2/pokemon/1/"},
    ]}

    def fake_get(url, timeout=10):
        class Resp:
            status_code = 200
            ok = True

            def json(self):
                if "pokemon?limit" in url:
                    return pagina
                return BULBASSAURO
        return Resp()

    monkeypatch.setattr(pokeapi._session, "get", fake_get)
    pokeapi._cache.clear()
    r = client.get("/api/pokemon?limit=1&offset=0")
    assert r.status_code == 200
    corpo = r.json()
    assert corpo["total"] == 2
    assert corpo["resultados"][0]["nome"] == "bulbasaur"


def test_rota_legada(monkeypatch):
    def fake_get(url, timeout=10):
        class Resp:
            status_code = 200
            ok = True

            def json(self):
                return BULBASSAURO
        return Resp()

    monkeypatch.setattr(pokeapi._session, "get", fake_get)
    pokeapi._cache.clear()
    r = client.get("/personagens/bulbasaur")
    assert r.status_code == 200
    assert r.json()["nome"] == "bulbasaur"


CHAIN_BULBASSAURO = {
    "chain": {
        "species": {"name": "bulbasaur", "url": "https://pokeapi.co/api/v2/pokemon-species/1/"},
        "evolves_to": [{
            "species": {"name": "ivysaur", "url": "https://pokeapi.co/api/v2/pokemon-species/2/"},
            "evolves_to": [{
                "species": {"name": "venusaur", "url": "https://pokeapi.co/api/v2/pokemon-species/3/"},
                "evolves_to": [],
            }],
        }],
    }
}


def test_extrair_evolucao():
    cadeia = pokeapi.extrair_evolucao(CHAIN_BULBASSAURO)
    assert [e["nome"] for e in cadeia] == ["bulbasaur", "ivysaur", "venusaur"]
    assert cadeia[0]["id"] == 1
    assert cadeia[0]["imagem"].endswith("/1.png")


def test_extrair_evolucao_ramificada():
    chain = {"chain": {
        "species": {"name": "eevee", "url": "https://pokeapi.co/api/v2/pokemon-species/133/"},
        "evolves_to": [
            {"species": {"name": "vaporeon", "url": "https://pokeapi.co/api/v2/pokemon-species/134/"},
             "evolves_to": []},
            {"species": {"name": "jolteon", "url": "https://pokeapi.co/api/v2/pokemon-species/135/"},
             "evolves_to": []},
        ],
    }}
    cadeia = pokeapi.extrair_evolucao(chain)
    assert [e["nome"] for e in cadeia] == ["eevee", "vaporeon", "jolteon"]


def test_detalhe_inclui_evolucoes(monkeypatch):
    species = {
        "flavor_text_entries": [],
        "evolution_chain": {"url": "https://pokeapi.co/api/v2/evolution-chain/1/"},
    }

    def fake_get(url, timeout=10):
        class Resp:
            status_code = 200
            ok = True

            def json(self):
                if "evolution-chain" in url:
                    return CHAIN_BULBASSAURO
                if "pokemon-species" in url:
                    return species
                return BULBASSAURO
        return Resp()

    monkeypatch.setattr(pokeapi._session, "get", fake_get)
    pokeapi._cache.clear()
    r = client.get("/api/pokemon/1")
    assert r.status_code == 200
    assert [e["nome"] for e in r.json()["evolucoes"]] == ["bulbasaur", "ivysaur", "venusaur"]
