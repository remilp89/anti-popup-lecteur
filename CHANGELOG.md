# Journal des modifications

Le format suit [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/) et le versionnage [SemVer](https://semver.org/lang/fr/) : `MAJEUR.MINEUR.CORRECTIF`.

## [1.2.0] - 2026-11-17

### Ajouté
- **À regarder plus tard** : ajout d'un film ou d'une série depuis la fenêtre de l'extension (titre, année et type détectés sur la page, modifiables), suivi des titres **vus** avec la date, et page « À regarder » (filtres, recherche, ajout manuel, retrait avec annulation, export/import `.json`).
- **Synchronisation Chrome** de la liste, de la liste des sites protégés et des réglages entre ordinateurs.

### Modifié
- L'identifiant de l'extension est désormais **fixe** (clé publique dans le manifest), ce qui est nécessaire à la synchronisation et ne dépend plus de l'emplacement du dossier.
  **Mise à jour depuis la 1.1.0 ou avant :** l'identifiant change, les réglages de l'ancienne version ne sont pas repris. Si l'extension affiche une erreur après rechargement, supprimez l'ancienne carte puis rechargez le dossier `extension`, et rajoutez vos sites une seule fois (ils seront ensuite synchronisés).

## [1.1.0] - 2026-11-17

### Ajouté
- Logo et icônes de l'extension (16, 32, 48 et 128 px).
- Numéro de version affiché en bas de la page « Sites protégés ».
- Guide de mise à jour dans le README.

## [1.0.0] - 2026-11-16

### Ajouté
- Version initiale : blocage des popups, annulation des redirections, suppression des calques invisibles, reclic automatique et plein écran, sur les sites choisis.
- Page « Sites protégés » (ajout, retrait, compteurs, liens cliquables).
