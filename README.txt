# Catálogo de JSONs — PS4

Este projeto é um catálogo local para os JSONs fornecidos pelo usuário.

## Como usar

1. Extraia os arquivos.
2. Abra `index.html` no navegador.
3. Selecione `GAMES.json`, `DLC.json` e `UPDATES.json`.
4. O site agrupa os itens pelo `title_id`.
5. Use a busca para encontrar jogos. A busca fuzzy é propositalmente conservadora:
   - correspondência exata/prefixo/substring tem prioridade;
   - erros pequenos são tolerados;
   - consultas com menos de 4 caracteres não fazem aproximação;
   - erros grandes não retornam resultados aleatórios.

O projeto não baixa nem hospeda arquivos. Para uso legítimo, os botões/links podem ser adaptados para apontar para fontes que você tenha autorização para distribuir.
