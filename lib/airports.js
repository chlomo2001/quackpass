// IATA code -> [airport name, country], for the route line on the ticket and
// for the destination named in the missing-barcode notice.
//
// Grouped by country so the list stays easy to check. Anything not listed falls
// back to the bare code, which is always safe.

const AIRPORTS = {
  // Ireland
  DUB: ["Dublin", "Ireland"],
  ORK: ["Cork", "Ireland"],
  SNN: ["Shannon", "Ireland"],
  NOC: ["Knock", "Ireland"],
  KIR: ["Kerry", "Ireland"],

  // United Kingdom
  STN: ["London Stansted", "the United Kingdom"],
  LTN: ["London Luton", "the United Kingdom"],
  LGW: ["London Gatwick", "the United Kingdom"],
  LHR: ["London Heathrow", "the United Kingdom"],
  SEN: ["London Southend", "the United Kingdom"],
  MAN: ["Manchester", "the United Kingdom"],
  LPL: ["Liverpool", "the United Kingdom"],
  LBA: ["Leeds Bradford", "the United Kingdom"],
  NCL: ["Newcastle", "the United Kingdom"],
  EDI: ["Edinburgh", "the United Kingdom"],
  GLA: ["Glasgow", "the United Kingdom"],
  PIK: ["Glasgow Prestwick", "the United Kingdom"],
  ABZ: ["Aberdeen", "the United Kingdom"],
  BHX: ["Birmingham", "the United Kingdom"],
  EMA: ["East Midlands", "the United Kingdom"],
  BRS: ["Bristol", "the United Kingdom"],
  BOH: ["Bournemouth", "the United Kingdom"],
  CWL: ["Cardiff", "the United Kingdom"],
  NQY: ["Newquay", "the United Kingdom"],
  EXT: ["Exeter", "the United Kingdom"],
  BFS: ["Belfast International", "the United Kingdom"],
  DSA: ["Doncaster Sheffield", "the United Kingdom"],
  GIB: ["Gibraltar", "Gibraltar"],

  // Poland
  WAW: ["Warsaw Chopin", "Poland"],
  WMI: ["Warsaw Modlin", "Poland"],
  KRK: ["Kraków", "Poland"],
  GDN: ["Gdańsk", "Poland"],
  WRO: ["Wrocław", "Poland"],
  POZ: ["Poznań", "Poland"],
  KTW: ["Katowice", "Poland"],
  LCJ: ["Łódź", "Poland"],
  RZE: ["Rzeszów", "Poland"],
  SZZ: ["Szczecin", "Poland"],
  BZG: ["Bydgoszcz", "Poland"],
  LUZ: ["Lublin", "Poland"],
  IEG: ["Zielona Góra", "Poland"],
  SZY: ["Olsztyn-Mazury", "Poland"],

  // Italy
  FCO: ["Rome Fiumicino", "Italy"],
  CIA: ["Rome Ciampino", "Italy"],
  MXP: ["Milan Malpensa", "Italy"],
  BGY: ["Milan Bergamo", "Italy"],
  LIN: ["Milan Linate", "Italy"],
  VCE: ["Venice", "Italy"],
  TSF: ["Treviso", "Italy"],
  BLQ: ["Bologna", "Italy"],
  PSA: ["Pisa", "Italy"],
  FLR: ["Florence", "Italy"],
  NAP: ["Naples", "Italy"],
  BRI: ["Bari", "Italy"],
  BDS: ["Brindisi", "Italy"],
  CTA: ["Catania", "Italy"],
  PMO: ["Palermo", "Italy"],
  TRN: ["Turin", "Italy"],
  GOA: ["Genoa", "Italy"],
  VRN: ["Verona", "Italy"],
  TRS: ["Trieste", "Italy"],
  AHO: ["Alghero", "Italy"],
  CAG: ["Cagliari", "Italy"],
  OLB: ["Olbia", "Italy"],
  SUF: ["Lamezia Terme", "Italy"],
  PSR: ["Pescara", "Italy"],
  RMI: ["Rimini", "Italy"],
  PEG: ["Perugia", "Italy"],
  AOI: ["Ancona", "Italy"],
  TPS: ["Trapani", "Italy"],
  REG: ["Reggio Calabria", "Italy"],
  CUF: ["Cuneo", "Italy"],
  CRV: ["Crotone", "Italy"],

  // Spain
  MAD: ["Madrid", "Spain"],
  BCN: ["Barcelona", "Spain"],
  AGP: ["Málaga", "Spain"],
  ALC: ["Alicante", "Spain"],
  VLC: ["Valencia", "Spain"],
  SVQ: ["Seville", "Spain"],
  PMI: ["Palma de Mallorca", "Spain"],
  IBZ: ["Ibiza", "Spain"],
  MAH: ["Menorca", "Spain"],
  LPA: ["Gran Canaria", "Spain"],
  TFS: ["Tenerife South", "Spain"],
  TFN: ["Tenerife North", "Spain"],
  ACE: ["Lanzarote", "Spain"],
  FUE: ["Fuerteventura", "Spain"],
  SPC: ["La Palma", "Spain"],
  BIO: ["Bilbao", "Spain"],
  SCQ: ["Santiago de Compostela", "Spain"],
  OVD: ["Asturias", "Spain"],
  SDR: ["Santander", "Spain"],
  ZAZ: ["Zaragoza", "Spain"],
  RMU: ["Murcia", "Spain"],
  REU: ["Reus", "Spain"],
  GRO: ["Girona", "Spain"],
  XRY: ["Jerez", "Spain"],
  LEI: ["Almería", "Spain"],
  GRX: ["Granada", "Spain"],
  VGO: ["Vigo", "Spain"],
  EAS: ["San Sebastián", "Spain"],
  VLL: ["Valladolid", "Spain"],

  // Portugal
  LIS: ["Lisbon", "Portugal"],
  OPO: ["Porto", "Portugal"],
  FAO: ["Faro", "Portugal"],
  FNC: ["Madeira", "Portugal"],
  PDL: ["Ponta Delgada", "Portugal"],
  TER: ["Terceira", "Portugal"],

  // France
  BVA: ["Paris Beauvais", "France"],
  CDG: ["Paris Charles de Gaulle", "France"],
  ORY: ["Paris Orly", "France"],
  MRS: ["Marseille", "France"],
  NCE: ["Nice", "France"],
  LYS: ["Lyon", "France"],
  TLS: ["Toulouse", "France"],
  BOD: ["Bordeaux", "France"],
  NTE: ["Nantes", "France"],
  MPL: ["Montpellier", "France"],
  PGF: ["Perpignan", "France"],
  BIQ: ["Biarritz", "France"],
  CCF: ["Carcassonne", "France"],
  LIL: ["Lille", "France"],
  SXB: ["Strasbourg", "France"],
  RNS: ["Rennes", "France"],
  BES: ["Brest", "France"],
  TLN: ["Toulon", "France"],
  LRH: ["La Rochelle", "France"],
  EGC: ["Bergerac", "France"],
  LDE: ["Tarbes-Lourdes", "France"],
  FSC: ["Figari", "France"],
  AJA: ["Ajaccio", "France"],
  BIA: ["Bastia", "France"],
  GNB: ["Grenoble", "France"],

  // Germany
  BER: ["Berlin Brandenburg", "Germany"],
  FRA: ["Frankfurt", "Germany"],
  HHN: ["Frankfurt Hahn", "Germany"],
  MUC: ["Munich", "Germany"],
  HAM: ["Hamburg", "Germany"],
  CGN: ["Cologne Bonn", "Germany"],
  DUS: ["Düsseldorf", "Germany"],
  NRN: ["Weeze", "Germany"],
  DTM: ["Dortmund", "Germany"],
  STR: ["Stuttgart", "Germany"],
  NUE: ["Nuremberg", "Germany"],
  LEJ: ["Leipzig Halle", "Germany"],
  DRS: ["Dresden", "Germany"],
  BRE: ["Bremen", "Germany"],
  FMM: ["Memmingen", "Germany"],
  FDH: ["Friedrichshafen", "Germany"],

  // Benelux
  BRU: ["Brussels", "Belgium"],
  CRL: ["Brussels Charleroi", "Belgium"],
  LGG: ["Liège", "Belgium"],
  OST: ["Ostend", "Belgium"],
  AMS: ["Amsterdam", "the Netherlands"],
  EIN: ["Eindhoven", "the Netherlands"],
  MST: ["Maastricht", "the Netherlands"],
  GRQ: ["Groningen", "the Netherlands"],
  LUX: ["Luxembourg", "Luxembourg"],

  // Alpine
  VIE: ["Vienna", "Austria"],
  SZG: ["Salzburg", "Austria"],
  KLU: ["Klagenfurt", "Austria"],
  GRZ: ["Graz", "Austria"],
  INN: ["Innsbruck", "Austria"],
  BSL: ["Basel", "Switzerland"],
  GVA: ["Geneva", "Switzerland"],
  ZRH: ["Zurich", "Switzerland"],

  // Nordics
  CPH: ["Copenhagen", "Denmark"],
  BLL: ["Billund", "Denmark"],
  AAL: ["Aalborg", "Denmark"],
  AAR: ["Aarhus", "Denmark"],
  ARN: ["Stockholm Arlanda", "Sweden"],
  NYO: ["Stockholm Skavsta", "Sweden"],
  VST: ["Stockholm Västerås", "Sweden"],
  GOT: ["Gothenburg", "Sweden"],
  MMX: ["Malmö", "Sweden"],
  OSL: ["Oslo", "Norway"],
  TRF: ["Sandefjord Torp", "Norway"],
  RYG: ["Moss Rygge", "Norway"],
  BGO: ["Bergen", "Norway"],
  SVG: ["Stavanger", "Norway"],
  TRD: ["Trondheim", "Norway"],
  HAU: ["Haugesund", "Norway"],
  KRS: ["Kristiansand", "Norway"],
  AES: ["Ålesund", "Norway"],
  HEL: ["Helsinki", "Finland"],
  TMP: ["Tampere", "Finland"],
  TKU: ["Turku", "Finland"],
  RVN: ["Rovaniemi", "Finland"],
  OUL: ["Oulu", "Finland"],
  KEF: ["Reykjavík Keflavík", "Iceland"],

  // Baltics
  VNO: ["Vilnius", "Lithuania"],
  KUN: ["Kaunas", "Lithuania"],
  PLQ: ["Palanga", "Lithuania"],
  RIX: ["Riga", "Latvia"],
  TLL: ["Tallinn", "Estonia"],

  // Central Europe
  PRG: ["Prague", "Czechia"],
  BRQ: ["Brno", "Czechia"],
  OSR: ["Ostrava", "Czechia"],
  BTS: ["Bratislava", "Slovakia"],
  KSC: ["Košice", "Slovakia"],
  TAT: ["Poprad-Tatry", "Slovakia"],
  BUD: ["Budapest", "Hungary"],
  DEB: ["Debrecen", "Hungary"],

  // Romania
  OTP: ["Bucharest Otopeni", "Romania"],
  CLJ: ["Cluj-Napoca", "Romania"],
  TSR: ["Timișoara", "Romania"],
  IAS: ["Iași", "Romania"],
  SBZ: ["Sibiu", "Romania"],
  CRA: ["Craiova", "Romania"],
  BCM: ["Bacău", "Romania"],
  SCV: ["Suceava", "Romania"],
  TGM: ["Târgu Mureș", "Romania"],
  BAY: ["Baia Mare", "Romania"],
  OMR: ["Oradea", "Romania"],
  ARW: ["Arad", "Romania"],
  CND: ["Constanța", "Romania"],
  SUJ: ["Satu Mare", "Romania"],

  // Bulgaria
  SOF: ["Sofia", "Bulgaria"],
  VAR: ["Varna", "Bulgaria"],
  BOJ: ["Burgas", "Bulgaria"],
  PDV: ["Plovdiv", "Bulgaria"],

  // Greece
  ATH: ["Athens", "Greece"],
  SKG: ["Thessaloniki", "Greece"],
  HER: ["Heraklion", "Greece"],
  CHQ: ["Chania", "Greece"],
  RHO: ["Rhodes", "Greece"],
  KGS: ["Kos", "Greece"],
  CFU: ["Corfu", "Greece"],
  ZTH: ["Zakynthos", "Greece"],
  JMK: ["Mykonos", "Greece"],
  JTR: ["Santorini", "Greece"],
  PVK: ["Preveza", "Greece"],
  KVA: ["Kavala", "Greece"],
  MJT: ["Mytilene", "Greece"],
  SMI: ["Samos", "Greece"],
  EFL: ["Kefalonia", "Greece"],
  VOL: ["Volos", "Greece"],
  AXD: ["Alexandroupoli", "Greece"],
  GPA: ["Patras", "Greece"],
  KLX: ["Kalamata", "Greece"],

  // Adriatic and Balkans
  ZAG: ["Zagreb", "Croatia"],
  SPU: ["Split", "Croatia"],
  DBV: ["Dubrovnik", "Croatia"],
  ZAD: ["Zadar", "Croatia"],
  PUY: ["Pula", "Croatia"],
  RJK: ["Rijeka", "Croatia"],
  OSI: ["Osijek", "Croatia"],
  LJU: ["Ljubljana", "Slovenia"],
  BEG: ["Belgrade", "Serbia"],
  INI: ["Niš", "Serbia"],
  SJJ: ["Sarajevo", "Bosnia and Herzegovina"],
  TZL: ["Tuzla", "Bosnia and Herzegovina"],
  BNX: ["Banja Luka", "Bosnia and Herzegovina"],
  TGD: ["Podgorica", "Montenegro"],
  TIV: ["Tivat", "Montenegro"],
  SKP: ["Skopje", "North Macedonia"],
  OHD: ["Ohrid", "North Macedonia"],
  TIA: ["Tirana", "Albania"],
  PRN: ["Pristina", "Kosovo"],

  // Mediterranean
  MLA: ["Malta", "Malta"],
  LCA: ["Larnaca", "Cyprus"],
  PFO: ["Paphos", "Cyprus"],

  // North Africa and Middle East
  RAK: ["Marrakesh", "Morocco"],
  AGA: ["Agadir", "Morocco"],
  FEZ: ["Fez", "Morocco"],
  TNG: ["Tangier", "Morocco"],
  RBA: ["Rabat", "Morocco"],
  NDR: ["Nador", "Morocco"],
  OZZ: ["Ouarzazate", "Morocco"],
  ESU: ["Essaouira", "Morocco"],
  CMN: ["Casablanca", "Morocco"],
  TLV: ["Tel Aviv", "Israel"],
  AMM: ["Amman", "Jordan"],

  // Caucasus
  KUT: ["Kutaisi", "Georgia"],
  TBS: ["Tbilisi", "Georgia"],
  EVN: ["Yerevan", "Armenia"],
};

const lookup = (code) => AIRPORTS[String(code ?? "").toUpperCase()] ?? null;

// "Manchester", or null when we do not know the code.
export function airportName(code) {
  const entry = lookup(code);
  return entry ? entry[0] : null;
}

// Prefer whatever the airline sent; fall back to our list, then to the code.
export function destinationCountry(pass) {
  const fromApi = pass?.arrival?.countryName ?? pass?.arrival?.country ?? null;

  if (typeof fromApi === "string" && fromApi.trim().length > 2) {
    return fromApi.trim();
  }

  const entry = lookup(pass?.arrival?.code);
  if (entry) return entry[1];

  const code = String(pass?.arrival?.code ?? "").toUpperCase();
  return code ? `your destination country (${code})` : "your destination country";
}
