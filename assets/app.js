// Variabile globale per le placche che verrà popolata dal JSON
let plaques = [];

// Funzione per caricare le placche dal backend
async function loadPlaques() {
    try {
        console.log('📂 Caricamento placche dal backend...');
        const response = await fetch('./backend/data/plaques.json');

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Verifica che i dati siano validi
        if (!Array.isArray(data)) {
            throw new Error('Il file JSON non contiene un array valido');
        }

        plaques = data;
        console.log(`✅ Caricate ${plaques.length} placche dal backend`);

        // Aggiorna il contatore del progresso
        updateProgressDisplay();

        return plaques;
    } catch (error) {
        console.error('❌ Errore nel caricamento delle placche:', error);

        // Fallback: usa le placche hardcoded come backup
        console.log('🔄 Fallback alle placche hardcoded...');
        plaques = getFallbackPlaques();

        showToast('⚠️ Impossibile caricare i dati aggiornati. Usando dati di backup.');

        return plaques;
    }
}
function getFallbackPlaques() {
    return []
}


// Funzione per aggiornare il display del progresso
function updateProgressDisplay() {
    const totalPlaques = plaques.filter(p => !p.isLastPlaque).length;
    const foundPlaques = userProgress.found.length;

    // Aggiorna i contatori nel DOM
    const counterProgress = document.getElementById('counter_progress');
    const ofCounterProgress = document.getElementById('of_counter_progress');

    if (counterProgress) counterProgress.textContent = foundPlaques;
    if (ofCounterProgress) ofCounterProgress.textContent = totalPlaques;
}


// Rilevamento dispositivo mobile
const isMobile = window.innerWidth < 768 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

let map;
let userProgress=JSON.parse(localStorage.getItem("progress"))||{found:[]};
let currentPositionMarker;
let routingControl;
let userPosition;
let isMapInitialized = false; // Flag per tracciare se la mappa è già stata inizializzata
let isRouteCalculating = false; // Flag per tracciare lo stato del calcolo del percorso
let destinationMarker = null;
let fallbackRouteLine = null;
let currentDestination = null; // Aggiungi questa riga


function getCSSVariable(variableName){
    const rootStyles=getComputedStyle(document.documentElement);
    return rootStyles.getPropertyValue(variableName).trim()
}

function isTouch(event){
    return event.touches!==undefined||event instanceof TouchEvent
}

function vibrate(){
    if("vibrate"in navigator){
        navigator.vibrate(50)
    }
}

function resetButtons(){
    document.getElementById("startButton").innerHTML="Inizia l'Avventura";
    if(userProgress.found.length>0){
        document.getElementById("startButton").innerHTML="Continua l'Avventura"
    }
}

// Funzione di inizializzazione principale
async function init(){
    console.log('🚀 Inizializzazione applicazione...');

    // Carica le placche dal backend prima di tutto
    await loadPlaques();

    // Assicurati che le variabili globali siano inizializzate correttamente
    map = undefined;
    isMapInitialized = false;
    currentPositionMarker = undefined;

    resetButtons();
    // Non inizializziamo più la mappa qui, ma la precalcoliamo solo quando serve
    setupEventListeners();
    startWatchingPosition();
}

// Funzione modificata per gestire meglio il rendering del percorso
async function calculateRoute() {
    if (!userPosition) {
        showToast("Attendi il posizionamento GPS...");
        return;
    }

    // Verifica che la mappa e il routing control siano inizializzati
    if (!map || !isMapInitialized) {
        console.log("Mappa non ancora inizializzata, impossibile calcolare il percorso");
        return;
    }

    if (!routingControl) {
        console.error("Routing control non definito, impossibile calcolare il percorso");
        return;
    }

    const nextPlaque = plaques.find(p => !userProgress.found.includes(p.id) && isUnlocked(p.id));

    if (!nextPlaque) {
        showToast("Hai già trovato tutte le targhe!");
        return;
    }

    try {
        console.log("Calcolo percorso da",
                    userPosition.coords.latitude, userPosition.coords.longitude,
                    "a", nextPlaque.lat, nextPlaque.lng);

        // Mostra indicatore di caricamento durante il calcolo
        showLoadingIndicator();

        // Rimuovi il controllo di routing esistente se presente
        if (map.hasLayer(routingControl)) {
            map.removeControl(routingControl);
        }

        // Ricrea il controllo di routing con le impostazioni corrette
        routingControl = L.Routing.control({
            waypoints: [
                L.latLng(userPosition.coords.latitude, userPosition.coords.longitude),
                L.latLng(nextPlaque.lat, nextPlaque.lng)
            ],
            show: false,
            addWaypoints: false,
            draggableWaypoints: false,
            fitSelectedRoutes: 'smart',
            createMarker: function() { return null; },
            lineOptions: {
                styles: [{
                    color: getCSSVariable("--secondary-color"),
                    opacity: 0.8,
                    weight: isMobile ? 4 : 5
                }]
            },
            router: L.Routing.osrmv1({
                serviceUrl: 'https://router.project-osrm.org/route/v1',
                profile: 'walking'
            }),
            routeWhileDragging: !isMobile
        }).addTo(map);

        // Imposta un listener per l'evento di percorso trovato
        routingControl.on('routesfound', function(e) {
            console.log("Percorso trovato:", e.routes);

            // Assicurati che il percorso sia visibile
            setTimeout(() => {
                // Aggiorna la visualizzazione della mappa
                map.invalidateSize();

                // Adatta la mappa per mostrare l'intero percorso, ma con un padding per vedere meglio
                if (e.routes && e.routes.length > 0) {
                    try {
                        // Estrai i limiti del percorso se disponibili
                        if (e.routes[0].bounds) {
                            map.fitBounds(e.routes[0].bounds, {
                                padding: [50, 50], // Padding attorno ai limiti
                                maxZoom: isMobile ? 15 : 18 // Limita lo zoom massimo
                            });
                        }
                    } catch (error) {
                        console.error("Errore nell'adattamento della mappa al percorso:", error);
                    }
                }

                // Aggiungi un marker per la destinazione (targhetta)
                if (!destinationMarker) {
                    // Utilizza un'icona diversa per la destinazione
                    const destIcon = L.icon({
                        iconUrl: './target-marker.png',  // Sostituisci con l'immagine reale
                        iconSize: [32, 32],
                        iconAnchor: [16, 32]
                    });

                    try {

                        destinationMarker = L.marker([nextPlaque.lat, nextPlaque.lng], {
                            icon: destIcon
                        }).addTo(map);

                        // Aggiungi un popup con informazioni
                        const isFound = userProgress.found.includes(nextPlaque.id);
                        destinationMarker
                            .bindPopup(`<b>${nextPlaque.title || 'Targhetta'}</b><br>Distanza: ${(e.routes[0].summary.totalDistance / 1000).toFixed(1)} km`)
                            .on("click", () => showPlaque(nextPlaque, nextPlaque.id, isFound));
                        // Apri immediatamente il popup
                        destinationMarker.openPopup();

                    } catch (markerError) {
                        console.error("Errore nella creazione del marker di destinazione:", markerError);

                        // Fallback: marker semplice
                        destinationMarker = L.marker([nextPlaque.lat, nextPlaque.lng]).addTo(map);
                    }
                } else {
                    // Aggiorna la posizione del marker esistente
                    destinationMarker.setLatLng([nextPlaque.lat, nextPlaque.lng]);
                }

                // Rendi visibile il percorso (a volte può essere necessario forzare la visualizzazione)
                const routeElements = document.querySelectorAll('.leaflet-overlay-pane path');
                routeElements.forEach(path => {
                    path.style.display = 'block';
                    path.style.visibility = 'visible';
                    path.style.opacity = '0.8';
                });

                hideLoadingIndicator();
            }, 500);
        });

        // Gestisci gli errori di routing
        routingControl.on('routingerror', function(e) {
            console.error("Errore di routing:", e.error);
            hideLoadingIndicator();
            showToast("Errore nel calcolo del percorso. Distanza troppo grande o servizio non disponibile.");

            // Fallback: crea una linea retta tra i due punti
            createFallbackRoute(
                [userPosition.coords.latitude, userPosition.coords.longitude],
                [nextPlaque.lat, nextPlaque.lng]
            );
        });

        // Imposta un timeout nel caso in cui il calcolo del percorso richieda troppo tempo
        setTimeout(() => {
            if (document.querySelector('.loading-indicator.active')) {
                hideLoadingIndicator();
                showToast("Calcolo del percorso in corso, potrebbe richiedere un po' di tempo...");
            }
        }, 5000);

    } catch (error) {
        console.error("Errore nel calcolo del percorso:", error);
        hideLoadingIndicator();
        showToast("Errore nel calcolo del percorso. Riprova più tardi.");

        // Fallback: crea una linea retta tra i due punti
        createFallbackRoute(
            [userPosition.coords.latitude, userPosition.coords.longitude],
            [nextPlaque.lat, nextPlaque.lng]
        );
    }
}

// Funzione fallback per creare una linea retta quando il routing fallisce
function createFallbackRoute(start, end) {
    console.log("Creazione percorso fallback semplificato");

    try {
        // Rimuovi il percorso precedente se presente
        if (fallbackRouteLine && map.hasLayer(fallbackRouteLine)) {
            map.removeLayer(fallbackRouteLine);
        }

        // Crea una semplice linea retta
        fallbackRouteLine = L.polyline([
            start,
            end
        ], {
            color: getCSSVariable("--secondary-color"),
            opacity: 0.8,
            weight: isMobile ? 4 : 5,
            dashArray: '5, 10', // Linea tratteggiata per indicare che è un percorso approssimativo
        }).addTo(map);

        // Adatta la vista della mappa per mostrare l'intero percorso
        map.fitBounds(fallbackRouteLine.getBounds(), {
            padding: [50, 50]
        });

        // Aggiungi un marker per la destinazione
        const nextPlaque = plaques.find(p => !userProgress.found.includes(p.id) && isUnlocked(p.id));
        if (nextPlaque && !destinationMarker) {
            destinationMarker = L.marker([nextPlaque.lat, nextPlaque.lng]).addTo(map);

            // Calcola la distanza in linea d'aria
            const distanceKm = calculateDistance(start, end);
            destinationMarker.bindPopup(`<b>${nextPlaque.title || 'Targhetta'}</b><br>Distanza in linea d'aria: ${distanceKm.toFixed(1)} km`);
        }

    } catch (error) {
        console.error("Errore nella creazione del percorso fallback:", error);
    }
}

// Calcolo della distanza in linea d'aria (formula di Haversine)
function calculateDistance(point1, point2) {
    const R = 6371; // Raggio della Terra in km
    const dLat = (point2[0] - point1[0]) * Math.PI / 180;
    const dLon = (point2[1] - point1[1]) * Math.PI / 180;
    const a =
        Math.sin(dLat/2) * Math.sin(dLat/2) +
        Math.cos(point1[0] * Math.PI / 180) * Math.cos(point2[0] * Math.PI / 180) *
        Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distanza in km
}

// Funzione per ripulire la mappa prima di chiuderla
function cleanupMap() {
    if (map) {
        // Rimuovi tutti i layer e i controlli
        if (routingControl && map.hasLayer(routingControl)) {
            map.removeControl(routingControl);
        }

        if (currentPositionMarker && map.hasLayer(currentPositionMarker)) {
            map.removeLayer(currentPositionMarker);
        }

        if (destinationMarker && map.hasLayer(destinationMarker)) {
            map.removeLayer(destinationMarker);
        }

        if (fallbackRouteLine && map.hasLayer(fallbackRouteLine)) {
            map.removeLayer(fallbackRouteLine);
        }

        // Reimposta le variabili
        routingControl = null;
        currentPositionMarker = null;
        destinationMarker = null;
        fallbackRouteLine = null;
    }
}

// Aggiungi questa logica di pulizia quando l'utente torna indietro
function returnToMainMenu() {
    // Pulisci la mappa
    cleanupMap();

    // Nascondi la mappa e mostra il menu principale
    document.getElementById("map").style.display = "none";
    document.querySelector(".progress-container").style.display = "none";
    document.getElementById("locationScreen").classList.remove("active");
    document.getElementById("mainMenu").classList.add("active");
}



// Funzione per mostrare l'indicatore di caricamento
function showLoadingIndicator() {
    // Crea un indicatore di caricamento se non esiste
    let loadingIndicator = document.getElementById('map-loading-indicator');

    if (!loadingIndicator) {
        loadingIndicator = document.createElement('div');
        loadingIndicator.id = 'map-loading-indicator';
        loadingIndicator.className = 'loading-indicator';
        loadingIndicator.innerHTML = '<div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(255,255,255,0.8); padding: 15px; border-radius: 5px; text-align: center;">Calcolo percorso in corso...</div>';

        // Aggiungi l'indicatore alla pagina
        const mapContainer = document.getElementById('map');
        if (mapContainer) {
            mapContainer.style.position = 'relative';
            mapContainer.appendChild(loadingIndicator);
        } else {
            document.body.appendChild(loadingIndicator);
        }
    } else {
        loadingIndicator.style.display = 'block';
    }
}

// Funzione per nascondere l'indicatore di caricamento
function hideLoadingIndicator() {
    const loadingIndicator = document.getElementById('map-loading-indicator');
    if (loadingIndicator) {
        loadingIndicator.style.display = 'none';
    }
}

// Funzione modificata per inizializzare la mappa solo quando necessario
async function initMap(){
if (isMapInitialized && map) {
        // La mappa è già inizializzata, aggiorniamo solo la vista
        try {
            map.invalidateSize();
            // Forza l'aggiornamento del marker della posizione se esistono informazioni sulla posizione
            if (userPosition) {
                updatePositionMarker(userPosition);
            }
        } catch (error) {
            console.error("Errore durante l'aggiornamento della mappa:", error);
        }
        return;
    }

    // Nascondi momentaneamente la mappa finché non è pronta
    const mapContainer = document.getElementById('map');
    if (mapContainer) {
        mapContainer.style.visibility = 'hidden';
    }

    try {
        // Inizializza la mappa con parametri appropriati per desktop/mobile
        map = L.map("map", {
            zoomControl: !isMobile, // Disabilita temporaneamente i controlli zoom su mobile
            attributionControl: true
        }).setView([40.7527295, 14.6464048], isMobile ? 13 : 14);

        // Aggiungi layer della mappa
        const tileLayer = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png?v=1.0.18", {
            updateWhenIdle: isMobile,
            updateWhenZooming: !isMobile,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);

        // Ottimizza i controlli per mobile
        if (isMobile) {
            // Aggiungi i controlli zoom in basso a destra per dispositivi touch
            L.control.zoom({ position: 'bottomright' }).addTo(map);
        }

        // IMPORTANTE: Assicuriamoci che L.Routing sia correttamente definito prima di usarlo
        if (typeof L.Routing === 'undefined' || typeof L.Routing.control === 'undefined') {
            console.error("L.Routing o L.Routing.control non sono definiti. Verificare che leaflet-routing-machine sia caricato correttamente.");

            // Mostra un errore visibile all'utente
            showToast("Errore nel caricamento del sistema di routing. Ricarica la pagina.", 5000);

            // Imposta comunque il flag di inizializzazione per evitare ulteriori tentativi
            isMapInitialized = true;

            // Rendi visibile la mappa anche in caso di errore
            if (mapContainer) {
                mapContainer.style.visibility = 'visible';
            }

            return;
        }

        // Configura il controllo di routing in modo diverso per desktop e mobile
        try {
            // Verifica che L.Routing sia disponibile prima di utilizzarlo
            console.log("Inizializzazione routing control...");

            // Useremo configurazioni diverse per desktop e mobile
            const routingConfig = {
                waypoints: [],  // Inizia con waypoints vuoti
                show: false,    // Non mostrare il pannello di controllo
                addWaypoints: false,
                draggableWaypoints: false,
                fitSelectedRoutes: true,
                createMarker: () => null,  // Non creare marker per i waypoints
                lineOptions: {
                    styles: [{
                        color: getCSSVariable("--secondary-color"),
                        opacity: 0.8,
                        weight: isMobile ? 4 : 5
                    }]
                },
                // Utilizziamo il router predefinito, ma lo configuriamo diversamente
                router: L.Routing.osrmv1({
                    serviceUrl: 'https://router.project-osrm.org/route/v1',  // URL OSRM predefinito
                    profile: 'walking',  // Usa il profilo per camminare
                    timeout: 30 * 1000   // Timeout di 30 secondi
                })
            };

            // Solo su desktop aggiungiamo alcuni parametri extra
            if (!isMobile) {
                routingConfig.routeWhileDragging = true;  // Calcola il percorso durante il trascinamento
                routingConfig.showAlternatives = false;   // Non mostrare percorsi alternativi
                routingConfig.useZoomParameter = true;    // Usa il parametro zoom per i calcoli del percorso
            }

            console.log("Configurazione routing:", routingConfig);

            // Crea e aggiungi il controllo di routing
            routingControl = L.Routing.control(routingConfig).addTo(map);

            // Verifica che il routing control sia stato aggiunto correttamente
            if (routingControl) {
                console.log("Routing control inizializzato con successo");

                // Forza l'aggiornamento del routing se ci sono già coordinate
                if (userPosition) {
                    setTimeout(() => calculateRoute(), 500);
                }
            } else {
                console.error("Routing control non è stato creato correttamente");
            }
        } catch (routingError) {
            console.error("Errore nell'inizializzazione del routing control:", routingError);
            console.error("Stack trace:", routingError.stack);

            // Prova a caricare il modulo di routing dinamicamente
            tryToLoadRoutingDynamically();
        }

        // Imposta il flag che indica che la mappa è stata inizializzata
        isMapInitialized = true;

        // Ottimizza gestione eventi touch per dispositivi mobili
        if (isMobile) {
            optimizeTouchInteraction();
        }

        // Forza l'aggiornamento del marker della posizione se esistono informazioni sulla posizione
        if (userPosition) {
            setTimeout(() => updatePositionMarker(userPosition), 300);
        }

        // Rendi visibile la mappa
        if (mapContainer) {
            mapContainer.style.visibility = 'visible';
        }

        // Aggiorna immediatamente la mappa per evitare problemi di resize
        setTimeout(() => {
            if (map) map.invalidateSize();
        }, 100);

        return map;
    } catch (error) {
        console.error("Errore nell'inizializzazione della mappa:", error);
        console.error("Stack trace:", error.stack);

        // Assicurati che la mappa sia visibile anche in caso di errore
        if (mapContainer) {
            mapContainer.style.visibility = 'visible';
        }

        throw error;
    }
}

// Funzione per provare a caricare dinamicamente il modulo di routing
function tryToLoadRoutingDynamically() {
    console.log("Tentativo di caricamento dinamico del modulo di routing...");

    // Verifica se il foglio di stile è già caricato
    const stylesheetExists = Array.from(document.styleSheets).some(sheet =>
        sheet.href && sheet.href.includes('leaflet-routing-machine'));

    // Verifica se lo script è già caricato
    const scriptExists = Array.from(document.scripts).some(script =>
        script.src && script.src.includes('leaflet-routing-machine'));

    // Carica il foglio di stile se necessario
    if (!stylesheetExists) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.css';
        document.head.appendChild(link);
        console.log("Foglio di stile routing caricato dinamicamente");
    }

    // Carica lo script se necessario
    if (!scriptExists) {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet-routing-machine@3.2.12/dist/leaflet-routing-machine.min.js';
        script.onload = function() {
            console.log("Script routing caricato dinamicamente. Tentativo di reinizializzazione...");

            // Tentativo di reinizializzazione dopo il caricamento dello script
            setTimeout(() => {
                if (typeof L.Routing !== 'undefined' && typeof L.Routing.control !== 'undefined') {
                    console.log("Routing disponibile dopo caricamento dinamico");

                    // Reinizializza la mappa
                    isMapInitialized = false;
                    initMap().then(() => {
                        // Ricalcola il percorso
                        if (userPosition) {
                            calculateRoute();
                        }
                    });
                } else {
                    console.error("Impossibile caricare il modulo di routing anche dopo caricamento dinamico");
                }
            }, 1000);
        };
        script.onerror = function() {
            console.error("Errore nel caricamento dinamico dello script di routing");
        };
        document.body.appendChild(script);
        console.log("Script routing caricato dinamicamente");
    }
}


// Implementiamo anche un controllo per verificare se l'icona GPS esiste
function checkGpsIconExists() {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = "./gps.png?v=1.0.27";
    });
}

// Ottimizza interazione touch per dispositivi mobili
function optimizeTouchInteraction() {
    if (!map) return;

    // Assicurati che i tap funzionino correttamente
    const mapElement = document.getElementById('map');
    if (mapElement) {
        let touchStartTime = 0;
        mapElement.addEventListener('touchstart', (e) => {
            const now = new Date().getTime();

            if (now - touchStartTime < 300 && e.touches.length === 1) {
                e.preventDefault(); // Previene doppio tap per zoom
            }

            touchStartTime = now;
        }, { passive: false });
    }

    // Riduci la frequenza di aggiornamento durante il pan
    let lastMoveTime = 0;
    map.on('move', function() {
        const now = Date.now();
        if (now - lastMoveTime > 100) { // Aggiorna solo ogni 100ms durante il movimento
            lastMoveTime = now;
        }
    });
}

function setupEventListeners(){
    document.querySelector(".overlay").addEventListener("click",closeModal);
    document.getElementById("answerForm").addEventListener("submit",handleFormSubmit);

    // Listener per gestire il resize della finestra
    window.addEventListener('resize', handleWindowResize);
}

function handleWindowResize() {
    // Assicurati che la mappa si adatti alle nuove dimensioni
    if (map && isMapInitialized) {
        setTimeout(() => {
            map.invalidateSize();
        }, 200);
    }
}

// Funzione per verificare se i permessi di geolocalizzazione sono già stati concessi
function checkLocationPermissions() {
    return new Promise((resolve, reject) => {
        // Verifico se l'API Permissions è supportata
        if (!navigator.permissions || !navigator.permissions.query) {
            // API non supportata, passiamo direttamente a richiedere i permessi
            console.log("API Permissions non supportata, passiamo direttamente alla richiesta");
            resolve("unknown");
            return;
        }

        navigator.permissions.query({ name: 'geolocation' })
            .then(permissionStatus => {
                console.log("Stato attuale dei permessi di geolocalizzazione:", permissionStatus.state);
                resolve(permissionStatus.state); // granted, denied, o prompt
            })
            .catch(error => {
                console.warn("Impossibile verificare i permessi:", error);
                // Se non possiamo verificare i permessi, assumiamo che non siano stati concessi
                resolve("unknown");
            });
    });
}

// Aggiungi questa funzione per forzare la richiesta dei permessi
function forceLocationPermissionRequest() {
    console.log("Forzo la richiesta dei permessi di geolocalizzazione...");

    // Verifica se la geolocalizzazione è supportata dal browser
    if (!navigator.geolocation) {
        showToast("Il tuo browser non supporta la geolocalizzazione. Prova ad utilizzare un browser più recente.", 5000);
        return Promise.reject("Geolocalizzazione non supportata");
    }

    // Mostra un toast all'utente
    showToast("Richiesta accesso alla posizione...", 2000);

    // Configura le opzioni per la geolocalizzazione
    const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
    };

    // Forza la richiesta di posizione per far apparire il popup del browser
    return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
            // Successo
            (position) => {
                console.log("Permessi concessi e posizione ottenuta:", position);

                // Salva la posizione
                userPosition = position;

                // Aggiorna il marker della posizione se la mappa è già inizializzata
                if (map && isMapInitialized) {
                    updatePositionMarker(position);

                    // Se abbiamo una destinazione attiva, calcola il percorso
                    if (currentDestination) {
                        calculateRoute();
                    }
                }

                // Mostra un messaggio di successo
                showToast("Posizione GPS rilevata!", 2000);

                // Attiva il monitoraggio continuo della posizione
                startPositionTracking();

                resolve(position);
            },
            // Errore
            (error) => {
                console.error("Errore nell'ottenere la posizione:", error);

                let errorMessage = "";
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = "Permesso di geolocalizzazione negato. Per usare questa funzione, devi consentire l'accesso alla posizione.";
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = "Informazioni sulla posizione non disponibili. Verifica che il GPS sia attivo.";
                        break;
                    case error.TIMEOUT:
                        errorMessage = "Richiesta di posizione scaduta. Verifica connessione e GPS.";
                        break;
                    default:
                        errorMessage = "Errore sconosciuto nel rilevamento della posizione.";
                        break;
                }

                showToast(errorMessage, 5000);
                reject(error);
            },
            // Opzioni
            options
        );
    });
}

// Modifica la funzione esistente per usare il nuovo sistema di verifica dei permessi
function requestLocationPermissionIfNeeded() {
    console.log("Verifica dei permessi di geolocalizzazione...");

    // Verifica se la geolocalizzazione è supportata dal browser
    if (!navigator.geolocation) {
        showToast("Il tuo browser non supporta la geolocalizzazione. Prova ad utilizzare un browser più recente.", 5000);
        return Promise.reject("Geolocalizzazione non supportata");
    }

    // Prima verifica se i permessi sono già stati concessi
    return checkLocationPermissions()
        .then(permissionState => {
            if (permissionState === "granted") {
                console.log("Permessi già concessi, recupero posizione...");
                // I permessi sono già stati concessi, ottieni la posizione
                return getCurrentPosition();
            }
            else {
                console.log("Permessi non ancora concessi o negati, forzo la richiesta...");
                // Invece di verificare ulteriormente lo stato, forziamo la richiesta
                // per far apparire il popup del browser
                return forceLocationPermissionRequest();
            }
        })
        .catch(error => {
            console.error("Errore nella verifica dei permessi:", error);
            return Promise.reject(error);
        });
}

// Funzione per ottenere la posizione corrente
function getCurrentPosition() {
    // Configura le opzioni per la geolocalizzazione - aumentiamo il timeout per la prima richiesta
    const options = {
        enableHighAccuracy: true,
        timeout: 15000 + (retryCount * 5000), // Aumenta il timeout ad ogni retry
        maximumAge: retryCount > 0 ? 60000 : 0 // Consenti cache dopo il primo tentativo
    };
    console.log(`Tentativo ${retryCount + 1}/${maxRetries + 1} di ottenere la posizione GPS...`);

    // Richiedi i permessi e ottieni la posizione
    return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
            // Successo
            (position) => {
                console.log("Posizione ottenuta:", position);

                // Salva la posizione
                userPosition = position;

                // Aggiorna il marker della posizione se la mappa è già inizializzata
                if (map && isMapInitialized) {
                    updatePositionMarker(position);

                    // Se abbiamo una destinazione attiva, calcola il percorso
                    if (currentDestination) {
                        calculateRoute();
                    }
                }

                // Mostra un messaggio di successo
                showToast("Posizione GPS rilevata!", 2000);

                // Attiva il monitoraggio continuo della posizione
                startPositionTracking();

                resolve(position);
            },
            // Errore
            (error) => {
                console.error("Errore nell'ottenere la posizione:", error);

                let errorMessage = "";
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        errorMessage = "Permesso di geolocalizzazione negato. Abilitalo nelle impostazioni del browser per utilizzare questa funzionalità.";
                        break;
                    case error.POSITION_UNAVAILABLE:
                        errorMessage = "Informazioni sulla posizione non disponibili. Verifica che il GPS sia attivo.";
                        break;
                    case error.TIMEOUT:
                        errorMessage = "Richiesta di posizione scaduta. Verifica la connessione e il GPS.";
                        break;
                    default:
                        errorMessage = "Errore sconosciuto nel rilevamento della posizione.";
                        break;
                }

                showToast(errorMessage, 5000);
                reject(error);
            },
            // Opzioni
            options
        );
    });
}

// Funzione per avviare il monitoraggio continuo della posizione
// Funzione per avviare il monitoraggio continuo della posizione
function startPositionTracking(highAccuracy = true) {
    // Se è già attivo, interrompiamo prima
    if (positionWatchId !== null) {
        stopPositionTracking();
    }

    // Configura le opzioni per il monitoraggio
    const options = {
        enableHighAccuracy: highAccuracy,
        timeout: highAccuracy ? 15000 : 30000,
        maximumAge: highAccuracy ? 0 : 60000
    };

    // Avvia il monitoraggio continuo
    positionWatchId = navigator.geolocation.watchPosition(
        // Successo
        (position) => {
            // Aggiorna la posizione dell'utente
            userPosition = position;

            // Aggiorna il marker della posizione se la mappa è inizializzata
            if (map && isMapInitialized) {
                updatePositionMarker(position);

                // Se abbiamo una destinazione attiva, aggiorna il percorso
                // Ma limitiamo gli aggiornamenti per non sovraccaricare l'API
                if (currentDestination && (!lastRouteUpdateTime || (Date.now() - lastRouteUpdateTime > 10000))) {
                    lastRouteUpdateTime = Date.now();
                    calculateRoute();
                }
            }
        },
        // Errore
        (error) => {
            console.error("Errore nel monitoraggio della posizione:", error);

            // Se è un timeout ma non abbiamo ancora provato con bassa precisione, prova quella
            if (error.code === error.TIMEOUT && highAccuracy) {
                console.log("Passaggio al monitoraggio con bassa precisione...");
                stopPositionTracking();
                startPositionTracking(false); // Riavvia con bassa precisione
                return;
            }

            // Non mostrare un toast qui per evitare spam di messaggi di errore
            if (error.code === error.PERMISSION_DENIED) {
                // Ferma il monitoraggio se l'utente ha negato i permessi
                stopPositionTracking();
            }
        },
        // Opzioni
        options
    );

    console.log(`Monitoraggio della posizione avviato (precisione: ${highAccuracy ? 'alta' : 'bassa'}), ID: ${positionWatchId}`);
}

// Funzione per fermare il monitoraggio della posizione
function stopPositionTracking() {
    if (positionWatchId !== null) {
        navigator.geolocation.clearWatch(positionWatchId);
        console.log("Monitoraggio della posizione fermato, ID:", positionWatchId);
        positionWatchId = null;
    }
}




function startWatchingPosition(){
    navigator.geolocation.watchPosition(
        position => {
            userPosition = position;

            // Aggiorna il marker solo se la mappa è già inizializzata
            if (map && isMapInitialized) {
                updatePositionMarker(position);
                calculateRoute();
            }
        },
        error => showToast(`Errore GPS: ${error.message}`),
        {enableHighAccuracy: true}
    );
}

function updatePositionMarker(position) {
    // Verifica che la mappa sia inizializzata prima di aggiungere il marker
    if (!map || !isMapInitialized) {
        console.log("Mappa non ancora inizializzata, impossibile aggiungere il marker GPS");
        return; // Esci dalla funzione se la mappa non è ancora inizializzata
    }

    const {latitude, longitude} = position.coords;

    // Verifica che le coordinate siano valide
    if (isNaN(latitude) || isNaN(longitude)) {
        console.error("Coordinate GPS non valide:", latitude, longitude);
        return;
    }

    // Logging per debug
    console.log("Aggiornamento posizione GPS:", latitude, longitude);

    if (!currentPositionMarker) {
        // Crea un marker più piccolo e ottimizzato su mobile
        const iconSize = isMobile ? [24, 24] : [32, 32];
        const iconAnchor = isMobile ? [12, 24] : [16, 32];

        // Verifica che l'URL dell'icona sia corretto
        const iconUrl = "./gps.png?v=1.0.27";
        console.log("Creazione nuovo marker con icona:", iconUrl);

        try {
            // Crea un nuovo marker con l'icona personalizzata
            const gpsIcon = L.icon({
                iconUrl: iconUrl,
                iconSize: iconSize,
                iconAnchor: iconAnchor
            });

            currentPositionMarker = L.marker([latitude, longitude], {
                icon: gpsIcon
            }).addTo(map);

            // Per sicurezza, assicurati che il marker sia visibile
            currentPositionMarker.setOpacity(1);
            currentPositionMarker.bindPopup(`Posizione GPS`);

            console.log("Marker GPS creato e aggiunto alla mappa");
        } catch (error) {
            console.error("Errore nella creazione del marker:", error);

            // Fallback: crea un marker semplice senza icona personalizzata
            try {
                currentPositionMarker = L.marker([latitude, longitude]).addTo(map);
                console.log("Creato marker fallback senza icona personalizzata");
            } catch (fallbackError) {
                console.error("Errore anche nel fallback:", fallbackError);
            }
        }
    } else {
        // Aggiorna la posizione del marker esistente
        try {
            currentPositionMarker.setLatLng([latitude, longitude]);
            console.log("Posizione marker GPS aggiornata");
        } catch (error) {
            console.error("Errore nell'aggiornamento della posizione del marker:", error);
        }
    }

    // Fai in modo che la mappa si aggiorni visivamente
    if (map) {
        try {
            map.invalidateSize();
        } catch (error) {
            console.error("Errore nell'invalidazione delle dimensioni della mappa:", error);
        }
    }
}

function updateMap(){
    if(map) {
        // Rimuovi i marker attuali (eccetto posizione utente)
        map.eachLayer(layer => {
            if (layer instanceof L.Marker && layer !== currentPositionMarker)
                map.removeLayer(layer);
        });

        // Aggiungi solo i marker rilevanti (unlocked)
        plaques.forEach(plaque => {
            if (isUnlocked(plaque.id)) {
                const isFound = userProgress.found.includes(plaque.id);

                // Crea marker ottimizzati per dispositivi mobili
                const iconSize = isMobile ? [24, 24] : [32, 32];
                const iconAnchor = isMobile ? [12, 24] : [16, 32];
                currentDestination = L.latLng(plaque.lat, plaque.lng);
                L.marker([plaque.lat, plaque.lng], {
                    icon: L.icon({
                        iconUrl: isFound ? "./447147.png?v=1.0.27" : "./684908.png?v=1.0.27",
                        iconSize: iconSize,
                        iconAnchor: iconAnchor
                    })
                })
                    .bindPopup(plaque.title)
                    .on("click", () => showPlaque(plaque, plaque.id, isFound))
                    .addTo(map);
            }
        });
    }
}

function isUnlocked(id){
    return userProgress.found.includes(id) ||
           (userProgress.found.length === 0 && id === 1) ||
           id === userProgress.found[userProgress.found.length - 1] + 1;
}

function showPlaque(plaque, id, isFound=false){
    returnTo360(id, isFound);
}

function handleFormSubmit(e) {
    e.preventDefault();

    const answers = Array.from(e.target.elements)
        .filter(el => el.tagName === "INPUT")
        .map(input => input.value.toLowerCase().trim());

    const plaque = plaques.find(p => p.id === userProgress.found.length + 1);
    if (userPosition) {
        const valid = validateAnswer(plaque, answers, userPosition);

        if (valid) {
            userProgress.found.push(plaque.id);
            saveProgress();
            updateMap();
            closeModal();
            showNextLocation();
        }

        showToast(valid ? "Corretto! Targa sbloccata!" : "Risposta errata o posizione non corretta");

    }
}

function validateAnswer(plaque, answers, position) {
    console.log("Validazione risposta:", plaque, answers, position);
    const distance = haversineDistance(
        position.coords.latitude,
        position.coords.longitude,
        plaque.lat,
        plaque.lng
    );

    const correctWords = plaque.missingWords
        .map(w => w.toLowerCase())
        .every((w, i) => w === answers[i]);
    return distance <= plaque.radius && correctWords;
}

function haversineDistance(lat1, lon1, lat2, lon2){
    return 10; // Valore di placeholder mantenuto dal codice originale
}

function closeModal(){
    document.querySelector(".modal").classList.remove("active");
    document.querySelector(".overlay").classList.remove("active");
}

function saveProgress(){
    localStorage.setItem("progress", JSON.stringify(userProgress));
    //document.getElementById("counter").textContent = userProgress.found.length;
    updateStatus();
}

function resetGame(){
    if (confirm("Sei sicuro di voler resettare il gioco? Tutti i progressi andranno persi!")) {
        if (routingControl) {
            map.removeControl(routingControl);
            routingControl = null;
        }
        localStorage.removeItem("progress");
        localStorage.removeItem("tourCompletato");
        userProgress = {found: []};
        updateMap();
        document.getElementById("counter").textContent = 0;
        returnToHome();
    }
    updateStatus();
}

function showToast(message, duration=3000){
    const toast = document.querySelector(".toast");
    toast.textContent = message;
    toast.style.display = "block";
    setTimeout(() => toast.style.display = "none", duration);
}

// Avvia l'applicazione in modo ottimizzato
init();

function startGame(){
    document.getElementById("welcomeCover").classList.add("hidden");
    showNextLocation();
}

function showInstructions(){
    document.getElementById("instructionsModal").classList.add("active");
}

function closeInstructions(){
    document.getElementById("instructionsModal").classList.remove("active");
}

function showNextLocation(){
    document.getElementById("map").style.display = "none";
    document.querySelector(".progress-container").style.display = "none";

    const nextPlaqueId = userProgress.found.length + 1;
    const nextPlaque = plaques.find(p => p.id === nextPlaqueId);

    if (nextPlaque && nextPlaque.locationImage) {
        display360InLocation(
            nextPlaque,
            nextPlaqueId,
            false,
            nextPlaque.locationBlurMaskImage
        );
    }

    document.getElementById("locationTitle").textContent = nextPlaque.locationTitle;
    document.getElementById("locationDescription").innerHTML = nextPlaque.locationDescription;
    document.getElementById("locationScreen").classList.add("active");

    // Non aggiorniamo più la mappa qui per evitare il caricamento prematuro
}

// Modifica la funzione startSearch per caricare prima la mappa e poi richiedere i permessi
function startSearch() {
    document.getElementById("locationScreen").classList.remove("active");

    // Mostra l'indicatore di caricamento
    showLoadingIndicator();

    // Mostra la mappa
    document.getElementById("map").style.display = "block";
    document.querySelector(".progress-container").style.display = "flex";

    // Prima inizializza la mappa, poi richiedi permessi GPS
    initMap()
        .then(() => {
            // La mappa è stata caricata, ora possiamo aggiornare la UI
            console.log("Mappa inizializzata");

            // Aggiorna le dimensioni della mappa
            if (map) map.invalidateSize();

            // Aggiorna la mappa con i punti d'interesse
            updateMap();

            // Aggiungi un pulsante per richiedere esplicitamente i permessi
            addPermissionRequestButton();

            // Tentiamo di richiedere i permessi di geolocalizzazione
            return requestLocationPermissionIfNeeded()
                .then(position => {
                    console.log("Posizione GPS ottenuta");

                    // Se il pulsante di richiesta permessi esiste, nascondilo
                    hidePermissionRequestButton();

                    // Se abbiamo una destinazione già selezionata, calcola il percorso
                    if (currentDestination) {
                        calculateRoute();
                    }
                })
                .catch(error => {
                    console.warn("Impossibile ottenere la posizione GPS:", error);

                    // Assicurati che il pulsante per richiedere i permessi sia visibile
                    showPermissionRequestButton();

                    // Continua comunque, l'utente potrà navigare nella mappa senza navigazione GPS
                    if (error && error.code === 1) { // PERMISSION_DENIED
                        showToast("Per utilizzare la navigazione, abilita l'accesso alla posizione.", 5000);
                    }
                });
        })
        .catch(error => {
            console.error("Errore nell'inizializzazione della mappa:", error);
            showToast("Errore nel caricamento della mappa. Riprova più tardi.", 5000);
        })
        .finally(() => {
            // Nascondi l'indicatore di caricamento
            hideLoadingIndicator();
        });
}


// Funzione per creare e aggiungere un pulsante per richiedere i permessi
function addPermissionRequestButton() {
    // Se il pulsante esiste già, non crearlo nuovamente
    if (document.getElementById('permissionRequestButton')) {
        return;
    }

    // Crea il pulsante
    const button = document.createElement('button');
    button.id = 'permissionRequestButton';
    button.className = 'permission-button';
    button.innerHTML = '<i class="fas fa-location-arrow"></i> Attiva posizione';

    // Aggiungi stile al pulsante
    button.style.position = 'absolute';
    button.style.bottom = '80px';
    button.style.right = '20px';
    button.style.zIndex = '1000';
    button.style.backgroundColor = '#007bff';
    button.style.color = 'white';
    button.style.border = 'none';
    button.style.borderRadius = '4px';
    button.style.padding = '10px 15px';
    button.style.fontWeight = 'bold';
    button.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
    button.style.display = 'flex';
    button.style.alignItems = 'center';
    button.style.justifyContent = 'center';

    // Inizialmente nascosto, lo mostreremo solo se necessario
    button.style.display = 'none';

    // Aggiungi event listener per richiedere i permessi quando cliccato
    button.addEventListener('click', () => {
        forceLocationPermissionRequest()
            .then(() => {
                // Nascondi il pulsante se otteniamo i permessi
                button.style.display = 'none';
            })
            .catch(error => {
                console.warn("Richiesta permessi fallita:", error);
            });
    });

    // Aggiungi il pulsante al container della mappa
    const mapElement = document.getElementById('map');
    if (mapElement) {
        mapElement.appendChild(button);
    }
}

// Funzione per mostrare il pulsante di richiesta permessi
function showPermissionRequestButton() {
    const button = document.getElementById('permissionRequestButton');
    if (button) {
        button.style.display = 'flex';
    } else {
        // Se il pulsante non esiste ancora, crealo
        addPermissionRequestButton();
        showPermissionRequestButton();
    }
}

// Funzione per nascondere il pulsante di richiesta permessi
function hidePermissionRequestButton() {
    const button = document.getElementById('permissionRequestButton');
    if (button) {
        button.style.display = 'none';
    }
}




function returnToHome(){
    document.getElementById("locationScreen").classList.remove("active");
    document.getElementById("welcomeCover").classList.remove("hidden");
    document.getElementById("map").style.display = "none";
    document.querySelector(".progress-container").style.display = "none";
    resetButtons();
}

// Ottimizza il caricamento delle immagini in base al dispositivo
function getOptimizedImageForDevice(plaque, isHighRes = false) {
    if (isMobile && !isHighRes) {
        return plaque.locationImageLowRes || plaque.locationImage;
    }
    return './backend/' + plaque.locationImage;
}

function display360InLocation(plaque, id=0, isFound=false, blurMaskImage=null, blurIntensity=1.95){
    const container = document.getElementById("locationImage");
    container.innerHTML = "";

    const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;

    if (isTouchDevice && !isFound) {
        const touchIndicator = document.createElement("div");
        touchIndicator.className = "touch-indicator";
        touchIndicator.innerHTML = `
            <div class="touch-hint">
                <div class="touch-icon">👆</div>
                <span>Tocca le aree evidenziate per interagire</span>
                <div class="touch-swipe-hint">Scorri per esplorare</div>
            </div>
        `;
        container.appendChild(touchIndicator);

        setTimeout(() => {
            touchIndicator.style.opacity = "0";
            setTimeout(() => touchIndicator.style.display = "none", 1000);
        }, 4000);
    }

    if (container.scene) {
        container.scene.dispose();
    }

    const scene = new THREE.Scene;
    const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, .1, 1000);

    // Renderer ottimizzato per dispositivi mobili
    const renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: !isMobile, // Disabilita antialiasing su mobile per prestazioni
        powerPreference: isMobile ? 'low-power' : 'high-performance'
    });

    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    camera.position.z = .1;

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.autoRotate = false;

    // Ottimizza controlli per dispositivi mobili
    if (isMobile) {
        controls.rotateSpeed = 0.5; // Movimento più lento su mobile
        controls.enableDamping = true;
        controls.dampingFactor = 0.1;
    }

    let autoRotationEnabled = true;
    const autoRotationSpeed = .005;
    let rotationVelocity = 0;
    const maxRotationVelocity = .3;
    const inertiaFactor = .95;
    let lastDeltaX = 0;
    let isInertiaActive = false;
    let userInteracting = false;

    controls.enableZoom = true;
    controls.zoomSpeed = isMobile ? 0.5 : 1; // Zoom più lento su mobile
    controls.enablePan = false;
    controls.minPolarAngle = Math.PI * .1;
    controls.maxPolarAngle = Math.PI * .9;

    let isDragging = false;
    const setCursor = type => {
        container.style.cursor = type;
    };

    // Geometria ottimizzata per dispositivi mobili
    const segments = isMobile ? 40 : 60;
    const geometry = new THREE.SphereGeometry(500, segments, 40);
    geometry.scale(-1, 1, 1);

    const textureLoader = new THREE.TextureLoader;
    const maskLoader = new THREE.TextureLoader;

    let panoramaMaterial;
    let maskTexture;
    let blurMaskTexture = null;
    let maskMaterial = undefined;

    const COLOR_MAGENTA = new THREE.Color(16711935);
    const COLOR_GREEN = new THREE.Color(65280);

    const loadPromises = [];

    // Carica la maschera interattiva
    const interactiveMaskPromise = new Promise((resolve, reject) => {
        maskLoader.load(
            './backend/' + plaque.locationMaskImage,
            texture => resolve(texture),
            undefined,
            error => reject(error)
        );
    });
    loadPromises.push(interactiveMaskPromise);

    // Carica maschera blur se disponibile
    let blurMaskPromise = Promise.resolve(null);
    if (blurMaskImage) {
        blurMaskPromise = new Promise((resolve, reject) => {
            maskLoader.load(
                './backend/' + blurMaskImage,
                texture => resolve(texture),
                undefined,
                error => reject(error)
            );
        });
        loadPromises.push(blurMaskPromise);
    }

    // Carica prima la versione a bassa risoluzione
    const lowResPromise = new Promise((resolve, reject) => {
        textureLoader.load(
            // Ottimizza il caricamento dell'immagine per dispositivi mobili
            getOptimizedImageForDevice(plaque, false),
            texture => resolve(texture),
            undefined,
            error => reject(error)
        );
    });
    loadPromises.push(lowResPromise);

    Promise.all(loadPromises).then(textures => {
        maskTexture = textures[0];
        let lowResTexture;

        if (blurMaskImage) {
            blurMaskTexture = textures[1];
            lowResTexture = textures[2];
        } else {
            lowResTexture = textures[1];
        }

        // Shader material ottimizzato per dispositivi mobili
        panoramaMaterial = new THREE.ShaderMaterial({
            uniforms: {
                panoramaTexture: { value: lowResTexture },
                blurMaskTexture: { value: blurMaskTexture },
                useBlurMask: { value: blurMaskTexture !== null },
                blurStrength: { value: isMobile ? blurIntensity * 0.7 : blurIntensity }, // Blur meno intenso su mobile
                textureSize: { value: new THREE.Vector2(lowResTexture.image.width, lowResTexture.image.height) }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D panoramaTexture;
                uniform sampler2D blurMaskTexture;
                uniform bool useBlurMask;
                uniform float blurStrength;
                uniform vec2 textureSize;
                varying vec2 vUv;
                
                vec4 applyBlur(sampler2D tex, vec2 uv, float strength) {
                    // Calcola dimensione pixel per offsets precisi
                    vec2 texelSize = 1.0 / textureSize;
                    
                    // Box blur semplice
                    vec4 result = vec4(0.0);
                    float totalWeight = 0.0;
                    
                    // Dimensione del kernel proporzionale all'intensità
                    float radius = strength * 4.0;
                    
                    for (float x = -radius; x <= radius; x += 1.0) {
                        for (float y = -radius; y <= radius; y += 1.0) {
                            vec2 offset = vec2(x, y) * texelSize;
                            result += texture2D(tex, uv + offset);
                            totalWeight += 1.0;
                        }
                    }
                    
                    return result / totalWeight;
                }
                
                void main() {
                    // Leggi il colore originale
                    vec4 originalColor = texture2D(panoramaTexture, vUv);
                    
                    if (useBlurMask) {
                        // Leggi il valore della maschera di blur
                        vec4 maskColor = texture2D(blurMaskTexture, vUv);
                        
                        // Se siamo in un'area bianca della maschera di blur
                        if (maskColor.r > 0.5) {
                            // Applica blur con intensità proporzionale alla maschera
                            float blurAmount = maskColor.r * blurStrength;
                            gl_FragColor = applyBlur(panoramaTexture, vUv, blurAmount);
                        } else {
                            // Nessun blur, mostra il colore originale
                            gl_FragColor = originalColor;
                        }
                    } else {
                        // Nessuna maschera di blur, mostra il colore originale ovunque
                        gl_FragColor = originalColor;
                    }
                }
            `
        });

        const sphere = new THREE.Mesh(geometry, panoramaMaterial);
        scene.add(sphere);

        // Carica l'immagine ad alta risoluzione dopo aver mostrato quella a bassa risoluzione
        textureLoader.load(
            getOptimizedImageForDevice(plaque, true),
            highRes => {
                panoramaMaterial.uniforms.panoramaTexture.value = highRes;
                panoramaMaterial.uniforms.textureSize.value.set(highRes.image.width, highRes.image.height);
                panoramaMaterial.needsUpdate = true;
            }
        );

        setupInteractiveMask(maskTexture);
    }).catch(error => {
        console.error("Errore durante il caricamento delle texture:", error);
    });

    function setupInteractiveMask(interactiveMaskTexture) {
        const maskImage = document.createElement("canvas");
        const maskImageContext = maskImage.getContext("2d");
        maskImage.width = interactiveMaskTexture.image.width;
        maskImage.height = interactiveMaskTexture.image.height;
        maskImageContext.drawImage(interactiveMaskTexture.image, 0, 0);

        // Shader material ottimizzato per dispositivi mobili
        maskMaterial = new THREE.ShaderMaterial({
            uniforms: {
                maskTexture: { value: interactiveMaskTexture },
                time: { value: 0 },
                color: { value: COLOR_MAGENTA.clone() },
                isMouseOver: { value: 0 }
            },
            transparent: true,
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D maskTexture;
                uniform float time;
                uniform vec3 color;
                uniform float isMouseOver;
                varying vec2 vUv;

                void main() {
                    vec4 maskValue = texture2D(maskTexture, vUv);
                    
                    if (maskValue.r > 0.2) {
                        if (isMouseOver > 0.2) {
                            gl_FragColor = vec4(color, 0.5);
                        } else {
                            float alpha = 0.2 + 0.2 * sin(time * 2.0);
                            gl_FragColor = vec4(color, alpha);
                        }
                    } else {
                        discard;
                    }
                }
            `
        });

        // Geometria ottimizzata per dispositivi mobili
        const maskSegments = isMobile ? 40 : 60;
        const maskGeometry = new THREE.SphereGeometry(490, maskSegments, 40);
        maskGeometry.scale(-1, 1, 1);

        const mask = new THREE.Mesh(maskGeometry, maskMaterial);
        if (!isFound) {
            scene.add(mask);
        }

        const raycaster = new THREE.Raycaster;
        const mouse = new THREE.Vector2;

        // Gestione ottimizzata degli eventi touch/mouse
        const handleInteraction = (event, isClick = false) => {

            // Prima fermiamo la propagazione
            event.stopPropagation();
            // Poi controlliamo se possiamo prevenire l'azione predefinita
            if (event.cancelable) {
                event.preventDefault();
            }

            if (isDragging) return;

            if (!isFound) {
                const rect = container.getBoundingClientRect();

                // Determina le coordinate x,y in base al tipo di evento
                let clientX, clientY;

                if (event.type.startsWith('touch')) {
                   // Eventi touch - verifica che changedTouches sia disponibile e non vuoto
                    if (event.changedTouches && event.changedTouches.length > 0) {
                        // Verifica se l'evento è cancellabile prima di chiamare preventDefault
                        if (event.cancelable) {
                            event.preventDefault();
                        }

                        clientX = event.changedTouches[0].clientX;
                        clientY = event.changedTouches[0].clientY;
                    } else {
                        console.warn("Evento touch senza changedTouches validi");
                        return;
                    }
               } else if (event.touches) {
                    // Evento touch
                    clientX = event.touches[0].clientX;
                    clientY = event.touches[0].clientY;
                } else {
                    // Evento mouse
                    clientX = event.clientX;
                    clientY = event.clientY;
                }

                mouse.x = ((clientX - rect.left) / container.clientWidth) * 2 - 1;
                mouse.y = -((clientY - rect.top) / container.clientHeight) * 2 + 1;

                raycaster.setFromCamera(mouse, camera);
                const intersects = raycaster.intersectObject(mask);

                if (intersects.length > 0) {
                    const uv = intersects[0].uv;

                    if (uv) {
                        const x = Math.floor(uv.x * maskImage.width);
                        const y = Math.floor((1 - uv.y) * maskImage.height);
                        const pixel = maskImageContext.getImageData(x, y, 1, 1).data;

                        if (pixel[0] > 128 && pixel[1] > 128 && pixel[2] > 128) {
                            maskMaterial.uniforms.color.value = COLOR_GREEN.clone();
                            maskMaterial.uniforms.isMouseOver.value = 1;
                            container.style.cursor = "pointer";

                            if (isClick) {                        // Verifica se l'evento è cancellabile prima di chiamare preventDefault
                                if (event.cancelable) {
                                    event.preventDefault();
                                }
                                event.stopPropagation();


                                if (isTouch(event)) {
                                    vibrate();
                                }

                                document.getElementById("plaqueImage").src = './backend/' + plaque.image;
                                document.getElementById("inputsContainer").innerHTML = plaque.missingWords
                                    .map((word, idx) => `<input type="text" placeholder="parola n. ${idx+1}" required>`)
                                    .join("");

                                document.querySelector(".modal").classList.add("active");
                                document.querySelector(".overlay").classList.add("active");
                            }

                            return;
                        }
                    }
                }

                maskMaterial.uniforms.color.value = COLOR_MAGENTA.clone();
                maskMaterial.uniforms.isMouseOver.value = 0;
                container.style.cursor = "move";
            }
        };

        // Ottimizza gli event listener in base al dispositivo
        if (isMobile) {
            // Per dispositivi touch, NON usiamo passive: true per permettere preventDefault()
            container.addEventListener("touchmove", (e) => {
                if (handleInteraction(e)) {
                    e.stopPropagation();
                    if (e.cancelable) e.preventDefault();
                }
            });

            container.addEventListener("touchend", (e) => {
                if (handleInteraction(e, true)) {
                    e.stopPropagation();
                    if (e.cancelable) e.preventDefault();
                }
            });

        } else {
            // Per desktop, usiamo eventi mouse
            container.addEventListener("mousemove", (e) => handleInteraction(e));
            container.addEventListener("click", (e) => {
                if (handleInteraction(e, true)) {
                    e.stopPropagation();
                    e.preventDefault();
                }
            });
        }
    }

    const clock = new THREE.Clock;
    let lon = 0, lat = 0, phi = 0, theta = 0;
    let previousMouseX = 0, previousMouseY = 0;

    // Funzione di animazione ottimizzata
    function animate() {
        // Utilizza requestAnimationFrame con modalità efficiente per dispositivi mobili
        requestAnimationFrame(animate);

        // Aggiorna i controlli (con limitazioni per dispositivi mobili)
        if (!isMobile || !userInteracting) {
            controls.update();
        }

        if (autoRotationEnabled && !userInteracting && !isInertiaActive) {
            scene.rotation.y += autoRotationSpeed;
        } else if (isInertiaActive) {
            scene.rotation.y += rotationVelocity;
            rotationVelocity *= inertiaFactor;

            if (Math.abs(rotationVelocity) < 1e-4) {
                isInertiaActive = false;
            }
        }

        if (maskMaterial) {
            // Aggiorna l'animazione della maschera
            maskMaterial.uniforms.time.value = clock.getElapsedTime();
        }

        phi = THREE.MathUtils.degToRad(90 - lat);
        theta = THREE.MathUtils.degToRad(lon);

        camera.lookAt(
            500 * Math.sin(phi) * Math.cos(theta),
            500 * Math.cos(phi),
            500 * Math.sin(phi) * Math.sin(theta)
        );

        // Rendering ottimizzato per dispositivi mobili
        renderer.render(scene, camera);
    }

    animate();

    // Gestione ottimizzata degli eventi della ruota
    container.addEventListener("wheel", event => {
        event.preventDefault();

        // Zoom più controllato su dispositivi mobili
        const zoomFactor = isMobile ? 0.03 : 0.05;
        camera.fov += event.deltaY * zoomFactor;
        camera.fov = Math.max(10, Math.min(75, camera.fov));
        camera.updateProjectionMatrix();
    });

    container.addEventListener("mouseenter", () => {
        if (!isDragging) setCursor("move");
    });

    // Gestione ottimizzata degli eventi mouse
    container.addEventListener("mousedown", event => {
        isDragging = true;
        autoRotationEnabled = false;
        userInteracting = true;
        setCursor("grabbing");
        previousMouseX = event.clientX;
        previousMouseY = event.clientY;
    });

    container.addEventListener("mousemove", event => {
        if (isDragging) {
            const deltaX = event.clientX - previousMouseX;
            const deltaY = event.clientY - previousMouseY;

            lastDeltaX = deltaX;
            lon -= deltaX * 0.1;
            lat += deltaY * 0.1;

            // Limita l'inclinazione verticale
            lat = Math.max(-85, Math.min(85, lat));

            previousMouseX = event.clientX;
            previousMouseY = event.clientY;

            setCursor("grabbing");
        }
    });

    container.addEventListener("mouseup", () => {
        userInteracting = false;
        isDragging = false;

        // Calcola l'inerzia basata sull'ultimo movimento
        rotationVelocity = -lastDeltaX * 5e-4;
        rotationVelocity = Math.max(-maxRotationVelocity, Math.min(maxRotationVelocity, rotationVelocity));
        isInertiaActive = Math.abs(rotationVelocity) > 5e-4;

        setCursor("move");
    });

    container.addEventListener("mouseleave", () => {
        isDragging = false;
        setCursor("move");
    });

    // Variabili per il pinch zoom
    let initialPinchDistance = 0;
    let isPinching = false;
    // Aggiungi queste variabili per tracciare se stiamo trascinando e la distanza trascinata
    let touchStartTime = 0;
    let totalDragDistance = 0;

    // Ottimizza gestione eventi touch
// Modifica il touchstart
container.addEventListener("touchstart", event => {
    event.stopPropagation();
    if (event.cancelable) event.preventDefault();

    // Registra il tempo di inizio del touch
    touchStartTime = Date.now();
    // Reset della distanza totale di trascinamento
    totalDragDistance = 0;

    autoRotationEnabled = false;
    userInteracting = true;

    if (event.touches.length === 2) {
        // Gestione pinch zoom
        isPinching = true;
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        initialPinchDistance = Math.hypot(
            touch2.clientX - touch1.clientX,
            touch2.clientY - touch1.clientY
        );
    } else if (event.touches.length === 1) {
        // Gestione pannello singolo
        isDragging = true;
        previousMouseX = event.touches[0].clientX;
        previousMouseY = event.touches[0].clientY;

        // Reset lastDeltaX per evitare inerzia indesiderata
        lastDeltaX = 0;
    }
});

// Modifica il touchmove
container.addEventListener("touchmove", event => {
    event.stopPropagation();
    if (event.cancelable) event.preventDefault();

    if (isPinching && event.touches.length === 2) {
        // Gestione pinch zoom
        const touch1 = event.touches[0];
        const touch2 = event.touches[1];
        const currentPinchDistance = Math.hypot(
            touch2.clientX - touch1.clientX,
            touch2.clientY - touch1.clientY
        );

        const pinchDelta = currentPinchDistance - initialPinchDistance;

        // Zoom più lento su dispositivi mobili
        const zoomFactor = isMobile ? 0.25 : 0.35;
        camera.fov -= pinchDelta * zoomFactor;
        camera.fov = Math.max(10, Math.min(75, camera.fov));
        camera.updateProjectionMatrix();

        initialPinchDistance = currentPinchDistance;
    } else if (isDragging && event.touches.length === 1) {
        // Gestione pannello singolo
        const deltaX = event.touches[0].clientX - previousMouseX;
        const deltaY = event.touches[0].clientY - previousMouseY;

        // Aggiorna la distanza totale di trascinamento (usa il valore assoluto)
        totalDragDistance += Math.abs(deltaX) + Math.abs(deltaY);

        // Aggiorna lastDeltaX per l'inerzia
        lastDeltaX = deltaX;

        lon -= deltaX * 0.1;
        lat += deltaY * 0.1;

        // Limita l'inclinazione verticale
        lat = Math.max(-85, Math.min(85, lat));

        previousMouseX = event.touches[0].clientX;
        previousMouseY = event.touches[0].clientY;
    }
}, { passive: false });

// Modifica il touchend
container.addEventListener("touchend", event => {
    event.stopPropagation();
    if (event.cancelable) event.preventDefault();

    userInteracting = false;

    if (isPinching) {
        isPinching = false;

        if (event.touches.length === 1) {
            // Se rimane un dito, continua con il pannello
            isDragging = true;
            previousMouseX = event.touches[0].clientX;
            previousMouseY = event.touches[0].clientY;
        } else {
            isDragging = false;
        }
    } else if (isDragging) {
        isDragging = false;

        if (!isPinching) {
            // Calcola durata del tocco
            const touchDuration = Date.now() - touchStartTime;

            // Applica l'inerzia SOLO se:
            // 1. Il trascinamento è durato abbastanza (non un tap)
            // 2. La distanza trascinata è significativa
            // 3. C'è stato un movimento recente (lastDeltaX è significativo)
            const isDeliberateDrag = touchDuration > 100 && totalDragDistance > 20 && Math.abs(lastDeltaX) > 3;

            if (isDeliberateDrag) {
                // Calcola l'inerzia - ridotta su dispositivi mobili
                const inertiaMult = isMobile ? 0.003 : 0.005;
                rotationVelocity = -lastDeltaX * inertiaMult;
                rotationVelocity = Math.max(-maxRotationVelocity, Math.min(maxRotationVelocity, rotationVelocity));
                isInertiaActive = Math.abs(rotationVelocity) > 0.005;
            } else {
                // Non è stato un trascinamento deliberato, quindi non applicare inerzia
                rotationVelocity = 0;
                isInertiaActive = false;
            }
        }
    }
});


    container.addEventListener("touchcancel", () => {
        userInteracting = false;
        isDragging = false;
        isPinching = false;
    });

    // Gestione del ridimensionamento con ottimizzazione per mobile
    const handleResize = () => {
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
    };

    // Usa ResizeObserver per prestazioni migliori
    if (typeof ResizeObserver !== 'undefined') {
        const resizeObserver = new ResizeObserver(throttle(handleResize, 100));
        resizeObserver.observe(container);
    } else {
        // Fallback per browser più vecchi
        window.addEventListener("resize", throttle(handleResize, 100));
    }

    // Funzione di throttle per limitare le chiamate a funzioni intensive
    function throttle(func, delay) {
        let lastCall = 0;
        return function(...args) {
            const now = Date.now();
            if (now - lastCall >= delay) {
                lastCall = now;
                return func.apply(this, args);
            }
        };
    }


    // Se abbiamo una destinazione già selezionata, calcola il percorso
    if (currentDestination) {
        calculateRoute();
    }
}

function returnTo360(id=0, isFound=false){
    document.getElementById("map").style.display = "none";
    document.querySelector(".progress-container").style.display = "none";

    const locationScreen = document.getElementById("locationScreen");
    locationScreen.classList.add("active");

    let plaqueId = 0;
    if (id !== 0) {
        plaqueId = id;
    } else {
        plaqueId = userProgress.found.length + 1;
    }

    const currentPlaque = plaques.find(p => p.id === plaqueId);
    let locationMask = currentPlaque.locationBlurMaskImage;

    if (isFound) {
        locationMask = currentPlaque.locationBlurMaskSolvedImage;
    }

    if (currentPlaque && currentPlaque.locationImage) {
        document.getElementById("locationTitle").textContent = currentPlaque.locationTitle;
        document.getElementById("locationDescription").innerHTML = currentPlaque.locationDescription;

        // Ottimizzazione: usa dispositivo per scegliere qualità immagine
        display360InLocation(currentPlaque, plaqueId, isFound, locationMask);
    }
}

function updateStatus(){
    document.getElementById("counter_progress").innerHTML = userProgress.found.length;
    document.getElementById("of_counter_progress").innerHTML = plaques.length - 1;
}

function setTheme(themeName){
    if (themeName === "vintage") {
        document.documentElement.setAttribute("data-theme", "vintage");
    } else if (themeName === "grazia_deledda") {
        document.documentElement.setAttribute("data-theme", "grazia_deledda");
    } else if (themeName === "may") {
        document.documentElement.setAttribute("data-theme", "may");
    } else if (themeName === "july") {
        document.documentElement.setAttribute("data-theme", "july");
    } else if (themeName === "moderno") {
        document.documentElement.setAttribute("data-theme", "moderno");
    } else {
        document.documentElement.removeAttribute("data-theme");
    }

    localStorage.setItem("selectedTheme", themeName);
}

document.addEventListener("DOMContentLoaded", async () => {
    // Verifica se l'icona GPS esiste
    const gpsIconExists = await checkGpsIconExists();
    console.log("Icona GPS esiste:", gpsIconExists);

    if (!gpsIconExists) {
        console.warn("Attenzione: l'icona GPS non è stata trovata. Verrà utilizzato un marker predefinito.");
    }





    console.log("Inizializzazione dell'app...");

    // Verifica se ci sono variabili globali necessarie
    if (typeof positionWatchId === 'undefined') {
        window.positionWatchId = null;
    }

    if (typeof userPosition === 'undefined') {
        window.userPosition = null;
    }

    // Resto del codice di inizializzazione...
    document.getElementById("map").style.display = "none";
    document.querySelector(".progress-container").style.display = "none";
});

window.addEventListener("DOMContentLoaded", () => {
    setTheme("grazia_deledda");
    updateStatus();

    document.addEventListener("DOMContentLoaded", function() {
        const locationContent = document.querySelector(".location-content");

        if (locationContent) {
            locationContent.addEventListener("mousedown", function(e) {
                if (!e.target.closest(".location-actions button")) {
                    e.preventDefault();
                }
            });

            locationContent.addEventListener("touchstart", function(e) {
                if (!e.target.closest(".location-actions button")) {
                    e.preventDefault();
                }
            });

            locationContent.style.userSelect = "none";
            locationContent.style.webkitUserSelect = "none";
            locationContent.style.msUserSelect = "none";
            locationContent.style.mozUserSelect = "none";

            const buttons = locationContent.querySelectorAll(".location-actions button");
            buttons.forEach(button => {
                button.style.pointerEvents = "auto";
            });
        }
    });

    // Aggiungi listener per eventi di cambiamento orientamento
    if (isMobile) {
        window.addEventListener('orientationchange', () => {
            // Riaggiusta la mappa e la vista 360 dopo il cambio di orientamento
            setTimeout(() => {
                if (map && isMapInitialized) {
                    map.invalidateSize();
                }

                // Verifica se siamo nella vista 360
                const locationImage = document.getElementById('locationImage');
                if (locationImage && locationImage.scene) {
                    // Ridimensiona il renderer
                    const renderer = locationImage.querySelector('canvas');
                    if (renderer) {
                        renderer.style.width = '100%';
                        renderer.style.height = '100%';
                    }
                }
            }, 300);
        });
    }
});