
// Configurazione globale
const CONFIG = {
    API_BASE: '../api',
    UPLOAD_ENDPOINT: '../api/upload.php',
    PLAQUES_ENDPOINT: '../api/plaques.php',
    EXPORT_ENDPOINT: '../api/export.php',
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    ALLOWED_IMAGE_TYPES: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    ALLOWED_AUDIO_TYPES: ['mp3', 'wav', 'ogg']
};

// Stato globale dell'applicazione
let appState = {
    isLoading: false,
    currentPlaque: null,
    uploadQueue: [],
    formData: {},
    validationErrors: []
};

// Variabili globali per la mappa
let editMap = null;
let currentMarker = null;
let radiusCircle = null;

// Utility Functions
const Utils = {
    /**
     * Mostra un messaggio di notifica
     */
    showNotification(message, type = 'info', duration = 5000) {
        const container = document.getElementById('notifications') || this.createNotificationContainer();

        const notification = document.createElement('div');
        notification.className = `alert alert-${type} fade-in`;
        notification.innerHTML = `
            <span>${message}</span>
            <button onclick="this.parentElement.remove()" style="float: right; background: none; border: none; font-size: 18px; cursor: pointer;">&times;</button>
        `;

        container.appendChild(notification);

        // Auto-remove dopo duration
        setTimeout(() => {
            if (notification.parentElement) {
                notification.style.animation = 'fadeOut 0.3s ease-out';
                setTimeout(() => notification.remove(), 300);
            }
        }, duration);
    },

    /**
     * Crea il container per le notifiche se non esiste
     */
    createNotificationContainer() {
        const container = document.createElement('div');
        container.id = 'notifications';
        container.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            max-width: 400px;
            width: 100%;
        `;
        document.body.appendChild(container);
        return container;
    },

    /**
     * Formatta le dimensioni dei file
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    /**
     * Valida un file prima dell'upload
     */
    validateFile(file, type) {
        const errors = [];

        if (file.size > CONFIG.MAX_FILE_SIZE) {
            errors.push(`File troppo grande. Massimo ${this.formatFileSize(CONFIG.MAX_FILE_SIZE)}`);
        }

        const extension = file.name.split('.').pop().toLowerCase();
        const allowedTypes = type === 'audio' ? CONFIG.ALLOWED_AUDIO_TYPES : CONFIG.ALLOWED_IMAGE_TYPES;

        if (!allowedTypes.includes(extension)) {
            errors.push(`Tipo di file non supportato: ${extension}`);
        }

        return errors;
    },

    /**
     * Debounce function per evitare chiamate eccessive
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    /**
     * Converte FormData in oggetto normale
     */
    formDataToObject(formData) {
        const obj = {};
        for (let [key, value] of formData.entries()) {
            if (obj[key]) {
                if (Array.isArray(obj[key])) {
                    obj[key].push(value);
                } else {
                    obj[key] = [obj[key], value];
                }
            } else {
                obj[key] = value;
            }
        }
        return obj;
    }
};

// API Functions
const API = {
    /**
     * Chiamata generica all'API
     */
    async request(endpoint, options = {}) {
        // Assicurati che l'endpoint inizi con /
        if (!endpoint.startsWith('/')) {
            endpoint = '/' + endpoint;
        }

        const url = CONFIG.API_BASE + endpoint;
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const config = { ...defaultOptions, ...options };

        try {
            appState.isLoading = true;
            console.log(`🔄 API Request: ${url}`);

            const response = await fetch(url, config);

            // Controlla se la risposta è JSON
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const textResponse = await response.text();
                console.error('❌ Non-JSON Response:', textResponse);
                throw new Error('Risposta del server non valida (non JSON)');
            }

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `HTTP ${response.status}: ${response.statusText}`);
            }

            console.log('✅ API Success:', data);
            return data;
        } catch (error) {
            console.error('❌ API Error:', error);
            throw error;
        } finally {
            appState.isLoading = false;
        }
    },

    /**
     * Ottiene tutte le plaques
     */
    async getPlaques() {
        return this.request('/plaques.php');
    },

    /**
     * Ottiene una plaque specifica
     */
    async getPlaque(id) {
        return this.request(`/plaques.php?id=${id}`);
    },

    /**
     * Salva una plaque (POST per nuova, PUT per aggiornamento)
     */
    async savePlaque(plaqueData) {
        const method = plaqueData.id ? 'PUT' : 'POST';
        return this.request('/plaques.php', {
            method,
            body: JSON.stringify(plaqueData)
        });
    },

    /**
     * Elimina una plaque
     */
    async deletePlaque(id) {
        return this.request(`/plaques.php?id=${id}`, {
            method: 'DELETE'
        });
    },

    /**
     * Upload di un file
     */
    async uploadFile(file, type) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', type);

        try {
            const response = await fetch(CONFIG.UPLOAD_ENDPOINT, {
                method: 'POST',
                body: formData
            });

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const textResponse = await response.text();
                console.error('❌ Upload Non-JSON Response:', textResponse);
                throw new Error('Risposta upload non valida');
            }

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Errore durante l\'upload');
            }

            return data;
        } catch (error) {
            console.error('❌ Upload Error:', error);
            throw error;
        }
    }
};

// Form Management
const FormManager = {
    /**
     * Inizializza il form di editing
     */
    init() {
        const form = document.getElementById('plaqueForm');
        if (!form) return;

        // Gestione submit del form
        form.addEventListener('submit', this.handleSubmit.bind(this));

        // Auto-save periodico
        this.setupAutoSave();

        // Validazione real-time
        this.setupValidation();

        // Inizializza TinyMCE se non già fatto
        this.initTinyMCE();
    },

    /**
     * Gestisce il submit del form
     */
    async handleSubmit(event) {
        event.preventDefault();

        const form = event.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;

        try {
            // Mostra loading
            submitBtn.innerHTML = '<span class="spinner"></span> Salvando...';
            submitBtn.disabled = true;

            // Raccogli i dati del form
            const formData = new FormData(form);
            const plaqueData = this.serializeForm(formData);

            // Valida i dati
            const errors = this.validatePlaque(plaqueData);
            if (errors.length > 0) {
                throw new Error('Errori di validazione:\n' + errors.join('\n'));
            }

            // Salva la plaque
            const result = await API.savePlaque(plaqueData);

            Utils.showNotification('Plaque salvata con successo!', 'success');

            // Reindirizza alla lista dopo 1 secondo
            setTimeout(() => {
                window.location.href = 'index.php';
            }, 1000);

        } catch (error) {
            console.error('Save Error:', error);
            Utils.showNotification(error.message, 'error');
        } finally {
            // Ripristina il pulsante
            submitBtn.innerHTML = originalText;
            submitBtn.disabled = false;
        }
    },

    /**
     * Serializza i dati del form in un oggetto
     */
    serializeForm(formData) {
        const data = {};

        // Campi semplici
        for (let [key, value] of formData.entries()) {
            data[key] = value;
        }

        // Conversioni di tipo
        data.id = data.id ? parseInt(data.id) : null;
        data.lat = parseFloat(data.lat);
        data.lng = parseFloat(data.lng);
        data.radius = parseInt(data.radius);
        data.isLastPlaque = formData.has('isLastPlaque');

        // Parole mancanti (una per riga)
        data.missingWords = data.missingWords ?
            data.missingWords.split('\n').map(w => w.trim()).filter(w => w) : [];

        // ⚠️ FIX: blur_areas devono essere gestite come array
        if (data.blur_areas) {
            try {
                // Se è una stringa JSON, parsala
                if (typeof data.blur_areas === 'string') {
                    data.blur_areas = JSON.parse(data.blur_areas);
                }
                // Se non è un array, creane uno vuoto
                if (!Array.isArray(data.blur_areas)) {
                    data.blur_areas = [];
                }
            } catch (e) {
                console.error('❌ Errore parsing blur_areas:', e);
                data.blur_areas = [];
            }
        } else {
            // Se non esiste, inizializza come array vuoto
            data.blur_areas = [];
        }

        // Ottieni contenuto TinyMCE
        if (window.tinymce && tinymce.get('locationDescription')) {
            data.locationDescription = tinymce.get('locationDescription').getContent();
        }

        return data;
    },

    /**
     * Valida i dati della plaque
     */
    validatePlaque(data) {
        const errors = [];

        if (!data.title || data.title.trim().length === 0) {
            errors.push('Il titolo è obbligatorio');
        }

        if (isNaN(data.lat) || data.lat < -90 || data.lat > 90) {
            errors.push('Latitudine non valida (deve essere tra -90 e 90)');
        }

        if (isNaN(data.lng) || data.lng < -180 || data.lng > 180) {
            errors.push('Longitudine non valida (deve essere tra -180 e 180)');
        }

        if (isNaN(data.radius) || data.radius < 1) {
            errors.push('Raggio deve essere un numero positivo');
        }

        return errors;
    },

    /**
     * Setup auto-save (salva in localStorage ogni 30 secondi)
     */
    setupAutoSave() {
        const form = document.getElementById('plaqueForm');
        if (!form) return;

        const autoSave = Utils.debounce(() => {
            const formData = new FormData(form);
            const data = this.serializeForm(formData);
            localStorage.setItem('plaque_draft', JSON.stringify(data));
            console.log('Auto-saved draft');
        }, 30000);

        form.addEventListener('input', autoSave);
        form.addEventListener('change', autoSave);
    },

    /**
     * Setup validazione real-time
     */
    setupValidation() {
        const form = document.getElementById('plaqueForm');
        if (!form) return;

        // Validazione campi numerici
        const numericFields = form.querySelectorAll('input[type="number"]');
        numericFields.forEach(field => {
            field.addEventListener('blur', () => {
                this.validateField(field);
            });
        });

        // Validazione campi richiesti
        const requiredFields = form.querySelectorAll('input[required], textarea[required]');
        requiredFields.forEach(field => {
            field.addEventListener('blur', () => {
                this.validateField(field);
            });
        });
    },

    /**
     * Valida un singolo campo
     */
    validateField(field) {
        const value = field.value.trim();
        let isValid = true;
        let message = '';

        // Rimuovi classi di validazione precedenti
        field.classList.remove('is-valid', 'is-invalid');

        if (field.hasAttribute('required') && !value) {
            isValid = false;
            message = 'Questo campo è obbligatorio';
        } else if (field.type === 'number') {
            const num = parseFloat(value);
            if (isNaN(num)) {
                isValid = false;
                message = 'Deve essere un numero valido';
            } else if (field.min && num < parseFloat(field.min)) {
                isValid = false;
                message = `Valore minimo: ${field.min}`;
            } else if (field.max && num > parseFloat(field.max)) {
                isValid = false;
                message = `Valore massimo: ${field.max}`;
            }
        }

        // Applica stile di validazione
        field.classList.add(isValid ? 'is-valid' : 'is-invalid');

        // Mostra/nascondi messaggio di errore
        let errorMsg = field.parentElement.querySelector('.error-message');
        if (!isValid) {
            if (!errorMsg) {
                errorMsg = document.createElement('small');
                errorMsg.className = 'error-message';
                errorMsg.style.color = 'var(--danger-color)';
                field.parentElement.appendChild(errorMsg);
            }
            errorMsg.textContent = message;
        } else if (errorMsg) {
            errorMsg.remove();
        }

        return isValid;
    },

    /**
     * Popola il form con i dati
     */
    populateForm(data) {
        const form = document.getElementById('plaqueForm');
        if (!form) return;

        // Popola i campi del form
        Object.keys(data).forEach(key => {
            const field = form.querySelector(`[name="${key}"]`);
            if (field) {
                if (field.type === 'checkbox') {
                    field.checked = data[key];
                } else {
                    field.value = data[key];
                }
            }
        });

        // Aggiorna la mappa se presente
        if (editMap && data.lat && data.lng) {
            setTimeout(() => {
                updateMapFromCoordinates();
            }, 100);
        }

        // Gestisce array speciali
        if (data.missingWords && Array.isArray(data.missingWords)) {
            const missingWordsField = form.querySelector('[name="missingWords"]');
            if (missingWordsField) {
                missingWordsField.value = data.missingWords.join('\n');
            }
        }
    },

    /**
     * Inizializza TinyMCE se non già fatto
     */
    initTinyMCE() {
        if (window.tinymce && !tinymce.get('locationDescription')) {
            tinymce.init({
                selector: '#locationDescription',
                height: 300,
                plugins: 'lists link image code table emoticons',
                toolbar: 'undo redo | formatselect | bold italic underline | alignleft aligncenter alignright | bullist numlist | link image | table | emoticons | code',
                content_css: 'assets/css/admin.css',
                menubar: false,
                branding: false,
                language: 'it',
                setup: function(editor) {
                    editor.on('change', function() {
                        // Trigger auto-save quando cambia il contenuto
                        editor.save();
                    });
                }
            });
        }
    }
};

// File Upload Management
const UploadManager = {
    /**
     * Upload di un file con preview
     */
    async uploadFile(input, type, previewId) {
        const file = input.files[0];
        if (!file) return;

        // Valida il file
        const errors = Utils.validateFile(file, type);
        if (errors.length > 0) {
            Utils.showNotification(errors.join('\n'), 'error');
            input.value = '';
            return;
        }

        const previewContainer = document.getElementById(previewId);

        // Trova il campo hidden corretto basandosi sul name dell'input
        const fieldName = input.getAttribute('name') || input.id;
        const hiddenInput = input.parentElement.querySelector(`input[name="${fieldName}"]`) ||
                           input.parentElement.querySelector('input[type="hidden"]');

        console.log('🔄 Upload file:', {
            filename: file.name,
            type: type,
            fieldName: fieldName,
            hiddenInput: hiddenInput
        });

        try {
            // Mostra loading
            this.showUploadProgress(previewContainer, true);

            // Upload del file
            const result = await API.uploadFile(file, type);

            console.log('✅ Upload result:', result);

            // Aggiorna il campo hidden con il percorso del file
            if (hiddenInput) {
                hiddenInput.value = result.filepath;
                console.log('📝 Updated hidden input value:', result.filepath);

                // Trigger change event per assicurarsi che il form sappia del cambiamento
                hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
            } else {
                console.error('❌ Hidden input not found for field:', fieldName);
            }

            // Mostra preview
            this.showPreview(previewContainer, result, type);

            Utils.showNotification(`File caricato: ${result.filename}`, 'success');

        } catch (error) {
            console.error('❌ Upload failed:', error);
            Utils.showNotification(`Errore upload: ${error.message}`, 'error');
            input.value = '';
        } finally {
            this.showUploadProgress(previewContainer, false);
        }
    },

    /**
     * Mostra preview del file caricato
     */
    showPreview(container, result, type) {
        // Rimuovi preview esistente
        const existingPreview = container.querySelector('.preview-content');
        if (existingPreview) {
            existingPreview.remove();
        }

        // Crea nuovo preview
        const preview = document.createElement('div');
        preview.className = 'preview-content';

        if (type === 'audio') {
            preview.innerHTML = `
                <div class="audio-preview">
                    <audio controls style="width: 100%; margin-bottom: 10px;">
                        <source src="../${result.filepath}" type="${result.mimetype}">
                        Il tuo browser non supporta l'audio HTML5.
                    </audio>
                    <div class="file-info">
                        <small>📁 ${result.filename}</small>
                        <small>📊 ${Utils.formatFileSize(result.size)}</small>
                    </div>
                    <button type="button" onclick="removeFile('${result.fieldName}')" class="remove-file">❌ Rimuovi</button>
                </div>
            `;
        } else {
            preview.innerHTML = `
                <div class="image-preview">
                    <img src="../${result.filepath}" alt="Preview" style="max-width: 100%; height: auto;">
                    <div class="file-info">
                        <small>📁 ${result.filename}</small>
                        <small>📊 ${Utils.formatFileSize(result.size)}</small>
                    </div>
                    <button type="button" onclick="removeFile('${result.fieldName}')" class="remove-file">❌ Rimuovi</button>
                </div>
            `;
        }

        container.appendChild(preview);
    },

    /**
     * Mostra/nasconde il progress dell'upload
     */
    showUploadProgress(container, show) {
        let progress = container.querySelector('.upload-progress');

        if (show && !progress) {
            progress = document.createElement('div');
            progress.className = 'upload-progress';
            progress.innerHTML = `
                <div class="upload-spinner">
                    <div class="spinner"></div>
                    <span>Caricamento in corso...</span>
                </div>
            `;
            container.appendChild(progress);
        } else if (!show && progress) {
            progress.remove();
        }
    }
};


// Funzioni per la gestione della mappa (spostate fuori dal DOMContentLoaded)

/**
 * Inizializza la mappa per l'editing delle coordinate
 */
function initEditMap() {
    // Verifica che Leaflet sia disponibile
    if (typeof L === 'undefined') {
        console.error('❌ Leaflet non disponibile');
        Utils.showNotification('Errore: Leaflet non caricato', 'error');
        return;
    }

    // Coordinate di default (centro Sardegna/Galtellì)
    const defaultLat = 40.387;
    const defaultLng = 9.617;

    // Ottieni coordinate esistenti dai campi input
    const latInput = document.getElementById('lat');
    const lngInput = document.getElementById('lng');
    const radiusInput = document.getElementById('radius');

    if (!latInput || !lngInput || !radiusInput) {
        console.error('❌ Campi input non trovati nel DOM');
        return;
    }

    const currentLat = parseFloat(latInput.value) || defaultLat;
    const currentLng = parseFloat(lngInput.value) || defaultLng;
    const currentRadius = parseInt(radiusInput.value) || 50;

    console.log(`🗺️ Inizializzazione mappa con coordinate: ${currentLat}, ${currentLng}, raggio: ${currentRadius}m`);

    // Inizializza la mappa
    editMap = L.map('editMap', {
        center: [currentLat, currentLng],
        zoom: 16,
        zoomControl: true
    });

    // Definisci i layer delle mappe
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        name: 'OpenStreetMap'
    });

    const googleSatelliteLayer = L.tileLayer('https://{s}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '© Google Maps',
        name: 'Google Satellite'
    });

    const googleHybridLayer = L.tileLayer('https://{s}.google.com/vt/lyrs=s,h&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '© Google Maps',
        name: 'Google Hybrid'
    });

    const googleStreetsLayer = L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
        attribution: '© Google Maps',
        name: 'Google Streets'
    });

    // Aggiungi il layer di default (OpenStreetMap)
    osmLayer.addTo(editMap);

    // Crea il controllo per switchare tra i layer
    const baseMaps = {
        "🗺️ OpenStreetMap": osmLayer,
        "🛰️ Google Satellite": googleSatelliteLayer,
        "🌍 Google Hybrid": googleHybridLayer,
        "🏙️ Google Streets": googleStreetsLayer
    };

    // Aggiungi il controllo dei layer alla mappa
    L.control.layers(baseMaps).addTo(editMap);

    // Aggiungi controlli personalizzati
    addMapControls();

    // Aggiungi marker iniziale
    addEditMarker(currentLat, currentLng);

    // Aggiungi cerchio del raggio
    updateRadiusCircle(currentRadius);

    // Event listener per click sulla mappa
    editMap.on('click', onMapClick);

    // Event listener per cambio raggio
    radiusInput.addEventListener('input', function() {
        const newRadius = parseInt(this.value) || 50;
        console.log(`🔄 Raggio cambiato: ${newRadius}m`);
        updateRadiusCircle(newRadius);
    });

    // Event listener per cambio manuale delle coordinate
    latInput.addEventListener('input', Utils.debounce(() => {
        updateMapFromInputs();
    }, 500));

    lngInput.addEventListener('input', Utils.debounce(() => {
        updateMapFromInputs();
    }, 500));

    // Event listener per cambio di layer
    editMap.on('baselayerchange', function(e) {
        console.log(`🗺️ Layer cambiato: ${e.name}`);

        // Aggiorna il marker e il cerchio quando cambia il layer
        // per assicurarsi che siano visibili
        setTimeout(() => {
            if (currentMarker) {
                currentMarker.bringToFront();
            }
            if (radiusCircle) {
                radiusCircle.bringToFront();
            }
        }, 100);
    });

    console.log('🗺️ Mappa di editing inizializzata con successo');
}

/**
 * Aggiorna la mappa quando i campi input cambiano manualmente
 */
function updateMapFromInputs() {
    if (!editMap) return;

    const lat = parseFloat(document.getElementById('lat').value);
    const lng = parseFloat(document.getElementById('lng').value);

    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        console.log(`🔄 Aggiornamento mappa da input: ${lat}, ${lng}`);
        editMap.setView([lat, lng], editMap.getZoom());
        addEditMarker(lat, lng);
        updateRadiusCircle();
    }
}

/**
 * Aggiunge controlli personalizzati alla mappa
 */
function addMapControls() {
    const controlsContainer = document.createElement('div');
    controlsContainer.className = 'map-controls';
    controlsContainer.innerHTML = `
        <button type="button" class="btn btn-sm btn-secondary" onclick="centerMapOnItaly()">
            🇮🇹 Italia
        </button>
        <button type="button" class="btn btn-sm btn-secondary" onclick="centerMapOnSardinia()">
            🏝️ Sardegna
        </button>
        <button type="button" class="btn btn-sm btn-primary" onclick="centerMapOnGaltelli()">
            📍 Galtellì
        </button>
        <button type="button" class="btn btn-sm btn-info" onclick="getCurrentLocation()">
            🎯 La Mia Posizione
        </button>
    `;

    // Inserisci i controlli prima della mappa
    const mapContainer = document.getElementById('editMap');
    mapContainer.parentNode.insertBefore(controlsContainer, mapContainer);
}

/**
 * Gestisce il click sulla mappa
 */
function onMapClick(e) {
    const lat = e.latlng.lat;
    const lng = e.latlng.lng;

    console.log(`🖱️ Click sulla mappa: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);

    // Aggiorna marker
    addEditMarker(lat, lng);

    // Aggiorna campi input
    updateCoordinateInputs(lat, lng);

    // Aggiorna cerchio
    updateRadiusCircle();
}

/**
 * Aggiunge o aggiorna il marker di editing
 */
function addEditMarker(lat, lng) {
    // Rimuovi marker esistente
    if (currentMarker) {
        editMap.removeLayer(currentMarker);
    }

    // Crea nuovo marker
    currentMarker = L.marker([lat, lng], {
        draggable: true,
        icon: L.divIcon({
            html: '📍',
            className: 'custom-marker',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        })
    }).addTo(editMap);

    // Event listener per trascinamento
    currentMarker.on('dragend', function(e) {
        const position = e.target.getLatLng();
        console.log(`🖱️ Marker trascinato: ${position.lat.toFixed(6)}, ${position.lng.toFixed(6)}`);
        updateCoordinateInputs(position.lat, position.lng);
        // Aggiorna anche il cerchio quando il marker viene trascinato
        updateRadiusCircle();
    });

    // Tooltip
    currentMarker.bindTooltip('Trascina per riposizionare', {
        permanent: false,
        direction: 'top'
    });

    console.log(`📍 Marker posizionato a: ${lat.toFixed(6)}, ${lng.toFixed(6)}`);
}

/**
 * Aggiorna i campi input delle coordinate
 */
function updateCoordinateInputs(lat, lng) {
    const latInput = document.getElementById('lat');
    const lngInput = document.getElementById('lng');

    if (latInput && lngInput) {
        latInput.value = lat.toFixed(8);
        lngInput.value = lng.toFixed(8);

        console.log(`📝 Coordinate aggiornate: lat=${lat.toFixed(8)}, lng=${lng.toFixed(8)}`);

        // Trigger validation se disponibile
        if (FormManager.validateField) {
            FormManager.validateField(latInput);
            FormManager.validateField(lngInput);
        }

        // Trigger change event per far sapere al form che i valori sono cambiati
        latInput.dispatchEvent(new Event('change', { bubbles: true }));
        lngInput.dispatchEvent(new Event('change', { bubbles: true }));
    } else {
        console.error('❌ Campi lat/lng non trovati nel DOM');
    }
}

/**
 * Aggiorna il cerchio del raggio
 */
function updateRadiusCircle(radius) {
    if (!currentMarker) return;

    // Ottieni raggio dai campi se non specificato
    if (!radius) {
        radius = parseInt(document.getElementById('radius').value) || 50;
    }

    // Rimuovi cerchio esistente
    if (radiusCircle) {
        editMap.removeLayer(radiusCircle);
    }

    // Crea nuovo cerchio
    const position = currentMarker.getLatLng();
    radiusCircle = L.circle(position, {
        radius: radius,
        color: '#2563eb',
        fillColor: '#2563eb',
        fillOpacity: 0.1,
        weight: 2,
        dashArray: '5, 5'
    }).addTo(editMap);

    // Tooltip per il cerchio
    radiusCircle.bindTooltip(`Raggio: ${radius}m`, {
        permanent: false,
        direction: 'center'
    });
}

/**
 * Aggiorna la mappa quando si caricano dati salvati
 */
function updateMapFromCoordinates() {
    if (!editMap) return;

    const lat = parseFloat(document.getElementById('lat').value);
    const lng = parseFloat(document.getElementById('lng').value);
    const radius = parseInt(document.getElementById('radius').value) || 50;

    if (!isNaN(lat) && !isNaN(lng)) {
        editMap.setView([lat, lng], 16);
        addEditMarker(lat, lng);
        updateRadiusCircle(radius);
        console.log(`🗺️ Mappa aggiornata con coordinate: ${lat}, ${lng}`);
    }
}

// Funzioni per i controlli della mappa

/**
 * Centra la mappa sull'Italia
 */
function centerMapOnItaly() {
    if (editMap) {
        editMap.setView([41.8719, 12.5674], 6);
    }
}

/**
 * Centra la mappa sulla Sardegna
 */
function centerMapOnSardinia() {
    if (editMap) {
        editMap.setView([40.1209, 9.0129], 8);
    }
}

/**
 * Centra la mappa su Galtellì
 */
function centerMapOnGaltelli() {
    if (editMap) {
        editMap.setView([40.387, 9.617], 16);
    }
}

/**
 * Ottieni la posizione corrente dell'utente
 */
function getCurrentLocation() {
    if (!navigator.geolocation) {
        Utils.showNotification('Geolocalizzazione non supportata', 'error');
        return;
    }

    Utils.showNotification('Rilevamento posizione...', 'info');

    navigator.geolocation.getCurrentPosition(
        function(position) {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;

            if (editMap) {
                editMap.setView([lat, lng], 16);
                addEditMarker(lat, lng);
                updateCoordinateInputs(lat, lng);
            }

            Utils.showNotification('Posizione rilevata!', 'success');
        },
        function(error) {
            let message = 'Errore nel rilevamento della posizione: ';
            switch (error.code) {
                case error.PERMISSION_DENIED:
                    message += 'Permesso negato';
                    break;
                case error.POSITION_UNAVAILABLE:
                    message += 'Posizione non disponibile';
                    break;
                case error.TIMEOUT:
                    message += 'Timeout';
                    break;
                default:
                    message += 'Errore sconosciuto';
                    break;
            }
            Utils.showNotification(message, 'error');
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 600000
        }
    );
}

// Global Functions (chiamate dagli elementi HTML)

// Funzione globale per l'upload (chiamata dall'HTML)
function uploadFile(input, type, previewId) {
    console.log('📤 uploadFile called:', { input, type, previewId });
    return UploadManager.uploadFile(input, type, previewId);
}

// Funzione globale per rimuovere file (chiamata dai pulsanti di rimozione)
function removeFile(fieldName) {
    console.log('🗑️ Removing file for field:', fieldName);

    // Trova il campo hidden e resettalo
    const hiddenInput = document.querySelector(`input[name="${fieldName}"]`);
    if (hiddenInput) {
        hiddenInput.value = '';
        console.log('✅ Hidden input cleared');

        // Trigger change event
        hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Trova il preview container e rimuovi il contenuto
    const previewContainer = document.getElementById(`${fieldName}-preview`);
    if (previewContainer) {
        const previewContent = previewContainer.querySelector('.preview-content');
        if (previewContent) {
            previewContent.remove();
        }
        console.log('✅ Preview removed');
    }

    // Reset del file input se presente
    const fileInput = document.getElementById(fieldName);
    if (fileInput) {
        fileInput.value = '';
        console.log('✅ File input cleared');
    }
}


/**
 * Modifica una plaque
 */
function editPlaque(id) {
    window.location.href = `edit.php?id=${id}`;
}

/**
 * Anteprima della plaque dal form di editing
 */
function previewPlaqueFromForm() {
    const form = document.getElementById('plaqueForm');
    if (!form) return;

    const formData = new FormData(form);
    const data = FormManager.serializeForm(formData);

    // Apri una nuova finestra con l'anteprima
    const previewWindow = window.open('', '_blank');
    previewWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Anteprima - ${data.title}</title>
            <style>
                body { 
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                    padding: 20px; 
                    background: #f8fafc;
                    margin: 0;
                }
                .preview-container { 
                    max-width: 700px; 
                    margin: 0 auto; 
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                    overflow: hidden;
                }
                .header {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 24px;
                    text-align: center;
                }
                .content {
                    padding: 24px;
                }
                .plaque-image { 
                    width: 100%; 
                    max-width: 500px; 
                    border-radius: 8px;
                    margin: 16px 0;
                    display: block;
                    margin-left: auto;
                    margin-right: auto;
                }
                .section { 
                    background: #f8fafc; 
                    padding: 16px; 
                    margin: 16px 0; 
                    border-radius: 8px;
                    border-left: 4px solid #3b82f6;
                }
                .coordinates { border-left-color: #10b981; }
                .missing-words { border-left-color: #f59e0b; }
                .location-info { border-left-color: #8b5cf6; }
                .section h3 {
                    margin: 0 0 12px 0;
                    color: #1f2937;
                    font-size: 18px;
                }
                .section p {
                    margin: 8px 0;
                    color: #4b5563;
                    line-height: 1.5;
                }
                .badge {
                    display: inline-block;
                    padding: 4px 12px;
                    background: #10b981;
                    color: white;
                    border-radius: 20px;
                    font-size: 14px;
                    font-weight: 600;
                    margin: 8px 0;
                }
                .badge.final {
                    background: #f59e0b;
                }
                .audio-info {
                    background: #ecfdf5;
                    border: 1px solid #10b981;
                    padding: 12px;
                    border-radius: 6px;
                    margin: 12px 0;
                }
                .no-content {
                    color: #9ca3af;
                    font-style: italic;
                }
            </style>
        </head>
        <body>
            <div class="preview-container">
                <div class="header">
                    <h1>${data.title || 'Titolo non inserito'}</h1>
                    ${data.isLastPlaque ? '<span class="badge final">🏆 Ultima Plaque</span>' : ''}
                </div>
                
                <div class="content">
                    ${data.image ? 
                        `<img src="../${data.image}" class="plaque-image" alt="Immagine Plaque">` : 
                        '<p class="no-content">📷 Nessuna immagine caricata</p>'
                    }
                    
                    <div class="section coordinates">
                        <h3>📍 Posizione e Area</h3>
                        <p><strong>Latitudine:</strong> ${data.lat || 'Non specificata'}</p>
                        <p><strong>Longitudine:</strong> ${data.lng || 'Non specificata'}</p>
                        <p><strong>Raggio di ricerca:</strong> ${data.radius || 50}m</p>
                    </div>
                    
                    <div class="section missing-words">
                        <h3>🔤 Parole Mancanti nel Gioco</h3>
                        ${data.missingWords && data.missingWords.length > 0 ? 
                            `<p><strong>${data.missingWords.length} parole:</strong> ${data.missingWords.join(', ')}</p>` :
                            '<p class="no-content">Nessuna parola mancante definita</p>'
                        }
                    </div>
                    
                    ${data.audio ? 
                        `<div class="audio-info">
                            <h4>🔊 File Audio</h4>
                            <p>Audio presente: ${data.audio}</p>
                        </div>` : ''
                    }
                    
                    ${data.locationTitle || data.locationDescription ? 
                        `<div class="section location-info">
                            <h3>🌍 Informazioni Visualizzazione 360°</h3>
                            ${data.locationTitle ? `<h4>${data.locationTitle}</h4>` : ''}
                            ${data.locationDescription ? `<div>${data.locationDescription}</div>` : ''}
                            ${data.locationImage ? `<p>✅ Immagine 360° caricata</p>` : '<p class="no-content">Nessuna immagine 360°</p>'}
                        </div>` : ''
                    }
                </div>
            </div>
            
            <script>
                // Auto-focus sulla finestra
                window.focus();
                
                // Chiudi con ESC
                document.addEventListener('keydown', function(e) {
                    if (e.key === 'Escape') {
                        window.close();
                    }
                });
                
                console.log('📋 Dati plaque:', ${JSON.stringify(data, null, 2)});
            </script>
        </body>
        </html>
    `);

    // Aggiungi il titolo alla finestra dopo che è stata creata
    previewWindow.document.title = `Anteprima - ${data.title || 'Plaque'}`;
}

/**
 * Anteprima di una plaque dalla lista (index.php) - QUESTA È LA FUNZIONE CHIAMATA DAL PHP
 */
function previewPlaque(id) {
    if (!id) {
        Utils.showNotification('❌ ID plaque non valido', 'error');
        return;
    }

    console.log(`🔍 Caricamento anteprima per plaque ID: ${id}`);

    // Carica i dati della plaque e mostra l'anteprima
    API.getPlaque(id)
        .then(data => {
            console.log('📋 Dati plaque ricevuti:', data);
            showPlaquePreview(data);
        })
        .catch(error => {
            console.error('❌ Preview Error:', error);
            Utils.showNotification(`Errore nel caricamento dell'anteprima: ${error.message}`, 'error');
        });
}

/**
 * Mostra l'anteprima di una plaque con i dati caricati
 */
function showPlaquePreview(data) {
    const previewWindow = window.open('', '_blank', 'width=800,height=900,scrollbars=yes,resizable=yes');

    previewWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Anteprima - ${data.title}</title>
            <style>
                body { 
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                    padding: 20px; 
                    background: #f8fafc;
                    margin: 0;
                }
                .preview-container { 
                    max-width: 700px; 
                    margin: 0 auto; 
                    background: white;
                    border-radius: 12px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                    overflow: hidden;
                }
                .header {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 24px;
                    text-align: center;
                }
                .content { padding: 24px; }
                .plaque-image { 
                    width: 100%; 
                    max-width: 500px; 
                    border-radius: 8px;
                    margin: 16px auto;
                    display: block;
                }
                .section { 
                    background: #f8fafc; 
                    padding: 16px; 
                    margin: 16px 0; 
                    border-radius: 8px;
                    border-left: 4px solid #3b82f6;
                }
                .coordinates { border-left-color: #10b981; }
                .missing-words { border-left-color: #f59e0b; }
                .location-info { border-left-color: #8b5cf6; }
                .section h3 {
                    margin: 0 0 12px 0;
                    color: #1f2937;
                    font-size: 18px;
                }
                .badge {
                    display: inline-block;
                    padding: 4px 12px;
                    background: #10b981;
                    color: white;
                    border-radius: 20px;
                    font-size: 14px;
                    font-weight: 600;
                    margin: 8px 0;
                }
                .badge.final { background: #f59e0b; }
                .no-content {
                    color: #9ca3af;
                    font-style: italic;
                }
            </style>
        </head>
        <body>
            <div class="preview-container">
                <div class="header">
                    <h1>${data.title || 'Titolo non inserito'}</h1>
                    ${data.isLastPlaque ? '<span class="badge final">🏆 Ultima Plaque</span>' : ''}
                </div>
                
                <div class="content">
                    ${data.image ? 
                        `<img src="../${data.image}" class="plaque-image" alt="Immagine Plaque">` : 
                        '<p class="no-content">📷 Nessuna immagine</p>'
                    }
                    
                    <div class="section coordinates">
                        <h3>📍 Posizione</h3>
                        <p><strong>Latitudine:</strong> ${data.lat}</p>
                        <p><strong>Longitudine:</strong> ${data.lng}</p>
                        <p><strong>Raggio:</strong> ${data.radius || 50}m</p>
                    </div>
                    
                    <div class="section missing-words">
                        <h3>🔤 Parole Mancanti</h3>
                        ${data.missingWords && data.missingWords.length > 0 ? 
                            `<p><strong>${data.missingWords.length} parole:</strong> ${data.missingWords.join(', ')}</p>` :
                            '<p class="no-content">Nessuna parola mancante</p>'
                        }
                    </div>
                    
                    ${data.locationTitle || data.locationDescription ? 
                        `<div class="section location-info">
                            <h3>🌍 Visualizzazione 360°</h3>
                            ${data.locationTitle ? `<h4>${data.locationTitle}</h4>` : ''}
                            ${data.locationDescription ? `<div>${data.locationDescription}</div>` : ''}
                        </div>` : ''
                    }
                </div>
            </div>
            
            <script>
                window.focus();
                document.addEventListener('keydown', function(e) {
                    if (e.key === 'Escape') window.close();
                });
                console.log('📋 Dati plaque completi:', ${JSON.stringify(data, null, 2)});
            </script>
        </body>
        </html>
    `);

    Utils.showNotification('👁️ Anteprima caricata', 'success');
}

/**
 * Elimina una plaque con conferma
 */
async function deletePlaque(id) {
    if (!id) {
        Utils.showNotification('❌ ID plaque non valido', 'error');
        return;
    }

    const confirmed = confirm(
        '⚠️ Sei sicuro di voler eliminare questa plaque?\n\n' +
        'Questa azione non può essere annullata.'
    );

    if (!confirmed) return;

    try {
        const card = document.querySelector(`[data-id="${id}"]`);
        if (card) {
            card.style.opacity = '0.5';
            card.style.pointerEvents = 'none';
        }

        await API.deletePlaque(id);

        if (card) {
            card.remove();
        }

        Utils.showNotification('✅ Plaque eliminata con successo', 'success');

        setTimeout(() => {
            window.location.reload();
        }, 1500);

    } catch (error) {
        console.error('❌ Delete Error:', error);
        Utils.showNotification(`Errore durante l'eliminazione: ${error.message}`, 'error');

        const card = document.querySelector(`[data-id="${id}"]`);
        if (card) {
            card.style.opacity = '1';
            card.style.pointerEvents = 'auto';
        }
    }
}

/**
 * Esporta i dati in vari formati
 */
async function exportData(format) {
    try {
        Utils.showNotification('📤 Preparando esportazione...', 'info');

        const response = await API.request(`/export.php?format=${format}`);

        if (response.downloadUrl) {
            window.open(response.downloadUrl, '_blank');
        } else if (response.data) {
            downloadFile(response.data, `plaques.${format}`, format);
        }

        Utils.showNotification(`✅ Esportazione ${format.toUpperCase()} completata`, 'success');

    } catch (error) {
        console.error('❌ Export Error:', error);
        Utils.showNotification(`Errore durante l'esportazione: ${error.message}`, 'error');
    }
}

/**
 * Download di un file
 */
function downloadFile(data, filename, format) {
    let content, mimeType;

    switch (format) {
        case 'json':
            content = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
            mimeType = 'application/json';
            break;
        case 'js':
            content = typeof data === 'string' ? data : `const PLAQUES_DATA = ${JSON.stringify(data, null, 2)};`;
            mimeType = 'application/javascript';
            break;
        default:
            content = JSON.stringify(data, null, 2);
            mimeType = 'application/json';
    }

    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
}

/**
 * Apre il gioco principale
 */
function openGame() {
    const gameUrl = '../../index.html';

    const gameWindow = window.open(gameUrl, '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');

    if (!gameWindow) {
        Utils.showNotification('⚠️ Popup bloccato! Apri manualmente: ' + gameUrl, 'warning');
        setTimeout(() => {
            window.open(gameUrl, '_blank');
        }, 2000);
    } else {
        Utils.showNotification('🎮 Gioco aperto in una nuova finestra', 'success');
    }
}

// Inizializzazione principale
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Admin Panel inizializzato');

    // Inizializza il form manager se siamo nella pagina di editing
    if (document.getElementById('plaqueForm')) {
        FormManager.init();
    }

    // Inizializza la mappa se presente
    if (document.getElementById('editMap')) {
        // Attendiamo che Leaflet sia caricato
        if (typeof L !== 'undefined') {
            initEditMap();
        } else {
            // Retry dopo 500ms se Leaflet non è ancora caricato
            setTimeout(() => {
                if (typeof L !== 'undefined') {
                    initEditMap();
                } else {
                    console.error('❌ Leaflet non trovato dopo timeout');
                    Utils.showNotification('Errore nel caricamento della mappa', 'error');
                }
            }, 500);
        }
    }

    // Carica dati se è presente un ID nella URL (modalità edit)
    const urlParams = new URLSearchParams(window.location.search);
    const plaqueId = urlParams.get('id');

    if (plaqueId && document.getElementById('plaqueForm')) {
        API.getPlaque(plaqueId)
            .then(data => {
                FormManager.populateForm(data);
                Utils.showNotification('Dati plaque caricati', 'success');
            })
            .catch(error => {
                console.error('❌ Load Error:', error);
                Utils.showNotification(`Errore nel caricamento: ${error.message}`, 'error');
            });
    }

    // Ripristina draft se disponibile
    if (document.getElementById('plaqueForm') && !plaqueId) {
        const draft = localStorage.getItem('plaque_draft');
        if (draft) {
            try {
                const draftData = JSON.parse(draft);
                if (confirm('È disponibile una bozza salvata. Vuoi ripristinarla?')) {
                    FormManager.populateForm(draftData);
                    Utils.showNotification('Bozza ripristinata', 'info');
                } else {
                    localStorage.removeItem('plaque_draft');
                }
            } catch (error) {
                console.error('❌ Draft Error:', error);
                localStorage.removeItem('plaque_draft');
            }
        }
    }

    console.log('🗺️ Sistema mappa ready');
});