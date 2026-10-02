# CLAUDE.md — Satia

Application web de suivi nutritionnel (calories, macros, jeûne, poids, activité,
entraînement) pour un usage familial (2 à 6 comptes), hébergée sur un service cloud managé.
Inspirée fonctionnellement des applis de comptage de calories du marché, avec une
identité propre. Spécification fonctionnelle : `docs/PRD.md`. Plan : `docs/PLAN.md`.

## Règles de propriété intellectuelle (non négociables)
- Ne jamais reprendre le nom, logo, textes marketing, illustrations, icônes, recettes
  ou captures d'une application existante (notamment Welmi).
- Tous les textes, recettes d'exemple, illustrations et le design sont originaux.
- Base d'aliments : uniquement des sources à licence ouverte
  (Ciqual/ANSES, Open Food Facts — respecter l'attribution ODbL).

## Contraintes de stack
Le choix précis te revient, mais il doit respecter :
- Hébergement cloud managé (PaaS ou serverless), pas de serveur à administrer.
  En phase 0, proposer 2 ou 3 hébergeurs comparés sur : coût mensuel estimé pour
  ~6 utilisateurs, région UE disponible, base managée, stockage objet, tâches
  planifiées (cron), facilité de déploiement depuis GitHub Actions. Attendre mon choix.
  Choix retenu (2026-10-02) : le moins cher → Vercel Hobby + Neon + Cloudflare R2,
  détaillé dans `docs/ARCHITECTURE.md`.
- Données de préférence dans l'Union européenne (base, photos, sauvegardes) quand
  c'est sans surcoût ; ce n'est plus une obligation.
- Base PostgreSQL managée avec sauvegardes automatiques activées.
- Photos stockées dans un stockage objet compatible S3, bucket privé, accès par
  URL signée à durée courte.
- Tâches planifiées (bilan hebdo, rappels, purge des photos) via le cron de
  l'hébergeur ou un équivalent managé.
- Garder l'app conteneurisable (Dockerfile) pour pouvoir changer d'hébergeur ;
  `docker compose up` doit rester possible en local pour le développement.
- Environnements : local + production (un environnement de preview par merge
  request si l'hébergeur le permet gratuitement).
- TypeScript de bout en bout, typage strict.
- PWA installable (manifest, service worker, icônes, mode hors-ligne pour la
  consultation du journal du jour et la saisie différée).
- Mobile-first : l'usage principal se fait sur téléphone, caméra incluse.
- Aucune dépendance à un service SaaS obligatoire autre que le fournisseur LLM.
- i18n prête dès le départ ; français par défaut, anglais en second.
- Unités métriques par défaut (g, ml, kg, cm, kcal), kJ en option.

## Couche LLM (critique pour les coûts)
- Objectif : coût par requête le plus bas possible.
- Toute interaction LLM passe par un module unique `llm/` avec une interface
  provider-agnostic. Fournisseur et modèle sont configurés par variables d'env
  (`LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL_VISION`, `LLM_MODEL_TEXT`).
  Supporter au minimum l'API compatible OpenAI (couvre OpenRouter, Gemini, Mistral,
  DeepSeek, Ollama…) ; l'API Anthropic en second adaptateur.
- Deux modèles distincts : un modèle vision (photo) et un modèle texte (chat coach,
  parsing de saisie vocale/texte libre), chacun le moins cher qui fait le travail.
- Le LLM identifie les aliments et estime les quantités ; il ne fournit PAS les
  valeurs nutritionnelles. Celles-ci viennent de la base locale (Ciqual/OFF) par
  matching. Le LLM ne sert de repli pour les valeurs que si aucun match n'existe,
  et le résultat est alors marqué "estimé".
- Réduction des tokens obligatoire : redimensionner/compresser les images côté client
  avant envoi (côté long ≤ 768 px, JPEG/WebP), utiliser le mode basse résolution si
  le provider le propose, sorties en JSON structuré court (schéma validé par Zod
  ou équivalent), prompts système courts et mis en cache si le provider le permet.
- Journaliser pour chaque appel : modèle, tokens in/out, coût estimé, latence.
  Page admin affichant le coût cumulé par mois et par utilisateur.
- Plafond de dépense mensuel configurable ; au-delà, les fonctions IA se désactivent
  proprement et la saisie manuelle reste disponible.
- Saisie vocale : transcription par la Web Speech API du navigateur (gratuite),
  puis parsing du texte par le modèle texte. Pas d'API de transcription payante.

## Santé et sécurité des utilisateurs
- Ne jamais présenter l'application comme un avis médical ; mention claire dans
  l'onboarding et les réglages.
- Objectif calorique : plancher minimal (1200 kcal femme / 1500 kcal homme par
  défaut, configurable par l'admin uniquement) ; perte de poids visée plafonnée
  à ~1 % du poids corporel par semaine. Afficher un message bienveillant si
  l'utilisateur tente de dépasser ces bornes.
- Pas de comptes mineurs avec objectif de perte de poids : si âge < 18 ans à
  l'onboarding, seuls les objectifs "maintien" et "équilibre" sont proposés.
- Module traitement (GLP-1, etc.) : journal et rappels uniquement, jamais de
  calcul ni de recommandation de dose.
- Entraînement : échauffement et retour au calme systématiques, progression
  graduelle, alternative plus douce proposée pour chaque exercice, possibilité de
  signaler une douleur ou une zone à ménager (l'exercice concerné est alors exclu).
- Ton des messages : encourageant, jamais culpabilisant. Pas de vocabulaire du type
  "craquage", "triche", "écart".

## Données et sécurité
- L'app est exposée sur Internet : HTTPS uniquement, en-têtes de sécurité (CSP,
  HSTS), protection CSRF, limitation de débit sur la connexion et les routes IA.
- Authentification email + mot de passe hashé (argon2/bcrypt), sessions sécurisées,
  double authentification TOTP optionnelle. Pas d'inscription publique : l'admin
  invite les membres de la famille par lien à usage unique.
- Les routes IA exigent une session valide (personne d'extérieur ne doit pouvoir
  consommer le budget LLM).
- Chaque utilisateur ne voit que ses propres données (contrôle côté serveur).
- Export complet des données d'un utilisateur (JSON + CSV) et suppression de compte.
- Secrets uniquement par variables d'env ; fournir `.env.example`.
- Photos de repas purgées automatiquement après une durée configurable (défaut : 90 jours).

## Qualité
- Tests unitaires pour tout le calcul (BMR, TDEE, macros, jeûne, streaks).
- Tests d'intégration pour les routes API ; tests e2e (Playwright) pour les parcours
  critiques : onboarding, ajout d'un repas manuel, par code-barres, par photo (LLM mocké).
- Les tests ne doivent jamais appeler un vrai LLM : provider mock déterministe.
- Lint + format + typecheck en CI ; workflows GitHub Actions (lint, test, build,
  déploiement automatique en production sur la branche `main`).
- Accessibilité : contrastes WCAG AA, navigation clavier, labels ARIA.

## Commits
- Format Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`…).
- Un commit (ou une petite série) par phase du plan, proposé à la fin de la phase
  en étape finale distincte, après le récapitulatif.

## Direction artistique
Voir `docs/PRD.md` section 9. Rien ne doit rappeler visuellement une app existante.
