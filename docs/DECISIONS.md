# Journal des décisions — Pommelia

Chaque décision structurante tient en quelques lignes : le contexte, ce qui a été décidé,
et ce que ça implique. Une décision n'est jamais effacée : quand elle change, on ajoute
une nouvelle entrée qui la remplace et on met à jour le statut de l'ancienne.

Statuts : **adoptée**, **remplacée** (par une entrée plus récente), **en attente**
(pas encore tranchée), **abandonnée**.

Pour ajouter une décision : copier le modèle en bas de page, prendre le numéro suivant.

| N° | Date | Décision | Statut |
|---|---|---|---|
| 001 | 2026-10-02 | Hébergement le moins cher : Vercel Hobby, Neon, Cloudflare R2 | adoptée |
| 002 | 2026-10-02 | Next.js, Drizzle et Better Auth | adoptée |
| 003 | 2026-10-02 | GitHub Actions pour la CI, pas GitLab | adoptée |
| 004 | 2026-10-02 | Sauvegarde quotidienne chiffrée vers R2 | adoptée |
| 005 | 2026-10-02 | Le LLM reconnaît, les bases d'aliments chiffrent | adoptée |
| 006 | 2026-10-02 | Gemini par son API compatible OpenAI, plafond de 2 $/mois | adoptée |
| 007 | 2026-10-02 | Voix transcrite par le navigateur, aucune API payante | adoptée |
| 008 | 2026-10-02 | Pas d'e-mail : l'admin transmet les liens | adoptée |
| 009 | 2026-10-02 | Sexe obligatoire, gel de streak automatique | adoptée |
| 010 | 2026-10-02 | Rappels déclenchés par GitHub Actions toutes les 15 min | adoptée |
| 011 | 2026-10-03 | L'app s'appelle Pommelia, le dépôt garde « satia » | adoptée |
| 012 | 2026-10-03 | Une seule version en production, pas de version parallèle | adoptée |
| 013 | 2026-10-05 | Budget hebdomadaire retiré, budget quotidien pour tous | adoptée |
| 014 | 2026-10-04 | Aucune recette proposée sans photo | adoptée |
| 015 | 2026-10-06 | Identité « Gourmande », anneau de calories conservé | adoptée |
| 016 | 2026-10-06 | Pas de quota IA par personne | adoptée |
| 017 | 2026-10-06 | Pépin connaît tout l'historique, dans un cadre strict | adoptée |
| 018 | 2026-10-06 | Poids masqué par défaut à l'écran | adoptée |
| 019 | 2026-10-06 | Version ordinateur : barre latérale, mobile inchangé | adoptée |
| 020 | 2026-10-06 | Pas de bannière d'installation iOS | abandonnée |
| 021 | 2026-10-07 | Gemini reçoit `thinking_level` | adoptée |
| 022 | 2026-10-07 | Invités dans un foyer à part | adoptée |
| 023 | 2026-10-10 | Dépôt public pour les minutes GitHub Actions | adoptée |
| 024 | 2026-10-04 | Widgets iOS : application native plus tard | en attente |
| 025 | 2026-10-04 | Vidéos d'exercices générées par IA | en attente |

---

## 001 — Hébergement le moins cher : Vercel Hobby, Neon, Cloudflare R2

- **Date** : 2026-10-02 · **Statut** : adoptée
- **Contexte** : 2 à 6 comptes familiaux, pas de serveur à administrer. Adel a demandé
  l'option la moins chère ; les données en UE ne sont plus obligatoires.
- **Décision** : Vercel Hobby (région `fra1`) pour l'app, Neon Free pour Postgres,
  Cloudflare R2 (juridiction UE) pour les photos et les sauvegardes. 0 €/mois hors LLM, et
  les données restent en UE sans surcoût.
- **Conséquences** : Vercel Hobby n'a qu'un cron par jour (voir 010) et réserve l'offre à un
  usage non commercial. L'app reste conteneurisable (`Dockerfile`, `docker compose`) : en
  cas de dépassement des quotas, passage à Vercel Pro ou à un hébergeur de conteneurs sans
  changer le code. Domaine `pommelia.fr` réservé chez OVH et pointé vers Vercel.

## 002 — Next.js, Drizzle et Better Auth

- **Date** : 2026-10-02 · **Statut** : adoptée
- **Contexte** : TypeScript de bout en bout, PWA mobile, une seule personne pour maintenir.
- **Décision** : Next.js (App Router, actions serveur) pour l'interface et le serveur dans un
  seul projet ; Drizzle pour un SQL typé et des migrations versionnées ; Better Auth comme
  bibliothèque (pas de service d'authentification externe) avec argon2 et TOTP.
- **Conséquences** : un seul déploiement, un seul langage. Toutes les données passent par
  le serveur, ce qui garde l'autorisation au même endroit.

## 003 — GitHub Actions pour la CI, pas GitLab

- **Date** : 2026-10-02 · **Statut** : adoptée
- **Contexte** : `CLAUDE.md` parlait de merge requests GitLab, mais le dépôt est sur GitHub.
- **Décision** : workflows GitHub Actions (lint, tests, build, sauvegarde, rappels).
  Le déploiement se fait par l'intégration GitHub de Vercel à chaque fusion sur `main`.
- **Conséquences** : dépend des minutes Actions (voir 023).

## 004 — Sauvegarde quotidienne chiffrée vers R2

- **Date** : 2026-10-02 · **Statut** : adoptée
- **Contexte** : Neon Free ne permet de revenir que 6 heures en arrière.
- **Décision** : `backup.yml` fait chaque nuit un `pg_dump` chiffré (GPG) déposé dans R2 et
  gardé 30 jours. La restauration se teste d'abord sur une branche Neon (`README.md`).
- **Conséquences** : des secrets `BACKUP_*` dans GitHub (base, R2, phrase de chiffrement) ; un mois d'historique.

## 005 — Le LLM reconnaît, les bases d'aliments chiffrent

- **Date** : 2026-10-02 · **Statut** : adoptée
- **Contexte** : un LLM invente facilement des calories ; Ciqual et Open Food Facts sont
  fiables, gratuits et sous licence ouverte.
- **Décision** : le LLM renvoie seulement des noms d'aliments et des grammes en JSON court ;
  les valeurs viennent de Ciqual ou d'Open Food Facts. Le LLM ne sert de repli que si aucun
  aliment ne correspond, et la ligne est alors marquée « estimé ».
- **Conséquences** : moins de tokens par appel. La qualité dépend du rapprochement nom →
  aliment (`src/domain/search.ts`), qui a demandé plusieurs corrections.

## 006 — Gemini par son API compatible OpenAI, plafond de 2 $/mois

- **Date** : 2026-10-02 · **Statut** : adoptée
- **Contexte** : coût par requête le plus bas possible, sans s'enfermer chez un fournisseur.
- **Décision** : couche `src/llm/` indépendante du fournisseur (API compatible OpenAI, plus
  un adaptateur Anthropic). En production, Google Gemini (modèles « flash-lite » pour la
  vision et le texte, `gemini-*-image` pour les photos de recettes), réflexion réduite,
  plafond mensuel de 2 $ pour le foyer.
- **Conséquences** : changer de fournisseur ou de modèle ne demande que des variables
  d'environnement. Au-delà du plafond, l'IA se coupe et la saisie manuelle reste.

## 007 — Voix transcrite par le navigateur, aucune API payante

- **Date** : 2026-10-02 · **Statut** : adoptée
- **Contexte** : `CLAUDE.md` interdit les API de transcription payantes.
- **Décision** : la Web Speech API du navigateur transcrit, puis le texte suit le chemin de la
  saisie libre. Les messages vocaux envoyés tels quels au LLM ne sont pas construits.
- **Conséquences** : gratuit, mais dépend du navigateur ; sur iPhone il a fallu démarrer la
  dictée dans le geste même et la relancer quand elle reste muette.

## 008 — Pas d'e-mail : l'admin transmet les liens

- **Date** : 2026-10-02 · **Statut** : adoptée
- **Contexte** : aucun service SaaS obligatoire hors LLM, et un foyer qui se connaît.
- **Décision** : l'admin génère dans `/admin` les liens d'invitation et de nouveau mot de
  passe et les envoie lui-même.
- **Conséquences** : pas de service d'envoi ni de configuration DNS d'e-mail ; un mot de
  passe oublié passe par l'admin.

## 009 — Sexe obligatoire, gel de streak automatique

- **Date** : 2026-10-02 · **Statut** : adoptée
- **Contexte** : la formule Mifflin-St Jeor et les planchers caloriques (1200 / 1500 kcal)
  dépendent du sexe ; un streak perdu pour un jour oublié décourage.
- **Décision** : le sexe (femme ou homme) est demandé à l'onboarding ; un jour manqué par
  semaine est couvert automatiquement.
- **Conséquences** : pas d'option « autre » pour le calcul ; aucune action à faire pour
  protéger son streak.

## 010 — Rappels déclenchés par GitHub Actions toutes les 15 min

- **Date** : 2026-10-02 · **Statut** : adoptée
- **Contexte** : le cron de Vercel Hobby ne passe qu'une fois par jour.
- **Décision** : `notify.yml` appelle `/api/cron/notify` toutes les 15 minutes avec
  `CRON_SECRET`. Les tâches qui peuvent attendre une visite (bilan hebdomadaire, jeûnes)
  se calculent à la lecture, sans cron.
- **Conséquences** : GitHub peut retarder un passage et suspend les workflows planifiés
  après 60 jours sans activité. Passer à un service de cron externe gratuit
  (cron-job.org) est envisagé ; il suffira de lui faire appeler la même route.

## 011 — L'app s'appelle Pommelia, le dépôt garde « satia »

- **Date** : 2026-10-03 · **Statut** : adoptée
- **Contexte** : « Satia » était un nom provisoire.
- **Décision** : l'app devient Pommelia (`APP_NAME`), le coach Pépin (`COACH_NAME`). Le dépôt
  GitHub, le projet Vercel et le bucket R2 gardent le nom « satia ».
- **Conséquences** : aucune migration d'infrastructure ; seuls les textes et l'identité
  visuelle changent.

## 012 — Une seule version en production, pas de version parallèle

- **Date** : 2026-10-03 · **Statut** : adoptée
- **Contexte** : au moment du redesign, une seconde version de l'app a été envisagée.
- **Décision** : une seule app en production ; les pistes se comparent sur des maquettes,
  avant le code.
- **Conséquences** : chaque changement de design passe par une maquette validée.

## 013 — Budget hebdomadaire retiré, budget quotidien pour tous

- **Date** : 2026-10-05 · **Statut** : adoptée
- **Contexte** : le budget hebdomadaire (phase 7) rendait l'objectif du jour difficile à lire.
- **Décision** : l'interface ne le propose plus ; tout le monde est revenu au budget
  quotidien (migration 0019). Le code de calcul reste en place.
- **Conséquences** : un seul objectif par jour, celui de l'anneau.

## 014 — Aucune recette proposée sans photo

- **Date** : 2026-10-04 · **Statut** : adoptée
- **Contexte** : une suggestion sans image donne envie de rien.
- **Décision** : les suggestions ne montrent que des recettes avec une photo (catalogue,
  photo de la famille ou photo générée).
- **Conséquences** : les recettes du foyer reçoivent une photo générée par IA si personne
  n'en a pris, dans le plafond mensuel.

## 015 — Identité « Gourmande », anneau de calories conservé

- **Date** : 2026-10-06 · **Statut** : adoptée (remplace la direction « Net » du 2026-10-03)
- **Contexte** : l'audit UX a montré une app correcte mais sans personnalité.
- **Décision** : titres en Fraunces, couleur pomme, Pépin qui parle sur l'accueil, logo
  « quartier qui sourit » (2026-10-07). L'anneau de calories reste l'élément central.
- **Conséquences** : rien ne rappelle une app existante (règle de `CLAUDE.md`).

## 016 — Pas de quota IA par personne

- **Date** : 2026-10-06 · **Statut** : adoptée
- **Contexte** : l'audit proposait un quota par membre.
- **Décision** : le plafond reste commun au foyer. Chaque appel est limité en débit
  (20 par 10 minutes et par personne) et la dépense par personne reste visible dans `/admin`.
- **Conséquences** : un membre très actif peut consommer le budget des autres ; l'admin le voit.

## 017 — Pépin connaît tout l'historique, dans un cadre strict

- **Date** : 2026-10-06 · **Statut** : adoptée
- **Contexte** : un coach qui ne voit que la journée donne des conseils génériques.
- **Décision** : le prompt reçoit jusqu'à un an d'historique résumé (repas, poids, ressenti,
  activité). En contrepartie, des garde-fous locaux répondent sans LLM aux demandes sous le
  plancher, aux questions de dose ou de médicament et aux pratiques à risque, et une
  réponse proposant moins que le plancher est remplacée.
- **Conséquences** : prompts plus longs, donc un peu plus chers ; le texte des membres est
  traité comme une donnée, pas comme une consigne.

## 018 — Poids masqué par défaut à l'écran

- **Date** : 2026-10-06 · **Statut** : adoptée
- **Contexte** : l'app s'ouvre souvent devant d'autres personnes.
- **Décision** : sur Progrès et Poids, le poids est flouté jusqu'à ce qu'on l'affiche ; le
  choix tient le temps de la session du navigateur.
- **Conséquences** : un geste de plus pour voir son poids.

## 019 — Version ordinateur : barre latérale, mobile inchangé

- **Date** : 2026-10-06 · **Statut** : adoptée
- **Contexte** : l'app est aussi ouverte sur ordinateur, où la barre inférieure gaspillait
  l'écran.
- **Décision** : à partir de 1024 px, barre latérale et pages en deux colonnes ; en dessous,
  rien ne change.
- **Conséquences** : chaque page a deux mises en page à tenir. L'ajout et le détail de
  recette en panneau latéral ne sont pas faits.

## 020 — Pas de bannière d'installation iOS

- **Date** : 2026-10-06 · **Statut** : abandonnée
- **Contexte** : sur iPhone, une PWA s'installe par le menu Partager, peu connu.
- **Décision** : la bannière maquettée n'est pas construite, et ne sera pas reproposée.

## 021 — Gemini reçoit `thinking_level`

- **Date** : 2026-10-07 · **Statut** : adoptée (complète 006)
- **Contexte** : Google a annoncé l'abandon de `thinking_budget`, que `reasoning_effort` peut
  produire sur son API compatible OpenAI.
- **Décision** : quand l'URL est celle de Gemini, `LLM_REASONING_EFFORT` part sous forme de
  `thinking_level` ; les autres fournisseurs gardent `reasoning_effort`.

## 022 — Invités dans un foyer à part

- **Date** : 2026-10-07 · **Statut** : adoptée
- **Contexte** : Adel veut faire essayer l'app à des proches hors de sa famille.
- **Décision** : une invitation peut créer un foyer séparé, rattaché au foyer de l'admin
  (`households.managed_by`). L'invité ne voit rien du foyer principal et ne peut pas devenir
  admin ; il partage le plafond IA, et sa dépense est affichée à part.
- **Conséquences** : un compte démo (`demo@pommelia.fr`) complète ce besoin pour montrer
  l'app sans inviter personne.

## 023 — Dépôt public pour les minutes GitHub Actions

- **Date** : 2026-10-10 · **Statut** : adoptée
- **Contexte** : le dépôt privé avait 2 000 minutes par mois ; elles ont été épuisées le
  2026-10-07 et plus aucun workflow ne tournait (CI, sauvegarde, rappels).
- **Décision** : le dépôt passe en public après vérification qu'aucun secret n'est dans
  l'historique ; les minutes deviennent gratuites.
- **Conséquences** : le code est lisible par tous, ce qui rend la règle « secrets
  uniquement en variables d'environnement » encore plus stricte.

## 024 — Widgets iOS : application native plus tard

- **Date** : 2026-10-04 · **Statut** : en attente
- **Contexte** : une PWA ne peut pas afficher de widget sur l'écran verrouillé d'un iPhone.
- **Piste** : une coque Capacitor avec un widget WidgetKit, qui demande un compte
  développeur Apple (99 €/an). À trancher avec la note de cadrage de l'app iOS.

## 025 — Vidéos d'exercices générées par IA

- **Date** : 2026-10-04 · **Statut** : en attente
- **Contexte** : les exercices sont illustrés par des images fixes ; un essai vidéo (squat)
  a été généré avec Veo Lite.
- **Piste** : 113 exercices pour environ 25 à 55 $ au total. Adel n'a pas encore décidé.

## 026 — Plus de « Comment tu te sens ? » dans Progrès

- **Date** : 2026-10-12 · **Statut** : adoptée
- **Contexte** : la carte de ressenti (faim, énergie, humeur de 1 à 5) et la courbe
  « Mes 4 dernières semaines » de l'onglet Progrès ne sont pas remplies ; Adel juge
  qu'elles n'apportent rien.
- **Décision** : retirer la carte et l'historique de l'interface. La table
  `daily_checkins` et les réponses déjà saisies restent en base (aucune migration).
- **Conséquences** : Pépin et le bilan hebdo lisent encore les anciennes réponses,
  qui s'effacent d'elles-mêmes de son contexte avec le temps ; l'export les inclut
  toujours. Le ressenti de fin de séance d'entraînement n'est pas concerné.

## 027 — Pépin depuis les fiches, pas une bulle partout

- **Date** : 2026-10-12 · **Statut** : adoptée
- **Contexte** : Adel trouve le chemin vers Pépin (Moi puis Coach) trop long quand il
  regarde un repas, et Pépin ne sait pas de quel repas il parle.
- **Décision** : un bouton « Demander à Pépin » sur les fiches aliment et recette, les
  repas du journal et le bilan du jour, qui ouvre un panneau par-dessus la page avec le
  sujet joint (option A de la maquette). Pas de bulle flottante ni d'avatar dans l'en-tête.
- **Conséquences** : rien de plus dans la barre du bas ; une ligne de plus dans le prompt
  quand la question vient d'une fiche. Si Pépin manque ailleurs, l'avatar d'en-tête
  pourra réutiliser le même panneau.

---

## 028 — Rappels de pesée, mensurations et photo, avec des victoires

- **Date** : 2026-10-12 · **Statut** : adoptée
- **Contexte** : Adel veut une app plus vivante qui fidélise, avec des rappels à
  l'ouverture (se peser, prendre ses mensurations). Rien ne les rappelait. Dans une app de
  nutrition, la pression (série qu'on perd, pesée quotidienne) peut nuire.
- **Décision** : option « rendez-vous de Pépin » (maquettes
  https://claude.ai/artifact/WsPoimfdpRuvFjoMNtb8K9) : une carte par rituel dû sur
  l'accueil, pesée hebdomadaire par défaut, rituels du mois toutes les quatre semaines,
  saisie du poids sur place et annonce des étapes de régularité.
- **Conséquences** : les victoires ne récompensent que la régularité, jamais les kilos
  perdus ; une semaine manquée n'efface rien. Chaque rituel se coupe dans Moi ›
  Notifications. « Plus tard » et « déjà annoncé » sont gardés par appareil.

---

## Modèle

```markdown
## NNN — Titre court de la décision

- **Date** : AAAA-MM-JJ · **Statut** : adoptée
- **Contexte** : ce qui oblige à choisir.
- **Décision** : ce qui a été choisi.
- **Conséquences** : ce que ça implique, y compris les inconvénients acceptés.
```
