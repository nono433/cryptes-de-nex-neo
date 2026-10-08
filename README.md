# Cryptes de Nex — **Néo**

Le même roguelike que la version console, **réécrit en JavaScript** pour le
navigateur. Aucune installation, aucune dépendance : tu double-cliques et ça
joue.

### ▶ [**Jouer en ligne**](https://nono433.github.io/cryptes-de-nex-neo/) — rien à installer

```
CryptesDeNex-Neo/index.html
```

> Doublie-clique `index.html` pour jouer. Si ton navigateur bloque le chargement
> local, lance `.\play.ps1` (un petit serveur Python sert alors les fichiers).

**Code sous droits réservés** — voir [LICENSE](LICENSE). Tu peux le lire, le
jouer et l'étudier ; tu ne peux pas le redistribuer sans me demander.

---

## Ce qui a changé par rapport à la version C#

Le jeu est **identique** : mêmes 40 profondeurs avec leurs noms et leurs
descriptions, même bestiaire, même courbe d'XP, mêmes 24 pièces d'équipement
réparties en 6 emplacements et 4 paliers, mêmes trois ensembles, mêmes autels,
même règle d'élite et de boss. Le butin, l'équilibrage et les tables sont
repris à l'identique.

Ce qui est nouveau, c'est **la façon dont on le voit** :

| | console | Néo |
|---|---|---|
| Décor | caractères monospace | tuiles pixel-art dessinées par le code, une palette par bande de profondeurs |
| Éclairage | rien | chaque torche éclaire vraiment, ombres radiales, lueur de la lanterne du héros |
| Créatures | une lettre | sprites dessinés à la main, **entourés d'un liseré sombre** pour ressortir sur la pierre |
| Profondeur | une ligne de texte | carte d'étage animée, titre plein écran à chaque descente |
| Combat | une ligne de journal | frappe en lunge, éclairs, nombres de dégâts flottants, secousse d'écran |
| Particules | aucune | poussière ambiante, étincelles, explosions magiques |
| Sons | aucun | synthétisés en WebAudio (aucun fichier à charger) |
| Interface | colonnes ANSI | panneaux en verre dépoli, barres de vie animées, infobulles, mini-carte |
| Entrées | clavier | clavier **et** souris (cliquer un monstre pour le frapper, cliquer l'escalier pour descendre) |

---

## Commandes

| Touche | Action |
|---|---|
| `Z` `Q` `S` `D` · `W` `A` `S` `D` · flèches | se déplacer |
| Marcher sur un monstre (ou cliquer dessus) | attaquer |
| `Espace` ou `.` | attendre un tour |
| `>` ou `Entrée` | descendre l'escalier |
| `I` | ouvrir le sac |
| `C` | fiche du héros |
| `X` | commercer sur un autel |
| `1`…`9` | utiliser un objet du sac |
| `1`…`6` | acheter une offre d'autel |
| `H` ou `?` | aide |
| `M` | couper le son |
| `R` | nouvelle partie |
| `Échap` | fermer / quitter |

---

## Règles

- **Quarante profondeurs.** Un étage sur cinq porte un autel (`3, 8, 13, 18, 23,
  28, 33, 38`), un étage sur dix une élite qui garde l'escalier (`10, 20, 30`).
  Au **`40ᵉ`** il n'y a plus d'escalier : il faut abattre le Gardien et prendre
  l'Amulette.
- **On ne voit que dans un cône de 8 cases** (élargi par les casques et les
  bottes). Les monstres ne te poursuivent que s'ils te voient : contourner vaut
  souvent mieux que frapper.
- **Décor** : `eau` infranchissable mais visible au travers · `piège` qui se
  déclenche une fois · `autel` (`X`) · `escalier` (`>`) · torches qui éclairent.
- **Dégâts** : `max(1, ATQ + 0…2 − DFO)`, coup critique à 10 % au départ (le
  double), esquive à 5 %.
- **Sac de 9 objets.** Une pièce d'équipement **moins bonne** que celle que tu
  portes n'entre pas dans le sac : elle est laissée au sol, ou jetée si tu
  essaies de l'enfiler. Le sac ne se remplit jamais de ferraille.
- **Niveaux** : chaque montée donne +7 PV max, +1 ATQ, +1 DFO et soigne
  entièrement. La courbe d'XP est quadratique — en linéaire on atteignait le
  niveau 61 et le jeu n'avait aucune tension.
- **Descendre** soigne 25 % des PV max plus le bonus de régénération.

### Les six emplacements

Arme · Armure · Casque · Bottes · Anneau · Talisman — chacun en quatre paliers
(*commun*, *rare*, *épique*, *de nex*). Les pièces se comparent sur un score
qui pondère ATQ ×3, DFO ×2, PV ×1, CRIT/ESQUIVE/VUE/REGEN ×2.

**Ensembles** — porter 2 à 4 pièces du même nom ajoute un bonus :

| Ensemble | 2 pièces | 3 pièces | 4 pièces |
|---|---|---|---|
| **cendre** | DFO +2 | ATQ +3, PV +6 | — |
| **fondeur** | PV max +15 | ATQ +4, DFO +2, ESQ +3 % | — |
| **nex** | ATQ +3, DFO +3 | — | PV +25, CRIT +10 %, VUE +2 |

Les autels vendent une pièce par emplacement. Le prix monte avec le palier **et**
avec la profondeur : `40 + 70·(palier−1) + 50·(palier−1)² + profondeur·15·palier`.

---

## Organisation du code

| Fichier | Rôle |
|---|---|
| `js/rng.js` | générateur déterministe (mulberry32) — une graine = une partie |
| `js/sprites.js` | pixel-art : chaque créature et chaque objet est une grille de caractères |
| `js/data.js` | les 40 profondeurs, le bestiaire, l'équipement, les ensembles, les palettes |
| `js/items.js` | le sac : consommables, pièces d'équipement, tables de butin |
| `js/world.js` | génération du donjon, eau, pièges, autels, torches, champ de vision |
| `js/game.js` | toute la logique : tours, IA, combat, niveaux, autels |
| `js/fx.js` | particules, nombres flottants, secousse d'écran |
| `js/audio.js` | sons synthétisés (oscillateurs + bruit filtré) |
| `js/render.js` | tuiles procédurales mises en cache, caméra, éclairage, vignette |
| `js/ui.js` | panneaux DOM, journal, sac, fiche, autel, aide, fin de partie |
| `js/main.js` | amorçage, boucle, entrées clavier et souris |

Aucun module ES : des scripts classiques dans l'ordre, ce qui permet
l'ouverture directe du fichier sans serveur. Tout est attaché à `window.NEX`.

---

## Tests

```powershell
npm test                 # les quatre suites
npm run test:sprites     # cohérence des grilles pixel-art
npm run test:smoke       # catalogue, équipement, 320 étages, 40 000 coups
npm run test:render      # 240 images, 40 étages, scène surchargée, interface
npm run test:boot        # démarrage complet, clavier, souris, fin de partie
```

Aucune dépendance : les tests tournent sur `node` seul, avec un canvas et un
DOM simulés.

- **sprites** — cohérence des 22 grilles pixel-art : chaque ligne a la bonne
  largeur et n'utilise que des couleurs déclarées.
- **smoke** — 40 profondeurs, 320 étages générés sur 8 graines avec contrôle de
  connexité (l'eau ne doit jamais couper le donjon), escalier atteignable,
  autel conforme, champ de vision qui ne traverse pas un mur, bonus d'ensemble,
  courbe d'XP, butin valide, **40 000 actions** jouées par un bot qui chemine
  vers l'escalier en BFS (le butin est ramassé, l'amulette aussi).
- **render** — construction du moteur, 240 images, les 40 palettes, une scène
  avec 147 objets et 88 monstres et 1100 particules, joueur dans les quatre
  coins, tous les panneaux de l'interface, **un sprite par emplacement
  d'équipement**, et **chaque objet dessiné dans sa propre case**.
- **boot** — `main.js` inclus : amorçage, **600 images**, chaque touche
  (`I` `C` `H` `M` `R` `X` `>` `Espace` AZERTY et flèches), les deux écrans de
  fin, le clic sur un monstre, le clic sur l'escalier, le survol de la souris,
  le redimensionnement.

### Vérifier le rendu à l'œil

Un rendu ne se juge pas avec des assertions. Ces deux outils rasterisent de
**vraies images PNG** du jeu dans `shots/` :

```powershell
npm install --no-save @napi-rs/canvas   # une seule fois, optionnel
npm run shots                          # 12 captures de jeu
npm run spritesheet                    # planche de tous les sprites, zoomés
```

`shots/02-visibilite.png` est la plus parlante : elle aligne le héros au
centre d'un cercle de créatures à 1 à 5 cases, ce qui juge d'un coup d'œil si
on voit les ennemis. `sprites.png` aligne chaque créature et chaque objet sur
un damier, avec le contour et la taille réelle.

C'est ce regard qui a révélé les deux pires bugs du projet — voir ci-dessous.

### Équilibrage

Le bot du test smoke est un marcheur bête : il frappe tout ce qui est
adjacent, ne fuit jamais et n'achète que ce qu'il peut payer au premier
autel. Il atteint le fond une fois sur douze et meurt le plus souvent entre
les profondeurs 10 et 25. Un joueur qui utilise la vue, l'esquive et les
autels va beaucoup plus loin. `node test/smoke.js` affiche les compteurs.

---

## Quatre bugs que les tests ne voyaient pas

Ils sont documentés parce que le Ratings d'un jeu se joue à l'œil, et que
l'œil ne s'automatise pas tout seul.

**1. Aucun monstre n'était jamais dessiné.** `map.at(x, y)` renvoie une
*fiche statique* de case (type, nom, franchissable) partagée par toutes les
cases du même type — elle ne porte aucun état. Or le code demandait
`map.at(x, y).visible`, qui valait donc toujours `undefined`. Même erreur dans
les six endroits concernés : monstres invisibles, butin invisible, monstres qui
ne poursuivent jamais (ils erraient au hasard au lieu de charger), bombe de
rune inerte. Le jeu était techniquement jouable et totalement mort.
→ `map.vis(x, y)` et `map.seen(x, y)` lisent les tableaux d'état.

**2. Tous les objets au sol étaient empilés en haut de l'écran.** Dans
`drawItem`, la hauteur du sprite était calculée à partir de `FOOT_Y` mais
**sans y ajouter `cy`**. Résultat : les halos et les ombres étaient à la
bonne place, les dessins allaient tous se coincer au bord supérieur. C'est
le symptôme exact « le butin n'a pas de sprite ».
→ un test de non-régression enregistre désormais les appels à `drawImage` et
vérifie que le rectangle tracé tombe dans la case de l'objet.

**3. Le héros marchait sur les murs.** Les sprites sont ancrés par le centre,
donc ils débordaient d'un tiers de tuile vers le bas — par-dessus la case
suivante. Aggravé par des sprites de 18 px dans des cases de 16.
→ ancrage par les **pieds** (`FOOT_Y`), une fonction `fitSprite()` qui bride
la taille, et un test qui recalcule l'empreinte de chaque créature et de chaque
objet à toutes les tailles de tuile.

**4. Le calque d'ombre était appliqué deux fois.** Pour «BOOSTER » la
visibilité des créatures, j'ai effacé un peu d'ombre autour d'elles, puis
redessiné le calque par-dessus. Chaque pixel recevait deux fois la pénalité :
la scène devenait plus sombre, pas plus claire.
→ toutes les sources sont effacées dans le calque, qui n'est appliqué
qu'une fois.

Le cinquième est plus discret : `Player.equip()` bornait les PV **avant** de
recalculer les bonus. Remplacer une armure lourde par une légère laissait le
héros avec 209 PV pour un maximum de 178 — invisible à l'écran, mais des
invulnérables.
