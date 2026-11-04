# Skills d'Emil Kowalski

Copie des skills de conception d'interface et d'animation publiées par Emil Kowalski
(https://github.com/emilkowalski/skills, commit 2d22863, licence MIT : voir `LICENSE-emilkowalski`).
Fichiers Markdown seulement, sans script.

Gardées : `emil-design-eng` (principale), `animate`, `review-animations`, `improve-animations`,
`find-animation-opportunities`, `animation-performance`, `animation-vocabulary`, `mobile-native`,
`break-ui`, `apple-design`.
Laissées de côté : `animate-expo` et `write-swift` (applis natives), `ask-sonner` (Pommelia n'utilise
pas Sonner), `pick-ui-library` et `prototype` (installent des bibliothèques ou des écrans de test
dans l'app ; les maquettes se font en dehors du code).

Les règles de `CLAUDE.md` passent avant ces skills (ton, santé, accessibilité, pas de dépendance
ajoutée sans raison). Pour mettre à jour : recopier les dossiers depuis le dépôt d'origine.

# Floorplan

Copie de la skill `floorplan` de Hayden Smith (https://github.com/haydenschmitty/floorplan,
version 0.6.3, commit 70be3f4, licence MIT : voir `LICENSE-floorplan`). Elle dessine une carte
interactive du code (parties, fichiers, routes, écrans) avec un nom et une phrase en clair pour
chacun, plus un « bilan de santé ». Elle écrit seulement dans `floorplan/` à la racine et,
si on l'accepte, dans `CLAUDE.local.md` ; les deux sont exclus de git.

Relue avant copie : pas de hook, pas de serveur MCP, aucune dépendance npm, rien de téléchargé.
Scripts Node lancés par la skill elle-même ; serveur local sur 127.0.0.1 seulement ; une seule
requête sortante possible (liste d'attente « Floorplan Cloud », seulement si on y tape un email,
à ne pas utiliser). Le fichier `assets/vendor/elk.bundled.js` est elkjs 0.9.3 tel que publié sur npm.
Retiré : `agents/openai.yaml` (Codex seulement).

Dans une session cloud, la carte ne s'ouvre pas en direct : construire avec
`build.mjs <racine> --artifact` puis publier `floorplan/artifact.html` en Artifact. Le dossier
`floorplan/` disparaît avec la session : copier `architecture.json` et `descriptions/` dans les
fichiers du projet pour ne pas tout redécrire la fois suivante. Pour mettre à jour : recopier
`skills/floorplan` depuis une version publiée, après relecture.
