/**
 * Le due pagine del pannello riservato, scritte per intero sul server.
 * Niente dati nel browser finche la sessione non e valida.
 */

export type Prenotazione = {
  id: number;
  nome: string;
  telefono: string;
  data: string;
  orario: string;
  persone: number;
  note: string | null;
  stato: string;
  creata_il: string;
};

export function esc(valore: unknown): string {
  return String(valore ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const FUSO = "Europe/Rome";

export function oggiRoma(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function dataEstesa(iso: string): string {
  const parti = iso.split("-").map(Number);
  const d = new Date(Date.UTC(parti[0], parti[1] - 1, parti[2]));
  const testo = new Intl.DateTimeFormat("it-IT", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
  return testo.charAt(0).toUpperCase() + testo.slice(1);
}

function persone(n: number): string {
  return n === 1 ? "1 persona" : `${n} persone`;
}

function etichettaStato(stato: string): string {
  if (stato === "confermata") return "Confermata";
  if (stato === "annullata") return "Annullata";
  return "In attesa";
}

const STILE = `
*,*::before,*::after{box-sizing:border-box}
:root{
  --notte:#0D2A20;--notte-2:#123528;--cacao:#241511;--targa:#3A2A1E;
  --ottone:#E0A32E;--ottone-2:#F7CE72;--panna:#FBF4E6;--panna-2:#C6B69B;
  --corallo:#C1502E;--corallo-2:#DE6A3C;--verde:#2F8A66;--verde-2:#5FC79B;
  --ec-giallo:#FFDD00;--ec-blu:#0072CE;--ec-rosso:#EF3340;
  --filo:rgba(251,244,230,.14);--oro-filo:rgba(224,163,46,.38);
  --display:"Anton",Impact,"Arial Narrow Bold","Arial Narrow",sans-serif;
  --cond:"Barlow Condensed","Arial Narrow",Roboto Condensed,sans-serif;
}
html{background:var(--notte)}
body{margin:0;background:var(--notte);color:var(--panna);
  font-family:var(--cond);font-size:17px;line-height:1.5;
  -webkit-font-smoothing:antialiased}
.nastro{position:fixed;top:0;left:0;right:0;height:6px;z-index:9;
  background:linear-gradient(180deg,var(--ec-giallo) 0 50%,var(--ec-blu) 50% 75%,var(--ec-rosso) 75% 100%)}
.w{max-width:1000px;margin:0 auto;padding:0 clamp(18px,4vw,34px)}
a{color:var(--ottone-2)}
h1,h2{font-family:var(--display);font-weight:400;letter-spacing:.012em;
  text-transform:uppercase;margin:0;line-height:1}
h1{font-size:clamp(30px,5vw,46px)}
h2{font-size:clamp(19px,2.4vw,24px)}
.occhio{display:flex;align-items:center;gap:11px;margin:0 0 14px;
  font-size:12px;letter-spacing:.24em;text-transform:uppercase;color:var(--panna-2)}
.occhio i{width:26px;height:2px;display:block;flex:0 0 auto;
  background:linear-gradient(90deg,var(--ottone),var(--corallo-2))}
:focus-visible{outline:2px solid var(--ottone);outline-offset:3px}

/* ---- accesso ---- */
.accesso{min-height:100svh;display:flex;align-items:center;justify-content:center;padding:40px 0}
.scatola{width:min(430px,92vw);background:var(--notte-2);border:1px solid var(--oro-filo);
  padding:clamp(26px,4vw,38px)}
.scatola h1{margin-bottom:8px}
.scatola .sotto{color:var(--panna-2);font-size:15px;margin:0 0 26px}
label{display:block;font-size:12px;letter-spacing:.2em;text-transform:uppercase;
  color:var(--panna-2);margin-bottom:9px}
input[type=password],input[type=text]{width:100%;font-family:var(--cond);font-size:17px;
  color:var(--panna);background:rgba(8,26,19,.6);border:1px solid var(--filo);
  border-radius:0;padding:13px 14px}
input:focus{outline:none;border-color:var(--ottone);background:rgba(8,26,19,.85);
  box-shadow:0 0 0 3px rgba(224,163,46,.14)}
.bottone{width:100%;margin-top:20px;background:var(--corallo);color:#fff;border:0;
  font-family:var(--cond);font-size:14px;letter-spacing:.18em;text-transform:uppercase;
  padding:16px 20px;cursor:pointer;transition:background .25s}
.bottone:hover{background:var(--corallo-2)}
.bottone:active{transform:translateY(1px)}
.errore{margin:18px 0 0;padding-left:12px;border-left:2px solid var(--corallo-2);
  color:#F2A07E;font-size:15px}

/* ---- pannello ---- */
.pannello{padding:40px 0 90px;margin-top:6px}
.p-testa{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;
  flex-wrap:wrap;padding-bottom:22px;border-bottom:1px solid var(--oro-filo)}
.esci{background:none;border:1px solid var(--filo);color:var(--panna);
  font-family:var(--cond);font-size:12px;letter-spacing:.18em;text-transform:uppercase;
  padding:11px 20px;cursor:pointer;transition:border-color .25s,color .25s}
.esci:hover{border-color:var(--ottone);color:var(--ottone-2)}
.p-conta{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;margin:30px 0 0;
  background:var(--filo);border:1px solid var(--filo)}
.p-conta div{background:var(--notte);padding:20px 18px}
.p-conta dt{font-size:11.5px;letter-spacing:.22em;text-transform:uppercase;color:var(--panna-2)}
.p-conta dd{margin:8px 0 0;font-family:var(--display);font-size:30px;line-height:1}
.p-conta dd.oro{color:var(--ottone)}
.gruppo{margin-top:46px}
.gruppo-data{margin:30px 0 12px;font-size:12px;letter-spacing:.2em;
  text-transform:uppercase;color:var(--ottone)}
.scheda{display:grid;grid-template-columns:96px minmax(0,1fr) 118px auto;gap:18px;
  align-items:start;padding:18px 0;border-bottom:1px solid var(--filo)}
.quando{font-family:var(--display);font-size:24px;line-height:1.05}
.quando small{display:block;font-family:var(--cond);font-size:13px;
  letter-spacing:.04em;color:var(--panna-2);margin-top:6px}
.chi b{font-size:18px}
.chi p{margin:5px 0 0;font-size:15px;color:var(--panna-2)}
.chi a{text-decoration:none;border-bottom:1px solid var(--oro-filo)}
.stato{font-size:12px;letter-spacing:.18em;text-transform:uppercase;padding-top:5px}
.stato[data-s=in_attesa]{color:var(--ottone)}
.stato[data-s=confermata]{color:var(--verde-2)}
.stato[data-s=annullata]{color:#F2A07E}
.azioni-riga{display:flex;gap:9px;flex-wrap:wrap}
.pill{background:none;font-family:var(--cond);font-size:12px;letter-spacing:.14em;
  text-transform:uppercase;padding:9px 15px;border:1px solid var(--filo);
  color:var(--panna);cursor:pointer;transition:background .25s,color .25s,border-color .25s}
.pill-conferma{color:var(--verde-2);border-color:var(--verde)}
.pill-conferma:hover{background:var(--verde);color:#04150E}
.pill-annulla{color:#F2A07E;border-color:#8C3624}
.pill-annulla:hover{background:var(--corallo);color:#fff}
.dett{grid-column:1/-1;margin-top:4px}
.dett summary{cursor:pointer;font-size:12px;letter-spacing:.14em;
  text-transform:uppercase;color:var(--panna-2);list-style:none}
.dett summary::-webkit-details-marker{display:none}
.dett summary::before{content:"+ ";color:var(--ottone)}
.dett[open] summary::before{content:"\\2212 "}
.dett dl{display:grid;grid-template-columns:150px 1fr;gap:7px 16px;margin:14px 0 4px;
  font-size:15px;padding-left:2px}
.dett dt{color:var(--panna-2);font-size:12px;letter-spacing:.16em;text-transform:uppercase;padding-top:3px}
.dett dd{margin:0}
.vuoto{color:var(--panna-2);font-size:15px;padding:16px 0;margin:0}
.nota{margin:46px 0 0;padding-top:20px;border-top:1px solid var(--filo);
  font-size:13.5px;line-height:1.6;color:var(--panna-2)}
@media(max-width:760px){
  .p-conta{grid-template-columns:1fr}
  .scheda{grid-template-columns:76px minmax(0,1fr);gap:12px}
  .stato{grid-column:2}
  .azioni-riga{grid-column:1/-1}
  .dett dl{grid-template-columns:1fr}
}
`;

function guscio(titolo: string, corpo: string): string {
  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${esc(titolo)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton&family=Barlow+Condensed:wght@400;500;600&display=swap">
<style>${STILE}</style>
</head>
<body>
<div class="nastro" aria-hidden="true"></div>
${corpo}
</body>
</html>`;
}

export function paginaAccesso(errore?: string): string {
  return guscio(
    "Accesso riservato · Las Delicias",
    `<main class="accesso">
  <form class="scatola" method="post" action="/gestione-prenotazioni" autocomplete="off">
    <p class="occhio"><i></i>Las Delicias</p>
    <h1>Accesso riservato</h1>
    <p class="sotto">Pannello delle prenotazioni.</p>
    <input type="hidden" name="azione" value="accedi">
    <label for="chiave">Chiave di accesso</label>
    <input id="chiave" name="chiave" type="password" autocomplete="current-password" autofocus required>
    <button class="bottone" type="submit">Accedi</button>
    ${errore ? `<p class="errore">${esc(errore)}</p>` : ""}
  </form>
</main>`,
  );
}

function scheda(r: Prenotazione): string {
  return `<article class="scheda">
  <div class="quando">${esc(r.orario)}<small>${esc(persone(r.persone))}</small></div>
  <div class="chi">
    <b>${esc(r.nome)}</b>
    <p><a href="tel:${esc(r.telefono.replace(/\s+/g, ""))}">${esc(r.telefono)}</a></p>
    ${r.note ? `<p>${esc(r.note)}</p>` : ""}
  </div>
  <div class="stato" data-s="${esc(r.stato)}">${esc(etichettaStato(r.stato))}</div>
  <div class="azioni-riga">
    ${
      r.stato !== "confermata"
        ? `<form method="post" action="/gestione-prenotazioni"><input type="hidden" name="azione" value="confermata"><input type="hidden" name="id" value="${r.id}"><button class="pill pill-conferma" type="submit">Conferma</button></form>`
        : ""
    }
    ${
      r.stato !== "annullata"
        ? `<form method="post" action="/gestione-prenotazioni"><input type="hidden" name="azione" value="annullata"><input type="hidden" name="id" value="${r.id}"><button class="pill pill-annulla" type="submit">Annulla</button></form>`
        : ""
    }
  </div>
  <details class="dett">
    <summary>Dettagli</summary>
    <dl>
      <dt>Data</dt><dd>${esc(dataEstesa(r.data))}</dd>
      <dt>Orario</dt><dd>${esc(r.orario)}</dd>
      <dt>Persone</dt><dd>${r.persone}</dd>
      <dt>Telefono</dt><dd>${esc(r.telefono)}</dd>
      <dt>Note</dt><dd>${r.note ? esc(r.note) : "Nessuna"}</dd>
      <dt>Stato</dt><dd>${esc(etichettaStato(r.stato))}</dd>
      <dt>Richiesta ricevuta</dt><dd>${esc(r.creata_il)}</dd>
    </dl>
  </details>
</article>`;
}

export function paginaPannello(oggi: Prenotazione[], prossime: Prenotazione[]): string {
  const giorno = oggiRoma();
  const vive = oggi.filter((r) => r.stato !== "annullata");
  const coperti = vive.reduce((somma, r) => somma + r.persone, 0);
  const inAttesa = [...oggi, ...prossime].filter((r) => r.stato === "in_attesa").length;

  let prossimeHtml = "";
  let ultimaData = "";
  for (const r of prossime) {
    if (r.data !== ultimaData) {
      ultimaData = r.data;
      prossimeHtml += `<p class="gruppo-data">${esc(dataEstesa(r.data))}</p>`;
    }
    prossimeHtml += scheda(r);
  }

  return guscio(
    "Prenotazioni · Las Delicias",
    `<main class="pannello">
  <div class="w">
    <div class="p-testa">
      <div>
        <p class="occhio"><i></i>Las Delicias</p>
        <h1>Prenotazioni</h1>
      </div>
      <form method="post" action="/gestione-prenotazioni">
        <input type="hidden" name="azione" value="esci">
        <button class="esci" type="submit">Esci</button>
      </form>
    </div>

    <dl class="p-conta">
      <div><dt>Oggi</dt><dd>${vive.length}</dd></div>
      <div><dt>Coperti</dt><dd>${coperti}</dd></div>
      <div><dt>In attesa</dt><dd class="oro">${inAttesa}</dd></div>
    </dl>

    <section class="gruppo">
      <p class="occhio"><i></i>Oggi, ${esc(dataEstesa(giorno))}</p>
      ${oggi.length ? oggi.map(scheda).join("") : '<p class="vuoto">Nessuna prenotazione per oggi.</p>'}
    </section>

    <section class="gruppo">
      <p class="occhio"><i></i>Prossime prenotazioni</p>
      ${prossimeHtml || '<p class="vuoto">Nessuna prenotazione nei prossimi giorni.</p>'}
    </section>

    <p class="nota">Le prenotazioni arrivano dal modulo del sito e restano salvate. Confermatele per telefono con il cliente: il pannello registra la vostra decisione, non avvisa il cliente da solo.</p>
  </div>
</main>`,
  );
}
