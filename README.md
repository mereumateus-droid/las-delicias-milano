# Las Delicias · Milano

Sito del ristorante Las Delicias (Via del Turchino 8, 20137 Milano) con
prenotazione dei tavoli e pannello riservato al proprietario.

Cloudflare Worker (React 19 + TanStack Start, reso sul server) con database
D1. Un solo Worker serve tutto:

| Percorso                  | Cosa fa                                              |
|---------------------------|------------------------------------------------------|
| `/`                       | il sito pubblico (documento unico, IT/ES)             |
| `/api/prenotazioni`       | riceve le prenotazioni dal modulo (solo POST)         |
| `/gestione-prenotazioni`  | pannello riservato, protetto da chiave                |
| `/robots.txt`             | robots                                                |
| `/sitemap.xml`            | sitemap (il pannello non compare)                     |

## Come si pubblica

Ogni push su `main` viene costruito e pubblicato da Cloudflare Workers Builds.
Non serve nessun comando a mano.

Build: `bun install && bun run build`
Deploy: `npx wrangler deploy`

## Segreti

Non stanno nel codice. Vivono nei secret del Worker e restano dopo ogni deploy:

- `PANNELLO_CHIAVE` — la chiave di accesso al pannello
- `PANNELLO_SESSIONE` — firma il cookie di sessione e sala l'impronta dell'IP

Per cambiarli:

```
npx wrangler secret put PANNELLO_CHIAVE
```

Cambiando la chiave decadono da sole tutte le sessioni aperte.

## Database

Il D1 `las-delicias-prenotazioni` esiste gia e il suo id e fissato in
`wrangler.jsonc`. Le migrazioni sono in `migrations/` e vanno applicate a mano
quando cambiano:

```
npx wrangler d1 execute las-delicias-prenotazioni --remote --file=migrations/0001_prenotazioni.sql
```

## Conservazione dei dati

Ogni notte, alle 4:30 UTC, il Worker cancella da solo le prenotazioni la cui
data e passata da piu di 6 mesi (`triggers.crons` in `wrangler.jsonc`, funzione
`pulizia` in `src/server.ts`). Il termine si cambia in un punto solo:
`MESI_DI_CONSERVAZIONE`. Cambiandolo, va aggiornata anche l'informativa nel
modulo, che dichiara i 6 mesi al cliente.

## Dati personali

Il modulo raccoglie nome, telefono, data, ora, numero di persone e note.
Restano nel D1 e si leggono solo dal pannello, dopo l'accesso con la chiave.
L'indirizzo di rete non viene mai salvato in chiaro: se ne conserva
un'impronta con sale segreto, usata solo per frenare gli invii ripetuti.
