# Plan de développement — Pommelia

Le développement est découpé en trois versions. Chaque phase se termine par :
tests verts, déploiement en production réussi, récapitulatif, commit
Conventional Commits, puis attente de validation.

Ne pas anticiper les versions suivantes dans le code (pas de tables, routes ou
écrans "pour plus tard"), mais garder un modèle de données qui ne bloque pas
leur ajout (ex. notion de foyer présente dès la v1).

---

## v1 — Utilisable au quotidien

Objectif : une app que la famille peut utiliser tous les jours pour suivre ses
repas et son poids.

**Phase 0 — Fondations.** Stack et hébergeur validés, `docs/ARCHITECTURE.md`,
squelette du projet, Docker Compose pour le local, base et stockage objet en UE,
CI/CD GitHub Actions avec déploiement automatique, lint/format/typecheck, i18n, thème
clair/sombre, design tokens de la DA, PWA de base. Une page "Hello" en production
avant de passer à la suite.

**Phase 1 — Comptes et onboarding.** Foyer, auth, invitations, 2FA optionnelle,
rôle admin, limitation de débit, questionnaire d'onboarding, moteur de calcul
(BMR/TDEE/macros/planchers) testé, export et suppression des données.

**Phase 2 — Base d'aliments et saisie manuelle.** Import Ciqual, cache Open Food
Facts, recherche floue, unités et conversions, aliments et recettes perso,
favoris, récents, copie de repas, duplication de la journée d'hier, tableau de
bord du jour, eau, streaks, suivi du poids avec tendance lissée.

**Phase 3 — Code-barres.** Scanner caméra, lookup OFF, mise en cache, fiche produit.

**Phase 4 — Couche LLM.** Module provider-agnostic, provider mock, journal des
coûts, budget plafond, page admin des coûts, compression d'images côté client.

**Phase 5 — Saisie IA.** Photo, voix (Web Speech API), texte libre, matching base
locale, écran de confirmation éditable, enregistrement des corrections, "Mes
contenants", dictionnaire personnel.

> **Jalon : 2 à 3 semaines d'utilisation réelle en famille avant la v2.**
> Noter les irritants et ajuster la suite du plan en conséquence.

---

## v2 — Plus malin et plus familial

**Phase 6 — Espace famille.** Repas partagé avec portions individuelles et
validation, recettes familiales.

**Phase 7 — Objectif adaptatif et budget hebdomadaire.** Recalcul hebdomadaire de
la dépense réelle, bornes, écran "Mon métabolisme", mode budget hebdomadaire et
jours "plus larges".

**Phase 8 — Qualité nutritionnelle et habitudes.** Nutri-Score, NOVA, fibres,
sucres, sel, bilan qualité hebdomadaire, repas habituel suggéré selon l'heure,
ressenti faim/énergie/humeur.

**Phase 9 — Coach.** Chat contextuel, 4 personnalités, plat suggéré du jour,
bilan hebdomadaire complet, garde-fous.

**Phase 10 — Notifications.** Web Push (repas, eau, bilan), plages silencieuses.

---

## v3 — Complète

**Phase 11 — Planification.** Menus 7 jours du foyer, génération par le coach,
liste de courses partagée temps réel, scanner de frigo, bibliothèque de recettes.

**Phase 12 — Espace Training.** Profil sportif, bibliothèque d'exercices,
générateur de programme (règles + personnalisation LLM), séance du jour,
remplacement et séance express, mode séance guidé avec minuteurs et Wake Lock,
progression selon le ressenti, historique et records, lien avec la nutrition.

**Phase 13 — Corps et activité.** Mensurations, photos de progression, saisie
libre d'activités et MET, pas, import CSV, ajustement dynamique des objectifs.

**Phase 14 — Jeûne et traitement.** Protocoles, planning par jour, démarrage
auto, minuteur, historique ; journal de traitement ; notifications associées.

**Phase 15 — Finitions.** Purge des photos, audit accessibilité, mode hors-ligne
complet, doc de déploiement, de restauration de sauvegarde et d'exploitation
(`README.md`).
