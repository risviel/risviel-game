<?php
/**
 * Classe per la validazione dei dati delle plaques
 */
class PlaqueValidator {
    /**
     * Valida i dati di una plaque
     */
    public static function validate($data) {
        $errors = [];

        // Validazione titolo
        if (empty($data['title'])) {
            $errors[] = 'Il titolo è obbligatorio';
        } elseif (strlen($data['title']) > 255) {
            $errors[] = 'Il titolo non può superare i 255 caratteri';
        }

        // Validazione coordinate
        if (!isset($data['lat']) || !is_numeric($data['lat'])) {
            $errors[] = 'Latitudine non valida';
        } elseif ($data['lat'] < -90 || $data['lat'] > 90) {
            $errors[] = 'Latitudine deve essere compresa tra -90 e 90';
        }

        if (!isset($data['lng']) || !is_numeric($data['lng'])) {
            $errors[] = 'Longitudine non valida';
        } elseif ($data['lng'] < -180 || $data['lng'] > 180) {
            $errors[] = 'Longitudine deve essere compresa tra -180 e 180';
        }

        // Validazione raggio
        if (!isset($data['radius']) || !is_numeric($data['radius']) || $data['radius'] < 1) {
            $errors[] = 'Raggio deve essere un numero positivo maggiore di 0';
        }

        // Validazione parole mancanti
        if (!isset($data['missingWords']) || !is_array($data['missingWords'])) {
            $errors[] = 'Parole mancanti devono essere un array';
        }

        // Validazione aree offuscate
        if (!isset($data['blur_areas']) || !is_array($data['blur_areas'])) {
            $errors[] = 'Aree offuscate devono essere un array';
        } else {
            foreach ($data['blur_areas'] as $index => $area) {
                if (!isset($area['top']) || !isset($area['left']) ||
                    !isset($area['width']) || !isset($area['height'])) {
                    $errors[] = "Area offuscata #" . ($index + 1) . " incompleta";
                } elseif ($area['top'] < 0 || $area['left'] < 0 ||
                         $area['width'] <= 0 || $area['height'] <= 0) {
                    $errors[] = "Area offuscata #" . ($index + 1) . " ha valori non validi";
                }
            }
        }

        // Validazione titolo location
        if (isset($data['locationTitle']) && strlen($data['locationTitle']) > 255) {
            $errors[] = 'Il titolo della location non può superare i 255 caratteri';
        }

        return $errors;
    }

    /**
     * Sanitizza i dati di input
     */
    public static function sanitize($data) {
        $sanitized = [];

        // Campi numerici
        $sanitized['id'] = isset($data['id']) ? (int)$data['id'] : null;
        $sanitized['lat'] = (float)$data['lat'];
        $sanitized['lng'] = (float)$data['lng'];
        $sanitized['radius'] = (int)$data['radius'];

        // Campi testo
        $sanitized['title'] = htmlspecialchars(trim($data['title']), ENT_QUOTES, 'UTF-8');
        $sanitized['locationTitle'] = isset($data['locationTitle']) ?
            htmlspecialchars(trim($data['locationTitle']), ENT_QUOTES, 'UTF-8') : '';

        // Campi file
        $fileFields = [
            'image', 'audio', 'locationImage', 'locationImageLowRes',
            'locationMaskImage', 'locationBlurMaskImage',
            'locationBlurMaskSolvedImage', 'locationImageSolvedImage',
            'locationImageSolvedImageLowRes'
        ];

        foreach ($fileFields as $field) {
            $sanitized[$field] = isset($data[$field]) ? trim($data[$field]) : '';
        }

        // Campo boolean
        $sanitized['isLastPlaque'] = isset($data['isLastPlaque']) ? (bool)$data['isLastPlaque'] : false;

        // Array di parole
        $sanitized['missingWords'] = isset($data['missingWords']) && is_array($data['missingWords']) ?
            array_map('trim', array_filter($data['missingWords'])) : [];

        // Array di aree offuscate
        $sanitized['blurAreas'] = [];
        if (isset($data['blurAreas']) && is_array($data['blurAreas'])) {
            foreach ($data['blurAreas'] as $area) {
                if (isset($area['top'], $area['left'], $area['width'], $area['height'])) {
                    $sanitized['blurAreas'][] = [
                        'top' => (int)$area['top'],
                        'left' => (int)$area['left'],
                        'width' => (int)$area['width'],
                        'height' => (int)$area['height']
                    ];
                }
            }
        }

        // Campo HTML (descrizione location)
        $sanitized['locationDescription'] = isset($data['locationDescription']) ?
            $data['locationDescription'] : ''; // HTML consentito da TinyMCE
        
        return $sanitized;
    }
}
?>