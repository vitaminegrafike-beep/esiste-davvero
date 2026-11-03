/*
 * Contenuti del gioco "Esiste davvero?"
 * Ordine, testi e nomi file dal dataset PRODUCTS.md di Alessio.
 * Per cambiare un testo basta modificare questo file.
 *
 * Campi di ogni round:
 *  id            identificativo stabile (usato per le statistiche)
 *  exists        true = ESISTE, false = NON ESISTE
 *  brand         nome grande in serif
 *  product       nome del prodotto
 *  description   una riga sotto il nome
 *  category      metadato in maiuscolo
 *  image         percorso dell'immagine (4:5 consigliato)
 *  alt           testo alternativo
 *  objectPosition  punto focale del taglio (fallback "center center")
 *  revealTitle   titolo del reveal
 *  revealText    testo del reveal
 *  payoff        (opzionale) frase in evidenza dopo il testo del reveal
 *  transition    (opzionale) testo extra dopo il reveal dell'ultimo round
 */
window.ROUNDS = [
  {
    id: "mugmood-m1",
    exists: false,
    brand: "MUGMOOD",
    product: "M1 Emotional Thermal Mug",
    description: "Una tazza smart con display e-ink che cambia espressione in base alla temperatura della bevanda.",
    category: "Smart Home / Lifestyle",
    image: "assets/images/01-mugmood-m1.webp",
    alt: "Tazza smart in ceramica chiara con fascia display nera e volto digitale.",
    objectPosition: "center 45%",
    revealTitle: "MUGMOOD non esiste.",
    revealText: "Ce lo siamo inventato. Per ora, l’unico a giudicare il tuo quarto caffè resta chi ti siede accanto."
  },
  {
    id: "amagami-ham-ham",
    exists: true,
    brand: "AMAGAMI HAM HAM",
    product: "Finger Nibbling Robot",
    description: "Un robot-peluche progettato per mordicchiarti delicatamente il dito.",
    category: "Robotics / Comfort Tech",
    image: "assets/images/02-amagami-ham-ham.webp",
    alt: "Peluche a forma di gattino che mordicchia la punta di un dito.",
    objectPosition: "center 55%",
    revealTitle: "Esiste davvero.",
    revealText: "Lo produce Yukai Engineering e sceglie tra circa due dozzine di modi di mordicchiare. In vendita dal 2022."
  },
  {
    id: "bite-me-f1",
    exists: false,
    brand: "BITE ME",
    product: "F1 Smart Eating Fork",
    description: "Una forchetta smart che rileva quanto velocemente mangi e vibra quando dovresti rallentare.",
    category: "Wellness / Food Tech",
    image: "assets/images/03-bite-me-f1.webp",
    alt: "Forchetta smart in acciaio satinato con indicatore luminoso integrato nel manico.",
    objectPosition: "center 45%",
    revealTitle: "BITE ME non esiste.",
    revealText: "Nessuna vibrazione, nessun sensore. Se mangi troppo in fretta, dovrai ancora accorgertene da solo."
  },
  {
    id: "norimaki-synthesizer",
    exists: true,
    brand: "NORIMAKI SYNTHESIZER",
    product: "Taste Display",
    description: "Un dispositivo sperimentale da leccare progettato per simulare differenti sensazioni di gusto.",
    category: "Experimental / Food Tech",
    image: "assets/images/04-norimaki-synthesizer.webp",
    alt: "Una persona lecca la punta di un piccolo dispositivo cilindrico color rame.",
    objectPosition: "center 45%",
    revealTitle: "Esiste davvero. Come prototipo.",
    revealText: "L’ha creato il professor Homei Miyashita alla Meiji University. Per ora si lecca solo in laboratorio."
  },
  {
    id: "qoobo",
    exists: true,
    brand: "QOOBO",
    product: "Tailed Therapeutic Cushion",
    description: "Un cuscino robotico senza volto che reagisce alle carezze muovendo una coda.",
    category: "Robotics / Wellbeing",
    image: "assets/images/05-qoobo.webp",
    alt: "Una persona sul divano accarezza un cuscino rotondo in pelliccia grigia con una coda.",
    objectPosition: "center 70%",
    revealTitle: "Esiste davvero.",
    revealText: "È di Yukai Engineering: presentato nel 2017, in vendita dal 2018. Niente faccia, solo coda."
  },
  {
    id: "noduo-a1",
    exists: false,
    brand: "NODUO",
    product: "A1 Shared Listening Earbuds",
    description: "Auricolari progettati per due persone: uno a testa, volume indipendente e pausa automatica quando ci si allontana.",
    category: "Audio / Technology",
    image: "assets/images/06-noduo-a1.webp",
    alt: "Due auricolari wireless, uno chiaro e uno scuro, con custodia di ricarica divisibile in due metà.",
    objectPosition: "center 45%",
    revealTitle: "NODUO non esiste.",
    revealText: "È un concept inventato. Ma la prossima volta che condividerai un auricolare sembrerà già una funzione mancante."
  },
  {
    id: "tomatan",
    exists: true,
    brand: "TOMATAN",
    product: "Wearable Tomato Robot",
    description: "Un robot indossabile progettato per imboccare pomodori mentre si corre.",
    category: "Wearable / Food Tech",
    image: "assets/images/07-tomatan.webp",
    alt: "Un uomo indossa sulle spalle un robot a forma di pomodoro che gli porge un pomodoro alla bocca.",
    objectPosition: "center 45%",
    revealTitle: "Esiste davvero. Per una maratona.",
    revealText: "Kagome lo ha costruito con Maywa Denki per la Maratona di Tokyo 2015: circa 8 kg, sei pomodori a bordo."
  },
  {
    id: "orvyn-o1",
    exists: false,
    brand: "ORVYN",
    product: "O1",
    description: "Un orologio senza lancette, numeri o display che comunica l’ora attraverso sequenze di vibrazioni sul polso.",
    category: "Haptic Watch / Digital Wellbeing",
    image: "assets/images/08-orvyn-o1.webp",
    alt: "Orologio con cassa metallica satinata e quadrante nero completamente vuoto, senza lancette, numeri né display, con un piccolo riferimento tattile in alto.",
    objectPosition: "center 45%",
    revealTitle: "ORVYN O1 non esiste.",
    revealText: "Ce lo siamo inventato. Un orologio pensato per percepire il tempo senza doverlo guardare.",
    payoff: "Niente schermo. Niente lancette. Solo il tempo.",
    transition: "Ma sull’orologio torniamo tra un minuto."
  }
];

/* Titoli e testi del risultato personale, per fasce di punteggio */
window.RESULT_COPY = [
  { min: 0, max: 2, title: "Cliente perfetto.", text: "Hai creduto quasi a tutto. Il marketing ti ringrazia." },
  { min: 3, max: 4, title: "Confusamente brillante.", text: "Hai seguito l’istinto. La tipografia ha fatto il resto." },
  { min: 5, max: 6, title: "Occhio attento.", text: "Non è così facile convincerti." },
  { min: 7, max: 7, title: "Difficile da ingannare.", text: "Il marketing ha ancora una sola possibilità con te." },
  { min: 8, max: 8, title: "Impossibile ingannarti.", text: "O conoscevi già tutto, oppure non ti fidi più di niente." }
];
