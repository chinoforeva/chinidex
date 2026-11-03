var ChiniPokedex = (function (factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    return api;
}(function () {
    'use strict';

    const SLOTS_PER_PAGE = 12;
    const PAGES_PER_ALBUM = 40;
    const SLOTS_PER_ALBUM = SLOTS_PER_PAGE * PAGES_PER_ALBUM;
    const ALBUM_COUNT = 3;
    const SPECIES_SLUGS = `bulbasaur|ivysaur|venusaur|charmander|charmeleon|charizard|squirtle|wartortle|blastoise|caterpie|metapod|butterfree|weedle|kakuna|beedrill|pidgey|pidgeotto|pidgeot|rattata|raticate|spearow|fearow|ekans|arbok|pikachu|raichu|sandshrew|sandslash|nidoran-f|nidorina|nidoqueen|nidoran-m|nidorino|nidoking|clefairy|clefable|vulpix|ninetales|jigglypuff|wigglytuff|zubat|golbat|oddish|gloom|vileplume|paras|parasect|venonat|venomoth|diglett|dugtrio|meowth|persian|psyduck|golduck|mankey|primeape|growlithe|arcanine|poliwag|poliwhirl|poliwrath|abra|kadabra|alakazam|machop|machoke|machamp|bellsprout|weepinbell|victreebel|tentacool|tentacruel|geodude|graveler|golem|ponyta|rapidash|slowpoke|slowbro|magnemite|magneton|farfetchd|doduo|dodrio|seel|dewgong|grimer|muk|shellder|cloyster|gastly|haunter|gengar|onix|drowzee|hypno|krabby|kingler|voltorb|electrode|exeggcute|exeggutor|cubone|marowak|hitmonlee|hitmonchan|lickitung|koffing|weezing|rhyhorn|rhydon|chansey|tangela|kangaskhan|horsea|seadra|goldeen|seaking|staryu|starmie|mr-mime|scyther|jynx|electabuzz|magmar|pinsir|tauros|magikarp|gyarados|lapras|ditto|eevee|vaporeon|jolteon|flareon|porygon|omanyte|omastar|kabuto|kabutops|aerodactyl|snorlax|articuno|zapdos|moltres|dratini|dragonair|dragonite|mewtwo|mew|chikorita|bayleef|meganium|cyndaquil|quilava|typhlosion|totodile|croconaw|feraligatr|sentret|furret|hoothoot|noctowl|ledyba|ledian|spinarak|ariados|crobat|chinchou|lanturn|pichu|cleffa|igglybuff|togepi|togetic|natu|xatu|mareep|flaaffy|ampharos|bellossom|marill|azumarill|sudowoodo|politoed|hoppip|skiploom|jumpluff|aipom|sunkern|sunflora|yanma|wooper|quagsire|espeon|umbreon|murkrow|slowking|misdreavus|unown|wobbuffet|girafarig|pineco|forretress|dunsparce|gligar|steelix|snubbull|granbull|qwilfish|scizor|shuckle|heracross|sneasel|teddiursa|ursaring|slugma|magcargo|swinub|piloswine|corsola|remoraid|octillery|delibird|mantine|skarmory|houndour|houndoom|kingdra|phanpy|donphan|porygon2|stantler|smeargle|tyrogue|hitmontop|smoochum|elekid|magby|miltank|blissey|raikou|entei|suicune|larvitar|pupitar|tyranitar|lugia|ho-oh|celebi|treecko|grovyle|sceptile|torchic|combusken|blaziken|mudkip|marshtomp|swampert|poochyena|mightyena|zigzagoon|linoone|wurmple|silcoon|beautifly|cascoon|dustox|lotad|lombre|ludicolo|seedot|nuzleaf|shiftry|taillow|swellow|wingull|pelipper|ralts|kirlia|gardevoir|surskit|masquerain|shroomish|breloom|slakoth|vigoroth|slaking|nincada|ninjask|shedinja|whismur|loudred|exploud|makuhita|hariyama|azurill|nosepass|skitty|delcatty|sableye|mawile|aron|lairon|aggron|meditite|medicham|electrike|manectric|plusle|minun|volbeat|illumise|roselia|gulpin|swalot|carvanha|sharpedo|wailmer|wailord|numel|camerupt|torkoal|spoink|grumpig|spinda|trapinch|vibrava|flygon|cacnea|cacturne|swablu|altaria|zangoose|seviper|lunatone|solrock|barboach|whiscash|corphish|crawdaunt|baltoy|claydol|lileep|cradily|anorith|armaldo|feebas|milotic|castform|kecleon|shuppet|banette|duskull|dusclops|tropius|chimecho|absol|wynaut|snorunt|glalie|spheal|sealeo|walrein|clamperl|huntail|gorebyss|relicanth|luvdisc|bagon|shelgon|salamence|beldum|metang|metagross|regirock|regice|registeel|latias|latios|kyogre|groudon|rayquaza|jirachi|deoxys|turtwig|grotle|torterra|chimchar|monferno|infernape|piplup|prinplup|empoleon|starly|staravia|staraptor|bidoof|bibarel|kricketot|kricketune|shinx|luxio|luxray|budew|roserade|cranidos|rampardos|shieldon|bastiodon|burmy|wormadam|mothim|combee|vespiquen|pachirisu|buizel|floatzel|cherubi|cherrim|shellos|gastrodon|ambipom|drifloon|drifblim|buneary|lopunny|mismagius|honchkrow|glameow|purugly|chingling|stunky|skuntank|bronzor|bronzong|bonsly|mime-jr|happiny|chatot|spiritomb|gible|gabite|garchomp|munchlax|riolu|lucario|hippopotas|hippowdon|skorupi|drapion|croagunk|toxicroak|carnivine|finneon|lumineon|mantyke|snover|abomasnow|weavile|magnezone|lickilicky|rhyperior|tangrowth|electivire|magmortar|togekiss|yanmega|leafeon|glaceon|gliscor|mamoswine|porygon-z|gallade|probopass|dusknoir|froslass|rotom|uxie|mesprit|azelf|dialga|palkia|heatran|regigigas|giratina|cresselia|phione|manaphy|darkrai|shaymin|arceus|victini|snivy|servine|serperior|tepig|pignite|emboar|oshawott|dewott|samurott|patrat|watchog|lillipup|herdier|stoutland|purrloin|liepard|pansage|simisage|pansear|simisear|panpour|simipour|munna|musharna|pidove|tranquill|unfezant|blitzle|zebstrika|roggenrola|boldore|gigalith|woobat|swoobat|drilbur|excadrill|audino|timburr|gurdurr|conkeldurr|tympole|palpitoad|seismitoad|throh|sawk|sewaddle|swadloon|leavanny|venipede|whirlipede|scolipede|cottonee|whimsicott|petilil|lilligant|basculin|sandile|krokorok|krookodile|darumaka|darmanitan|maractus|dwebble|crustle|scraggy|scrafty|sigilyph|yamask|cofagrigus|tirtouga|carracosta|archen|archeops|trubbish|garbodor|zorua|zoroark|minccino|cinccino|gothita|gothorita|gothitelle|solosis|duosion|reuniclus|ducklett|swanna|vanillite|vanillish|vanilluxe|deerling|sawsbuck|emolga|karrablast|escavalier|foongus|amoonguss|frillish|jellicent|alomomola|joltik|galvantula|ferroseed|ferrothorn|klink|klang|klinklang|tynamo|eelektrik|eelektross|elgyem|beheeyem|litwick|lampent|chandelure|axew|fraxure|haxorus|cubchoo|beartic|cryogonal|shelmet|accelgor|stunfisk|mienfoo|mienshao|druddigon|golett|golurk|pawniard|bisharp|bouffalant|rufflet|braviary|vullaby|mandibuzz|heatmor|durant|deino|zweilous|hydreigon|larvesta|volcarona|cobalion|terrakion|virizion|tornadus|thundurus|reshiram|zekrom|landorus|kyurem|keldeo|meloetta|genesect|chespin|quilladin|chesnaught|fennekin|braixen|delphox|froakie|frogadier|greninja|bunnelby|diggersby|fletchling|fletchinder|talonflame|scatterbug|spewpa|vivillon|litleo|pyroar|flabebe|floette|florges|skiddo|gogoat|pancham|pangoro|furfrou|espurr|meowstic|honedge|doublade|aegislash|spritzee|aromatisse|swirlix|slurpuff|inkay|malamar|binacle|barbaracle|skrelp|dragalge|clauncher|clawitzer|helioptile|heliolisk|tyrunt|tyrantrum|amaura|aurorus|sylveon|hawlucha|dedenne|carbink|goomy|sliggoo|goodra|klefki|phantump|trevenant|pumpkaboo|gourgeist|bergmite|avalugg|noibat|noivern|xerneas|yveltal|zygarde|diancie|hoopa|volcanion|rowlet|dartrix|decidueye|litten|torracat|incineroar|popplio|brionne|primarina|pikipek|trumbeak|toucannon|yungoos|gumshoos|grubbin|charjabug|vikavolt|crabrawler|crabominable|oricorio|cutiefly|ribombee|rockruff|lycanroc|wishiwashi|mareanie|toxapex|mudbray|mudsdale|dewpider|araquanid|fomantis|lurantis|morelull|shiinotic|salandit|salazzle|stufful|bewear|bounsweet|steenee|tsareena|comfey|oranguru|passimian|wimpod|golisopod|sandygast|palossand|pyukumuku|type-null|silvally|minior|komala|turtonator|togedemaru|mimikyu|bruxish|drampa|dhelmise|jangmo-o|hakamo-o|kommo-o|tapu-koko|tapu-lele|tapu-bulu|tapu-fini|cosmog|cosmoem|solgaleo|lunala|nihilego|buzzwole|pheromosa|xurkitree|celesteela|kartana|guzzlord|necrozma|magearna|marshadow|poipole|naganadel|stakataka|blacephalon|zeraora|meltan|melmetal|grookey|thwackey|rillaboom|scorbunny|raboot|cinderace|sobble|drizzile|inteleon|skwovet|greedent|rookidee|corvisquire|corviknight|blipbug|dottler|orbeetle|nickit|thievul|gossifleur|eldegoss|wooloo|dubwool|chewtle|drednaw|yamper|boltund|rolycoly|carkol|coalossal|applin|flapple|appletun|silicobra|sandaconda|cramorant|arrokuda|barraskewda|toxel|toxtricity|sizzlipede|centiskorch|clobbopus|grapploct|sinistea|polteageist|hatenna|hattrem|hatterene|impidimp|morgrem|grimmsnarl|obstagoon|perrserker|cursola|sirfetchd|mr-rime|runerigus|milcery|alcremie|falinks|pincurchin|snom|frosmoth|stonjourner|eiscue|indeedee|morpeko|cufant|copperajah|dracozolt|arctozolt|dracovish|arctovish|duraludon|dreepy|drakloak|dragapult|zacian|zamazenta|eternatus|kubfu|urshifu|zarude|regieleki|regidrago|glastrier|spectrier|calyrex|wyrdeer|kleavor|ursaluna|basculegion|sneasler|overqwil|enamorus|sprigatito|floragato|meowscarada|fuecoco|crocalor|skeledirge|quaxly|quaxwell|quaquaval|lechonk|oinkologne|tarountula|spidops|nymble|lokix|pawmi|pawmo|pawmot|tandemaus|maushold|fidough|dachsbun|smoliv|dolliv|arboliva|squawkabilly|nacli|naclstack|garganacl|charcadet|armarouge|ceruledge|tadbulb|bellibolt|wattrel|kilowattrel|maschiff|mabosstiff|shroodle|grafaiai|bramblin|brambleghast|toedscool|toedscruel|klawf|capsakid|scovillain|rellor|rabsca|flittle|espathra|tinkatink|tinkatuff|tinkaton|wiglett|wugtrio|bombirdier|finizen|palafin|varoom|revavroom|cyclizar|orthworm|glimmet|glimmora|greavard|houndstone|flamigo|cetoddle|cetitan|veluza|dondozo|tatsugiri|annihilape|clodsire|farigiraf|dudunsparce|kingambit|great-tusk|scream-tail|brute-bonnet|flutter-mane|slither-wing|sandy-shocks|iron-treads|iron-bundle|iron-hands|iron-jugulis|iron-moth|iron-thorns|frigibax|arctibax|baxcalibur|gimmighoul|gholdengo|wo-chien|chien-pao|ting-lu|chi-yu|roaring-moon|iron-valiant|koraidon|miraidon|walking-wake|iron-leaves|dipplin|poltchageist|sinistcha|okidogi|munkidori|fezandipiti|ogerpon|archaludon|hydrapple|gouging-fire|raging-bolt|iron-boulder|iron-crown|terapagos|pecharunt`.split('|');

    const DISPLAY_OVERRIDES = {
        'nidoran-f': 'Nidoran♀', 'nidoran-m': 'Nidoran♂', farfetchd: "Farfetch’d", 'mr-mime': 'Mr. Mime',
        'mime-jr': 'Mime Jr.', 'ho-oh': 'Ho-Oh', 'porygon-z': 'Porygon-Z', flabebe: 'Flabébé',
        'type-null': 'Type: Null', 'jangmo-o': 'Jangmo-o', 'hakamo-o': 'Hakamo-o', 'kommo-o': 'Kommo-o',
        'tapu-koko': 'Tapu Koko', 'tapu-lele': 'Tapu Lele', 'tapu-bulu': 'Tapu Bulu', 'tapu-fini': 'Tapu Fini',
        sirfetchd: "Sirfetch’d", 'mr-rime': 'Mr. Rime', 'wo-chien': 'Wo-Chien', 'chien-pao': 'Chien-Pao',
        'ting-lu': 'Ting-Lu', 'chi-yu': 'Chi-Yu'
    };
    const GENERATION_ENDS = [151, 251, 386, 493, 649, 721, 809, 905, 1025];

    function displayName(slug) {
        return DISPLAY_OVERRIDES[slug] || slug.split('-').map(part => part ? part[0].toUpperCase() + part.slice(1) : '').join(' ');
    }

    function normalizeText(value) {
        return String(value || '')
            .replace(/♀/g, ' f ')
            .replace(/♂/g, ' m ')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, ' ')
            .trim()
            .replace(/\s+/g, ' ');
    }

    function generationFor(number) {
        const index = GENERATION_ENDS.findIndex(end => number <= end);
        return index === -1 ? null : index + 1;
    }

    const species = SPECIES_SLUGS.map((slug, index) => ({
        number: index + 1,
        slug,
        name: displayName(slug),
        normalized: normalizeText(displayName(slug)),
        generation: generationFor(index + 1)
    }));
    const matchers = [...species].sort((a, b) => b.normalized.length - a.normalized.length || a.number - b.number);

    function speciesByNumber(number) {
        const value = Number(number);
        return Number.isInteger(value) && value >= 1 && value <= species.length ? species[value - 1] : null;
    }

    function matchCard(cardOrName) {
        if (cardOrName && cardOrName.pokedexNumber != null && cardOrName.pokedexNumber !== '' && Number.isInteger(Number(cardOrName.pokedexNumber))) {
            return speciesByNumber(Number(cardOrName.pokedexNumber));
        }
        const rawName = typeof cardOrName === 'string'
            ? cardOrName
            : cardOrName?.baseName || cardOrName?.nameEnglish || cardOrName?.name || '';
        const normalized = ` ${normalizeText(rawName.replace(/\s*\((?:CN|JP|EN)\)\s*$/i, ''))} `;
        return matchers.find(entry => normalized.includes(` ${entry.normalized} `)) || null;
    }

    function locationFor(number) {
        const value = Number(number);
        if (!Number.isInteger(value) || value < 1 || value > SLOTS_PER_ALBUM * ALBUM_COUNT) return null;
        const album = Math.floor((value - 1) / SLOTS_PER_ALBUM) + 1;
        const albumIndex = (value - 1) % SLOTS_PER_ALBUM;
        const page = Math.floor(albumIndex / SLOTS_PER_PAGE) + 1;
        const slot = (albumIndex % SLOTS_PER_PAGE) + 1;
        const row = Math.floor((slot - 1) / 4) + 1;
        const column = ((slot - 1) % 4) + 1;
        const spread = Math.floor(page / 2) + 1;
        const side = page === 1 || page % 2 === 1 ? 'derecha' : 'izquierda';
        return { number: value, album, page, slot, row, column, spread, side };
    }

    function cardsForSpecies(collection, speciesNumber) {
        return Object.values(collection || {}).filter(card => matchCard(card)?.number === Number(speciesNumber));
    }

    function normalizedVariant(card) {
        return normalizeText(card?.variant || 'normal').replace(/\s+/g, '') || 'normal';
    }

    function normalizedCardNumber(card) {
        const value = String(card?.number || '').trim().toLowerCase();
        return /^\d+$/.test(value) ? String(Number(value)) : value.replace(/[^a-z0-9]+/g, '');
    }

    function normalizedSet(card) {
        return normalizeText(card?.setSlug || card?.setId || card?.setName || '').replace(/\s+/g, '');
    }

    function sameCardPrint(left, right) {
        if (!left || !right) return false;
        if (left.id && right.id && String(left.id) === String(right.id)) return true;
        if (left.productId && right.productId && String(left.productId) === String(right.productId)) {
            return normalizedVariant(left) === normalizedVariant(right);
        }
        const leftSet = normalizedSet(left);
        const rightSet = normalizedSet(right);
        const leftNumber = normalizedCardNumber(left);
        const rightNumber = normalizedCardNumber(right);
        return !!leftSet && leftSet === rightSet
            && !!leftNumber && leftNumber === rightNumber
            && normalizedVariant(left) === normalizedVariant(right);
    }

    function normalizedLanguage(card) {
        const value = normalizeText(card?.languageCode || card?.language || '').replace(/\s+/g, '');
        if (value === 'ja' || value === 'jp' || value === 'japanese') return 'jp';
        if (value === 'en' || value === 'english') return 'en';
        return value;
    }

    function samePreviewCard(left, right) {
        const leftLanguage = normalizedLanguage(left);
        const rightLanguage = normalizedLanguage(right);
        if (leftLanguage && rightLanguage && leftLanguage !== rightLanguage) return false;
        return sameCardPrint(left, right);
    }

    function createPreviewTracker(options = {}) {
        const releaseAfterMs = Math.max(0, Number(options.releaseAfterMs ?? 1100));
        let seenCards = [];
        let activeCard = null;
        let activeWasSeen = false;
        let lastSeenAt = 0;

        return {
            observe(card, now = Date.now()) {
                if (!samePreviewCard(card, activeCard)) {
                    activeWasSeen = seenCards.some(seenCard => samePreviewCard(card, seenCard));
                    activeCard = card;
                    if (!activeWasSeen) seenCards.push(card);
                }
                lastSeenAt = Number(now);
                return { alreadySeen: activeWasSeen, seenCount: seenCards.length };
            },
            miss(now = Date.now()) {
                if (!activeCard || Number(now) - lastSeenAt < releaseAfterMs) return false;
                activeCard = null;
                activeWasSeen = false;
                return true;
            },
            reset() {
                seenCards = [];
                activeCard = null;
                activeWasSeen = false;
                lastSeenAt = 0;
            },
            size() {
                return seenCards.length;
            }
        };
    }

    function classifyCard(card, collection) {
        const matchedSpecies = matchCard(card);
        if (!matchedSpecies) return { kind: 'not-pokemon', species: null, location: null, variants: [], exact: null };
        const variants = cardsForSpecies(collection, matchedSpecies.number);
        const exact = (card?.id ? (collection || {})[card.id] || null : null)
            || variants.find(ownedCard => sameCardPrint(card, ownedCard))
            || null;
        return {
            kind: exact ? 'duplicate' : variants.length ? 'new-variant' : 'new-species',
            species: matchedSpecies,
            location: locationFor(matchedSpecies.number),
            variants,
            exact
        };
    }

    return {
        SLOTS_PER_PAGE, PAGES_PER_ALBUM, SLOTS_PER_ALBUM, ALBUM_COUNT,
        species, normalizeText, matchCard, speciesByNumber, locationFor, cardsForSpecies,
        normalizedVariant, sameCardPrint, samePreviewCard, createPreviewTracker, classifyCard
    };
}));

// Expose the album API explicitly.  Some browser execution contexts do not
// turn a top-level `var` from an external script into a reliable global name.
if (typeof window !== 'undefined') window.ChiniPokedex = ChiniPokedex;
