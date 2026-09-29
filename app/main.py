from fastapi import FastAPI

from .pokeapi import buscar_personagem

app = FastAPI(title="Pokedex API", description="API de personagens da franquia Pokémon.")


@app.get("/personagens/{nome}")
def personagem_por_nome(nome: str):
    return buscar_personagem(nome)
