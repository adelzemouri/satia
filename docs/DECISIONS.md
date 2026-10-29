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
| 010 | 2026-10-02 | Rappels déclenchés toutes les 15 min (GitHub Actions, puis cron-job.org) | adoptée, révisée |
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
- **Révision** : GitHub Actions ne passait en pratique que toutes les 3 à 6 h. `notify.yml`
  a été retiré : c'est désormais cron-job.org qui appelle
  `https://www.pommelia.fr/api/cron/notify` toutes les 15 minutes (adresse finale, il ne
  suit pas les redirections).

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

## 029 — Un seul ton pour Pépin

- **Date** : 2026-10-12 · **Statut** : adoptée
- **Contexte** : Adel trouve le choix entre 4 personnalités du coach (pédagogue,
  enthousiaste, serein, gourmand) superflu et veut simplifier l'app.
- **Décision** : un seul ton, bienveillant et concret (explique le pourquoi, propose des
  idées de plats). Le choix disparaît de l'onboarding et de la page Coach.
- **Conséquences** : l'onboarding garde six écrans, le dernier ne porte plus que l'avis
  « pas un avis médical ». La colonne `profiles.coach_style` reste en base, plus lue,
  pour éviter une migration destructive. Prompts un peu plus courts.

---

## 030 — Le + ouvre un éventail d'actions

- **Date** : 2026-10-14 · **Statut** : remplacée par 035, puis rétablie par 043
- **Contexte** : Adel trouve le + de la barre du bas trop gros et voudrait qu'il s'anime. Il
  ouvrait la page Ajouter, qui attend une dizaine de lectures en base avant de s'afficher.
- **Décision** : un + plus petit qui tourne en × et fait jaillir en éventail la photo, la
  voix, le code-barres et la recherche (variante A des maquettes
  https://claude.ai/artifact/Q9FGcY9odM3WbyNy8CBfRD). Pas d'animation permanente.
- **Conséquences** : la photo prise depuis l'éventail et la dictée sont remises à l'écran
  d'ajout par `features/ai/quick-start.ts`. « Chercher » ouvre la page Ajouter, qui garde
  les récents et les favoris. Sur ordinateur, la barre latérale ne change pas.

---

## 031 — Toutes les recettes sont communes au foyer

- **Date** : 2026-10-15 · **Statut** : adoptée
- **Contexte** : Adel ne comprenait pas la différence entre « Ma recette » et « Recette du
  foyer ». La case qui choisissait entre les deux bloquait le partage d'un plat perso au menu
  ou à table, et refusait les aliments perso dans une recette du foyer.
- **Décision** : plus de recette personnelle. Toute recette est visible et modifiable par
  les membres du foyer ; un aliment perso qui entre dans une recette devient commun lui
  aussi (le formulaire le signale). Le catalogue garde son étiquette « Recette Pommelia ».
  Migration 0022 : les recettes perso existantes et leurs aliments perso passent au foyer.
- **Conséquences** : plus de case ni de libellé « du foyer ». Une recette reste dans le
  foyer quand son auteur supprime son compte, et sort de son export personnel (comme le
  menu). Les aliments perso hors recette restent privés.

## 032 — L'IA choisit l'aliment parmi les résultats de la recherche

- **Date** : 2026-10-15 · **Statut** : adoptée
- **Contexte** : sur un banc de 200 noms courants renvoyés par l'IA, la recherche par mots
  choisissait le mauvais aliment Ciqual pour environ 40 d'entre eux (pomme séchée pour
  « pomme », feuilles de thé pour « thé », courge pour « spaghetti »), et l'avertissement
  n'en signalait que 6. Le bon aliment figurait pourtant presque toujours dans les 10
  premiers résultats.
- **Décision** : après la reconnaissance, un appel au modèle texte reçoit pour chaque
  aliment les 10 premiers résultats numérotés et renvoie un numéro (0 si aucun ne
  convient : valeurs estimées). Les habitudes apprises passent avant et ne sont pas
  soumises. Sans IA, le premier résultat de la recherche reste proposé.
- **Conséquences** : un appel texte de plus par repas analysé (moins de 0,001 $, une
  seconde d'attente). Les valeurs nutritionnelles viennent toujours de Ciqual/OFF : la
  règle du CLAUDE.md tient, l'IA désigne seulement l'aliment. Le banc d'essai
  (`tests/integration/food-matching.test.ts`) protège la présence du bon aliment parmi les
  10 ; la qualité du choix lui-même ne se teste pas sans vrai LLM.

---

## 033 — Sur ordinateur, densifier les pages longues plutôt qu'élargir

- **Date** : 2026-10-16 · **Statut** : adoptée
- **Contexte** : sur ordinateur, les recettes (92), les exercices (113) et la fiche recette
  obligeaient à beaucoup défiler alors que l'écran avait de la place. Le contenu occupait
  déjà 1 152 px de large : le défilement venait de grilles clairsemées et de pages restées
  en une colonne de téléphone.
- **Décision** : à partir de 1024 px seulement, recettes en 5 puis 6 colonnes avec
  recherche et catégories collées en haut ; fiche d'aliment ou de recette en deux colonnes
  (photo, nom et ajout fixes à gauche) ; menu de la semaine en tableau jours × repas avec
  ajout dans la case ; filtres des exercices en colonne ; Progrès en tableau de bord
  (dépense réelle, séances, pas des 14 jours en barres, aussi sur Activité) ; profil
  sportif sur deux colonnes ; conversation de Pépin à la hauteur de la fenêtre. La largeur
  maximale ne change pas (écran standard).
- **Conséquences** : le téléphone ne change pas. Le menu a deux affichages (liste sur
  téléphone, tableau sur ordinateur) à garder cohérents, et Progrès lit métabolisme, pas
  et séances même sur téléphone, où ces cartes restent masquées.

---

## 034 — Retrait de « Mes contenants » et « Mon dictionnaire »

- **Date** : 2026-10-18 · **Statut** : adoptée
- **Contexte** : Adel ne s'en est pas servi en 14 jours. Les deux ne font rien tant qu'on
  ne les remplit pas à la main, et d'autres chemins couvrent le même besoin : la précision
  libre de la photo (« bol de 500 ml ») pour les contenants, les habitudes apprises des
  corrections (reconnues sans appel à l'IA après deux corrections identiques) pour le
  dictionnaire.
- **Décision** : retirer les pages `/containers` et `/dictionary`, leurs entrées dans Moi
  et sous la photo ou la dictée, le choix du contenant avant la photo et le code qui ne
  sert plus. Les tables `containers` et `personal_expressions` restent, avec leurs
  données, et figurent toujours dans l'export.
- **Conséquences** : une expression personnelle n'est plus reconnue dès la première fois ;
  il faut deux corrections pour qu'une habitude prenne le relais. Les tables pourront être
  supprimées plus tard, dans un déploiement à part.

---

## 035 — Le + ouvre l'appareil photo

- **Date** : 2026-10-18 · **Statut** : remplacée par 043
- **Contexte** : Adel aime l'appareil photo intégré d'une appli du marché : le + ouvre la
  caméra tout de suite, avec les autres façons d'ajouter en bas. L'éventail demandait une
  touche de plus pour la photo et une page à part pour le code-barres.
- **Décision** : sur téléphone, le + ouvre un appareil photo plein écran (maquette
  https://claude.ai/artifact/D4LHgu5MvuAC95NfzTpoyT) : modes Photo et Code-barres sur la
  même caméra, Voix et Chercher qui mènent à l'écran d'ajout, galerie, « Écrire mon repas »
  et une liste « Récents » (ajout d'un geste de la dernière portion). Sans IA, il s'ouvre
  sur le code-barres. La caméra passe par `getUserMedia` (`features/scan/use-camera.ts`),
  partagée par l'écran de scan.
- **Conséquences** : chaque + allume la caméra, même pour chercher un aliment. Sur iPhone,
  pas de lampe (Safari ne la donne pas ; proposée seulement quand le téléphone la permet)
  et l'autorisation caméra peut être redemandée. Si la caméra est refusée, le déclencheur
  ouvre l'appareil photo du téléphone. Sur ordinateur, rien ne change.

---

## 036 — « Mes objectifs » dans Moi, réglés en plein écran

- **Date** : 2026-10-18 · **Statut** : adoptée
- **Contexte** : après l'inscription, l'objectif (perdre, maintenir, prendre), le rythme et
  le niveau d'activité ne se changeaient nulle part ; le poids visé était dans Poids, l'eau
  dans Préférences, le jeûne dans Jeûne. Adel aime les réglages en cartes d'une appli du
  marché, avec la valeur à droite et un écran plein pour la changer.
- **Décision** : une carte « Mes objectifs » en tête de Moi (objectif, poids visé, calories,
  eau, jeûne, activité) avec la valeur en cours ; chaque ligne ouvre un réglage plein écran
  (× pour annuler, ✓ pour enregistrer), avec une règle à glisser pour le poids visé, l'eau
  et les calories choisies à la main (maquette https://claude.ai/artifact/D4LHgu5MvuAC95NfzTpoyT).
  Changer d'objectif, de rythme ou d'activité recalcule les calories dès aujourd'hui, sur la
  dépense mesurée si le bilan du lundi a assez de données, sinon sur la formule ; un aperçu
  l'annonce avant d'enregistrer. Les calories peuvent être choisies à la main (jamais sous
  le plancher, au plus 5 000 kcal) : l'objectif est alors figé, comme « Figer mon objectif ».
- **Conséquences** : l'objectif d'eau quitte Préférences. Le poids visé reste aussi réglable
  depuis Poids. Le jeûne garde sa page, la ligne y mène. Pas d'objectif de pas : l'app n'en a
  pas.
  Sur ordinateur (≥ 1024 px, depuis le 2026-10-18), le réglage est une carte centrée dans la
  page, barre latérale visible, et non un plein écran.

---

## 037 — Plus de partage de plats ; le foyer reste

- **Date** : 2026-10-18 · **Statut** : adoptée
- **Contexte** : le partage de plats entre membres n'a pas servi en 14 jours. Adel envisage
  d'ouvrir Pommelia (peut-être payante) et commence par une bêta fermée d'invités en
  « Foyer à part ».
- **Décision** : retirer l'interface du partage (« Partager un plat » dans Menu, Ajouter, la
  fiche recette et Mes repas ; les repas à valider sur l'accueil et le menu) et les mots
  « famille » des textes. « Servir » dans le menu ouvre la fiche du plat pour ajouter sa
  portion. Le foyer reste : il porte les recettes, le menu, la liste de courses, le compte
  démo et l'isolement des invités ; chaque futur inscrit public aura le sien.
- **Conséquences** : les tables `shared_meals` et `shared_meal_shares` et `server/family.ts`
  sont gardés (toujours exportés et testés) pour pouvoir remettre le partage. Les plats déjà
  partagés et pas encore validés ne s'affichent plus.

---

## 038 — Recettes favorites : les mêmes favoris que les aliments

- **Date** : 2026-10-19 · **Statut** : adoptée
- **Contexte** : Adel veut mettre des recettes en favoris depuis Cuisine → Recettes. Une recette est
  déjà enregistrée comme un aliment (`foods.source = 'recipe'`), et la table `favorites` (par
  utilisateur) sert déjà à l'étoile des aliments.
- **Décision** : pas de nouvelle table. L'étoile d'une vignette ou d'une fiche recette écrit dans
  `favorites` ; la page Recettes gagne un filtre « Favoris » (`?cat=favoris`) sans changer l'ordre
  fixe des recettes. Les favoris restent personnels, même pour les recettes du foyer.
- **Conséquences** : une recette favorite apparaît aussi dans l'onglet Favoris de « Écrire », prête
  à être notée (voulu). Des favoris communs à la famille, s'ils servent un jour au menu de la
  semaine, demanderaient une autre table.

---

## 039 — Plus de glissement latéral pour changer d'onglet

- **Date** : 2026-10-19 · **Statut** : adoptée
- **Contexte** : sur téléphone, glisser le doigt vers la gauche ou la droite faisait passer d'un
  onglet principal à l'autre (Accueil, Cuisine, Progrès, Moi). Adel trouve ce geste sans logique :
  il se déclenche par erreur et les onglets ne forment pas une suite de pages.
- **Décision** : le geste est retiré (`tab-swipe.tsx`, `tab-order.ts`). On change d'onglet par la
  barre du bas ou la barre latérale. Le glissement d'une ligne du journal (supprimer, dupliquer),
  les carrousels et le retour arrière du téléphone restent.
- **Conséquences** : plus de conflit entre ce geste et les carrousels horizontaux ; l'attribut
  `data-swipe-lock` qui servait à les protéger disparaît.

---

## 040 — Un menu de la semaine branché sur les recettes et le journal

- **Date** : 2026-10-20 · **Statut** : adoptée
- **Contexte** : la page Menu vivait à part : l'accueil et le journal ne lisaient pas le menu,
  la liste déroulante ne proposait que les recettes du foyer, et le menu de Pépin inventait des
  plats sans photo au lieu de reprendre les recettes Pommelia.
- **Décision** : « Ajouter au menu » sur la fiche de toute recette commune (jour, repas, parts) ;
  le plat prévu apparaît dans son repas du journal avec « Ajouter » (jusqu'à aujourd'hui, tant
  qu'il n'y est pas) ; sur la page Menu, chaque repas a un « + » qui ouvre une recherche avec
  photos (recettes du foyer puis Pommelia, ou plat libre) ; Pépin reçoit les recettes du foyer
  puis jusqu'à 50 recettes du catalogue adaptées aux repas et au régime.
- **Conséquences** : la page Menu n'a plus de formulaire en bas ; sur téléphone, seuls le
  déjeuner et le dîner (et les repas déjà remplis) ont leur ligne, comme le tableau sur
  ordinateur ; les autres repas se planifient depuis la fiche d'une recette.

---

## 041 — Remarques et bugs envoyés depuis l'app, rangés dans la base

- **Date** : 2026-10-20 · **Statut** : adoptée
- **Contexte** : les invités de la bêta n'avaient aucun moyen simple de signaler un bug ou
  de donner un avis à Adel. Pas d'e-mail en v1, et des issues GitHub exposeraient leurs
  messages tant que le dépôt est public (et demanderaient un jeton GitHub côté serveur).
- **Décision** : nouvelle table `feedback_messages` (type remarque ou bug, texte, page
  d'origine, version, user-agent, détail d'erreur, capture facultative). Le message va au
  foyer de la personne, ou au foyer qui gère son foyer à part. Les admins de ce foyer
  reçoivent une notification push et lisent les messages dans `/admin`. Limite de 20 messages
  par jour et par personne.
- **Conséquences** : rien ne sort de Pommelia et rien ne coûte en IA. La personne ne voit
  pas de réponse dans l'app, Adel répond de vive voix. Les captures suivent la durée de
  conservation des photos (90 jours) ; les messages restent, sont exportés avec les données de
  la personne et partent avec son compte.

---

## 042 — Numéro de version calculé au build

- **Date** : 2026-10-20 · **Statut** : adoptée
- **Contexte** : Adel veut un numéro de version en bas de Moi, qui reste valable si l'app ouvre au public, sans intervention humaine. L'app est remise en ligne à chaque fusion sur `main`, sans sorties numérotées.
- **Décision** : « Version 1.N · date », où N est le nombre de commits de `main` (`git rev-list --count`, historique récupéré en entier sur Vercel) et la date celle du build, figés par `next.config.ts`. Le premier chiffre (`APP_MAJOR_VERSION`) ne change qu'à la main, pour une étape. Pas de semver calculé depuis les titres de commits (robot qui écrit dans le dépôt, minutes de CI, numéro pas plus parlant). Les remarques enregistrent « 1.N · sha ».
- **Conséquences** : un commit poussé directement sur `main` compte aussi. Si l'historique ne peut pas être récupéré (Docker, build hors Vercel), l'app affiche le code court du commit à la place, sans casser le build.

---

## 043 — Retour de l'éventail du +

- **Date** : 2026-10-23 · **Statut** : adoptée (remplace 035, rétablit 030)
- **Contexte** : Adel préfère l'éventail : le + qui tourne en × et fait sortir les façons
  d'ajouter, plutôt qu'une caméra qui s'allume à chaque toucher.
- **Décision** : le + rouvre l'éventail de 030 (Photo, Voix, Code-barres, Chercher ; sans IA,
  Code-barres et Chercher). Photo et Code-barres ouvrent l'appareil photo de 035 sur le bon
  mode, qui garde les récents, la galerie et « Écrire mon repas ». Voix et Chercher mènent à
  l'écran d'ajout, comme avant.
- **Conséquences** : la photo demande une touche de plus qu'avec 035, mais la caméra ne
  s'allume plus quand on veut seulement chercher ou dicter. Le code-barres passe par
  l'appareil photo du + au lieu de la page `/scan`, qui reste en place. Sur ordinateur, rien
  ne change : « Ajouter un repas » de la barre latérale ouvre la page Ajouter.

---

## 044 — Erreurs du serveur : relance, message gardé, pas de cache

- **Date** : 2026-10-24 · **Statut** : adoptée
- **Contexte** : Adel a vu « Minified React error #441 » en ouvrant l'app. C'est une erreur du
  rendu serveur dont la production ne transmet qu'un `digest`, et les journaux de Vercel Hobby
  ne gardent qu'une heure : impossible d'en retrouver la cause. Le bouton « Réessayer »
  appelait `reset`, qui réaffiche la même réponse sans redemander la page au serveur. Et la
  page en erreur arrive en 200 : le service worker la gardait pour le hors-ligne.
- **Décision** : l'écran d'erreur redemande la page une fois tout seul quand l'erreur vient du
  serveur (au plus une fois par 30 s), avec « Un instant… » à la place du message d'erreur ;
  « Réessayer » utilise `retry` (rafraîchit depuis le serveur). `onRequestError`
  (`src/instrumentation.ts`) garde le message de chaque erreur, cause comprise, dans
  `server_errors`, par digest, 30 jours ; la boîte des remarques le joint au bug signalé
  (« Serveur : … »), donc aussi à « Copier pour Claude ». Le service worker ne met plus en
  cache une page dont le flux contient une erreur.
- **Conséquences** : une coupure passagère (base qui se réveille…) ne se voit plus. Les
  messages gardés peuvent contenir le texte d'une requête SQL ; ils restent en base, visibles
  des seuls admins via les bugs signalés. Si la base elle-même est en cause, le message n'est
  pas gardé (il reste une heure dans les journaux de Vercel).

---

## Modèle

```markdown
## NNN — Titre court de la décision

- **Date** : AAAA-MM-JJ · **Statut** : adoptée
- **Contexte** : ce qui oblige à choisir.
- **Décision** : ce qui a été choisi.
- **Conséquences** : ce que ça implique, y compris les inconvénients acceptés.
```
