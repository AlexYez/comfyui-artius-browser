# Artius Browser — Français

[Руководства / Guides](README.md) · [Project entry](../README.md)

> Release and local-feature status: [shared guide status](README.md#released-and-local-changes).

> **Artius Browser** vit dans la barre latérale de ComfyUI et rend agréable
> la recherche, la prévisualisation, le glisser-déposer et le chargement de
> vos assets — images, vidéos, audios, modèles 3D et fichiers de workflow.
> Reste rapide même avec d'immenses bibliothèques et utilise le comportement
> natif de ComfyUI partout où c'est possible.

### ✨ Points forts

| | |
|---|---|
| 🖼️ **Images** | Miniatures en cache, extraction de `Prompt` + `Workflow` du PNG, lightbox avec comparaison wipe / 2×2 et zoom synchronisé |
| 🎬 **Vidéos** | Navigation image par image, infos codec / FPS / durée / audio, prompt + workflow embarqués, comparaison synchronisée de 2-4 clips |
| 🎵 **Audio** | Aperçu de la forme d'onde, contrôles de transport, layout des canaux |
| 🎲 **3D** | Viewer 3D natif de ComfyUI dans la lightbox, miniatures 3D capturées |
| 📜 **Workflows** | Lit le dossier de workflows natif de ComfyUI, aperçus sidecar, drag-to-load |
| 🪟 **Deux onglets** | `Assets` et `Workflows` avec un état **indépendant** (recherche, tri, vue, taille des aperçus, largeur du panneau arborescence) |
| 🔍 **Recherche par nom uniquement** | Rapide, prévisible, pas de scan full-text surprise |
| 🚀 **Glisser-déposer** | Directement vers les nœuds natifs `LoadImage` / `LoadVideo` / `LoadAudio` / `Load3D` |
| 🗑️ **Suppression sûre** | Envoyé à la corbeille système via `send2trash` — jamais de suppression définitive |
| 🔄 **Autoscan / Reconstruction du cache** | Rafraîchissement à la demande, ou reconstruction depuis zéro |
| 🏷️ **Étiquette de version + chip de mise à jour** | Version actuelle à côté du titre ; vérifie GitHub une fois par jour et affiche `New version available` quand une nouvelle release sort |
| 🧲 **Glisser une sélection multiple** | Glissez toute la sélection sur le canvas — un nœud natif par asset, disposés automatiquement en grille |
| 📦 **Télécharger la sélection** | Sélectionnez n'importe quel mélange d'images, vidéos, audio et 3D, puis `Download Selected` — plusieurs fichiers arrivent dans un seul ZIP, un fichier seul tel quel |
| 📝 **Exporter les prompts**  [local draft](README.md#local-draft-features) | Sélectionnez des images puis `Export Prompts` — une image donne `<nom>.txt` avec son prompt, plusieurs donnent un seul ZIP avec un `.txt` du même nom par image |
| 📋 **Copier les chemins**  [local draft](README.md#local-draft-features) | `Copy Path` dans la visionneuse, ou sélectionnez des fichiers puis `Copy Paths` — chemins complets sur la machine qui exécute ComfyUI, un par ligne |
| 🔔 **Retour d'action** | Notifications quand copier / supprimer / charger / rescanner réussit ou échoue — fini les échecs silencieux |
| 🌍 **Interface localisée** | Suit la langue configurée dans ComfyUI — anglais, russe, chinois et japonais déjà fournis |
| ♿ **Grille accessible** | Sémantique listbox pour lecteurs d'écran avec état de sélection, plus un anneau de focus clavier |

### 📁 Formats pris en charge

- 🖼️ Images : `.png` · `.jpg` · `.jpeg` · `.webp` · `.avif` · `.tif` · `.tiff` · `.exr`
- 🎬 Vidéos : `.mp4` · `.mov` · `.webm` · `.prores` · `.mkv` · `.avi` · `.m4v`
- 🔁 Les formats que le navigateur ne sait pas afficher (ProRes, HEVC, AVI, MKV, EXR, TIFF) sont lus et affichés dans la visionneuse via une copie créée à la demande par ffmpeg ; le fichier d'origine n'est jamais modifié
- 🎵 Audio : `.mp3` · `.wav` · `.flac` · `.opus` · `.ogg`
- 🎲 3D : `.glb` · `.obj`
- 📜 Workflows : `.json`

### 🚀 Démarrage rapide

#### Recommandé — via Comfy Registry

…ou recherchez **Timesaver Artius Browser** dans **ComfyUI Manager**.

#### Installation manuelle

```bash
git clone https://github.com/AlexYez/comfyui-artius-browser \
  ComfyUI/custom_nodes/comfyui-artius-browser
pip install -r ComfyUI/custom_nodes/comfyui-artius-browser/requirements.txt
```

Puis **redémarrez ComfyUI** et faites un **rafraîchissement forcé** du navigateur avec `Ctrl+F5`.

> 💡 **FFmpeg** (`ffmpeg` + `ffprobe`) génère les métadonnées vidéo/audio et les formes d'onde — optionnel (ComfyUI démarre quand même sans), mais recommandé :
>
> - **Windows :** `winget install ffmpeg` (ou `choco install ffmpeg`)
> - **macOS :** `brew install ffmpeg`
> - **Linux :** `sudo apt install ffmpeg`
>
> Redémarrez ComfyUI après l'installation, puis vérifiez avec `ffmpeg -version`.

### ⌨️ Clavier et boutons de carte

#### Clavier — grille d'assets

| Touche | Action |
|:---:|---|
| <kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd> <kbd>↓</kbd> | Déplacer la sélection |
| <kbd>Enter</kbd> | Ouvrir la lightbox *(dans l'onglet `Workflows`, charger le workflow)* |

#### Clavier — lightbox

| Touche | Action |
|:---:|---|
| <kbd>Esc</kbd> | Fermer |
| <kbd>←</kbd> <kbd>→</kbd> | Asset précédent / suivant *(image par image en mode comparaison vidéo)* |
| <kbd>↑</kbd> <kbd>↓</kbd> | Avancer d'une image vidéo |
| <kbd>Home</kbd> <kbd>End</kbd> | Première / dernière image de la vidéo (en comparaison, celle de chaque clip) ; la lecture en boucle est désactivée par défaut |
| <kbd>Delete</kbd> | Envoyer à la corbeille système |

#### Boutons de la carte

> Ce sont des **boutons sur la carte** (au survol), pas des raccourcis clavier.

| Bouton | Action |
|:---:|---|
| `P` | Copier le prompt |
| `W` | Copier le workflow *(uniquement quand le PNG contient vraiment des données de workflow)* |
| `D` | Télécharger |
| `X` | Envoyer à la corbeille système *(uniquement là où le root autorise la suppression)* |

#### Boutons de la carte workflow

| Bouton | Action |
|:---:|---|
| `L` · double-clic | Charger le workflow dans ComfyUI |
| `D` | Télécharger le JSON du workflow |
| `X` | Envoyer à la corbeille le workflow + sidecars d'aperçu correspondants |

### 🎯 Intégration native avec ComfyUI

Ce pack ne réinvente pas les loaders — il route le glisser-déposer vers les nœuds natifs :

| Type d'asset | Nœud natif |
|---|---|
| Image | `LoadImage` |
| Vidéo | `LoadVideo` |
| Audio | `LoadAudio` |
| 3D | `Load 3D & Animation` / `Load3D` |
| Workflow | Loader natif du frontend |

Les fichiers 3D sont automatiquement préparés dans le stockage d'input de ComfyUI, de sorte que les nœuds 3D natifs les voient exactement comme des fichiers sélectionnés depuis l'UI du nœud. L'onglet `Workflows` lit `workflows` ([userdata](README.md#released-and-local-changes)) directement — pas de cache séparé, pas d'index parallèle.

Si un autre pack installé publie un meilleur loader, c'est lui qui gagne : une vidéo déposée sur le canvas devient un nœud **TS Video Loader** (de `comfyui-timesaver`) qui lit le fichier là où il se trouve déjà, au lieu d'en copier un dans `input/`. Sans ce pack, le nœud natif est créé exactement comme ci-dessus.

### 🔬 Tour de la lightbox

<details>
<summary><strong>🖼️ Images</strong></summary>

- Zoom à la molette, pan avec le bouton gauche/milieu
- Comparaison **wipe** de 2 images avec slider gauche-droite
- Comparaison **grille 2×2** de 4 images
- Panneaux séparés `Prompt` et `Negative Prompt`
- `Copy Workflow` en un clic quand le PNG le contient
- Ouvrir dans un nouvel onglet, afficher dans le dossier, télécharger, supprimer

</details>

<details>
<summary><strong>🎬 Vidéos</strong></summary>

- Lecture inline avec affichage de l'image courante
- ⬅️ / ➡️ navigation image par image
- Codec, FPS, durée, débit, format, infos piste audio
- Comparaison synchronisée de 2, 3 ou 4 vidéos sélectionnées avec un transport partagé (bouton **Compare**)

</details>

<details>
<summary><strong>🎵 Audio</strong></summary>

- Aperçu de la forme d'onde
- Contrôles de lecture
- Durée · débit · codec · layout des canaux

</details>

<details>
<summary><strong>🎲 3D</strong></summary>

- Viewer 3D natif de ComfyUI dans la lightbox
- Informations techniques du modèle dans la barre latérale
- Pas de feuille de texture factice — c'est le vrai modèle

</details>

### 🧠 Règles des métadonnées PNG

- **Prompt** est lu **uniquement** depuis le champ `Prompt` du PNG
- **Workflow** est lu **uniquement** depuis le champ `Workflow` du PNG
- Les prompts positifs et négatifs sont séparés avant affichage
- Si positif et négatif sont identiques, seul le positif est affiché
- Le **seed** est lu depuis le champ `Prompt` du PNG et affiché dans la lightbox (copiable)

### 🛡️ Compatibilité et sécurité

- L'accès au graph pour le glisser-déposer passe par un adaptateur fin de Comfy — les API actuelles du canvas sont préférées, les chemins legacy de `LiteGraph` sont isolés.
- La recherche d'assets se concentre sur le nom de fichier. Les paramètres de requête `metadata` non pris en charge retournent `400 Bad Request` au lieu d'échouer silencieusement.
- La pagination de la liste d'assets est **keyset-based** (`after_sort` + `after_id`) ; les pages profondes sont en O(1) quelle que soit la taille de la bibliothèque.
- Les images companion (sidecars PNG dont le stem correspond à un asset vidéo / audio / 3D frère) sont masquées via un flag stocké, pas une sous-requête au moment de la requête.
- Les listeners frontend sont démontés explicitement à la fermeture du stage / arrêt du worker.

### ⚡ Notes de performance

- Recherche par nom uniquement · métadonnées compactes · cache d'aperçus compact
- Grille virtualisée · pagination keyset · cache stale-while-revalidate *(LRU 10, TTL 30 s)* pour des bascules instantanées de filtre / tri
- Navigation de workflows uniquement côté frontend · miniatures 3D générées par le frontend et persistées sur disque
- `ffprobe` + `ffmpeg` tournent **en parallèle par asset** (une seule paire Popen)
- FFmpeg / ffprobe: Worker pools par défaut `max(1, min(4, cpu_count() // 2))` — ajustable dans `config.json`
- Poster vidéo : ffmpeg réduit d'avance la taille du frame capturé, PIL termine simplement une petite image avec LANCZOS
- Aperçus WebP écrits avec `method=0` (le plus rapide, visuellement identique à la taille thumbnail)
- Les URL d'aperçu portent le `mtime` du fichier en cache comme cache-buster — pas besoin de rafraîchissement forcé après Rebuild Cache
- Accélérateurs optionnels :
  - `Pillow-SIMD` — implémentation facultative compatible avec Pillow ; la vitesse dépend du traitement.
  - 🚀 `blake3` — déjà dans `requirements.txt`, évite le fallback plus lent `blake2b`

### 🆘 Dépannage

<details>
<summary><strong>Certains aperçus paraissent obsolètes</strong></summary>

Cliquez sur **Rebuild Cache**. Les URL d'aperçu invalident le cache du navigateur automatiquement via un token `mtime`, donc un rafraîchissement forcé n'est généralement pas nécessaire. Si ça reste obsolète, redémarrez ComfyUI et `Ctrl+F5`.

</details>

<details>
<summary><strong>Métadonnées vidéo ou audio manquantes</strong></summary>

Vous n'avez probablement pas `ffmpeg` / `ffprobe` dans le `PATH`. Installez-les et redémarrez.

</details>

<details>
<summary><strong>Je veux une remise à zéro complète</strong></summary>

Utilisez Rebuild Cache pour régénérer l’index et les aperçus. Pour la remise à zéro complète du dossier et les pertes de données, consultez [reset policy](README.md#сброс-индекса-и-полный-сброс).

</details>

### 🗂️ Layout d'exécution

```
ComfyUI/output/.ts_artius_browser/
├── db.sqlite          # index des assets
├── config.json        # paramètres UI + outils (schéma v18)
└── cache/
    ├── thumbnails/
    ├── video_frames/
    ├── waveforms/
    └── placeholders/
```

### 📋 Changelog

Voir [CHANGELOG.md](../CHANGELOG.md). Format : [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
