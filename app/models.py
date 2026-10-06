from dataclasses import asdict, dataclass, field


@dataclass
class Personagem:
    """Modelo de um Pokémon exposto pela API."""

    id: int
    nome: str
    altura: int
    peso: int
    tipos: list[str]
    imagem: str | None = None
    sprite_shiny: str | None = None
    habilidades: list[str] = field(default_factory=list)
    stats: list[dict] = field(default_factory=list)
    experiencia_base: int | None = None
    descricao: str | None = None
    evolucoes: list[dict] = field(default_factory=list)

    def to_dict(self):
        return asdict(self)


def _imagem_oficial(dados_json) -> str | None:
    sprites = dados_json.get("sprites") or {}
    other = sprites.get("other") or {}
    official = (other.get("official-artwork") or {}).get("front_default")
    if official:
        return official
    dream = (other.get("dream_world") or {}).get("front_default")
    if dream:
        return dream
    return sprites.get("front_default")


def montar_personagem(dados_json, descricao: str | None = None, evolucoes: list[dict] | None = None):
    tipos = [item["type"]["name"] for item in dados_json.get("types", [])]
    habilidades = [item["ability"]["name"] for item in dados_json.get("abilities", [])]
    stats = [
        {"nome": item["stat"]["name"], "valor": item["base_stat"]}
        for item in dados_json.get("stats", [])
    ]
    sprites = dados_json.get("sprites") or {}

    return Personagem(
        id=dados_json.get("id", 0),
        nome=dados_json.get("name", ""),
        altura=dados_json.get("height", 0),
        peso=dados_json.get("weight", 0),
        tipos=tipos,
        imagem=_imagem_oficial(dados_json),
        sprite_shiny=sprites.get("front_shiny"),
        habilidades=habilidades,
        stats=stats,
        experiencia_base=dados_json.get("base_experience"),
        descricao=descricao,
        evolucoes=evolucoes or [],
    )


def montar_resumo(dados_json):
    """Versão leve para cards da listagem."""
    tipos = [item["type"]["name"] for item in dados_json.get("types", [])]
    return {
        "id": dados_json.get("id", 0),
        "nome": dados_json.get("name", ""),
        "tipos": tipos,
        "imagem": _imagem_oficial(dados_json),
    }
