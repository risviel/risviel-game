<?php
require_once __DIR__ . '/../config/config.php';
require_once __DIR__ . '/../includes/functions.php';
require_once __DIR__ . '/../includes/validation.php';

setCorsHeaders();

$plaqueManager = new PlaqueManager();
$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        if (isset($_GET['id'])) {
            // Ottieni plaque specifica
            $plaque = $plaqueManager->getPlaque($_GET['id']);
            if ($plaque) {
                jsonResponse($plaque);
            } else {
                jsonResponse(['error' => 'Plaque non trovata'], 404);
            }
        } else {
            // Ottieni tutte le plaques
            $plaques = $plaqueManager->getAllPlaques();
            jsonResponse($plaques);
        }
        break;

    case 'POST':
        // Crea nuova plaque
        $input = json_decode(file_get_contents('php://input'), true);

        if (!$input) {
            jsonResponse(['error' => 'Dati JSON non validi'], 400);
        }

        $errors = PlaqueValidator::validate($input);
        if (!empty($errors)) {
            jsonResponse(['error' => 'Errori di validazione', 'details' => $errors], 400);
        }

        $sanitized = PlaqueValidator::sanitize($input);

        if ($plaqueManager->savePlaque($sanitized)) {
            jsonResponse(['success' => 'Plaque creata con successo', 'data' => $sanitized], 201);
        } else {
            jsonResponse(['error' => 'Errore durante la creazione'], 500);
        }
        break;

    case 'PUT':
        // Aggiorna plaque esistente
        $input = json_decode(file_get_contents('php://input'), true);

        if (!$input || !isset($input['id'])) {
            jsonResponse(['error' => 'ID richiesto per l\'aggiornamento'], 400);
        }

        $errors = PlaqueValidator::validate($input);
        if (!empty($errors)) {
            jsonResponse(['error' => 'Errori di validazione', 'details' => $errors], 400);
        }

        $sanitized = PlaqueValidator::sanitize($input);

        if ($plaqueManager->savePlaque($sanitized)) {
            jsonResponse(['success' => 'Plaque aggiornata con successo', 'data' => $sanitized]);
        } else {
            jsonResponse(['error' => 'Errore durante l\'aggiornamento'], 500);
        }
        break;

    case 'DELETE':
        // Elimina plaque
        if (!isset($_GET['id'])) {
            jsonResponse(['error' => 'ID richiesto per l\'eliminazione'], 400);
        }

        if ($plaqueManager->deletePlaque($_GET['id'])) {
            jsonResponse(['success' => 'Plaque eliminata con successo']);
        } else {
            jsonResponse(['error' => 'Errore durante l\'eliminazione'], 500);
        }
        break;

    default:
        jsonResponse(['error' => 'Metodo HTTP non supportato'], 405);
}
?>