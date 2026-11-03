/* Collector-facing visual families, not prices, strength or pull-rate estimates.
 * See RARITIES.md. Exact aliases avoid collisions between games/locales. */
(function(root) {
    const normalize = value => String(value ?? '').trim().toLowerCase();
    const pokemon = Object.create(null);
    const add = (tier, labels) => labels.split('|').forEach(label => pokemon[normalize(label)] = tier);
    add('unknown', '|—|None');
    add('common', 'Common|C|●');
    add('uncommon', 'Uncommon|U|UC|♦');
    add('rare', 'Rare|R|★');
    add('holo', 'Rare Holo|★H|TR');
    add('double', 'Double Rare|RR|RRR|Rare Holo EX|Rare Holo GX|Rare Holo LV.X|Rare Holo V|Rare Holo VMAX|Rare Holo VSTAR|Holo Rare V|Holo Rare VMAX|Holo Rare VSTAR|Rare BREAK|Rare Prime|れじぇんど|LEGEND');
    add('ultra', 'Ultra Rare|Rare Ultra|UR|SR|Super Rare|ACE|ACE SPEC Rare|Rare ACE|Rare Prism Star|Radiant Rare|Amazing Rare|A|K|PR');
    add('art', 'Illustration Rare|Art Rare|AR|CHR|Trainer Gallery Rare Holo|Shiny Rare|Rare Shiny|S|Pikachu Rare|ピカチュウレア');
    add('special-art', 'Special Illustration Rare|SIR|SAR|Special Art Rare|Secret Art Rare|CSR|SSR|Shiny Ultra Rare|Shiny Secret Rare|Rare Shiny GX|Rare Shining|Rare Holo Star|Rare Holo ☆|Mega Attack Rare|FUR|Futuristic Rare');
    add('secret', 'Secret Rare|Rare Secret|Hyper Rare|HR');
    add('rainbow', 'Rare Rainbow');
    add('prestige', 'Mega Hyper Rare|MUR|BWR|Black White Rare');
    add('special', 'Classic Collection');
    add('promo', 'Promo|PROMO|P|プロモ');
    const games = {
        pokemon,
        onepiece: {c:'common',uc:'uncommon',r:'rare',sr:'ultra',sec:'secret',tr:'prestige',l:'special',p:'promo',sp:'special-art'},
        riftbound: {common:'common',uncommon:'uncommon',rare:'rare',epic:'ultra',showcase:'prestige'},
        magic: {common:'common',uncommon:'uncommon',rare:'secret',mythic:'mythic','mythic rare':'mythic',special:'special',bonus:'special','—':'unknown'}
    };
    function classify(rarity, game='pokemon', lang='en') {
        const key = normalize(rarity);
        if (game === 'pokemon' && (lang === 'jp' || lang === 'cn')) {
            if (key === 'ur') return 'secret';
            if (key === 'hr') return 'rainbow';
        }
        return games[game]?.[key] || 'unknown';
    }
    function known(rarity, game='pokemon') {
        return !normalize(rarity) || Object.hasOwn(games[game] || {}, normalize(rarity));
    }
    const api = Object.freeze({classify, known});
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else root.ChiniRarity = api;
})(globalThis);
