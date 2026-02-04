<?php
/**
 * API endpoint per la gestione del gioco
 */

require_once '../config/database.php';
require_once '../includes/functions.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Gestisce preflight OPTIONS
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

try {
    $method = $_SERVER['REQUEST_METHOD'];
    $input = json_decode(file_get_contents('php://input'), true);

    switch ($method) {
        case 'GET':
            handleGetRequest();
            break;
        case 'POST':
            handlePostRequest($input);
            break;
        default:
            throw new Exception('Metodo non supportato');
    }

} catch (Exception $e) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => $e->getMessage()
    ]);
}

/**
 * Gestisce le richieste GET
 */
function handleGetRequest() {
    $action = $_GET['action'] ?? 'stats';

    switch ($action) {
        case 'stats':
            getGameStats();
            break;
        case 'progress':
            getGameProgress();
            break;
        default:
            throw new Exception('Azione non valida');
    }
}

/**
 * Gestisce le richieste POST
 */
function handlePostRequest($input) {
    if (!$input || !isset($input['action'])) {
        throw new Exception('Dati non validi');
    }

    switch ($input['action']) {
        case 'save_progress':
            saveGameProgress($input);
            break;
        case 'get_leaderboard':
            getLeaderboard();
            break;
        default:
            throw new Exception('Azione non valida');
    }
}

/**
 * Salva il progresso del gioco
 */
function saveGameProgress($input) {
    if (!isset($input['plaque_id'])) {
        throw new Exception('ID plaque mancante');
    }

    $plaqueId = (int) $input['plaque_id'];
    $timestamp = $input['timestamp'] ?? time() * 1000;
    $sessionId = $input['session_id'] ?? session_id() ?: generateSessionId();

    // Verifica che la plaque esista
    $plaques = loadPlaques();
    $plaque = null;
    foreach ($plaques as $p) {
        if ($p['id'] === $plaqueId) {
            $plaque = $p;
            break;
        }
    }

    if (!$plaque) {
        throw new Exception('Plaque non trovata');
    }

    // Salva nel file di log del gioco
    $logData = [
        'session_id' => $sessionId,
        'plaque_id' => $plaqueId,
        'plaque_title' => $plaque['title'],
        'timestamp' => $timestamp,
        'completed_at' => date('Y-m-d H:i:s'),
        'ip_address' => $_SERVER['REMOTE_ADDR'] ?? 'unknown'
    ];

    saveGameLog($logData);

    // Aggiorna le statistiche
    updateGameStats($plaqueId);

    echo json_encode([
        'success' => true,
        'message' => 'Progresso salvato',
        'session_id' => $sessionId
    ]);
}

/**
 * Ottiene le statistiche del gioco
 */
function getGameStats() {
    $statsFile = '../data/game_stats.json';

    if (!file_exists($statsFile)) {
        $stats = [
            'total_sessions' => 0,
            'total_completions' => 0,
            'plaques_stats' => [],
            'last_updated' => date('Y-m-d H:i:s')
        ];
    } else {
        $stats = json_decode(file_get_contents($statsFile), true) ?: [];
    }

    echo json_encode([
        'success' => true,
        'data' => $stats
    ]);
}

/**
 * Ottiene il progresso del gioco per una sessione
 */
function getGameProgress() {
    $sessionId = $_GET['session_id'] ?? session_id();

    if (!$sessionId) {
        throw new Exception('Session ID mancante');
    }

    $logFile = '../data/game_log.json';
    $progress = [];

    if (file_exists($logFile)) {
        $logs = json_decode(file_get_contents($logFile), true) ?: [];

        // Filtra per session ID
        foreach ($logs as $log) {
            if ($log['session_id'] === $sessionId) {
                $progress[] = [
                    'plaque_id' => $log['plaque_id'],
                    'completed_at' => $log['completed_at']
                ];
            }
        }
    }

    echo json_encode([
        'success' => true,
        'data' => $progress
    ]);
}

/**
 * Ottiene la classifica
 */
function getLeaderboard() {
    $logFile = '../data/game_log.json';
    $leaderboard = [];

    if (file_exists($logFile)) {
        $logs = json_decode(file_get_contents($logFile), true) ?: [];

        // Raggruppa per sessione
        $sessions = [];
        foreach ($logs as $log) {
            $sessionId = $log['session_id'];
            if (!isset($sessions[$sessionId])) {
                $sessions[$sessionId] = [];
            }
            $sessions[$sessionId][] = $log;
        }

        // Calcola statistiche per sessione
        foreach ($sessions as $sessionId => $sessionLogs) {
            if (count($sessionLogs) > 0) {
                $firstLog = min(array_column($sessionLogs, 'timestamp'));
                $lastLog = max(array_column($sessionLogs, 'timestamp'));
                $duration = ($lastLog - $firstLog) / 1000 / 60; // minuti

                $leaderboard[] = [
                    'session_id' => substr($sessionId, 0, 8),
                    'plaques_found' => count($sessionLogs),
                    'duration_minutes' => round($duration, 1),
                    'completed_at' => date('Y-m-d H:i', $lastLog / 1000)
                ];
            }
        }

        // Ordina per numero di plaques trovate e durata
        usort($leaderboard, function($a, $b) {
            if ($a['plaques_found'] === $b['plaques_found']) {
                return $a['duration_minutes'] <=> $b['duration_minutes'];
            }
            return $b['plaques_found'] <=> $a['plaques_found'];
        });

        // Prendi i primi 10
        $leaderboard = array_slice($leaderboard, 0, 10);
    }

    echo json_encode([
        'success' => true,
        'data' => $leaderboard
    ]);
}

/**
 * Salva il log del gioco
 */
function saveGameLog($logData) {
    $logFile = '../data/game_log.json';

    $logs = [];
    if (file_exists($logFile)) {
        $logs = json_decode(file_get_contents($logFile), true) ?: [];
    }

    $logs[] = $logData;

    // Mantieni solo gli ultimi 1000 log
    if (count($logs) > 1000) {
        $logs = array_slice($logs, -1000);
    }

    file_put_contents($logFile, json_encode($logs, JSON_PRETTY_PRINT));
}

/**
 * Aggiorna le statistiche del gioco
 */
function updateGameStats($plaqueId) {
    $statsFile = '../data/game_stats.json';

    $stats = [];
    if (file_exists($statsFile)) {
        $stats = json_decode(file_get_contents($statsFile), true) ?: [];
    }

    // Inizializza se necessario
    if (!isset($stats['total_completions'])) {
        $stats['total_completions'] = 0;
    }
    if (!isset($stats['plaques_stats'])) {
        $stats['plaques_stats'] = [];
    }

    // Incrementa contatori
    $stats['total_completions']++;

    if (!isset($stats['plaques_stats'][$plaqueId])) {
        $stats['plaques_stats'][$plaqueId] = 0;
    }
    $stats['plaques_stats'][$plaqueId]++;

    $stats['last_updated'] = date('Y-m-d H:i:s');

    file_put_contents($statsFile, json_encode($stats, JSON_PRETTY_PRINT));
}

/**
 * Genera un session ID univoco
 */
function generateSessionId() {
    return uniqid('game_', true);
}

?>