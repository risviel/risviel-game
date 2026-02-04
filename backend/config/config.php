<?php
// Configurazione generale del sistema
define('BASE_PATH', dirname(__DIR__));
define('UPLOAD_PATH', BASE_PATH . '/uploads/');
define('DATA_PATH', BASE_PATH . '/data/');
define('ASSETS_PATH', dirname(BASE_PATH) . '/assets/');

// Configurazione upload file
define('MAX_FILE_SIZE', 10 * 1024 * 1024); // 10MB
define('ALLOWED_IMAGE_TYPES', ['jpg', 'jpeg', 'png', 'gif', 'webp']);
define('ALLOWED_AUDIO_TYPES', ['mp3', 'wav', 'ogg']);

// Chiave API TinyMCE (sostituire con la propria)
define('TINYMCE_API_KEY', 'your-tinymce-api-key-here');

// Configurazione CORS
function setCorsHeaders() {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization');

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit();
    }
}

// Funzione per rispondere in JSON
function jsonResponse($data, $status = 200) {
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    exit();
}

// Funzione per generare timestamp univoci
function generateTimestamp() {
    return time() . rand(1000, 9999);
}
?>