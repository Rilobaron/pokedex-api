import requests

from .models import montar_personagem


def buscar_personagem(nome):
    resposta = requests.get(f"https://pokeapi.co/api/v2/pokemon/{nome}")
    dados = resposta.json()

    return montar_personagem(dados)
