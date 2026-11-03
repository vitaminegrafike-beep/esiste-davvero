/*
 * Configurazione del gioco.
 * È l'unico file da modificare per cambiare sessione o collegare Supabase.
 *
 * Nel repository va SOLO la anon public key di Supabase, mai la service role key.
 */
window.APP_CONFIG = {
  // Identificativo della sessione di gioco: cambialo per avviare una nuova partita di gruppo.
  gameId: "DESIGNPIL01",

  // Link pubblico del gioco (per il QR della schermata desktop) e versione breve da mostrare.
  gameUrl: "https://vitaminegrafike-beep.github.io/esiste-davvero/",
  shortUrl: "vitaminegrafike-beep.github.io/esiste-davvero",

  // Supabase: da compilare in fase 4.
  supabaseUrl: "",
  supabaseAnonKey: "",

  // Fase 3: graduatoria e statistiche con dati di prova, nessuna connessione.
  useMockData: true
};
