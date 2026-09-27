import requests


def buscar_personagem(nome):
    resposta = requests.get(f"https://pokeapi.co/api/v2/pokemon/{nome}")
    dados = resposta.json()

    return {
        "nome": dados["name"],
        "altura": dados["height"],
    }
