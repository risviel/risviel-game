<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../includes/functions.php';

$plaqueManager = new PlaqueManager();
$plaques = $plaqueManager->getAllPlaques();
?>
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gestione Placche Letterarie</title>
    <link rel="stylesheet" href="assets/css/admin.css">
</head>
<body>
    <div class="container">
        <header>
            <h1>📚 Gestione Placche Letterarie</h1>
            <div class="actions">
                <button onclick="window.open('../../index.html', '_blank')" class="btn btn-success">
                    🎮 Apri Gioco
                </button>
                <button onclick="window.location.href='edit.php'" class="btn btn-primary">
                    ➕ Nuova Plaque
                </button>
                <button onclick="exportData('json')" class="btn btn-secondary">
                    📄 Esporta JSON
                </button>
                <button onclick="exportData('js')" class="btn btn-secondary">
                    🔧 Esporta JS
                </button>
            </div>
        </header>


        <div class="stats">
            <div class="stat-card">
                <h3><?= count($plaques) ?></h3>
                <p>Plaques Totali</p>
            </div>
            <div class="stat-card">
                <h3><?= count(array_filter($plaques, function($p) { return $p['isLastPlaque']; })) ?></h3>
                <p>Plaques Finali</p>
            </div>
            <div class="stat-card">
                <h3><?= count(array_filter($plaques, function($p) { return !empty($p['audio']); })) ?></h3>
                <p>Con Audio</p>
            </div>
            <div class="stat-card">
                <h3><?= count(array_filter($plaques, function($p) { return !empty($p['missingWords']) && count($p['missingWords']) > 0; })) ?></h3>
                <p>Con Parole Mancanti</p>
            </div>
        </div>

        <div class="plaques-grid">
            <?php foreach ($plaques as $plaque): ?>
            <div class="plaque-card" data-id="<?= $plaque['id'] ?>">
                <div class="plaque-image">
                    <?php if (!empty($plaque['image'])): ?>
                        <img src="../<?= htmlspecialchars($plaque['image']) ?>" alt="<?= htmlspecialchars($plaque['title']) ?>">
                    <?php else: ?>
                        <div class="no-image">📷 Nessuna immagine</div>
                    <?php endif; ?>
                </div>

                <div class="plaque-info">
                    <h3><?= htmlspecialchars($plaque['title']) ?></h3>
                    <p class="location">📍 <?= $plaque['lat'] ?>, <?= $plaque['lng'] ?></p>
                    <p class="radius">🎯 Raggio: <?= $plaque['radius'] ?? 50 ?>m</p>
                    <p class="words">🔤 <?= count($plaque['missingWords'] ?? []) ?> parole mancanti</p>

                    <div class="badges">
                        <?php if ($plaque['isLastPlaque']): ?>
                            <span class="badge badge-final">🏆 Ultima Plaque</span>
                        <?php endif; ?>
                        <?php if (!empty($plaque['audio'])): ?>
                            <span class="badge badge-audio">🔊 Audio</span>
                        <?php endif; ?>
                        <?php if (!empty($plaque['locationImage'])): ?>
                            <span class="badge badge-360">🌍 360°</span>
                        <?php endif; ?>
                    </div>
                </div>

                <div class="plaque-actions">
                    <button onclick="editPlaque(<?= $plaque['id'] ?>)" class="btn btn-sm btn-primary">
                        ✏️ Modifica
                    </button>
                    <button onclick="previewPlaque(<?= $plaque['id'] ?>)" class="btn btn-sm btn-info">
                        👁️ Anteprima
                    </button>
                    <button onclick="deletePlaque(<?= $plaque['id'] ?>)" class="btn btn-sm btn-danger">
                        🗑️ Elimina
                    </button>
                </div>
            </div>
            <?php endforeach; ?>
        </div>

        <?php if (empty($plaques)): ?>
        <div class="empty-state">
            <div class="empty-icon">📚</div>
            <h3>Nessuna plaque trovata</h3>
            <p>Inizia creando la tua prima plaque letteraria per il tour guidato</p>
            <button onclick="window.location.href='edit.php'" class="btn btn-primary">
                ➕ Crea Prima Plaque
            </button>
        </div>
        <?php endif; ?>
    </div>

    <script src="assets/js/admin.js"></script>
</body>
</html>