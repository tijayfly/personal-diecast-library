// Shared helpers: brands and ranges, parse a free-text diecast name, score image-search candidates.
// Works in Node (require) and is copied into the renderer.
(function (root) {
  // typical: rough UK street price in £ for a standard release, used only for dummy values when there's no price paid
  const BRANDS = {
    'Hot Wheels':       { code: 'HW',        color: '#e4511b', scale: '1:64', typical: 1.5,
      ranges: { Mainline: 1.5, Premium: 6, 'Car Culture': 6, 'Pop Culture': 6, Boulevard: 6, 'Team Transport': 12, RLC: 25, 'Elite 64': 30, Experimotors: 4 } },
    Matchbox:           { code: 'MBX',       color: '#d79a00', scale: '1:64', typical: 1.5,
      ranges: { Mainline: 1.5, Collectors: 4, 'Moving Parts': 3, Superfast: 5 } },
    Tomica:             { code: 'TOMICA',    color: '#d1202f', scale: '1:64', typical: 3.5,
      ranges: { Regular: 3.5, Premium: 7, 'Premium Unlimited': 8, 'Limited Vintage': 18, 'Limited Vintage Neo': 18, 'Dream Tomica': 4, Disney: 5, 'Disney Resort': 8, Event: 5, Ania: 4, Playset: 25 } },
    'Mini GT':          { code: 'MINI GT',   color: '#16181d', scale: '1:64', typical: 12, ranges: {} },
    AUTOart:            { code: 'AUTOART',   color: '#5a6472', scale: '1:64', typical: 22, ranges: {} },
    Kyosho:             { code: 'KYOSHO',    color: '#1b5fc1', scale: '1:64', typical: 9, ranges: {} },
    Inno64:             { code: 'INNO64',    color: '#7b2cbf', scale: '1:64', typical: 18, ranges: {} },
    'Tarmac Works':     { code: 'TARMAC',    color: '#2b2d42', scale: '1:64', typical: 18, ranges: {} },
    'Pop Race':         { code: 'POP RACE',  color: '#ef476f', scale: '1:64', typical: 15, ranges: {} },
    Majorette:          { code: 'MAJORETTE', color: '#e63946', scale: '1:64', typical: 2.5, ranges: {} },
    Motormax:           { code: 'MOTORMAX',  color: '#1d8a7a', scale: '1:64', typical: 3, ranges: {} },
    Greenlight:         { code: 'GREENLIGHT', color: '#2d9a3f', scale: '1:64', typical: 6, ranges: {} },
    'M2 Machines':      { code: 'M2',        color: '#8d5a2b', scale: '1:64', typical: 8, ranges: {} },
    'Johnny Lightning': { code: 'JL',        color: '#b5179e', scale: '1:64', typical: 7, ranges: {} },
    Siku:               { code: 'SIKU',      color: '#c1121f', scale: '1:55', typical: 4, ranges: {} },
    Maisto:             { code: 'MAISTO',    color: '#3a6ea5', scale: '1:64', typical: 3, ranges: {} },
    Jada:               { code: 'JADA',      color: '#444b55', scale: '1:64', typical: 6, ranges: {} },
    Other:              { code: 'OTHER',     color: '#6b7280', scale: '1:64', typical: 3, ranges: {} },
  };
  const BRAND_ORDER = Object.keys(BRANDS);
  const brandInfo = (b) => BRANDS[b] || BRANDS.Other;

  const RARITY = {
    standard: { label: 'Standard release', short: '' },
    limited:  { label: 'Limited run / exclusive', short: 'LIMITED' },
    chase:    { label: 'Chase', short: 'CHASE' },
    th:       { label: 'Treasure Hunt', short: 'TH' },
    sth:      { label: 'Super Treasure Hunt', short: 'STH' },
  };
  const RARITY_ORDER = ['standard', 'limited', 'chase', 'th', 'sth'];

  // brand prefixes: [regex, brand, strip?]. "HW Exotics" etc. are Hot Wheels series names, so a bare "HW" is kept in the text.
  const BRAND_PREFIX = [
    [/^hot ?wheels\b\s*/i, 'Hot Wheels', true], [/^(?=hw\b)/i, 'Hot Wheels', true],
    [/^(matchbox|mbx)\b\s*/i, 'Matchbox', true],
    [/^(tomica limited vintage neo|tlv-?n)\b\s*/i, 'Tomica', true, 'Limited Vintage Neo'],
    [/^(tomica limited vintage|tlv)\b\s*/i, 'Tomica', true, 'Limited Vintage'],
    [/^dream tomica\b\s*/i, 'Tomica', true, 'Dream Tomica'],
    [/^(tomica|tomy|takara tomy)\b\s*/i, 'Tomica', true],
    [/^ania\b\s*/i, 'Tomica', true, 'Ania'],
    [/^mini ?gt\b\s*/i, 'Mini GT', true], [/^auto ?art\b\s*/i, 'AUTOart', true], [/^kyosho\b\s*/i, 'Kyosho', true],
    [/^inno ?64\b\s*/i, 'Inno64', true], [/^tarmac( works)?\b\s*/i, 'Tarmac Works', true], [/^pop ?race\b\s*/i, 'Pop Race', true],
    [/^majorette\b\s*/i, 'Majorette', true], [/^motor ?max\b\s*/i, 'Motormax', true], [/^green ?light\b\s*/i, 'Greenlight', true],
    [/^m2( machines)?\b\s*/i, 'M2 Machines', true], [/^(johnny lightning|jl)\b\s*/i, 'Johnny Lightning', true],
    [/^siku\b\s*/i, 'Siku', true], [/^maisto\b\s*/i, 'Maisto', true], [/^jada\b\s*/i, 'Jada', true],
  ];
  // range words that can follow the brand: [regex, range, series-to-keep]
  const RANGE_PREFIX = {
    'Hot Wheels': [[/^premium\s+car culture\b/i, 'Premium', 'Car Culture'], [/^car culture\b/i, 'Premium', 'Car Culture'], [/^pop culture\b/i, 'Premium', 'Pop Culture'],
      [/^boulevard\b/i, 'Premium', 'Boulevard'], [/^team transport\b/i, 'Team Transport'], [/^(rlc|red line club)\b/i, 'RLC'], [/^elite ?64\b/i, 'Elite 64'],
      [/^premium\b/i, 'Premium'], [/^experimotors\b/i, 'Experimotors', 'Experimotors'], [/^mainline\b/i, 'Mainline']],
    Matchbox: [[/^collectors?\b/i, 'Collectors'], [/^moving parts\b/i, 'Moving Parts'], [/^superfast\b/i, 'Superfast'], [/^mainline\b/i, 'Mainline']],
    Tomica: [[/^premium unlimited\b/i, 'Premium Unlimited'], [/^unlimited\b/i, 'Premium Unlimited'], [/^initial d\b/i, 'Premium Unlimited', 'Initial D'],
      [/^premium\b/i, 'Premium'], [/^limited vintage neo\b/i, 'Limited Vintage Neo'], [/^limited vintage\b/i, 'Limited Vintage'],
      [/^dream( tomica)?\b/i, 'Dream Tomica'], [/^disney (resort|vehicle collection)\b/i, 'Disney Resort'], [/^disney( motors)?\b/i, 'Disney'],
      [/^(event|mobishow|mobility show|anniversary)\b/i, 'Event', null, true], [/^ania\b/i, 'Ania'], [/^(tomica )?(garage|town|playset)\b/i, 'Playset']],
  };
  const DEFAULT_RANGE = { 'Hot Wheels': 'Mainline', Matchbox: 'Mainline', Tomica: 'Regular' };

  const COLOURS = 'red|blue|white|black|silver|grey|gray|gold|green|yellow|orange|pink|purple|bronze|teal|brown|beige|chrome|zamac|spectraflame \\w+|metallic \\w+|dark \\w+|light \\w+';
  const COLOUR_TAIL = new RegExp('\\s+(' + COLOURS + ')(\\s*(?:/|&|and)\\s*(' + COLOURS + '))?$', 'i');

  // real-car makes: [regex on the name, make]. A make already spelled out in the name is matched first.
  const MAKES = ['Toyota', 'Nissan', 'Honda', 'Mazda', 'Subaru', 'Suzuki', 'Mitsubishi Fuso', 'Mitsubishi', 'Daihatsu', 'Lexus', 'Isuzu', 'Hino', 'Datsun',
    'Ferrari', 'Lamborghini', 'Porsche', 'Mercedes-Benz', 'Mercedes', 'Merc', 'BMW', 'Audi', 'Volkswagen', 'VW', 'Tesla', 'Ford', 'Chevrolet', 'Chevy', 'Dodge', 'Cadillac',
    'Jeep', 'Fiat', 'Alfa Romeo', 'Lancia', 'Renault', 'Peugeot', 'Citroen', 'Vauxhall', 'Opel', 'Rover', 'Land Rover', 'Range Rover', 'Mini', 'Jaguar', 'Aston Martin',
    'McLaren', 'Lotus', 'Bentley', 'Rolls-Royce', 'Bugatti', 'Koenigsegg', 'Pagani', 'Volvo', 'Saab', 'Hyundai', 'Kia', 'Morita', 'DeLorean', 'Shelby', 'Pontiac', 'Plymouth', 'Buick'];
  const MODEL_HINTS = [
    [/\b(sf90|f40|f50|enzo|testarossa|laferrari|488|812|296|roma|purosangue)\b/i, 'Ferrari'],
    [/\b(911|carrera|boxster|cayman|taycan|918|356|959|cayenne)\b/i, 'Porsche'],
    [/\b(model [3sxy]|cybertruck|roadster 2)\b/i, 'Tesla'],
    [/\b(g ?wagon|g-?class|amg|\d{3} ?se[lc]?\b|sls|300 ?sl)\b/i, 'Mercedes-Benz'],
    [/\b(supra|crown|alphard|gr ?86|ae ?86|mr2|prius|corolla|land cruiser|hilux|celica|century|hiace|chaser|sprinter trueno|levin|gr yaris|2000 ?gt)\b/i, 'Toyota'],
    [/\b(gt-?r|skyline|leaf|silvia|180sx|sleighty|fairlady|z33|z34|370z|300zx|cedric|gloria|super silhouette|elgrand|serena|note)\b/i, 'Nissan'],
    [/\b(civic|nsx|s2000|integra|type r|n-?box|beat)\b/i, 'Honda'],
    [/\b(787b|rx-?7|rx-?8|miata|mx-?5|eunos|cosmo)\b/i, 'Mazda'],
    [/\b(impreza|wrx|brz|sambar|levorg|forester)\b/i, 'Subaru'],
    [/\b(jimny|alto|swift|hustler|carry)\b/i, 'Suzuki'],
    [/\b(lancer|evo|pajero|delica)\b/i, 'Mitsubishi'],
    [/\b(fuso|canter)\b/i, 'Mitsubishi Fuso'],
    [/\b(huracan|hurac[aá]n|countach|aventador|urus|miura|diablo|murci[eé]lago|revuelto)\b/i, 'Lamborghini'],
    [/\b(jesko|agera|regera|gemera|ccx)\b/i, 'Koenigsegg'],
    [/\b(ats-?v|ct5|escalade|eldorado)\b/i, 'Cadillac'],
    [/\b(lc ?500|lfa|is-?f)\b/i, 'Lexus'],
    [/\b(500e|500 abarth|panda|abarth)\b/i, 'Fiat'],
    [/\b(astra|corsa|cavalier|calibra)\b/i, 'Vauxhall'],
    [/\b(sterling|mini cooper)\b/i, 'Rover'],
    [/\b(r5 e-?tech|5 e-?tech|clio|alpine)\b/i, 'Renault'],
    [/\b(mustang|gt40|bronco|f-?150|escort|sierra|focus)\b/i, 'Ford'],
    [/\b(camaro|corvette|impala|chevelle|silverado)\b/i, 'Chevrolet'],
    [/\b(challenger|charger|viper)\b/i, 'Dodge'],
    [/\b(golf|beetle|kombi|type 2|t1)\b/i, 'Volkswagen'],
    [/\b(m3|m4|e30|e46|i8|2002)\b/i, 'BMW'],
    [/\b(r8|quattro|rs ?6|rs ?4)\b/i, 'Audi'],
    [/\b(senna|720s|765lt|p1|f1 gtr)\b/i, 'McLaren'],
    [/\b(db5|db11|vantage|valkyrie)\b/i, 'Aston Martin'],
    [/\b(chiron|veyron|eb110)\b/i, 'Bugatti'],
    [/\b(aerial ladder|ranger|profia)\b/i, 'Hino'],
  ];
  const NOT_A_CAR = /\b(mario|mcqueen|lightning|penguins?|sharks?|whale|dolphin|gundam|landspeeder|x-?34|monorail|columbia|leagues|shark bite|corobee|batmobile|pikachu|travel van)\b/i;

  const ESCAPE = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const tidy = (s) => String(s || '').replace(/\s+/g, ' ').replace(/^[\s,·\-–]+|[\s,·\-–]+$/g, '').trim();

  function detectMake(text) {
    for (const mk of MAKES) {
      const re = new RegExp('(^|[^a-z])' + ESCAPE(mk) + '(?=$|[^a-z])', 'i');
      if (re.test(text)) return { make: /^merc/i.test(mk) ? 'Mercedes-Benz' : mk === 'Chevy' ? 'Chevrolet' : mk === 'VW' ? 'Volkswagen' : mk, inText: mk };
    }
    if (NOT_A_CAR.test(text)) return { make: '', inText: null };
    for (const [re, mk] of MODEL_HINTS) if (re.test(text)) return { make: mk, inText: null };
    return { make: '', inText: null };
  }

  // Make + model as one display name, without saying the make twice.
  function displayName(make, model) {
    make = tidy(make); model = tidy(model);
    if (!make) return model;
    if (!model) return make;
    return model.toLowerCase().startsWith(make.toLowerCase()) ? model : make + ' ' + model;
  }

  // "Hot Wheels Factory Fresh 5/5 2025 SF90 Stradale Blue", "Tomica 110 Toyota Crown Patrol Car", "Tomica Premium 14 Eunos Roadster", "Mini GT 512 GT-R"
  function parseName(raw, brandHint) {
    let s = tidy(raw).replace(/[‘’]/g, "'");
    let brand = brandHint && BRANDS[brandHint] ? brandHint : '', range = '', series = '', rarity = 'standard', number = '', year = '', colour = '', accessory = false;
    if (!brandHint || brandHint === 'auto') brand = '';
    for (const [re, b, strip, r] of BRAND_PREFIX) {
      if (re.test(s) && (!brand || brand === b)) { brand = b; if (strip) s = s.replace(re, ''); if (r) range = r; break; }
    }
    // rarity words anywhere
    if (/\b(sth|super treasure hunt|super th)\b/i.test(s)) { rarity = 'sth'; s = s.replace(/\b(sth|super treasure hunt|super th)\b/ig, ' '); }
    else if (/\b(th|treasure hunt)\b/i.test(s)) { rarity = 'th'; s = s.replace(/\b(th|treasure hunt)\b/ig, ' '); }
    else if (/\b(chase|raw chase|green machine)\b/i.test(s)) { rarity = 'chase'; s = s.replace(/\b(raw chase|chase)\b/ig, ' '); }
    if (rarity === 'standard' && /\b(limited|exclusive|event|anniversary|mobishow|mobility show|convention|zamac|rlc|lucky ?bag|campaign)\b/i.test(s)) rarity = 'limited';
    s = tidy(s);
    if (!brand) {
      // no brand prefix: guess from the shape of the name
      if (/^(premium|limited vintage|dream|ania)\b/i.test(s) && !/car culture|boulevard/i.test(s)) brand = 'Tomica';
      else if (/\d{1,3}\/\d{2,3}\b/.test(s) || /^(hw|car culture|premium car culture|factory fresh|nightspeed|then and now|then & now|drop tops|race day|wild widebody)\b/i.test(s)) brand = 'Hot Wheels';
      else brand = 'Other';
    }
    for (const [re, r, keepSeries, ltd] of RANGE_PREFIX[brand] || []) {
      if (!range && re.test(s)) {
        range = r;
        if (r === 'Playset') accessory = true; else s = s.replace(re, '');
        if (keepSeries) series = keepSeries;
        if (ltd && rarity === 'standard') rarity = 'limited';
        break;
      }
    }
    s = tidy(s);
    // year: 1950–2049, or '71
    const ym = s.match(/(^|\s)(19[5-9]\d|20[0-4]\d)(?=\s|$)/) || s.match(/(^|\s)'(\d{2})(?=\s|$)/);
    if (ym) { year = ym[2].length === 2 ? (Number(ym[2]) > 40 ? '19' : '20') + ym[2] : ym[2]; s = tidy(s.replace(ym[0], ' ')); }
    // number on the card: "5/10" (series position) or "18/100" (collector no.), or a leading Tomica/casting number "110", "C21", "AS11", "No.4"
    const slash = s.match(/(^|\s)(\d{1,3}\/\d{1,3})(?=\s|$)/);
    if (slash) {
      number = slash[2];
      const before = tidy(s.slice(0, slash.index + slash[1].length));
      const after = tidy(s.slice(slash.index + slash[0].length));
      if (before && brand === 'Hot Wheels') { series = tidy((series ? series + ' ' : '') + before); s = after; }
      else s = tidy(before + ' ' + after);
    } else {
      const lead = s.match(/^(?:no\.?\s*)?(lv-?n?\d{1,3}[a-z]?|[a-z]{0,3}\d{1,4})(?=\s)/i);
      if (lead && !/^(19|20)\d\d$/.test(lead[1]) && !/^(gt|r|rs|mr|gr|lc|ae|rx|sf|f|m|z|x)\d/i.test(lead[1])) { number = lead[1].toUpperCase(); s = tidy(s.slice(lead[0].length)); }
    }
    if (brand === 'Tomica' && (!range || range === 'Regular')) {
      if (/^A[SLC]-?\d/i.test(number)) range = 'Ania';
      else if (/^C-?\d/i.test(number)) range = 'Disney';
    }
    // colour at the end
    const cm = s.match(COLOUR_TAIL);
    if (cm && tidy(s.slice(0, cm.index)).split(' ').length >= 1 && tidy(s.slice(0, cm.index))) { colour = tidy(cm[0]).replace(/\b\w/g, (c) => c.toUpperCase()).replace(/Gray/, 'Grey'); s = tidy(s.slice(0, cm.index)); }
    const mk = detectMake(s);
    let model = s;
    if (mk.inText) model = tidy(s.replace(new RegExp('(^|[^a-z])' + ESCAPE(mk.inText) + '(?=$|[^a-z])', 'i'), '$1'));
    if (!range && DEFAULT_RANGE[brand]) range = DEFAULT_RANGE[brand];
    if (brand === 'Tomica' && /\b(garage|playset|tomica town|parking)\b/i.test(raw)) { accessory = true; range = range === 'Regular' ? 'Playset' : range; }
    const scale = (String(raw).match(/\b1[:/](18|24|32|36|43|50|55|56|60|61|62|64|72|76|87)\b(?!\s*\d)/) || [])[1];
    const out = {
      brand, range, series, number, year, colour, rarity, accessory,
      make: mk.make, model: model || s, scale: scale ? '1:' + scale : (range === 'Ania' || accessory ? '' : brandInfo(brand).scale),
    };
    out.title = displayName(out.make, out.model);
    return out;
  }

  // Text for photo and price searches
  function searchQuery(it) {
    const r = it.range && !/^(mainline|regular)$/i.test(it.range) ? it.range : '';
    const b = it.brand && it.brand !== 'Other' ? it.brand : '';
    const parts = [b, r, it.brand === 'Tomica' && it.number && !/\//.test(it.number) ? 'No.' + it.number : '', it.title || displayName(it.make, it.model), it.colour];
    let q = tidy(parts.filter(Boolean).join(' '));
    if (!/diecast|tomica|hot wheels|matchbox/i.test(q)) q += ' diecast';
    return q;
  }

  const NOISE = /\b(review|reddit|tiktok|wiki|fandom|youtube|custom|customs?|lot of|bundle|job ?lot|wheels only|real riders swap|sticker|decal|wallpaper|3d print|display case|unboxing|haul|hunting)\b/i;
  const BRAND_TOKENS = {
    'Hot Wheels': /hot ?wheels/i, Matchbox: /matchbox/i, Tomica: /tomica|トミカ/i, 'Mini GT': /mini ?gt/i, AUTOart: /auto ?art/i, Kyosho: /kyosho/i,
    Inno64: /inno ?64/i, 'Tarmac Works': /tarmac/i, Majorette: /majorette/i, Motormax: /motor ?max/i, Greenlight: /green ?light/i, Maisto: /maisto/i, Jada: /jada/i, Siku: /siku/i,
  };
  function tokens(s) {
    return String(s).toLowerCase().replace(/[^a-z0-9\-\/. ]/g, ' ').split(/\s+/).filter((t) => t.length > 1 && !['the', 'and', 'diecast', 'die-cast', 'car', 'cars', '1:64', '1/64', 'scale', 'model', 'new', 'mainline', 'regular'].includes(t));
  }
  function scoreCandidate(item, cand) {
    const t = cand.t || '';
    let score = 0;
    for (const w of tokens(item.title || '')) if (t.toLowerCase().includes(w)) score += 2;
    if (item.colour && t.toLowerCase().includes(String(item.colour).toLowerCase().split(' ').pop())) score += 1;
    if (item.number && t.includes(item.number)) score += 1;
    const own = BRAND_TOKENS[item.brand];
    if (own && own.test(t)) score += 3;
    for (const [b, re] of Object.entries(BRAND_TOKENS)) if (b !== item.brand && re.test(t) && !(own && own.test(t))) score -= 3;
    if (item.range && /premium|limited vintage|car culture/i.test(item.range) && new RegExp(item.range.split(' ')[0], 'i').test(t)) score += 1;
    if (/\b(super treasure hunt|sth)\b/i.test(t) && item.rarity !== 'sth') score -= 1;
    if (NOISE.test(t)) score -= 4;
    return score;
  }
  function rankCandidates(item, cands) {
    return cands.map((c, i) => ({ ...c, score: scoreCandidate(item, c) - i * 0.3 })).sort((a, b) => b.score - a.score);
  }

  const api = { BRANDS, BRAND_ORDER, brandInfo, RARITY, RARITY_ORDER, parseName, displayName, searchQuery, scoreCandidate, rankCandidates, detectMake };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Match = api;
})(typeof window !== 'undefined' ? window : globalThis);
