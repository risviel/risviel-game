<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../includes/functions.php';

$plaqueManager = new PlaqueManager();
$plaque = null;
$isEdit = false;

if (isset($_GET['id'])) {
    $plaque = $plaqueManager->getPlaque($_GET['id']);
    $isEdit = true;
}

// Dati di default per nuova plaque
if (!$plaque) {
    $plaque = [
        'id' => '',
        'title' => '',
        'lat' => 40.38686389,
        'lng' => 9.61706111,
        'image' => '',
        'audio' => '',
        'missingWords' => [],
        'radius' => 50,
        'isLastPlaque' => false,
        'locationImage' => '',
        'locationImageLowRes' => '',
        'locationMaskImage' => '',
        'locationBlurMaskImage' => '',
        'locationBlurMaskSolvedImage' => '',
        'locationImageSolvedImage' => '',
        'locationImageSolvedImageLowRes' => '',
        'locationTitle' => '',
        'locationDescription' => ''
    ];
}

// Funzione helper per gestire valori null in htmlspecialchars
function safe_htmlspecialchars($value) {
    return htmlspecialchars($value ?? '', ENT_QUOTES, 'UTF-8');
}
?>
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= $isEdit ? 'Modifica' : 'Nuova' ?> Plaque - Gestione Placche Letterarie</title>

    <!-- Leaflet CSS -->
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossorigin=""/>

    <!-- Admin CSS -->
    <link rel="stylesheet" href="assets/css/admin.css">

    <!-- TinyMCE -->
    <script src="https://cdn.tiny.cloud/1/<?= TINYMCE_API_KEY ?>/tinymce/6/tinymce.min.js"></script>
</head>
<body>
    <div class="container">
        <header>
            <h1><?= $isEdit ? '✏️ Modifica' : '➕ Nuova' ?> Plaque</h1>
            <div class="actions">
                <button onclick="window.location.href='index.php'" class="btn btn-secondary">
                    ← Torna alla Lista
                </button>
                <button onclick="previewPlaqueFromForm()" class="btn btn-info">
                    👁️ Anteprima
                </button>
                <?php if ($isEdit): ?>
                <button onclick="previewPlaque(<?= $plaque['id'] ?>)" class="btn btn-success">
                    👁️ Anteprima Salvata
                </button>
                <?php endif; ?>
            </div>
        </header>

        <form id="plaqueForm" class="plaque-form">
            <input type="hidden" name="id" value="<?= safe_htmlspecialchars($plaque['id']) ?>">

            <!-- Sezione Informazioni Base -->
            <div class="form-section">
                <h3>📋 Informazioni Base</h3>

                <div class="form-group">
                    <label for="title">Titolo della Plaque *</label>
                    <input type="text" id="title" name="title" value="<?= safe_htmlspecialchars($plaque['title']) ?>"
                           placeholder="es. Targa 1 - Il Rifugio tra le Canne" required>
                </div>

                <!-- Mappa per selezionare posizione -->
                <div class="form-group">
                    <label>📍 Posizione sulla Mappa</label>
                    <div class="map-container">
                        <div id="editMap" style="height: 400px; border-radius: 8px; border: 1px solid var(--border-color);"></div>
                        <div class="map-instructions">
                            <small>
                                <strong>Istruzioni:</strong>
                                Clicca sulla mappa per posizionare la plaque.
                                Puoi trascinare il marker per riposizionarlo.
                                Le coordinate si aggiorneranno automaticamente.
                            </small>
                        </div>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label for="lat">Latitudine *</label>
                        <input type="number" id="lat" name="lat" step="any" value="<?= $plaque['lat'] ?? '' ?>"
                               placeholder="40.38686389" required>
                    </div>
                    <div class="form-group">
                        <label for="lng">Longitudine *</label>
                        <input type="number" id="lng" name="lng" step="any" value="<?= $plaque['lng'] ?? '' ?>"
                               placeholder="9.61706111" required>
                    </div>
                    <div class="form-group">
                        <label for="radius">Raggio di Ricerca (metri) *</label>
                        <input type="number" id="radius" name="radius" value="<?= $plaque['radius'] ?? 50 ?>"
                               min="1" max="500" required>
                    </div>
                </div>


                <div class="form-group">
                    <label class="checkbox-label">
                        <input type="checkbox" name="isLastPlaque" <?= !empty($plaque['isLastPlaque']) ? 'checked' : '' ?>>
                        🏆 Questa è l'ultima plaque del percorso
                    </label>
                </div>
            </div>

            <!-- Sezione Media -->
            <div class="form-section">
                <h3>🎨 Media Files</h3>

                <div class="form-group">
                    <label for="image">Immagine della Plaque</label>
                    <div class="file-upload" onclick="document.getElementById('image').click()">
                        <input type="file" id="image" accept="image/*" onchange="uploadFile(this, 'image', 'image-preview')" style="display: none;">
                        <input type="hidden" name="image" value="<?= safe_htmlspecialchars($plaque['image']) ?>">
                        <div class="upload-area">
                            <span>📷 Clicca per caricare un'immagine</span>
                        </div>
                        <div id="image-preview" class="preview">
                            <?php if (!empty($plaque['image'])): ?>
                                <img src="../<?= safe_htmlspecialchars($plaque['image']) ?>" alt="Preview">
                                <button type="button" onclick="removeFile('image')" class="remove-file">❌</button>
                            <?php endif; ?>
                        </div>
                    </div>
                </div>

                <div class="form-group">
                    <label for="audio">File Audio (opzionale)</label>
                    <div class="file-upload" onclick="document.getElementById('audio').click()">
                        <input type="file" id="audio" name="audio" accept="audio/*" onchange="uploadFile(this, 'audio', 'audio-preview')" style="display: none;">
                        <input type="hidden" name="audio" value="<?= safe_htmlspecialchars($plaque['audio']) ?>">
                        <div class="upload-area">
                            <span>🔊 Clicca per caricare un file audio</span>
                        </div>
                        <div id="audio-preview" class="preview">
                            <?php if (!empty($plaque['audio'])): ?>
                                <div class="preview-content">
                                    <div class="audio-preview">
                                        <audio controls style="width: 100%; margin-bottom: 10px;">
                                            <source src="../<?= safe_htmlspecialchars($plaque['audio']) ?>">
                                        </audio>
                                        <div class="file-info">
                                            <small>📁 <?= basename($plaque['audio']) ?></small>
                                        </div>
                                        <button type="button" onclick="removeFile('audio')" class="remove-file">❌ Rimuovi</button>
                                    </div>
                                </div>
                            <?php endif; ?>
                        </div>
                    </div>
                </div>

            </div>

            <!-- Sezione Gioco -->
            <div class="form-section">
                <h3>🎮 Configurazione Gioco</h3>

                <div class="form-group">
                    <label for="missingWords">Parole Mancanti</label>
                    <textarea id="missingWords" name="missingWords" rows="5"
                              placeholder="Inserisci una parola per riga, es:&#10;verde&#10;muraglie&#10;glauco"><?= is_array($plaque['missingWords']) ? implode("\n", $plaque['missingWords']) : safe_htmlspecialchars($plaque['missingWords']) ?></textarea>
                    <small>Una parola per riga. Queste parole saranno nascoste nel testo della plaque.</small>
                </div>

            </div>

            <!-- Sezione Location -->
            <div class="form-section">
                <h3>📍 Informazioni Location</h3>

                <div class="form-group">
                    <label for="locationTitle">Titolo della Location</label>
                    <input type="text" id="locationTitle" name="locationTitle"
                           value="<?= safe_htmlspecialchars($plaque['locationTitle']) ?>"
                           placeholder="es. Il Rifugio tra le Canne e le Rocce">
                </div>

                <div class="form-group">
                    <label for="locationDescription">Descrizione della Location</label>
                    <textarea id="locationDescription" name="locationDescription" rows="8"><?= safe_htmlspecialchars($plaque['locationDescription']) ?></textarea>
                    <small>Descrizione che appare quando l'utente trova la location. Può contenere HTML.</small>
                </div>
            </div>

            <!-- Sezione Immagini Location -->
            <div class="form-section">
                <h3>🖼️ Immagini Location (360° e Maschere)</h3>
                <p class="section-description">Carica le varie versioni delle immagini panoramiche a 360° e le relative maschere per gli effetti di gioco.</p>

                <div class="form-row">
                    <div class="form-group">
                        <label>Immagine Location Principale</label>
                        <div class="file-upload" onclick="document.getElementById('locationImage').click()">
                            <input type="file" id="locationImage" accept="image/*" onchange="uploadFile(this, 'image', 'locationImage-preview')" style="display: none;">
                            <input type="hidden" name="locationImage" value="<?= safe_htmlspecialchars($plaque['locationImage']) ?>">
                            <div class="upload-area"><span>📷</span></div>
                            <div id="locationImage-preview" class="preview">
                                <?php if (!empty($plaque['locationImage'])): ?>
                                    <img src="../<?= safe_htmlspecialchars($plaque['locationImage']) ?>" alt="Preview">
                                    <button type="button" onclick="removeFile('locationImage')" class="remove-file">❌</button>
                                <?php endif; ?>
                            </div>
                        </div>
                    </div>

                    <div class="form-group">
                        <label>Immagine Location Bassa Risoluzione</label>
                        <div class="file-upload" onclick="document.getElementById('locationImageLowRes').click()">
                            <input type="file" id="locationImageLowRes" accept="image/*" onchange="uploadFile(this, 'image', 'locationImageLowRes-preview')" style="display: none;">
                            <input type="hidden" name="locationImageLowRes" value="<?= safe_htmlspecialchars($plaque['locationImageLowRes']) ?>">
                            <div class="upload-area"><span>📷</span></div>
                            <div id="locationImageLowRes-preview" class="preview">
                                <?php if (!empty($plaque['locationImageLowRes'])): ?>
                                    <img src="../<?= safe_htmlspecialchars($plaque['locationImageLowRes']) ?>" alt="Preview">
                                    <button type="button" onclick="removeFile('locationImageLowRes')" class="remove-file">❌</button>
                                <?php endif; ?>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label>Maschera Location</label>
                        <div class="file-upload" onclick="document.getElementById('locationMaskImage').click()">
                            <input type="file" id="locationMaskImage" accept="image/*" onchange="uploadFile(this, 'image', 'locationMaskImage-preview')" style="display: none;">
                            <input type="hidden" name="locationMaskImage" value="<?= safe_htmlspecialchars($plaque['locationMaskImage']) ?>">
                            <div class="upload-area"><span>🎭</span></div>
                            <div id="locationMaskImage-preview" class="preview">
                                <?php if (!empty($plaque['locationMaskImage'])): ?>
                                    <img src="../<?= safe_htmlspecialchars($plaque['locationMaskImage']) ?>" alt="Preview">
                                    <button type="button" onclick="removeFile('locationMaskImage')" class="remove-file">❌</button>
                                <?php endif; ?>
                            </div>
                        </div>
                    </div>

                    <div class="form-group">
                        <label>Maschera Offuscata</label>
                        <div class="file-upload" onclick="document.getElementById('locationBlurMaskImage').click()">
                            <input type="file" id="locationBlurMaskImage" accept="image/*" onchange="uploadFile(this, 'image', 'locationBlurMaskImage-preview')" style="display: none;">
                            <input type="hidden" name="locationBlurMaskImage" value="<?= safe_htmlspecialchars($plaque['locationBlurMaskImage']) ?>">
                            <div class="upload-area"><span>🌫️</span></div>
                            <div id="locationBlurMaskImage-preview" class="preview">
                                <?php if (!empty($plaque['locationBlurMaskImage'])): ?>
                                    <img src="../<?= safe_htmlspecialchars($plaque['locationBlurMaskImage']) ?>" alt="Preview">
                                    <button type="button" onclick="removeFile('locationBlurMaskImage')" class="remove-file">❌</button>
                                <?php endif; ?>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group">
                        <label>Maschera Offuscata Risolta</label>
                        <div class="file-upload" onclick="document.getElementById('locationBlurMaskSolvedImage').click()">
                            <input type="file" id="locationBlurMaskSolvedImage" accept="image/*" onchange="uploadFile(this, 'image', 'locationBlurMaskSolvedImage-preview')" style="display: none;">
                            <input type="hidden" name="locationBlurMaskSolvedImage" value="<?= safe_htmlspecialchars($plaque['locationBlurMaskSolvedImage']) ?>">
                            <div class="upload-area"><span>✨</span></div>
                            <div id="locationBlurMaskSolvedImage-preview" class="preview">
                                <?php if (!empty($plaque['locationBlurMaskSolvedImage'])): ?>
                                    <img src="../<?= safe_htmlspecialchars($plaque['locationBlurMaskSolvedImage']) ?>" alt="Preview">
                                    <button type="button" onclick="removeFile('locationBlurMaskSolvedImage')" class="remove-file">❌</button>
                                <?php endif; ?>
                            </div>
                        </div>
                    </div>

                    <div class="form-group">
                        <label>Immagine Location Risolta</label>
                        <div class="file-upload" onclick="document.getElementById('locationImageSolvedImage').click()">
                            <input type="file" id="locationImageSolvedImage" accept="image/*" onchange="uploadFile(this, 'image', 'locationImageSolvedImage-preview')" style="display: none;">
                            <input type="hidden" name="locationImageSolvedImage" value="<?= safe_htmlspecialchars($plaque['locationImageSolvedImage']) ?>">
                            <div class="upload-area"><span>🎯</span></div>
                            <div id="locationImageSolvedImage-preview" class="preview">
                                <?php if (!empty($plaque['locationImageSolvedImage'])): ?>
                                    <img src="../<?= safe_htmlspecialchars($plaque['locationImageSolvedImage']) ?>" alt="Preview">
                                    <button type="button" onclick="removeFile('locationImageSolvedImage')" class="remove-file">❌</button>
                                <?php endif; ?>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="form-group">
                    <label>Immagine Location Risolta Bassa Risoluzione</label>
                    <div class="file-upload" onclick="document.getElementById('locationImageSolvedImageLowRes').click()">
                        <input type="file" id="locationImageSolvedImageLowRes" accept="image/*" onchange="uploadFile(this, 'image', 'locationImageSolvedImageLowRes-preview')" style="display: none;">
                        <input type="hidden" name="locationImageSolvedImageLowRes" value="<?= safe_htmlspecialchars($plaque['locationImageSolvedImageLowRes']) ?>">
                        <div class="upload-area"><span>📷</span></div>
                        <div id="locationImageSolvedImageLowRes-preview" class="preview">
                            <?php if (!empty($plaque['locationImageSolvedImageLowRes'])): ?>
                                <img src="../<?= safe_htmlspecialchars($plaque['locationImageSolvedImageLowRes']) ?>" alt="Preview">
                                <button type="button" onclick="removeFile('locationImageSolvedImageLowRes')" class="remove-file">❌</button>
                            <?php endif; ?>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Form Actions -->
            <div class="form-actions">
                <button type="button" onclick="saveDraft()" class="btn btn-outline">
                    💾 Salva Bozza
                </button>
                <button type="button" onclick="loadDraft()" class="btn btn-outline">
                    📂 Carica Bozza
                </button>
                <button type="submit" class="btn btn-primary">
                    <?= $isEdit ? '✏️ Aggiorna' : '➕ Crea' ?> Plaque
                </button>
            </div>
        </form>
    </div>

    <!-- Leaflet JS -->
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
            integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo="
            crossorigin=""></script>

    <!-- Admin JS -->
    <script src="assets/js/admin.js"></script>

    <!-- Script di inizializzazione mappa -->
    <script>
        // Assicura che Leaflet sia caricato prima di inizializzare
        document.addEventListener('DOMContentLoaded', function() {
            // Verifica che Leaflet sia disponibile
            if (typeof L === 'undefined') {
                console.error('❌ Leaflet non è stato caricato correttamente');
                return;
            }

            console.log('✅ Leaflet caricato, versione:', L.version);
        });
    </script>
</body>
</html>