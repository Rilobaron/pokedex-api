from dataclasses import dataclass


@dataclass
class Personagem:
    nome: str
    altura: int
    peso: int
    tipos: list[str]


def montar_personagem(dados_json):
    tipos = [item["type"]["name"] for item in dados_json["types"]]

    return Personagem(
        nome=dados_json["name"],
        altura=dados_json["height"],
        peso=dados_json["weight"],
        tipos=tipos,
    )
