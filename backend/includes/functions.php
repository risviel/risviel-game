<?php
require_once __DIR__ . '/../config/config.php';

/**
 * Classe per la gestione delle plaques letterarie
 */
class PlaqueManager {
    private $dataFile;

    public function __construct() {
        $this->dataFile = DATA_PATH . 'plaques.json';
        $this->ensureDataFileExists();
    }

    /**
     * Assicura che il file di dati esista
     */
    private function ensureDataFileExists() {
        if (!file_exists(DATA_PATH)) {
            mkdir(DATA_PATH, 0755, true);
        }

        if (!file_exists($this->dataFile)) {
            file_put_contents($this->dataFile, json_encode([], JSON_PRETTY_PRINT));
        }
    }

    /**
     * Ottiene tutte le plaques
     */
    public function getAllPlaques() {
        $content = file_get_contents($this->dataFile);
        return json_decode($content, true) ?: [];
    }

    /**
     * Ottiene una plaque specifica per ID
     */
    public function getPlaque($id) {
        $plaques = $this->getAllPlaques();
        foreach ($plaques as $plaque) {
            if ($plaque['id'] == $id) {
                return $plaque;
            }
        }
        return null;
    }

    /**
     * Salva una plaque (nuova o aggiornamento)
     */
    public function savePlaque($plaqueData) {
        $plaques = $this->getAllPlaques();

        // Se non ha ID, è una nuova plaque
        if (!isset($plaqueData['id']) || empty($plaqueData['id'])) {
            $plaqueData['id'] = $this->getNextId();
            $plaques[] = $plaqueData;
        } else {
            // Aggiorna plaque esistente
            $found = false;
            for ($i = 0; $i < count($plaques); $i++) {
                if ($plaques[$i]['id'] == $plaqueData['id']) {
                    $plaques[$i] = $plaqueData;
                    $found = true;
                    break;
                }
            }
            if (!$found) {
                $plaques[] = $plaqueData;
            }
        }

        return $this->savePlaques($plaques);
    }

    /**
     * Elimina una plaque
     */
    public function deletePlaque($id) {
        $plaques = $this->getAllPlaques();
        $plaque = $this->getPlaque($id);

        // Elimina i file associati
        if ($plaque) {
            $this->deleteAssociatedFiles($plaque);
        }

        $plaques = array_filter($plaques, function($plaque) use ($id) {
            return $plaque['id'] != $id;
        });

        return $this->savePlaques(array_values($plaques));
    }

    /**
     * Elimina i file associati a una plaque
     */
    private function deleteAssociatedFiles($plaque) {
        $fileFields = [
            'image', 'audio', 'locationImage', 'locationImageLowRes',
            'locationMaskImage', 'locationBlurMaskImage',
            'locationBlurMaskSolvedImage', 'locationImageSolvedImage',
            'locationImageSolvedImageLowRes'
        ];

        foreach ($fileFields as $field) {
            if (!empty($plaque[$field]) && strpos($plaque[$field], 'uploads/') === 0) {
                FileUploader::deleteFile($plaque[$field]);
            }
        }
    }

    /**
     * Salva l'array delle plaques su file
     */
    private function savePlaques($plaques) {
        $json = json_encode($plaques, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
        return file_put_contents($this->dataFile, $json) !== false;
    }

    /**
     * Ottiene il prossimo ID disponibile
     */
    private function getNextId() {
        $plaques = $this->getAllPlaques();
        $maxId = 0;
        foreach ($plaques as $plaque) {
            if ($plaque['id'] > $maxId) {
                $maxId = $plaque['id'];
            }
        }
        return $maxId + 1;
    }

    /**
     * Esporta le plaques in formato JavaScript
     */
    public function exportToJavaScript() {
        $plaques = $this->getAllPlaques();
        $js = "const plaques = " . json_encode($plaques, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . ";";
        return $js;
    }
}

/**
 * Classe per la gestione dell'upload dei file
 */
class FileUploader {
    /**
     * Upload di un'immagine
     */
    public static function uploadImage($file, $subfolder = 'images') {
        return self::uploadFile($file, $subfolder, ALLOWED_IMAGE_TYPES);
    }

    /**
     * Upload di un file audio
     */
    public static function uploadAudio($file, $subfolder = 'audio') {
        return self::uploadFile($file, $subfolder, ALLOWED_AUDIO_TYPES);
    }

    /**
     * Upload generico di file
     */
    private static function uploadFile($file, $subfolder, $allowedTypes) {
        if (!isset($file['tmp_name']) || !is_uploaded_file($file['tmp_name'])) {
            throw new Exception('File non valido');
        }

        if ($file['size'] > MAX_FILE_SIZE) {
            throw new Exception('File troppo grande (max ' . (MAX_FILE_SIZE / 1024 / 1024) . 'MB)');
        }

        $extension = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        if (!in_array($extension, $allowedTypes)) {
            throw new Exception('Tipo di file non supportato: ' . $extension);
        }

        $uploadDir = UPLOAD_PATH . $subfolder . '/';
        if (!file_exists($uploadDir)) {
            mkdir($uploadDir, 0755, true);
        }

        $filename = time() . '_' . uniqid() . '.' . $extension;
        $filepath = $uploadDir . $filename;

        if (!move_uploaded_file($file['tmp_name'], $filepath)) {
            throw new Exception('Errore durante il caricamento del file');
        }

        return 'uploads/' . $subfolder . '/' . $filename;
    }

    /**
     * Elimina un file dal filesystem
     */
    public static function deleteFile($filepath) {
        $fullPath = BASE_PATH . '/' . $filepath;
        if (file_exists($fullPath)) {
            return unlink($fullPath);
        }
        return true;
    }
}
?>