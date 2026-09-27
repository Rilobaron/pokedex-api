from pokeapi import buscar_personagem

personagem = buscar_personagem("pikachu")

print(f"Personagem: {personagem['nome']} | Altura: {personagem['altura']}")
