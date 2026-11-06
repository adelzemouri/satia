# Skills d'Emil Kowalski

Copie des skills de conception d'interface et d'animation publiées par Emil Kowalski
(https://github.com/emilkowalski/skills, commit c8a7962 du 4 novembre 2026, licence MIT : voir
`LICENSE-emilkowalski`). Fichiers Markdown seulement, sans script.

Gardées : `emil-design-eng` (principale), `animate`, `choreograph` (plusieurs éléments qui bougent
ensemble), `review-animations`, `improve-animations`, `remove-animations` (retirer les animations
inutiles), `find-animation-opportunities`, `animation-performance`, `animation-vocabulary`,
`mobile-native`, `break-ui`, `apple-design`.
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

# Impeccable

Copie de la skill `impeccable` de Paul Bakaus (https://github.com/pbakaus/impeccable, version 4.8.0,
commit c3bb418, licence Apache 2.0 : voir `LICENSE-impeccable` et `NOTICE-impeccable.md`).
Vocabulaire de design pour l'agent : `critique`, `audit`, `polish`, `quieter`, `distill`, `typeset`,
`layout`, `harden`, `clarify`, `adapt`, `onboard`… Pommelia est en mode « Operate » (une app) :
précision et retenue plutôt qu'effets.

Copiés tels quels : `SKILL.md` et `reference/` (Markdown seulement).
Laissés de côté : le lanceur `scripts/impeccable` (il télécharge un binaire, le détecteur de
62 règles), les hooks qui le lancent après chaque modification, et les agents. La skill passe alors
par son chemin prévu « Launcher unavailable » : elle lit `PRODUCT.md` et `DESIGN.md` s'ils existent
(il n'y en a pas : le cadre est `CLAUDE.md`, `docs/PRD.md` §9, `src/ui/tokens.css` et
`docs/DECISIONS.md`). Les commandes `live`, `generate`, `pin`, `hooks` et `doctor` ont besoin du
lanceur : ne pas les utiliser.

Règle « The brief wins » de la skill : l'identité en place (Fraunces arrondie, vert canard, rouge
pomme, anneau de calories, Pépin) est le brief et passe avant ses refus par défaut.

# Taste Skill : pas copiée

https://github.com/Leonxlnx/taste-skill (MIT). La version 2.5 (5 novembre 2026) ne sert qu'aux
sites vitrines d'entreprise (40 Mo de photos, effets WebGL, scripts Node + Chrome). Les anciennes
versions (dépôt `taste-skill-classics`) interdisent les polices serif dans une app et ajoutent des
animations en boucle partout, ce qui contredit l'identité et les skills d'Emil Kowalski.
