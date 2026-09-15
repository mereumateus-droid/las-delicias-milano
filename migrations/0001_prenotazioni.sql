-- Prenotazioni inviate dal sito pubblico. Additiva: CREATE TABLE IF NOT EXISTS.
CREATE TABLE IF NOT EXISTS prenotazioni (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  telefono TEXT NOT NULL,
  data TEXT NOT NULL,
  orario TEXT NOT NULL,
  persone INTEGER NOT NULL,
  note TEXT,
  stato TEXT NOT NULL DEFAULT 'in_attesa',
  -- impronta dell'indirizzo di rete (mai l'indirizzo in chiaro): serve solo
  -- a frenare l'invio ripetuto dallo stesso punto.
  origine TEXT,
  creata_il TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_prenotazioni_data ON prenotazioni (data, orario);
CREATE INDEX IF NOT EXISTS idx_prenotazioni_origine ON prenotazioni (origine, creata_il);
