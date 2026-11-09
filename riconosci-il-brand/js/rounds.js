/*
 * Zoom Race: i 10 round.
 * Le immagini restano quelle originali: il ritaglio si fa solo via CSS.
 *
 *  image     file in assets/rounds/
 *  options   le tre risposte nell'ordine A, B, C
 *  correct   indice della risposta giusta (0 = A, 1 = B, 2 = C)
 *  focus     punto dell'immagine da tenere al centro del ritaglio (object-position e transform-origin)
 *  zoom      ingrandimento durante il round (1 = immagine intera nel riquadro 4:5)
 *  alt       testo alternativo
 */
window.ZR_ROUNDS = [
  { id: "pepsi",       image: "assets/rounds/pepsi.webp",        options: ["Tommy Hilfiger", "NASA", "Pepsi"],            correct: 2, focus: "48% 29%",  zoom: 3.6, alt: "Lattina con dettaglio rosso, bianco e blu." },
  { id: "alessi",      image: "assets/rounds/alessi.jpg",        options: ["Alessi", "Tesla", "Citroën"],                 correct: 0, focus: "50% 40%",  zoom: 1.35, alt: "Spremiagrumi in metallo lucido su tre gambe." },
  { id: "ferrari",     image: "assets/rounds/ferrari.webp",      options: ["Ferrari", "Coca-Cola", "Ducati"],             correct: 0, focus: "80% 30%",  zoom: 1.5, alt: "Fiancata rossa con stemma giallo." },
  { id: "smeg",        image: "assets/rounds/smeg.jpeg",         options: ["Tiffany & Co.", "Smeg", "Fiat"],              correct: 1, focus: "55% 91%",  zoom: 2, alt: "Superficie azzurro pastello con maniglia cromata." },
  { id: "polaroid",    image: "assets/rounds/polaroid.jpg",      options: ["Lego", "Google", "Polaroid"],                 correct: 2, focus: "86% 29%",  zoom: 2, alt: "Corpo grigio scuro con striscia arcobaleno e obiettivo." },
  { id: "rolex",       image: "assets/rounds/rolex2.jpeg",       options: ["Harrods", "Rolex", "Starbucks"],              correct: 1, focus: "100% 56%", zoom: 1.6, alt: "Quadrante verde con indici in acciaio e finestrella della data." },
  { id: "vespa",       image: "assets/rounds/vespa.webp",        options: ["Vespa", "Heineken", "Android"],               correct: 0, focus: "52% 30%",  zoom: 1, alt: "Faro tondo su carrozzeria verde acceso." },
  { id: "macbook",     image: "assets/rounds/macbook.webp",      options: ["Dell", "Razer", "Apple"],                     correct: 2, focus: "48% 62%",  zoom: 1.4, alt: "Tastiera nera retroilluminata con barra touch e icone colorate sfocate sullo schermo." },
  { id: "dyson",       image: "assets/rounds/dyson.jpg",         options: ["Nothing", "Dyson", "Gatorade"],               correct: 1, focus: "32% 42%",  zoom: 1.5, alt: "Oggetto turchese con frontale trasparente e componenti interni." },
  { id: "birkenstock", image: "assets/rounds/birkenstock.jpg",   options: ["Hermès", "Timberland", "Birkenstock"],        correct: 2, focus: "50% 52%",  zoom: 1.1, alt: "Sandalo in pelle marrone con due fibbie metalliche." }
];

/* Durata del round e sfocatura nel tempo (px): un passo ogni 1,5 s, interpolato in modo continuo sui 9 secondi */
window.ZR_ROUND_MS = 12000;
window.ZR_BLUR_STEPS = [45, 34, 25, 17, 10, 5, 2];

/* Punti per una risposta esatta, continui in base al tempo (millisecondi): da 100 a 30.
   Errata o nessuna risposta: 0. Lo stesso calcolo è nel database (supabase/schema.sql), che fa fede. */
window.ZR_POINTS = function (ms, correct) {
  if (!correct) return 0;
  var t = Math.max(0, Math.min(window.ZR_ROUND_MS, ms));
  return Math.round(100 - (t / window.ZR_ROUND_MS) * 70);
};
