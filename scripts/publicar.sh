#!/bin/zsh
# Publica la carpeta dist/ en la rama gh-pages del repositorio (GitHub Pages).
# Uso: npm run publicar   (requiere haber hecho `git remote add origin ...`)
set -e
cd "$(dirname "$0")/.."
npm run -s dist
REMOTO=$(git remote get-url origin)
touch dist/.nojekyll
cd dist
rm -rf .git
git init -q
git checkout -q -b gh-pages
git add -A
git -c user.name="$(git -C .. config user.name)" -c user.email="$(git -C .. config user.email)" commit -q -m "Publicar Micelio $(date '+%Y-%m-%d %H:%M')"
git push -q --force "$REMOTO" gh-pages
cd .. && rm -rf dist/.git
echo "Publicado en gh-pages. GitHub Pages tarda 1-2 minutos en actualizar."
