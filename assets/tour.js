// Tour guidato per l'esperienza di foto panoramica 360°
const tourGuida = {
    steps: [
        {
            id: "benvenuto",
            title: "Benvenuto all'esperienza immersiva di Canne al Vento!",
            content: "Questo tour ti guiderà alla scoperta dei luoghi del celebre romanzo di Grazia Deledda attraverso immagini panoramiche interattive.",
            position: "center"
        },
        {
            id: "rotazione",
            title: "Esplora a 360°",
            content: "Trascina con il dito o con il mouse per ruotare la vista panoramica e guardare in tutte le direzioni. Prova a fare un giro completo per scoprire l'ambiente che ti circonda!",
            position: "bottom"
        },
        {
            id: "hotspot",
            title: "Cerca le aree speciali",
            content: "Mentre esplori, cerca le aree evidenziate di colore magenta che lampeggiano nell'immagine. Queste sono zone interattive che nascondono informazioni speciali.",
            position: "right"
        },
        {
            id: "interazione",
            title: "Interagisci con le aree evidenziate",
            content: "Quando passi il mouse sopra un'area interattiva, diventa verde. Cliccala per scoprire una targa con un indovinello legato al romanzo di Grazia Deledda.",
            position: "left"
        },
        {
            id: "indovinello",
            title: "Risolvi l'indovinello",
            content: "Ogni targa contiene una citazione del libro con alcune parole mancanti. Completa le frasi inserendo le parole corrette per procedere nella caccia al tesoro.",
            position: "bottom"
        },
        {
            id: "mappa",
            title: "Cerca sulla mappa",
            content: "Dopo aver esplorato la scena, clicca sul pulsante 'Cerca sulla mappa' per vedere la posizione esatta di questo luogo e come raggiungerlo.",
            position: "top"
        }
    ],

    currentStep: 0,
    active: false,
    tourElement: null,
    pointer: null,
    maskFound: false,
    modalOpened: false,
    areaHovered: false,
    initialized: false,

    init: function() {
        if (this.initialized) return;

        // Crea l'elemento DOM per il tour
        this.createTourElement();

        // Aggiungi gli stili CSS
        this.addStyles();

        this.initialized = true;

        console.log('Tour guida inizializzato');
    },

    createTourElement: function() {
        this.tourElement = document.createElement('div');
        this.tourElement.className = 'tour-popup';
        document.body.appendChild(this.tourElement);

        this.pointer = document.createElement('div');
        this.pointer.className = 'pointer-animation';
        document.body.appendChild(this.pointer);
    },

    addStyles: function() {
        const styleElement = document.createElement('style');
        styleElement.textContent = `
            .tour-popup {
                position: fixed;
                bottom: 20%;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(255, 255, 255, 0.95);
                border-radius: 8px;
                padding: 20px;
                max-width: 85%;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
                z-index: 10000;
                text-align: center;
                animation: fadeIn 0.3s ease-in-out;
                display: none;
                color: #333;
            }

            .tour-popup h3 {
                margin-top: 0;
                color: var(--primary-color, #2c3e50);
                font-size: 1.3rem;
            }

            .tour-popup p {
                margin-bottom: 20px;
                line-height: 1.5;
                font-size: 1rem;
            }

            .tour-popup button {
                padding: 8px 16px;
                border: none;
                border-radius: 4px;
                margin: 0 5px;
                cursor: pointer;
                font-size: 0.9rem;
            }

            .tour-next {
                background-color: var(--primary-color, #2c3e50);
                color: white;
            }

            .tour-skip {
                background-color: transparent;
                color: var(--secondary-color, #3498db);
            }

            .highlight-area {
                position: fixed;
                pointer-events: none;
                border: 3px solid #ff00ff;
                border-radius: 50%;
                z-index: 9999;
                animation: pulse 1.5s infinite;
                opacity: 0.7;
            }

            .pointer-animation {
                position: fixed;
                top: 20% !important;
                width: 40px;
                height: 40px;
                pointer-events: none;
                z-index: 9999;
                transition: all 0.5s ease;
                display: none;
                font-size: 40px;
                text-align: center;
                line-height: 50px;
            }

            @keyframes pulse {
                0% {
                    box-shadow: 0 0 0 0 rgba(255, 0, 255, 0.7);
                }
                70% {
                    box-shadow: 0 0 0 15px rgba(255, 0, 255, 0);
                }
                100% {
                    box-shadow: 0 0 0 0 rgba(255, 0, 255, 0);
                }
            }

            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }

            .mock-hotspot {
                position: fixed;
                width: 80px;
                height: 80px;
                background-color: rgba(255, 0, 255, 0.5);
                border-radius: 50%;
                animation: pulse 1.5s infinite;
                pointer-events: none;
                z-index: 999;
                display: none;
            }

            .highlight-button {
                animation: pulse 1.5s infinite !important;
            }
        `;
        document.head.appendChild(styleElement);
    },

    startTour: function() {
        if (!this.initialized) {
            this.init();
        }

        this.active = true;
        this.currentStep = 0;
        this.maskFound = false;
        this.modalOpened = false;
        this.areaHovered = false;
        this.showStep(this.currentStep);

        // Aggiungi listener per rilevare il movimento del mouse/touch
        this.addEventListeners();

        console.log('Tour guida avviato');
    },

    addEventListeners: function() {
        // Listener per la rotazione della panoramica
        const container = document.getElementById('locationImage');
        if (!container) {
            console.log('Container locationImage non trovato');
            return;
        }

        // Monitora il movimento del mouse per rilevare la rotazione della vista
        let mouseMovements = 0;
        const mouseListener = (e) => {
            if (this.active && this.currentStep === 1) {
                // Se l'utente sta trascinando, conteggia il movimento
                if (e.buttons === 1) {
                    mouseMovements += Math.abs(e.movementX) + Math.abs(e.movementY);
                    if (mouseMovements > 300) {
                        // L'utente ha ruotato abbastanza la vista
                        setTimeout(() => {
                            if (this.currentStep === 1) {
                                this.nextStep();
                            }
                        }, 1000);
                    }
                }
            }
        };

        container.addEventListener('mousemove', mouseListener);
        this._mouseListener = mouseListener; // Salva per rimozione

        // Monitora il touch per i dispositivi mobili
        let touchStartX = 0, touchStartY = 0;
        const touchStartListener = (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        };

        container.addEventListener('touchstart', touchStartListener);
        this._touchStartListener = touchStartListener; // Salva per rimozione

        const touchMoveListener = (e) => {
            if (this.active && this.currentStep === 1) {
                const touchX = e.touches[0].clientX;
                const touchY = e.touches[0].clientY;
                const moveX = Math.abs(touchX - touchStartX);
                const moveY = Math.abs(touchY - touchStartY);

                mouseMovements += moveX + moveY;
                if (mouseMovements > 300) {
                    // L'utente ha ruotato abbastanza la vista
                    setTimeout(() => {
                        if (this.currentStep === 1) {
                            this.nextStep();
                        }
                    }, 1000);
                }

                touchStartX = touchX;
                touchStartY = touchY;
            }
        };

        container.addEventListener('touchmove', touchMoveListener);
        this._touchMoveListener = touchMoveListener; // Salva per rimozione

        // Monitora gli eventi mouseover per rilevare quando l'hotspot diventa verde
        const mouseoverListener = (e) => {
            if (this.active && this.currentStep === 3 && !this.areaHovered) {
                // Verifica se è un elemento hotspot o un suo discendente
                let targetElement = e.target;

                // Trova l'elemento hotspot risalendo nella gerarchia degli elementi
                while (targetElement &&
                      !(targetElement.classList &&
                       (targetElement.classList.contains('hotspot') ||
                        targetElement.classList.contains('interactive-area') ||
                        targetElement.hasAttribute('data-interactive')))) {

                    // Se l'elemento corrente ha uno stile con background-color verde,
                    // consideriamo che siamo sopra un hotspot
                    const computedStyle = window.getComputedStyle(targetElement);
                    const backgroundColor = computedStyle.backgroundColor;

                    // Verifica se il background è verde (include varie tonalità di verde)
                    if (backgroundColor.includes('rgb(0, 128, 0)') ||
                        backgroundColor.includes('rgb(0, 255, 0)') ||
                        backgroundColor.includes('rgb(144, 238, 144)') ||
                        backgroundColor.includes('rgba(0, 128, 0') ||
                        backgroundColor.includes('rgba(0, 255, 0') ||
                        backgroundColor.includes('rgba(144, 238, 144') ||
                        backgroundColor.includes('#00ff00') ||
                        backgroundColor.includes('#00cc00') ||
                        backgroundColor.includes('#008000') ||
                        backgroundColor.includes('#90ee90')) {

                        // Hotspot diventa verde
                        this.areaHovered = true;

                        // Passa allo step successivo dopo un breve ritardo
                        setTimeout(() => {
                            if (this.currentStep === 3) {
                                this.nextStep();
                            }
                        }, 1500); // Passa allo step successivo dopo 1.5 secondi
                        break;
                    }

                    // Se non è stato rilevato un background verde, continua a risalire nella gerarchia
                    targetElement = targetElement.parentElement;
                }
            }
        };

        document.addEventListener('mouseover', mouseoverListener);
        this._mouseoverListener = mouseoverListener; // Salva per rimozione

        // Monitora i click per rilevare interazione con gli hotspot
        const clickListener = (e) => {
            // Verifica se siamo allo step 3 (interazione con hotspot)
            if (this.active && this.currentStep === 3) {
                // Controlla se il click è su una zona interattiva
                if (e.target.classList &&
                   (e.target.classList.contains('hotspot') ||
                    e.target.classList.contains('interactive-area') ||
                    e.target.hasAttribute('data-interactive'))) {

                    // Segna che è stata cliccata un'area interattiva
                    this.areaClicked = true;

                    // Passa allo step successivo dopo un breve ritardo per permettere all'utente
                    // di vedere l'indovinello
                    setTimeout(() => {
                        if (this.currentStep === 3 && this.areaClicked) {
                            this.nextStep();
                        }
                    }, 2000);
                }
            }
        };

        container.addEventListener('click', clickListener);
        this._clickListener = clickListener; // Salva per rimozione

        // Monitora il documento per rilevare aperture di modal
        const documentClickListener = (e) => {
            // Per lo step 3 (interazione con hotspot)
            if (this.active && this.currentStep === 3) {
                // Controlla tutto il documento per rilevare aperture di modal
                setTimeout(() => {
                    const modal = document.querySelector('.modal, .dialog, .popup, [role="dialog"]');
                    if (modal && window.getComputedStyle(modal).display !== 'none') {
                        // Modal rilevata, passa allo step successivo
                        if (!this.modalOpened) {
                            this.modalOpened = true;
                            setTimeout(() => {
                                if (this.currentStep === 3) {
                                    this.nextStep();
                                }
                            }, 2000); // Attendere 2 secondi per dare all'utente il tempo di vedere l'indovinello
                        }
                    }
                }, 300);
            }

            // Per lo step 5 (mappa)
            if (this.active && this.currentStep === 5) {
                if (e.target.classList.contains('start-button') &&
                    e.target.textContent.includes('Cerca sulla mappa')) {
                    setTimeout(() => this.endTour(), 1000);
                }
            }
        };

        document.addEventListener('click', documentClickListener);
        this._documentClickListener = documentClickListener; // Salva per rimozione

        // Monitora il submit del form dell'indovinello
        const formSubmitListener = (e) => {
            if (this.active && this.currentStep === 4) {
                // Se è stato inviato un form, passa allo step successivo
                if (e.target && e.target.tagName === 'FORM') {
                    e.preventDefault(); // Previeni il comportamento predefinito
                    setTimeout(() => {
                        if (this.currentStep === 4) {
                            this.nextStep();
                        }
                    }, 1000);
                }
            }
        };

        document.addEventListener('submit', formSubmitListener);
        this._formSubmitListener = formSubmitListener; // Salva per rimozione

        // Osservatore di mutazioni per rilevare cambiamenti di colore negli elementi hotspot
        const styleObserver = new MutationObserver((mutations) => {
            if (this.active && this.currentStep === 3 && !this.areaHovered) {
                // Cerca elementi che potrebbero essere diventati verdi
                const possibleHotspots = document.querySelectorAll('.hotspot, .interactive-area, [data-interactive="true"], [class*="hotspot"], [class*="interactive"]');

                possibleHotspots.forEach(element => {
                    const computedStyle = window.getComputedStyle(element);
                    const backgroundColor = computedStyle.backgroundColor;
                    const borderColor = computedStyle.borderColor;

                    // Verifica colore verde nel background o nel bordo
                    if ((backgroundColor.includes('rgb(0, 128, 0)') ||
                         backgroundColor.includes('rgb(0, 255, 0)') ||
                         backgroundColor.includes('rgb(144, 238, 144)') ||
                         backgroundColor.includes('rgba(0, 128, 0') ||
                         backgroundColor.includes('rgba(0, 255, 0') ||
                         backgroundColor.includes('rgba(144, 238, 144') ||
                         backgroundColor.includes('#00ff00') ||
                         backgroundColor.includes('#00cc00') ||
                         backgroundColor.includes('#008000') ||
                         backgroundColor.includes('#90ee90')) ||
                        (borderColor.includes('rgb(0, 128, 0)') ||
                         borderColor.includes('rgb(0, 255, 0)') ||
                         borderColor.includes('rgb(144, 238, 144)') ||
                         borderColor.includes('#00ff00') ||
                         borderColor.includes('#00cc00') ||
                         borderColor.includes('#008000') ||
                         borderColor.includes('#90ee90'))) {

                        // Elemento hotspot diventato verde
                        this.areaHovered = true;

                        // Passa allo step successivo dopo un ritardo
                        setTimeout(() => {
                            if (this.currentStep === 3 && !this.modalOpened) {
                                this.nextStep();
                            }
                        }, 1500);
                    }
                });
            }
        });

        // Osservatore di mutazioni per rilevare quando compaiono elementi interattivi
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'childList' && this.active) {
                    // Cerca elementi canvas (dove viene renderizzata la scena Three.js)
                    const canvas = container.querySelector('canvas');

                    if (canvas) {
                        // Se siamo allo step 2 e la maschera non è ancora stata trovata
                        if (this.currentStep === 2 && !this.maskFound) {
                            // Cerca aree interattive/hotspot
                            const hotspots = document.querySelectorAll('.hotspot, .interactive-area, [data-interactive="true"]');

                            if (hotspots && hotspots.length > 0) {
                                // Un'area cliccabile è apparsa
                                this.maskFound = true;

                                // Crea un mock hotspot per guidare l'utente
                                this.createMockHotspot();

                                // Attendi un momento per permettere all'utente di notare l'area cliccabile
                                setTimeout(() => {
                                    // Passa allo step successivo automaticamente
                                    if (this.currentStep === 2) {
                                        this.nextStep();
                                    }
                                }, 3000); // Passa allo step successivo dopo 3 secondi
                            }
                        }
                    }

                    // Controlla se appare un modal (per step 3)
                    if (this.currentStep === 3 && !this.modalOpened) {
                        const modal = document.querySelector('.modal, .dialog, .popup, [role="dialog"]');
                        if (modal && window.getComputedStyle(modal).display !== 'none') {
                            this.modalOpened = true;

                            // Passa allo step successivo
                            setTimeout(() => {
                                if (this.currentStep === 3) {
                                    this.nextStep();
                                }
                            }, 2000);
                        }
                    }
                }

                // Verifica anche cambiamenti di attributi che potrebbero indicare un hotspot attivo
                if (mutation.type === 'attributes' && this.active && this.currentStep === 3 && !this.areaHovered) {
                    const target = mutation.target;

                    // Controlla se l'elemento è un hotspot o simile
                    if (target.classList &&
                        (target.classList.contains('hotspot') ||
                         target.classList.contains('interactive-area') ||
                         target.hasAttribute('data-interactive'))) {

                        // Controlla il colore dell'elemento
                        const style = window.getComputedStyle(target);
                        const backgroundColor = style.backgroundColor;

                        // Verifica se il background è verde
                        if (backgroundColor.includes('rgb(0, 128, 0)') ||
                            backgroundColor.includes('rgb(0, 255, 0)') ||
                            backgroundColor.includes('rgb(144, 238, 144)') ||
                            backgroundColor.includes('rgba(0, 128, 0') ||
                            backgroundColor.includes('rgba(0, 255, 0') ||
                            backgroundColor.includes('rgba(144, 238, 144') ||
                            backgroundColor.includes('#00ff00') ||
                            backgroundColor.includes('#00cc00') ||
                            backgroundColor.includes('#008000') ||
                            backgroundColor.includes('#90ee90')) {

                            // Hotspot diventa verde
                            this.areaHovered = true;

                            // Passa allo step successivo
                            setTimeout(() => {
                                if (this.currentStep === 3 && !this.modalOpened) {
                                    this.nextStep();
                                }
                            }, 1500);
                        }
                    }
                }
            });
        });

        // Osserva il contenitore principale e tutto il documento
        if (container) {
            observer.observe(container, {childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class']});
            styleObserver.observe(container, {attributes: true, subtree: true, attributeFilter: ['style', 'class']});
        }
        observer.observe(document.body, {childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class']});
        styleObserver.observe(document.body, {attributes: true, subtree: true, attributeFilter: ['style', 'class']});

        this._observer = observer; // Salva per rimozione
        this._styleObserver = styleObserver; // Salva per rimozione
    },

    createMockHotspot: function() {
        // Se abbiamo già creato un mockHotspot, non crearne un altro
        if (this.mockHotspot) return;

        const container = document.getElementById('locationImage');
        if (!container) return;

        // Cerca un hotspot esistente da cui prendere posizione
        const existingHotspot = document.querySelector('.hotspot, .interactive-area, [data-interactive="true"]');

        // Crea un mock hotspot
        const mockHotspot = document.createElement('div');
        mockHotspot.className = 'mock-hotspot';
        document.body.appendChild(mockHotspot);

        // Posiziona il mock hotspot in una posizione visibile
        const rect = container.getBoundingClientRect();

        if (existingHotspot) {
            // Se esiste un hotspot, posiziona il mockHotspot vicino ad esso
            const hotspotRect = existingHotspot.getBoundingClientRect();
            mockHotspot.style.left = hotspotRect.left + 'px';
            mockHotspot.style.top = hotspotRect.top + 'px';
        } else {
            // Altrimenti, posiziona il mockHotspot al centro della scena
            mockHotspot.style.left = (rect.left + rect.width * 0.5 - 40) + 'px';
            mockHotspot.style.top = (rect.top + rect.height * 0.5 - 40) + 'px';
        }

        mockHotspot.style.display = 'block';

        // Mostra il puntatore vicino all'hotspot
        this.pointer.style.display = 'block';
        this.pointer.innerHTML = '👆'; // Emoji di mano che punta
        this.pointer.style.backgroundImage = 'none';
        this.pointer.style.fontSize = '40px';
        this.pointer.style.textAlign = 'center';
        this.pointer.style.lineHeight = '50px';
        this.pointer.style.width = '50px';
        this.pointer.style.height = '50px';
        this.pointer.style.left = (parseFloat(mockHotspot.style.left) - 60) + 'px';
        this.pointer.style.top = (parseFloat(mockHotspot.style.top) - 20) + 'px';

        // Memorizza per la pulizia
        this.mockHotspot = mockHotspot;
    },

    showStep: function(index) {
        const step = this.steps[index];

        // Aggiorna il contenuto del popup
        this.tourElement.innerHTML = `
            <h3>${step.title}</h3>
            <p>${step.content}</p>
            <button class="tour-next">Continua</button>
            <button class="tour-skip">Salta tour</button>
        `;

        // Mostra il popup
        this.tourElement.style.display = 'block';

        // Posiziona il popup in base all'opzione position
        switch(step.position) {
            case 'top':
                this.tourElement.style.bottom = 'auto';
                this.tourElement.style.top = '20%';
                break;
            case 'bottom':
                this.tourElement.style.top = 'auto';
                this.tourElement.style.bottom = '20%';
                break;
            case 'center':
                this.tourElement.style.top = '50%';
                this.tourElement.style.bottom = 'auto';
                this.tourElement.style.transform = 'translate(-50%, -50%)';
                break;
            default:
                this.tourElement.style.top = 'auto';
                this.tourElement.style.bottom = '20%';
                this.tourElement.style.transform = 'translateX(-50%)';
        }

        // Aggiungi ascoltatori per i pulsanti
        this.tourElement.querySelector('.tour-next').addEventListener('click', () => this.nextStep());
        this.tourElement.querySelector('.tour-skip').addEventListener('click', () => this.endTour());

        // Step-specific actions
        switch(index) {
            case 1: // Rotazione della vista
                this.showDragAnimation();
                break;
            case 2: // Cercare gli hotspot
                this.pointer.style.display = 'none';
                // La creazione del mock hotspot avviene in addEventListeners quando la maschera viene caricata
                break;
            case 3: // Interazione con gli hotspot
                // Resetta il flag per l'interazione
                this.areaClicked = false;
                this.modalOpened = false;
                this.areaHovered = false;

                // Mostra il puntatore sull'hotspot
                if (this.mockHotspot) {
                    this.pointer.style.display = 'block';

                    // Anima il puntatore per simulare un hover e click
                    const rect = this.mockHotspot.getBoundingClientRect();
                    this.pointer.style.left = (rect.left - 20) + 'px';
                    this.pointer.style.top = (rect.top + 20) + 'px';

                    // Animazione di hover e click
                    const hoverClickAnimation = () => {
                        // Movimento verso l'hotspot (hover)
                        this.pointer.style.left = (rect.left + 20) + 'px';
                        this.pointer.style.top = (rect.top + 20) + 'px';

                        // Piccola pausa per dimostrare l'hover
                        setTimeout(() => {
                            // Cambia il colore del mock hotspot per simulare l'effetto verde
                            if (!this.areaHovered) {
                                this.mockHotspot.style.backgroundColor = 'rgba(0, 255, 0, 0.5)';
                            }

                            // Simula il click dopo l'hover
                            setTimeout(() => {
                                this.pointer.style.transform = 'scale(0.8)';
                                setTimeout(() => {
                                    this.pointer.style.transform = 'scale(1)';

                                    // Ritorna alla posizione originale
                                    setTimeout(() => {
                                        this.pointer.style.left = (rect.left - 20) + 'px';
                                        this.pointer.style.top = (rect.top + 20) + 'px';

                                        // Ripristina il colore se necessario
                                        if (!this.areaHovered) {
                                            this.mockHotspot.style.backgroundColor = 'rgba(255, 0, 255, 0.5)';
                                        }

                                        // Ripeti l'animazione se siamo ancora in questo step
                                        if (this.active && this.currentStep === 3 && !this.areaHovered && !this.areaClicked && !this.modalOpened) {
                                            setTimeout(hoverClickAnimation, 1500);
                                        }
                                    }, 1000);
                                }, 200);
                            }, 800);
                        }, 800);
                    };

                    // Avvia l'animazione
                    hoverClickAnimation();
                }
                break;
            case 4: // Indovinello
                this.pointer.style.display = 'none';
                // Nascondi il mock hotspot
                if (this.mockHotspot) {
                    this.mockHotspot.style.display = 'none';
                }
                break;
            case 5: // Mappa
                // Evidenzia il pulsante "Cerca sulla mappa"
                const mapButton = document.querySelector('.start-button');
                if (mapButton && mapButton.textContent.includes('Cerca sulla mappa')) {
                    // Aggiungi highlight
                    mapButton.classList.add('highlight-button');

                    // Mostra il puntatore sul pulsante
                    const rect = mapButton.getBoundingClientRect();
                    this.pointer.style.display = 'block';
                    this.pointer.innerHTML = '👆';
                    this.pointer.style.left = (rect.left + rect.width/2 - 20) + 'px';
                    this.pointer.style.top = (rect.top - 40) + 'px';

                    // Animazione di click sul pulsante
                    const mapClickAnimation = () => {
                        // Movimento verso il pulsante
                        this.pointer.style.left = (rect.left + rect.width/2) + 'px';
                        this.pointer.style.top = (rect.top + rect.height/2) + 'px';

                        // Simula il click
                        setTimeout(() => {
                            this.pointer.style.transform = 'scale(0.8)';
                            setTimeout(() => {
                                this.pointer.style.transform = 'scale(1)';

                                // Ritorna alla posizione originale
                                setTimeout(() => {
                                                                        this.pointer.style.left = (rect.left + rect.width/2 - 20) + 'px';
                                    this.pointer.style.top = (rect.top - 40) + 'px';

                                    // Ripeti l'animazione se siamo ancora in questo step
                                    if (this.active && this.currentStep === 5) {
                                        setTimeout(mapClickAnimation, 2000);
                                    }
                                }, 1000);
                            }, 200);
                        }, 500);
                    };

                    // Avvia l'animazione
                    mapClickAnimation();
                }
                break;
        }
    },

    showDragAnimation: function() {
        const container = document.getElementById('locationImage');
        if (!container) return;

        const rect = container.getBoundingClientRect();

        // Utilizziamo un'icona HTML invece di SVG
        this.pointer.innerHTML = '👆'; // Emoji di mano che punta
        this.pointer.style.backgroundImage = 'none';
        this.pointer.style.fontSize = '40px';
        this.pointer.style.textAlign = 'center';
        this.pointer.style.lineHeight = '50px';
        this.pointer.style.width = '50px';
        this.pointer.style.height = '50px';
        this.pointer.style.display = 'block';
        this.pointer.style.left = (rect.left + rect.width * 0.3) + 'px';
        this.pointer.style.top = (rect.top + rect.height * 0.5) + 'px';

        // Variazione: alternare tra due emoji per simulare il gesto di trascinamento
        let usingDragEmoji = false;

        // Animazione del trascinamento
        const animateDrag = () => {
            // Cambia l'emoji per simulare il trascinamento
            if (!usingDragEmoji) {
                this.pointer.innerHTML = '✊'; // Mano chiusa (simulando il trascinamento)
                this.pointer.style.transform = 'scale(0.9)';
                usingDragEmoji = true;
            }

            // Mostra l'effetto di trascinamento
            setTimeout(() => {
                this.pointer.style.left = (rect.left + rect.width * 0.7) + 'px';
            }, 500);

            // Ripristina lo stile
            setTimeout(() => {
                // Cambia di nuovo l'emoji quando rilascia
                this.pointer.innerHTML = '👆';
                this.pointer.style.transform = 'scale(1)';
                usingDragEmoji = false;

                // Ritorna alla posizione iniziale (con transizione più rapida)
                setTimeout(() => {
                    this.pointer.style.transition = 'left 0.3s ease';
                    this.pointer.style.left = (rect.left + rect.width * 0.3) + 'px';

                    // Ripristina la transizione normale e ricomincia
                    setTimeout(() => {
                        this.pointer.style.transition = 'all 0.5s ease';
                        // Esegui l'animazione ancora una volta
                        if (this.active && this.currentStep === 1) {
                            animateDrag();
                        }
                    }, 500);
                }, 1000);
            }, 1500);
        };

        // Avvia l'animazione
        animateDrag();

        // Salva il riferimento all'intervallo per poterlo cancellare quando necessario
        this._dragAnimationTimeout = setTimeout(() => {
            // Ferma l'animazione dopo un certo numero di ripetizioni
            if (this.pointer.style.display !== 'none') {
                this.pointer.style.transition = 'all 0.5s ease';
            }
        }, 15000); // Interrompi dopo 15 secondi
    },

    nextStep: function() {
        // Incrementa lo step
        this.currentStep++;

        // Se abbiamo completato tutti gli step, termina il tour
        if (this.currentStep >= this.steps.length) {
            this.endTour();
            return;
        }

        // Mostra il prossimo step
        this.showStep(this.currentStep);
    },

    cleanupAnimations: function() {
        // Nascondi il puntatore
        if (this.pointer) {
            this.pointer.style.display = 'none';
        }

        // Rimuovi il mock hotspot
        if (this.mockHotspot && this.mockHotspot.parentNode) {
            document.body.removeChild(this.mockHotspot);
            this.mockHotspot = null;
        }

        // Rimuovi evidenziazioni dai pulsanti
        document.querySelectorAll('.highlight-button').forEach(el => {
            el.classList.remove('highlight-button');
        });

        // Cancella i timeout delle animazioni
        if (this._dragAnimationTimeout) {
            clearTimeout(this._dragAnimationTimeout);
        }
    },

    cleanupListeners: function() {
        // Rimuovi tutti i listener di eventi
        const container = document.getElementById('locationImage');
        if (container) {
            if (this._mouseListener) container.removeEventListener('mousemove', this._mouseListener);
            if (this._touchStartListener) container.removeEventListener('touchstart', this._touchStartListener);
            if (this._touchMoveListener) container.removeEventListener('touchmove', this._touchMoveListener);
            if (this._clickListener) container.removeEventListener('click', this._clickListener);
        }

        if (this._mouseoverListener) {
            document.removeEventListener('mouseover', this._mouseoverListener);
        }

        if (this._documentClickListener) {
            document.removeEventListener('click', this._documentClickListener);
        }

        if (this._formSubmitListener) {
            document.removeEventListener('submit', this._formSubmitListener);
        }

        if (this._observer) {
            this._observer.disconnect();
        }

        if (this._styleObserver) {
            this._styleObserver.disconnect();
        }
    },

    endTour: function() {
        // Nascondi il tour
        this.tourElement.style.display = 'none';
        this.active = false;

        // Pulisci le animazioni
        this.cleanupAnimations();

        // Rimuovi i listener
        this.cleanupListeners();

        // Salva lo stato del tour
        localStorage.setItem('tourCompletato', 'true');

        console.log('Tour guida terminato');
    }
};

// Avvia il tour quando viene premuto il pulsante Start
document.addEventListener('DOMContentLoaded', function() {
    // Inizializza il tour (senza avviarlo)
    tourGuida.init();

    // Metodo diretto: aggiungi un listener globale per il click sul pulsante Start
    document.addEventListener('click', function(e) {
        // Verifica se l'elemento cliccato è il pulsante Start
        if (e.target && e.target.id === 'startButton') {
            console.log('Pulsante Start cliccato');

            // Controlla se il tour è già stato completato
            const tourCompletato = localStorage.getItem('tourCompletato') === 'true';

            if (!tourCompletato) {
                // Attendi che la vista panoramica venga caricata
                const checkForPanorama = setInterval(function() {
                    const locationScreen = document.getElementById('locationScreen');
                    const isVisible = locationScreen &&
                                      window.getComputedStyle(locationScreen).display !== 'none';

                    if (isVisible) {
                        clearInterval(checkForPanorama);

                        // Attendi che il canvas di Three.js venga creato
                        const checkForCanvas = setInterval(function() {
                            const container = document.getElementById('locationImage');
                            const hasCanvas = container && container.querySelector('canvas');

                            if (hasCanvas) {
                                clearInterval(checkForCanvas);

                                // Attendi un po' per assicurarti che tutto sia renderizzato
                                setTimeout(() => {
                                    tourGuida.startTour();
                                }, 500);
                            }
                        }, 500); // Controlla ogni 500ms
                    }
                }, 500); // Controlla ogni 500ms
            }
        }
    });

    // Supporto per pulsanti con attributo data-id="startButton" (nel caso in cui il pulsante non abbia un ID)
    document.addEventListener('click', function(e) {
        if (e.target && e.target.getAttribute('data-id') === 'startButton') {
            console.log('Pulsante Start (con data-id) cliccato');

            // Controlla se il tour è già stato completato
            const tourCompletato = localStorage.getItem('tourCompletato') === 'true';

            if (!tourCompletato) {
                // Stesso processo del caso precedente
                const checkForPanorama = setInterval(function() {
                    const locationScreen = document.getElementById('locationScreen');
                    const isVisible = locationScreen &&
                                      window.getComputedStyle(locationScreen).display !== 'none';

                    if (isVisible) {
                        clearInterval(checkForPanorama);

                        const checkForCanvas = setInterval(function() {
                            const container = document.getElementById('locationImage');
                            const hasCanvas = container && container.querySelector('canvas');

                            if (hasCanvas) {
                                clearInterval(checkForCanvas);

                                setTimeout(() => {
                                    tourGuida.startTour();
                                }, 500);
                            }
                        }, 500);
                    }
                }, 500);
            }
        }
    });

    // Supporto per elementi che contengono il testo "Inizia l'avventura"
    document.addEventListener('click', function(e) {
        if (e.target && e.target.textContent && e.target.textContent.includes("Inizia l'avventura")) {
            console.log('Pulsante "Inizia l\'avventura" cliccato');

            // Controlla se il tour è già stato completato
            const tourCompletato = localStorage.getItem('tourCompletato') === 'true';

            if (!tourCompletato) {
                // Stesso processo dei casi precedenti
                const checkForPanorama = setInterval(function() {
                    const locationScreen = document.getElementById('locationScreen');
                    const isVisible = locationScreen &&
                                      window.getComputedStyle(locationScreen).display !== 'none';

                    if (isVisible) {
                        clearInterval(checkForPanorama);

                        const checkForCanvas = setInterval(function() {
                            const container = document.getElementById('locationImage');
                            const hasCanvas = container && container.querySelector('canvas');

                            if (hasCanvas) {
                                clearInterval(checkForCanvas);

                                setTimeout(() => {
                                    tourGuida.startTour();
                                }, 500);
                            }
                        }, 500);
                    }
                }, 500);
            }
        }
    });

    // Opzione per bypassare il tour completato (per test)
    // Uncomment per testare: localStorage.removeItem('tourCompletato');
});