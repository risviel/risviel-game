<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../includes/functions.php';

setCorsHeaders();

$plaqueManager = new PlaqueManager();
$format = $_GET['format'] ?? 'json';

try {
    switch ($format) {
        case 'js':
        case 'javascript':
            header('Content-Type: application/javascript; charset=utf-8');
            header('Content-Disposition: attachment; filename="plaques.js"');
            echo $plaqueManager->exportToJavaScript();
            break;

        case 'json':
        default:
            header('Content-Type: application/json; charset=utf-8');
            header('Content-Disposition: attachment; filename="plaques.json"');
            $plaques = $plaqueManager->getAllPlaques();
            echo json_encode($plaques, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
            break;
    }
} catch (Exception $e) {
    jsonResponse(['error' => 'Errore durante l\'esportazione: ' . $e->getMessage()], 500);
}
?>