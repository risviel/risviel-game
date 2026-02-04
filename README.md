# Caccia al Tesoro - Canne al Vento
Un'esperienza interattiva di caccia al tesoro letteraria ispirata al romanzo "Canne al Vento" di Grazia Deledda.
## 📖 Descrizione
Questa applicazione web permette agli utenti di esplorare un percorso tematico attraverso targhe letterarie disseminate sul territorio. Ogni targa contiene estratti dal celebre romanzo di Grazia Deledda e sfide interattive che guidano i partecipanti attraverso un viaggio culturale e educativo.
## ✨ Caratteristiche Principali
- **Sistema di Geolocalizzazione GPS** per tracciare la posizione dell'utente in tempo reale
- **Mappa Interattiva** con marcatori delle targhe e percorso ottimizzato
- **10 Targhe Letterarie** con citazioni originali dal romanzo
- **Quiz Interattivi** per completare le frasi mancanti
- **Riproduzione Audio** delle citazioni letterarie
- **Sistema di Progressione** con salvataggio automatico
- **Interfaccia Responsive** ottimizzata per dispositivi mobili
- **Temi Personalizzabili** (moderno, vintage, letterario)

## 🗂️ Struttura del Progetto
``` 
game/
├── assets/              # Risorse statiche
│   ├── images/         # Icone e immagini
│   ├── *.js           # Librerie JavaScript
│   └── *.css          # Fogli di stile
├── backend/            # Sistema di gestione
│   ├── admin/         # Pannello amministrativo
│   ├── api/           # Endpoint API
│   ├── config/        # Configurazioni
│   ├── data/          # Database JSON
│   └── includes/      # Funzioni PHP
├── img/               # Immagini dell'applicazione
├── index.html         # Pagina principale
└── mappa.html         # Mappa alternativa
```

## 🚀 Installazione
1. Clona il repository o scarica i file
2. Posiziona la cartella `game/` nella root del tuo server web
3. Assicurati che il server abbia PHP abilitato per le funzionalità backend
4. Configura i permessi di scrittura per la cartella `backend/data/`

## 💻 Requisiti
- Server web (Apache/Nginx)
- PHP 7.0 o superiore
- Browser moderno con supporto Geolocalizzazione
- Connessione internet per le mappe OpenStreetMap

## 🎮 Utilizzo
1. Apri l'applicazione dal browser
2. Consenti l'accesso alla posizione GPS
3. Clicca su "Inizia l'Avventura"
4. Segui il percorso verso la prima targa
5. Raggiungi la posizione indicata sulla mappa
6. Completa il quiz letterario
7. Ascolta l'audio della citazione
8. Prosegui verso la targa successiva

## 🛠️ Tecnologie Utilizzate
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Mappe**: Leaflet.js + Leaflet Routing Machine
- **Rendering 3D**: Three.js + OrbitControls
- **Backend**: PHP
- **Storage**: JSON + LocalStorage
- **Geolocalizzazione**: HTML5 Geolocation API

## 📱 Funzionalità Mobile
Design responsive ottimizzato
Touch gestures supportati
Ottimizzazione batteria per GPS
Modalità offline parziale

## 🔧 Configurazione
Le targhe possono essere configurate modificando l'array `plaques` in `index.html`:
``` javascript
{
    id: 1,
    title: "Nome Targa",
    lat: 40.7638,
    lng: 14.6470,
    image: "data:image/...",
    audio: "data:audio/...",
    missingWords: ["parola1", "parola2"],
    blurAreas: [
        { top: 105, left: 178, width: 51, height: 25 }
    ],
    radius: 50
}
```

## 👥 Credits
- Ispirato al romanzo "Canne al Vento" di Grazia Deledda
- Sviluppato per il Parco Letterario Grazia Deledda
- Icone da Flaticon
- Mappe da OpenStreetMap

## 📄 Licenza
Progetto didattico-culturale per la valorizzazione del patrimonio letterario sardo.

## 🤝 Contribuire
Per segnalare bug o proporre miglioramenti, contatta gli amministratori del parco.
 
---

Nota: Assicurati di essere in un'area con copertura GPS adeguata per un'esperienza ottimale.