// Larmkalkyl – all beräkningslogik samlad här.
// Ändra priser och konstanter i det här blocket om något ändras.

const KONST = {
  grundprovision: 2500,
  manader: 72,
  adminavgift: 49,
  merforsaljningProc: 0.10, // + på allt som läggs till
  rabattProc: 0.20,         // − på rabatt och minus-justering
  installationProc: 0.30,   // + på installation utöver uppläggningsavgiften
  upplaggningsavgift: 579,
  utkopFaktor: 1.06,
  avrundningPlusProc: 0.10,
  avrundningMinusProc: 0.20,
};

const PAKET = {
  standard: { namn: 'Standard', info: 'Under 75 år', pris: 32400 },
  senior: { namn: 'Senior', info: '75 år och äldre', pris: 30990 },
};

// ingar = antal som redan ingår i startpaketet
const PRODUKTER = [
  { id: 'kamera', namn: 'Kameradetektor', kort: 'K', pris: 2200, ingar: 2 },
  { id: 'rok', namn: 'Rökdetektor', kort: 'BV', pris: 2000, ingar: 1 },
  { id: 'magnet', namn: 'Magnetkontakt', kort: 'MK', pris: 1000, ingar: 2 },
  { id: 'rorelse', namn: 'Rörelsedetektor (utan kamera)', pris: 1700, ingar: 0 },
  { id: 'panik', namn: 'Paniklarm (armband)', pris: 1000, ingar: 0 },
  { id: 'vatten', namn: 'Vattendetektor', pris: 1800, ingar: 0 },
  { id: 'glas', namn: 'Glaskrossdetektor', pris: 2000, ingar: 0 },
  { id: 'ute', namn: 'Utomhus-/livekamera', pris: 2200, ingar: 0 },
  { id: 'sirenUte', namn: 'Utomhussiren', pris: 2000, ingar: 0 },
  { id: 'sirenInne', namn: 'Inomhussiren', pris: 2000, ingar: 0 },
  { id: 'panel', namn: 'Manöverpanel', pris: 1600, ingar: 0 },
  { id: 'fjarr', namn: 'Fjärrkontroll', pris: 900, ingar: 0 },
  { id: 'yale', namn: 'Yale Doorman', pris: 500, ingar: 0 },
  { id: 'plug1', namn: 'Smart Plug (1 st)', pris: 500, ingar: 0 },
  { id: 'plug2', namn: 'Smart Plug (2-pack)', pris: 900, ingar: 0 },
];

// [ordervärde från, max rabatt] – högsta nivå först
const RABATTRAPPA = [
  [52500, 10000],
  [47500, 8500],
  [42500, 6600],
  [37500, 4400],
  [0, 2200],
];

function heltal(x) {
  const n = Math.round(Number(x) || 0);
  return Number.isFinite(n) ? n : 0;
}

// Avrundar till närmaste tal som slutar på 9. Exakt mitt emellan => uppåt.
// Räknar i "kronor × 72" för att undvika avrundningsfel.
function avrunda9(summaGanger72) {
  const M = KONST.manader;
  let lagre = Math.floor((summaGanger72 / M - 9) / 10) * 10 + 9;
  while (lagre * M > summaGanger72) lagre -= 10;
  while ((lagre + 10) * M <= summaGanger72) lagre += 10;
  const rest = summaGanger72 - lagre * M; // = (exakt − lägre) × 72
  return rest < 5 * M ? lagre : lagre + 10;
}

function rabattTak(underlag) {
  for (const [grans, tak] of RABATTRAPPA) if (underlag >= grans) return tak;
  return RABATTRAPPA[RABATTRAPPA.length - 1][1];
}

function nastaRabattNiva(underlag) {
  const nivaer = [...RABATTRAPPA].reverse();
  for (const [grans, tak] of nivaer) if (grans > underlag) return { grans, tak, saknas: grans - underlag };
  return null;
}

/*
 in = {
   paket: 'standard' | 'senior',
   lage: 'manuell' | 'produkter',
   merManuell, bortManuell,           // manuellt läge
   antal: { [produktId]: antal }, ovrigt, // produktläge
   justering,   // ± fritt belopp på startpaketet
   rabatt, installation, utkop,
 }
*/
function berakna(inp) {
  const K = KONST;
  const paketPris = PAKET[inp.paket] ? PAKET[inp.paket].pris : PAKET.standard.pris;

  let merforsaljning = 0, borttaget = 0;
  const rader = [];
  if (inp.lage === 'produkter') {
    for (const p of PRODUKTER) {
      const n = Math.max(0, heltal(inp.antal && inp.antal[p.id] != null ? inp.antal[p.id] : p.ingar));
      const diff = n - p.ingar;
      if (diff > 0) merforsaljning += diff * p.pris;
      if (diff < 0) borttaget += -diff * p.pris;
      if (diff !== 0) rader.push({ namn: p.namn, diff, belopp: diff * p.pris });
    }
    const ovr = Math.max(0, heltal(inp.ovrigt));
    if (ovr) { merforsaljning += ovr; rader.push({ namn: 'Övrigt', diff: 1, belopp: ovr }); }
  } else {
    merforsaljning = Math.max(0, heltal(inp.merManuell));
    borttaget = Math.max(0, heltal(inp.bortManuell));
  }

  const justering = heltal(inp.justering);
  const justPlus = Math.max(0, justering);
  const justMinus = Math.max(0, -justering);
  const rabatt = Math.max(0, heltal(inp.rabatt));
  const utkopX = Math.max(0, heltal(inp.utkop));
  const utkop = Math.round(utkopX * K.utkopFaktor);
  const installation = Math.max(0, heltal(inp.installation));
  const installationKontrakt = installation > 0 ? Math.max(0, installation - K.upplaggningsavgift) : 0;

  // Orderbelopp före eventuell månadsprisändring/avrundning
  const grundTotalt = paketPris + merforsaljning - borttaget + justering - rabatt + utkop;
  const M = K.manader, A = K.adminavgift;
  const exaktFore = grundTotalt / M + A;

  // Avrundat alternativ (visas alltid)
  const avrundatManad = avrunda9(grundTotalt + A * M);
  const avrundatJustering = (avrundatManad - A) * M - grundTotalt;

  // Läge för månadspriset: 'eget' (inskrivet), 'avrundat' (9-tal) eller 'exakt'
  const malManad = heltal(inp.malManad);
  const manadsLage = malManad > A ? 'eget' : inp.avrunda ? 'avrundat' : 'exakt';

  let manadsPlus = 0, manadsRabatt = 0, totaljustering = 0;
  if (manadsLage === 'eget') {
    const d = (malManad - A) * M - grundTotalt;
    manadsPlus = Math.max(0, d);   // läggs på startpaketets pris (+10 %)
    manadsRabatt = Math.max(0, -d); // läggs som rabatt (−20 %)
  } else if (manadsLage === 'avrundat') {
    totaljustering = avrundatJustering;
  }
  const totalt = grundTotalt + manadsPlus - manadsRabatt + totaljustering;
  const exaktManad = totalt / M + A;
  const manad = manadsLage === 'exakt' ? Math.round(exaktManad * 100) / 100 : exaktManad;

  // Rabattrappa: ordervärde före rabatt (utan utköp)
  const rabattUnderlag = paketPris + merforsaljning - borttaget + justPlus + manadsPlus;
  const rabattTotalt = rabatt + manadsRabatt;
  const tak = rabattTak(rabattUnderlag);
  const nastaNiva = nastaRabattNiva(rabattUnderlag);

  // Provision
  const prov = {
    grund: K.grundprovision,
    merforsaljning: merforsaljning * K.merforsaljningProc,
    justeringPlus: justPlus * K.merforsaljningProc,
    manadsPlus: manadsPlus * K.merforsaljningProc,
    rabatt: -rabatt * K.rabattProc,
    manadsRabatt: -manadsRabatt * K.rabattProc,
    justeringMinus: -justMinus * K.rabattProc,
    installation: installationKontrakt * K.installationProc,
    avrundning: totaljustering > 0
      ? totaljustering * K.avrundningPlusProc
      : totaljustering * K.avrundningMinusProc,
  };
  const provision = Object.values(prov).reduce((a, b) => a + b, 0);
  const provAvrundat = totaljustering === 0 && manadsLage === 'exakt'
    ? provision + (avrundatJustering > 0 ? avrundatJustering * K.avrundningPlusProc : avrundatJustering * K.avrundningMinusProc)
    : null;

  // Förslag: närmaste 9-tal under och över (utan avrundning)
  const forsta9 = Math.floor((exaktFore - 9) / 10) * 10 + 9;
  const kandidater = [forsta9 - 10, forsta9, forsta9 + 10, forsta9 + 20].filter((m) => m > A);
  const grannar = kandidater.map((m) => {
    const d = (m - A) * M - grundTotalt;
    return { manad: m, andring: d, prov: d > 0 ? d * K.merforsaljningProc : d * K.rabattProc };
  });

  return {
    paketPris, merforsaljning, borttaget, rader, justering, rabatt, utkopX, utkop,
    installation, installationKontrakt,
    rabattUnderlag, rabattTak: tak, rabattTotalt, overTak: rabattTotalt > tak, nastaNiva,
    grundTotalt, exaktFore, avrundatManad, avrundatJustering, manadsLage, malManad,
    manadsPlus, manadsRabatt,
    totalt, exaktManad, manad, totaljustering, justeratTotalt: totalt,
    nyttPrisStartpaket: paketPris + justering + manadsPlus + totaljustering,
    prov, provision: Math.round(provision * 100) / 100,
    provAvrundat: provAvrundat == null ? null : Math.round(provAvrundat * 100) / 100,
    grannar,
  };
}

if (typeof module !== 'undefined') {
  module.exports = { KONST, PAKET, PRODUKTER, RABATTRAPPA, berakna, avrunda9 };
}
