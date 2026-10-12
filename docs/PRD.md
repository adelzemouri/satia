# PRD — Pommelia

## 1. Vision
Une app de suivi nutritionnel douce et sans culpabilité, pour la famille. On prend
son assiette en photo, l'app estime calories et macros, et un coach IA aide à
construire de bonnes habitudes. Le nom est centralisé dans une constante de config
pour pouvoir être changé facilement.

## 2. Utilisateurs
- Admin (moi) : installe, gère les comptes, configure le LLM et le budget.
- Membres de la famille : adultes principalement ; éventuellement ados
  (objectifs restreints, cf. CLAUDE.md).

## 3. Onboarding
Questionnaire en plusieurs écrans, une question par écran, barre de progression :
- Prénom, sexe, date de naissance, taille, poids actuel, poids cible (optionnel).
- Objectif : perdre du poids / maintenir / prendre du muscle / manger plus équilibré.
- Niveau d'activité (5 niveaux décrits concrètement).
- Rythme souhaité (doux / modéré) avec date d'objectif estimée affichée.
- Préférences alimentaires (omnivore, végétarien, végan, sans porc, etc.) et
  aliments exclus (goûts, pas allergies stockées en dur — champ libre "à éviter").
- Horaires de repas habituels (pour les rappels).
- Intérêt pour le jeûne intermittent (oui/non).
- Mode de budget : quotidien ou hebdomadaire (cf. §4 bis).
- Choix du coach (cf. §6).
- Écran de synthèse : objectif calorique, répartition des macros, explication en
  langage simple du calcul (Mifflin-St Jeor + facteur d'activité ± ajustement),
  en précisant que l'objectif s'affinera automatiquement après 2 semaines (§4 bis).

## 4. Tableau de bord du jour (écran d'accueil)
- Anneau principal : calories consommées / objectif, calories restantes,
  calories brûlées (activité) ajoutées au budget.
- Trois anneaux ou barres : protéines, glucides, lipides (consommé / objectif).
- Indicateur de zone : zone perte de poids / maintien / prise de muscle selon
  l'apport du jour par rapport au TDEE.
- Liste des repas : petit-déjeuner, déjeuner, dîner, collations ; chacun avec total
  kcal et bouton d'ajout rapide.
- En mode budget hebdomadaire : jauge de la semaine (consommé / total) en plus
  de l'objectif du jour recalculé.
- Suivi de l'eau : verres cliquables, objectif quotidien réglable.
- ~~Ressenti du jour facultatif : faim, énergie, humeur (échelle de 1 à 5, 3 taps).~~ Retiré le 2026-10-12 (DECISIONS 026).
- Carte "plat suggéré" : une idée de repas qui tient dans le budget restant.
- Streak (jours consécutifs avec au moins un repas saisi), avec rattrapage
  bienveillant (1 jour de "gel" par semaine).
- Navigation par date (jours passés, sans permettre la saisie dans le futur sauf
  planification de menu).

## 4 bis. Objectif adaptatif et budget hebdomadaire

**Objectif adaptatif** (calcul pur, aucun appel LLM)
- La formule de départ n'est qu'une estimation. Chaque semaine, l'app recalcule la
  dépense énergétique réelle à partir de la tendance de poids (moyenne lissée, pas
  la pesée brute) et des calories saisies sur la période.
- Démarrage après 14 jours de données, avec au moins 3 pesées et 80 % des jours
  saisis ; sinon l'app conserve l'objectif actuel et explique ce qui manque.
- Ajustement borné (±150 kcal par semaine maximum) et toujours au-dessus du
  plancher calorique.
- Écran "Mon métabolisme" : dépense estimée au départ vs dépense mesurée, courbe
  d'évolution, explication en langage simple. L'utilisateur peut figer l'objectif.

**Budget hebdomadaire** (option)
- Total de la semaine = 7 × objectif quotidien. Chaque jour, l'objectif est
  recalculé à partir de ce qui reste à répartir sur les jours restants.
- Possibilité de marquer à l'avance des jours "plus larges" (repas de famille,
  sortie) : les autres jours s'ajustent légèrement.
- Bornes : un jour ne descend jamais sous le plancher calorique ni à moins de
  80 % de l'objectif moyen ; si la semaine est déjà dépassée, l'excédent n'est
  pas reporté sur la semaine suivante (on repart à zéro, sans message culpabilisant).

## 5. Saisie des repas
Toutes les méthodes aboutissent à un écran de confirmation éditable avant ajout
(aliment, quantité, unité, kcal, P/G/L), avec indicateur "estimé" quand pertinent.

1. **Photo** : caméra ou galerie ; champ texte optionnel pour préciser
   ("sauce à part", "demi-portion"). Le LLM vision renvoie la liste d'aliments +
   quantités estimées ; matching sur la base locale ; l'utilisateur ajuste.
2. **Voix** : bouton micro, transcription navigateur, parsing par LLM texte.
3. **Texte libre** : "2 œufs brouillés et une tartine beurrée" → même pipeline que la voix.
4. **Code-barres** : scan via caméra (librairie JS côté client), lookup Open Food
   Facts, mise en cache locale du produit.
5. **Recherche manuelle** dans la base (Ciqual + OFF en cache + aliments perso),
   avec recherche floue tolérante aux accents et fautes.
6. **Favoris et repas récents** : ajout en un tap.
7. **Aliments et recettes personnalisés** : créer un aliment (valeurs pour 100 g
   ou par portion) ou une recette composée d'ingrédients avec nombre de portions.
8. **Copier** un repas d'un autre jour, ou **dupliquer la journée d'hier** en un tap.
9. **Repas habituel suggéré** : selon l'heure et l'historique, l'app propose en
   haut de l'écran d'ajout le repas le plus fréquent du créneau
   ("Ton petit-déj habituel ?"), ajoutable en un tap.

**Apprentissage à partir des corrections**
- Chaque correction d'une estimation IA (aliment, quantité) est enregistrée par
  utilisateur. Les corrections récurrentes servent de règles locales appliquées
  avant tout appel LLM (ex. "riz" → portion habituelle 200 g) et sont injectées
  sous forme compacte dans le prompt photo.
- **Mes contenants** : l'utilisateur enregistre ses bols, assiettes, verres et
  mugs (nom, volume ou diamètre, photo optionnelle). Il peut les sélectionner lors
  d'une saisie photo pour améliorer l'estimation des quantités, ou en saisie
  manuelle ("1 mon grand bol de soupe").
- Dictionnaire personnel : expressions propres à l'utilisateur ("ma tartine",
  "mon café du matin") associées à un aliment ou un repas précis, reconnues en
  saisie texte et vocale sans appel LLM.

Unités supportées : g, kg, ml, cl, l, c. à café, c. à soupe, tasse, portion,
pièce/unité, tranche ; conversions par aliment quand une densité ou un poids
unitaire est connu.

## 5 bis. Espace famille

- **Foyer** : tous les comptes invités par l'admin appartiennent au même foyer.
- **Repas partagé** : un membre saisit une fois un plat préparé pour plusieurs
  (photo, recette ou ingrédients), indique le nombre de parts total, puis chaque
  membre concerné reçoit le plat dans son journal et indique sa portion
  (½, 1, 1½, 2 parts ou grammes). Les autres membres valident en un tap ; rien
  n'est ajouté au journal de quelqu'un sans sa validation.
- **Recettes familiales** : bibliothèque commune au foyer, en plus des recettes
  personnelles ; chacun peut ajouter, modifier ou mettre en favori.
- **Menu de la semaine commun** et **liste de courses partagée** (cf. §7),
  synchronisés en temps réel entre les membres.
- Confidentialité : poids, objectifs, journaux et ressentis restent privés ;
  seuls les recettes, menus, repas partagés et listes de courses sont communs.

## 5 ter. Qualité nutritionnelle
- Pour chaque aliment, afficher quand disponibles : Nutri-Score, groupe NOVA
  (degré de transformation), fibres, sucres, sel (source Open Food Facts / Ciqual).
- Objectifs indicatifs de fibres et de légumes/fruits par jour, affichés à côté
  des macros.
- Bilan qualité hebdomadaire : part d'aliments ultra-transformés, fibres
  moyennes, sel moyen, aliments les plus contributeurs, avec une ou deux
  suggestions concrètes et positives (ajouter plutôt que retirer).

## 6. Coach IA
- Chat contextuel : le coach connaît l'objectif, le journal du jour, le budget restant,
  les préférences et les données de poids/activité (contexte compact injecté).
- Un seul ton de coach, bienveillant et concret (les 4 personnalités au choix ont été
  retirées en 2026-10 pour simplifier, voir DECISIONS 029).
- Suggestions : idées de repas qui rentrent dans le budget, recettes à partir des
  préférences, ajustements de fenêtres alimentaires.
- Bilan hebdomadaire automatique (1 appel LLM / utilisateur / semaine), intégrant
  l'objectif adaptatif, le bilan qualité, le training et les ressentis
  (ex. lien entre énergie basse et jours à faibles apports en protéines).
- Garde-fous : pas d'avis médical, renvoi vers un professionnel pour toute question
  de santé, refus d'aider à descendre sous le plancher calorique.

## 7. Planification et recettes
- Planificateur de menus sur 7 jours, au niveau du foyer : glisser des
  recettes/repas dans les créneaux ; les repas planifiés deviennent des repas
  partagés le jour venu.
- Génération d'un menu de la semaine par le coach (dans le budget et les préférences).
- Liste de courses partagée par le foyer, générée depuis le menu (quantités
  calculées selon le nombre de parts), regroupée par rayon, cochable par
  n'importe quel membre, ajout manuel d'articles.
- **Scanner de frigo** : photo du frigo/placard → liste d'ingrédients → 3 idées
  de recettes compatibles avec le budget restant.
- Bibliothèque de recettes : recettes perso + recettes générées et sauvegardées.

## 8. Corps, activité, jeûne, traitement
- **Poids** : saisie, courbe de tendance lissée (utilisée aussi par l'objectif
  adaptatif), projection vers l'objectif.
- **Mensurations** (tour de taille, hanches, etc.) et photos de progression privées.
- **Activité** : saisie de séances (type, durée, intensité) → calories brûlées via
  valeurs MET ; saisie manuelle des pas quotidiens ; import CSV optionnel
  (export Google Fit / Apple Santé / montre) ; les calories brûlées augmentent
  l'objectif du jour et les macros proportionnellement.
- **Jeûne intermittent** : protocoles (12:12, 14:10, 16:8, 18:6, personnalisé),
  planning différent par jour de la semaine, démarrage automatique de la fenêtre,
  minuteur visuel, historique.
- **Traitement** (ex. GLP-1) : journal des prises (date, heure, nom libre, note),
  rappels, aucun calcul de dose.

## 8 bis. Espace Training
Un onglet dédié à l'entraînement, relié à la nutrition (les calories brûlées
alimentent le budget du jour).

**Profil sportif** (complété à la première ouverture, modifiable) : niveau
(débutant / intermédiaire / confirmé), objectif (perte de poids, renforcement,
prise de muscle, endurance, mobilité), lieu (maison sans matériel, maison avec
petit matériel, salle de sport, extérieur), matériel disponible (haltères,
élastiques, barre de traction, kettlebell…), jours disponibles et durée par
séance (15 / 30 / 45 / 60 min), zones à ménager (genoux, dos, épaules…).

**Propositions d'entraînement**
- Programme hebdomadaire généré à partir du profil : répartition des séances sur
  les jours disponibles, alternance des groupes musculaires, jours de repos.
- Génération en deux temps pour limiter les coûts : un moteur de règles construit
  la structure du programme à partir de la bibliothèque d'exercices, puis le
  modèle texte le moins cher personnalise (ordre, consignes, ton du coach). Le
  programme est généré une fois par semaine, pas à chaque séance.
- Séance du jour mise en avant sur l'accueil Training, avec bouton "Remplacer"
  (propose une alternative de même durée) et "Séance express" (10 min).
- Progression automatique d'une semaine à l'autre selon le ressenti noté après
  chaque séance (trop facile / bien / trop dur) : répétitions, séries, durée ou
  charge ajustées.
- Le coach IA peut aussi proposer une séance à la demande dans le chat
  ("j'ai 20 minutes, pas de matériel").

**Bibliothèque d'exercices**
- 80 à 120 exercices de départ, rédigés pour l'app : nom, groupe musculaire,
  matériel, niveau, consignes en 3 à 5 étapes, erreurs fréquentes, variante plus
  facile et plus difficile, valeur MET, illustration SVG simple ou animation.
- Filtres par muscle, matériel, niveau ; ajout d'exercices personnalisés.

**Mode séance**
- Déroulé guidé plein écran : échauffement, exercices, retour au calme.
- Minuteurs de travail et de repos, compteur de séries, signal sonore et vibration,
  écran maintenu allumé (Wake Lock API).
- Saisie des répétitions et charges réalisées, ressenti en fin de séance.
- Calories brûlées estimées (MET × poids × durée) ajoutées automatiquement au
  journal du jour.

**Suivi**
- Historique des séances, volume par groupe musculaire, records personnels,
  régularité (calendrier), streak d'entraînement séparé du streak nutrition.

**Lien nutrition ↔ training**
- Les jours d'entraînement, l'objectif protéines est légèrement relevé.
- Le coach suggère une collation adaptée avant ou après la séance.

## 9. Direction artistique
Ambiance "marché du dimanche" : chaleureuse, végétale, apaisante, loin des codes
fitness agressifs.
- Palette : vert sauge (primaire), terracotta (accent), crème (fond clair),
  anthracite chaud (texte) ; mode sombre complet avec fond olive très foncé.
  Macros : chaque macro a sa couleur, toujours doublée d'une icône ou d'un libellé.
- Typo : une serif douce pour les titres, une sans-serif lisible pour le texte
  (polices servies par l'app elle-même).
- Formes arrondies, illustrations SVG simples d'aliments créées pour l'app,
  micro-animations sobres (remplissage des anneaux, confettis légers sur un streak).
- Composants : cartes à coins arrondis, grands boutons tactiles, navigation par
  barre inférieure à 5 onglets (Accueil, Journal, +, Training, Profil ; Plans
  accessible depuis Journal), bouton "+"
  central qui ouvre les méthodes de saisie.

## 10. Notifications
Web Push via le service worker : rappels de repas, d'hydratation, début/fin de
jeûne, prise de traitement, bilan hebdo. Chaque type activable séparément,
plages silencieuses.

## 11. Profil et réglages
Modifier objectifs et macros (en % ou en grammes), unités, langue, thème, coach,
notifications, préférences alimentaires ; export et suppression des données.
Admin : invitations et gestion des membres, configuration LLM, budget mensuel, tableau des coûts,
activation/désactivation des fonctions IA, purge des photos.

## 12. Hors périmètre
Estimation de la composition corporelle par photo, intégrations domotiques,
abonnements et paiements, publicité, réseaux sociaux, apps natives, synchronisation
directe Apple Health/Google Fit (remplacée par la saisie manuelle et l'import CSV),
widget d'écran d'accueil natif (remplacé par le raccourci PWA).
