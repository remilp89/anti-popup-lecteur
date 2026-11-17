<p align="center">
  <img src="extension/icons/icon128.png" width="128" height="128" alt="Logo Anti-Popup Lecteur : un bouclier bleu avec un lecteur vidéo">
</p>

<h1 align="center">Anti-Popup Lecteur</h1>

Extension de navigateur (Chrome et navigateurs basés sur Chromium, Manifest V3) qui supprime les pièges publicitaires autour des lecteurs vidéo : onglets qui s'ouvrent au clic, redirections de la page, calques invisibles posés par-dessus le lecteur. Elle reclique ensuite automatiquement jusqu'au lancement de la vidéo et passe en plein écran.

Elle n'agit **que sur les sites que vous choisissez**. Partout ailleurs, elle ne touche à rien.

## Fonctionnalités

- **Blocage des popups** : neutralise `window.open`, les liens `target="_blank"` déclenchés par script, les formulaires envoyés vers un nouvel onglet, y compris depuis des iframes vides créés à la volée. Ferme tout onglet publicitaire qui s'ouvre malgré tout juste après un clic.
- **Anti-redirection** : annule les redirections de la page entière vers un autre domaine qui ne viennent pas d'un vrai clic (« popunder inversé »).
- **Calques invisibles** : supprime les couches transparentes plein écran qui interceptent vos clics à la place du lecteur.
- **Reclic automatique** : quand un popup est bloqué, reclique au même endroit (6 fois maximum, réglable) jusqu'à ce que la vidéo démarre.
- **Plein écran automatique** au lancement de la lecture (désactivable).
- **Page « Sites protégés »** : liste des sites actifs, compteur de blocages par site, ajout et retrait.
- **À regarder plus tard** : depuis la page d'un film ou d'une série, un clic dans la fenêtre de l'extension ajoute le titre (nom, année, type) à une liste, avec suivi des titres vus, synchronisée entre vos ordinateurs par votre compte Chrome.
- **Respect de vos actions** : Ctrl/Cmd + clic, clic molette et Maj + clic ouvrent normalement un onglet.

## Installation

### Prérequis

- Chrome 111 ou plus récent, ou un navigateur basé sur Chromium (Brave, Edge, Vivaldi, Opera…).
- Testé sur Chrome 157 (macOS).

L'extension n'est pas (encore) publiée sur le Chrome Web Store : elle s'installe en mode développeur, ce qui prend une minute.

### Étapes

1. **Récupérer le code**

   ```bash
   git clone https://github.com/remilp89/anti-popup-lecteur.git
   ```

   ou, sur la page GitHub du dépôt, **Code → Download ZIP**, puis décompressez l'archive.

2. **Ouvrir la page des extensions** : saisissez dans la barre d'adresse

   | Navigateur | Adresse |
   |---|---|
   | Chrome / Chromium | `chrome://extensions` |
   | Brave | `brave://extensions` |
   | Edge | `edge://extensions` |

3. **Activer le mode développeur** (interrupteur en haut à droite).

4. Cliquer sur **Charger l'extension non empaquetée** et sélectionner le dossier **`extension`** du dépôt, celui qui contient le fichier `manifest.json`. Ne sélectionnez pas la racine du dépôt.

5. *(Recommandé)* **Épingler l'icône** : cliquez sur l'icône puzzle de la barre d'outils, puis sur la punaise à côté d'« Anti-Popup Lecteur ».

> **Important** : ne déplacez pas et ne renommez pas le dossier `extension` après l'avoir chargé : le navigateur en retient l'emplacement. Si vous devez le déplacer, supprimez l'extension puis rechargez-la depuis le nouvel emplacement. Depuis la version 1.2.0, l'identifiant de l'extension est fixe : si la synchronisation Chrome est active (voir plus bas), vos sites et votre liste « à regarder » sont restaurés depuis votre compte ; seuls les compteurs de blocages repartent de zéro.

Au démarrage, Chrome peut afficher un avertissement sur les « extensions en mode développeur » : c'est normal pour une extension non empaquetée.

## Utilisation

### Protéger un site

1. Ouvrez le site dans un onglet.
2. Cliquez sur l'icône de l'extension.
3. Cliquez sur **Activer sur ce site**. La page se recharge, la protection est active.

Pour l'arrêter sur un site : même bouton, **Désactiver sur ce site**.

### À regarder plus tard

1. Ouvrez la page d'un film ou d'une série.
2. Cliquez sur l'icône de l'extension : le bloc **À regarder plus tard** propose le **titre**, l'**année** et le **type** (film ou série) détectés sur la page. Corrigez-les si besoin.
3. Cliquez sur **Ajouter à ma liste**.

Si le titre est déjà dans la liste, le bouton devient **Marquer comme vu** (puis **Remettre à voir**), avec la date de visionnage.

Cliquez sur **Ma liste** dans la fenêtre de l'extension, ou sur l'onglet **À regarder** de la page de gestion, pour :

- cocher un titre comme **vu** (la date est conservée) ou le remettre à voir ;
- filtrer (à voir / vus / tous, films / séries) et rechercher ;
- **ajouter** un titre à la main, **retirer** un titre (avec annulation) ;
- **exporter** la liste en fichier `.json` et **importer** un export (fusion sans doublon, sans rien écraser).

Le titre est le même quel que soit le site : ajouter « Dune (2021) » depuis deux sites ne crée qu'une entrée. La détection fonctionne sur la plupart des pages ; sinon, corrigez simplement les champs avant d'ajouter.

#### Synchronisation entre ordinateurs

La liste, la liste des sites protégés et les réglages sont stockés avec `chrome.storage.sync` : Chrome les synchronise via votre compte Google. Pour que ça fonctionne :

1. **Connectez-vous à Chrome avec le même compte** sur chaque ordinateur.
2. Dans les paramètres de Chrome, vérifiez que la **synchronisation** est activée et que l'option **Extensions** est cochée (l'intitulé exact peut varier selon la version).
3. **Chargez l'extension en version 1.2.0 ou plus** sur chaque ordinateur : son identifiant est fixe, ce qui permet à Chrome de relier les installations.

La synchronisation n'est pas instantanée (quelques secondes à quelques minutes). Les compteurs de blocages restent propres à chaque ordinateur.

### Gérer tous les sites

Cliquez sur **Sites protégés** dans la fenêtre de l'extension, ou ouvrez `chrome://extensions` → **Détails** → **Options de l'extension**.

La page permet de :

- voir les sites protégés (chaque nom est un lien vers le site) et le nombre de blocages de chacun ;
- **ajouter** un ou plusieurs domaines (séparés par des espaces ou des virgules) ;
- **retirer** un site.

Un site protégé couvre aussi ses sous-domaines.

### Réglages

Dans la fenêtre de l'extension :

- **Plein écran automatique** : active ou non le plein écran au lancement de la vidéo.
- **Reclics max** : nombre maximal de reclics automatiques (1 à 20, 6 par défaut).

### Mise à jour

Une extension chargée en mode développeur **ne se met pas à jour toute seule**.

**Installée avec `git clone`** :

```bash
git pull
```

**Installée avec le ZIP** : retéléchargez le ZIP, puis remplacez le contenu du dossier `extension` par le nouveau, **au même emplacement**.

Dans les deux cas, cliquez ensuite sur l'icône de rechargement (↻) de la carte de l'extension dans `chrome://extensions`, puis rechargez les onglets des sites protégés (les pages déjà ouvertes gardent l'ancien code).

Ne déplacez pas le dossier (voir la note de l'étape d'installation).

**Quelle version ai-je ?** Le numéro figure sur la carte de l'extension dans `chrome://extensions` et en bas de la page « Sites protégés ». Comparez-le à la [dernière version](https://github.com/remilp89/anti-popup-lecteur/releases) et au [journal des modifications](CHANGELOG.md).

### Désinstallation

`chrome://extensions` → **Supprimer** sur la carte de l'extension.

## Dépannage

| Problème | À essayer |
|---|---|
| Rien ne change sur un site | Vérifiez qu'il est bien activé (icône → bouton vert « Désactiver sur ce site »), puis rechargez la page. |
| Des onglets s'ouvrent encore | Rechargez l'extension (↻) et la page. Si le cas persiste, ouvrez un ticket avec l'adresse du site et ce que vous observez. |
| Un onglet que je voulais ouvrir est fermé | Utilisez Ctrl/Cmd + clic ou le clic molette, ou désactivez l'extension sur ce site. |
| La vidéo ne démarre pas | Essayez un autre serveur de lecture sur le site ; certains liens sont simplement expirés. |
| Pas de plein écran | Le lecteur doit l'autoriser (attribut `allowfullscreen`). Sinon, le plein écran se déclenche au clic suivant. |
| La liste « à regarder » ne se synchronise pas | Vérifiez que vous utilisez le même compte Chrome partout, que la synchronisation (y compris **Extensions**) est activée, et que les deux ordinateurs ont la version 1.2.0 ou plus. Patientez quelques minutes. En cas de doute, utilisez Exporter / Importer. |
| Le titre détecté est faux ou vide | Corrigez-le dans la fenêtre avant d'ajouter : le nom du site peut rester collé au titre sur certaines pages. |
| L'extension ne se charge pas | Vérifiez que vous avez sélectionné le dossier `extension` (avec `manifest.json`) et que le mode développeur est activé. |

Pour inspecter l'extension : `chrome://extensions` → **Détails** → lien **service worker** (console de l'arrière-plan).

## Limites

- **Lecteur dans un iframe d'un autre domaine** : si une couche publicitaire de la page recouvre un tel lecteur, le reclic automatique ne peut pas atteindre l'intérieur de l'iframe (restriction du navigateur). Les popups sont bloqués ; il suffit de cliquer vous-même.
- **Murs publicitaires** : l'extension **ne simule pas de vues ni de clics publicitaires** et ne contourne pas les murs qui exigent de « regarder N publicités » ou d'ouvrir des onglets. Sur ce type de page, désactivez l'extension pour le site.
- **Sites qui changent** : chaque régie publicitaire a ses propres astuces et les renouvelle ; un site peut nécessiter des ajustements.
- **Taille de la liste** : la synchronisation Chrome est limitée (environ 100 Ko et 512 éléments par extension), soit **environ 500 titres** ; la page « À regarder » indique l'espace utilisé et prévient quand il est presque plein. Retirez les titres déjà vus pour faire de la place.
- **Détection du titre et du type** : fondée sur le balisage de la page et son adresse ; elle peut se tromper sur des pages atypiques, d'où les champs modifiables. L'année n'est renseignée que si la page l'indique clairement.
- Navigateurs mobiles non pris en charge.

## Confidentialité

- **L'extension ne collecte ni n'envoie aucune donnée** : elle ne fait aucune requête réseau et n'a aucun serveur.
- Elle ne stocke, dans le stockage de l'extension du navigateur (`chrome.storage`), que : la liste des sites que vous avez activés, vos réglages (plein écran, reclics), votre liste « à regarder » (titre, année, type, adresse de la page, dates d'ajout et de visionnage) et les compteurs de blocages.
- **Si la synchronisation Chrome est active**, c'est Chrome (Google) qui synchronise la liste des sites, les réglages et la liste « à regarder » entre vos appareils, sous votre compte. Les compteurs de blocages restent locaux.
- Aucun historique de navigation n'est enregistré : seule la page que vous ajoutez explicitement à la liste est mémorisée.

### Permissions demandées

| Permission | Pourquoi |
|---|---|
| `storage` | Conserver la liste des sites, les réglages et les compteurs. |
| `tabs` | Connaître l'adresse de l'onglet actif et fermer les onglets publicitaires. |
| `webNavigation` | Repérer les onglets ouverts par une page, y compris sans `opener`. |
| Accès à tous les sites (`<all_urls>`) | Pouvoir s'activer sur n'importe quel site que vous choisissez ; le code ne fait rien sur les sites non activés. |

## Fonctionnement (aperçu)

| Fichier | Rôle |
|---|---|
| `extension/main.js` | Dans la page : remplace `window.open`, bloque les clics simulés sur des liens, annule les redirections non initiées par l'utilisateur. |
| `extension/content.js` | Dans la page (monde isolé) : reclic automatique, plein écran, suppression des calques invisibles. |
| `extension/background.js` | Service worker : configuration par site, fermeture des onglets publicitaires, compteurs. |
| `extension/shared.js` | Détection du titre / de l'année / du type d'une page, et gestion de la liste « à regarder » (une clé de stockage par titre, pour que deux ordinateurs ne s'écrasent pas). |
| `extension/popup.*` | Fenêtre de l'extension (activer/désactiver un site, réglages, ajout à la liste). |
| `extension/options.*` | Page « Sites protégés ». |
| `extension/watchlist.*` | Page « À regarder » (liste, filtres, vu, export/import). |
| `extension/ui.css` | Styles communs des pages de l'extension. |

## Avertissement

Cet outil est fourni « tel quel », sans garantie, pour un usage personnel de confort de navigation. Vous êtes responsable de l'usage que vous en faites et du respect des lois et des conditions d'utilisation des sites visités. Ce projet n'est affilié à aucun site ni à aucune régie publicitaire.

## Licence

[MIT](LICENSE)
