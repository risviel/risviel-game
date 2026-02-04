<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../includes/functions.php';

setCorsHeaders();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['error' => 'Solo metodo POST consentito'], 405);
}

try {
    if (!isset($_FILES['file'])) {
        throw new Exception('Nessun file ricevuto nella richiesta');
    }

    $file = $_FILES['file'];
    $type = $_POST['type'] ?? 'image';

    // Verifica errori di upload
    if ($file['error'] !== UPLOAD_ERR_OK) {
        throw new Exception('Errore durante il caricamento del file: ' . $file['error']);
    }

    // Upload del file in base al tipo
    switch ($type) {
        case 'image':
            $filepath = FileUploader::uploadImage($file);
            break;
        case 'audio':
            $filepath = FileUploader::uploadAudio($file);
            break;
        default:
            throw new Exception('Tipo di file non supportato: ' . $type);
    }

    jsonResponse([
        'success' => 'File caricato con successo',
        'filepath' => $filepath,
        'url' => '../' . $filepath,
        'filename' => basename($filepath),
        'type' => $type,
        'size' => $file['size']
    ]);

} catch (Exception $e) {
    jsonResponse(['error' => $e->getMessage()], 400);
}
?>