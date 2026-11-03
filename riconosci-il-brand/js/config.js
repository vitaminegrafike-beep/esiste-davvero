/*
 * Zoom Race: collegamento a Supabase.
 * Incolla qui i due valori da Supabase → Project Settings → API (o "Connect"):
 *   supabaseUrl  = Project URL, tipo https://abcdefgh.supabase.co
 *   supabaseKey  = chiave pubblica "anon" / "publishable"
 * MAI la chiave "service_role" o "secret": questo file è pubblico.
 *
 * Finché i due valori sono vuoti il gioco gira in "modalità prova":
 * regia e telefoni comunicano solo tra schede dello stesso browser, con giocatori simulati.
 * Si può forzare la modalità prova anche a Supabase collegato aggiungendo ?prova all'indirizzo.
 */
window.ZR_CONFIG = {
  supabaseUrl: "https://vltuppjolpbqaezhaqef.supabase.co",
  supabaseKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZsdHVwcGpvbHBicWFlemhhcWVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM3MzQ2MDUsImV4cCI6MjEwOTMxMDYwNX0.cD-ocV7DJjMxq-SXUydUPpjeQaC4PVU3IYuhkSxSc0E"
};
