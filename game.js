// Simple RNG Looter RPG built with vanilla JS
// Systems: combat, loot, skills, dragons, events, saving

const ENEMY_SCALE = 2;
const ENEMY_ATTACK_MOD = 5 / 6; // global reduction to enemy attack power

const rarities = [
  { key: 'common', label: 'Common', color: 'common', weight: 70, stats: [1, 2], scale: 1 },
  { key: 'uncommon', label: 'Uncommon', color: 'uncommon', weight: 22, stats: [2, 3], scale: 1.08 },
  { key: 'rare', label: 'Rare', color: 'rare', weight: 6, stats: [3, 4], scale: 1.2 },
  { key: 'epic', label: 'Epic', color: 'epic', weight: 2, stats: [4, 5], scale: 1.35 },
  { key: 'legendary', label: 'Legendary', color: 'legendary', weight: 0.5, stats: [4, 5], scale: 1.55 },
];

const statPool = [
  { key: 'hp', label: 'Max HP', base: 10 },
  { key: 'attack', label: 'Attack', base: 2 },
  { key: 'defense', label: 'Defense', base: 1 },
  { key: 'crit', label: 'Crit %', base: 1 },
  { key: 'critdmg', label: 'Crit DMG %', base: 3 },
  { key: 'speed', label: 'Speed', base: 1 },
  { key: 'elemental', label: 'Elemental Dmg', base: 2 },
];

const lifeSkillDefs = {
  mining: { name: 'Mining', desc: 'Gather ores, crystals, stones.' },
  foraging: { name: 'Foraging', desc: 'Harvest herbs, plants, mushrooms.' },
  fishing: { name: 'Fishing', desc: 'Catch fish and treasure.' },
  hunting: { name: 'Hunting', desc: 'Track monster parts from enemies.' },
  blacksmithing: { name: 'Blacksmithing', desc: 'Forge and upgrade gear.' },
  alchemy: { name: 'Alchemy', desc: 'Brew potions and elixirs.' },
  cooking: { name: 'Cooking', desc: 'Prepare meals for temporary buffs.' },
  enchanting: { name: 'Enchanting', desc: 'Reroll or empower items.' },
  dragonHandling: { name: 'Dragon Handling', desc: 'Reduce hatch time and improve dragons.' },
  dragonBonding: { name: 'Dragon Bonding', desc: 'Unlock deeper dragon synergies.' },
  trading: { name: 'Trading', desc: 'Better shop deals and rarer wares.' },
};

const materialCatalog = [
  { id: 'copper_ore', name: 'Copper Ore', tier: 1, sourceZones: [1, 2], minPlayerLevel: 1, rarityColor: 'common', sourceType: 'mining', dropRates: { 1: 0.7, 2: 0.6 }, description: 'Soft metal used for novice gear.', usedInRecipes: ['copper_blade', 'simple_stew'], usedInTiers: [1] },
  { id: 'soft_wood', name: 'Soft Wood', tier: 1, sourceZones: [1], minPlayerLevel: 1, rarityColor: 'common', sourceType: 'foraging', dropRates: { 1: 0.65 }, description: 'Young timber good for handles.', usedInRecipes: ['copper_blade'], usedInTiers: [1] },
  { id: 'basic_herb', name: 'Basic Herbs', tier: 1, sourceZones: [1], minPlayerLevel: 1, rarityColor: 'common', sourceType: 'foraging', dropRates: { 1: 0.7 }, description: 'Simple herbs for stew and poultices.', usedInRecipes: ['simple_stew', 'novice_potion'], usedInTiers: [1] },
  { id: 'raw_meat', name: 'Raw Meat', tier: 1, sourceZones: [1], minPlayerLevel: 1, rarityColor: 'common', sourceType: 'hunting', dropRates: { 1: 0.55 }, description: 'Fresh game meat.', usedInRecipes: ['simple_stew'], usedInTiers: [1] },
  { id: 'brook_trout', name: 'Brook Trout', tier: 1, sourceZones: [1], minPlayerLevel: 1, rarityColor: 'common', sourceType: 'fishing', dropRates: { 1: 0.6 }, description: 'Common river catch used for light meals.', usedInRecipes: ['simple_stew'], usedInTiers: [1] },

  { id: 'iron_ore', name: 'Iron Ore', tier: 2, sourceZones: [2, 3, 4], minPlayerLevel: 8, rarityColor: 'uncommon', sourceType: 'mining', dropRates: { 2: 0.35, 3: 0.5, 4: 0.55 }, description: 'Sturdy ore for stronger blades.', usedInRecipes: ['iron_blade', 'frost_soup', 'iron_refine'], usedInTiers: [2] },
  { id: 'cedar_wood', name: 'Cedar Wood', tier: 2, sourceZones: [2], minPlayerLevel: 8, rarityColor: 'uncommon', sourceType: 'foraging', dropRates: { 2: 0.5 }, description: 'Resinous wood with bite.', usedInRecipes: ['iron_blade'], usedInTiers: [2] },
  { id: 'frostbud', name: 'Frostbud Herb', tier: 2, sourceZones: [2], minPlayerLevel: 8, rarityColor: 'uncommon', sourceType: 'foraging', dropRates: { 2: 0.55 }, description: 'Cold-loving herb for soups and resistance tonics.', usedInRecipes: ['frost_soup', 'resist_elixir'], usedInTiers: [2] },
  { id: 'venom_gland', name: 'Venom Gland', tier: 2, sourceZones: [3], minPlayerLevel: 12, rarityColor: 'uncommon', sourceType: 'hunting', dropRates: { 3: 0.35 }, description: 'Toxic gland useful for alchemy.', usedInRecipes: ['resist_elixir'], usedInTiers: [2, 3] },

  { id: 'storm_eel', name: 'Stormreach Eel', tier: 3, sourceZones: [5], minPlayerLevel: 18, rarityColor: 'rare', sourceType: 'fishing', dropRates: { 5: 0.35 }, description: 'Eel crackling with latent lightning.', usedInRecipes: ['elemental_tonic'], usedInTiers: [3] },
  { id: 'steel_ore', name: 'Steel Ore', tier: 3, sourceZones: [3, 4, 5], minPlayerLevel: 18, rarityColor: 'rare', sourceType: 'mining', dropRates: { 3: 0.4, 4: 0.45, 5: 0.35 }, description: 'Refined ore able to hold great edges.', usedInRecipes: ['steel_greatsword', 'ember_feast', 'steel_refine'], usedInTiers: [3] },
  { id: 'darkwood', name: 'Darkwood', tier: 3, sourceZones: [4], minPlayerLevel: 18, rarityColor: 'rare', sourceType: 'foraging', dropRates: { 4: 0.35 }, description: 'Dense lumber, ideal for hardy hafts.', usedInRecipes: ['steel_greatsword'], usedInTiers: [3] },
  { id: 'emberleaf', name: 'Emberleaf', tier: 3, sourceZones: [3], minPlayerLevel: 18, rarityColor: 'rare', sourceType: 'foraging', dropRates: { 3: 0.45 }, description: 'Smoldering leaf that spices hearty meals.', usedInRecipes: ['ember_feast', 'elemental_tonic'], usedInTiers: [3] },
  { id: 'alpha_parts', name: 'Alpha Monster Parts', tier: 3, sourceZones: [5], minPlayerLevel: 18, rarityColor: 'rare', sourceType: 'hunting', dropRates: { 5: 0.32 }, description: 'Trophies from tough beasts.', usedInRecipes: ['steel_greatsword'], usedInTiers: [3] },

  { id: 'sky_pearl', name: 'Sky Pearl', tier: 4, sourceZones: [5], minPlayerLevel: 26, rarityColor: 'epic', sourceType: 'fishing', dropRates: { 5: 0.2 }, description: 'Shimmering pearl infused with clouds.', usedInRecipes: ['battle_elixir'], usedInTiers: [4] },
  { id: 'mithril_ore', name: 'Mithril Ore', tier: 4, sourceZones: [4, 5, 6], minPlayerLevel: 26, rarityColor: 'epic', sourceType: 'mining', dropRates: { 4: 0.35, 5: 0.4, 6: 0.35 }, description: 'Light but potent metal.', usedInRecipes: ['mithril_spear', 'battle_elixir', 'mithril_refine'], usedInTiers: [4] },
  { id: 'dragonwood', name: 'Dragonwood', tier: 4, sourceZones: [4], minPlayerLevel: 26, rarityColor: 'epic', sourceType: 'foraging', dropRates: { 4: 0.35 }, description: 'Bark steeped in draconic heat.', usedInRecipes: ['mithril_spear'], usedInTiers: [4] },
  { id: 'crystal_bloom', name: 'Crystal Bloom', tier: 4, sourceZones: [5, 6], minPlayerLevel: 26, rarityColor: 'epic', sourceType: 'foraging', dropRates: { 5: 0.25, 6: 0.2 }, description: 'Fractal flowers pulsing with mana.', usedInRecipes: ['mithril_spear', 'eternal_elixir'], usedInTiers: [4, 5] },
  { id: 'ancient_essence', name: 'Ancient Essence', tier: 5, sourceZones: [7], minPlayerLevel: 30, rarityColor: 'legendary', sourceType: 'enemy', dropRates: { 7: 0.2 }, description: 'Phantasmal energy from ruins.', usedInRecipes: ['eternal_elixir'], usedInTiers: [5] },

  { id: 'dragonite_ore', name: 'Dragonite Ore', tier: 5, sourceZones: [6, 7], minPlayerLevel: 40, rarityColor: 'legendary', sourceType: 'boss', dropRates: { 6: 0.12, 7: 0.15 }, description: 'Legendary ore that hums with power.', usedInRecipes: ['dragonite_waraxe', 'eternal_elixir'], usedInTiers: [5] },
  { id: 'elderwood', name: 'Elderwood', tier: 5, sourceZones: [7], minPlayerLevel: 40, rarityColor: 'legendary', sourceType: 'foraging', dropRates: { 7: 0.2 }, description: 'Wood from primordial trees.', usedInRecipes: ['dragonite_waraxe', 'elder_feast'], usedInTiers: [5] },
  { id: 'phoenix_herb', name: 'Phoenix Herb', tier: 5, sourceZones: [6, 7], minPlayerLevel: 40, rarityColor: 'legendary', sourceType: 'foraging', dropRates: { 6: 0.12, 7: 0.2 }, description: 'Self-rekindling herb with radiant oils.', usedInRecipes: ['elder_feast', 'eternal_elixir'], usedInTiers: [5] },
  { id: 'primordial_core', name: 'Primordial Core', tier: 5, sourceZones: [7], minPlayerLevel: 45, rarityColor: 'legendary', sourceType: 'boss', dropRates: { 7: 0.1 }, description: 'Rare core from ancient guardians.', usedInRecipes: ['dragonite_waraxe', 'master_rune'], usedInTiers: [5] },
];

const materialTemplates = materialCatalog.map(m => m.id);
const materialMap = materialCatalog.reduce((acc, mat) => {
  acc[mat.id] = mat;
  return acc;
}, {});

function zoneById(id) {
  return zones.find(z => z.id === id) || zones[id];
}

function materialAllowedInZone(mat, zone, playerLevel) {
  if (!mat || !zone) return false;
  const tierOk = (zone.allowedMaterialTiers || []).includes(mat.tier);
  const levelOk = playerLevel >= (mat.minPlayerLevel || 1);
  const zoneOk = (mat.sourceZones || []).includes(zone.id);
  return tierOk && levelOk && zoneOk;
}

function getAvailableMaterialsForZone(zoneId, playerLevel, predicate) {
  const zone = zoneById(zoneId);
  return materialCatalog.filter(mat => materialAllowedInZone(mat, zone, playerLevel) && (!predicate || predicate(mat)));
}

const lifeActions = {
  mining: [{ label: 'Mine Ore', xp: 14, sourceType: 'mining', rewards: materialCatalog.filter(m => m.sourceType === 'mining').map(m => ({ id: m.id, min: 1, max: 3, chance: 0.4 + m.tier * 0.1 })) }],
  foraging: [{ label: 'Search for Herbs', xp: 12, sourceType: 'foraging', rewards: materialCatalog.filter(m => m.sourceType === 'foraging').map(m => ({ id: m.id, min: 1, max: 2, chance: 0.35 + m.tier * 0.08 })) }],
  fishing: [{ label: 'Go Fishing', xp: 11, sourceType: 'fishing', rewards: materialCatalog.filter(m => m.sourceType === 'fishing').map(m => ({ id: m.id, min: 1, max: 2, chance: 0.4 + m.tier * 0.05 })) }],
  hunting: [{ label: 'Dress Game', xp: 10, sourceType: 'hunting', rewards: materialCatalog.filter(m => m.sourceType === 'hunting' || m.sourceType === 'enemy').map(m => ({ id: m.id, min: 1, max: 2, chance: 0.35 + m.tier * 0.07 })) }],
};

const recipeBook = {
  blacksmithing: [
    { id: 'copper_blade', name: 'Copper Sword', skillReq: 1, tier: 1, quality: 'common', profession: 'blacksmithing', type: 'gear', gearTier: 1, recommendedZones: [1, 2], playerLevelReq: 1, slot: 'weapon', rarity: 'uncommon', levelReq: 4, mats: { copper_ore: 4, soft_wood: 2 }, stats: [{ key: 'attack', label: 'Attack', value: 6 }], desc: 'Basic blade for starting adventurers.', autoUnlock: true },
    { id: 'iron_blade', name: 'Iron Blade', skillReq: 10, tier: 2, profession: 'blacksmithing', type: 'gear', gearTier: 2, recommendedZones: [2, 3], playerLevelReq: 10, slot: 'weapon', rarity: 'rare', levelReq: 10, mats: { iron_ore: 6, cedar_wood: 2, soft_wood: 1 }, stats: [{ key: 'attack', label: 'Attack', value: 14 }, { key: 'crit', label: 'Crit %', value: 3 }], desc: 'Sharper iron-forged blade.', rarityTag: 'uncommon' },
    { id: 'steel_greatsword', name: 'Steel Greatsword', skillReq: 20, tier: 3, profession: 'blacksmithing', type: 'gear', gearTier: 3, recommendedZones: [4, 5], playerLevelReq: 20, slot: 'weapon', rarity: 'epic', levelReq: 18, mats: { steel_ore: 8, darkwood: 2, alpha_parts: 2 }, stats: [{ key: 'attack', label: 'Attack', value: 28 }, { key: 'critdmg', label: 'Crit DMG %', value: 6 }], desc: 'Heavy sword tempered for raids.' },
    { id: 'mithril_spear', name: 'Mithril Spear', skillReq: 35, tier: 4, profession: 'blacksmithing', type: 'gear', gearTier: 4, recommendedZones: [5, 6], playerLevelReq: 30, slot: 'weapon', rarity: 'epic', levelReq: 28, mats: { mithril_ore: 8, crystal_bloom: 2, dragonwood: 2 }, stats: [{ key: 'attack', label: 'Attack', value: 45 }, { key: 'speed', label: 'Speed', value: 6 }], desc: 'Lightweight spear for elite fighters.' },
    { id: 'dragonite_waraxe', name: 'Dragonite Waraxe', skillReq: 50, tier: 5, profession: 'blacksmithing', type: 'gear', gearTier: 5, recommendedZones: [6, 7], playerLevelReq: 40, slot: 'weapon', rarity: 'legendary', levelReq: 40, mats: { dragonite_ore: 10, elderwood: 3, primordial_core: 1 }, stats: [{ key: 'attack', label: 'Attack', value: 70 }, { key: 'elemental', label: 'Elemental Dmg', value: 20 }], desc: 'Mythic axe infused with primal flames.', rarityTag: 'legendary' }
  ],
  cooking: [
    { id: 'simple_stew', name: 'Simple Stew', skillReq: 1, tier: 1, profession: 'cooking', type: 'food', rarity: 'common', buff: { xpBoost: 0.05, duration: 3 }, mats: { basic_herb: 2, raw_meat: 1 }, desc: 'Comfort stew that boosts XP gain.', autoUnlock: true },
    { id: 'frost_soup', name: 'Frost Soup', skillReq: 10, tier: 2, profession: 'cooking', type: 'food', rarity: 'uncommon', buff: { crit: 0.1, duration: 3 }, mats: { frostbud: 2, iron_ore: 1 }, desc: 'Chilled soup sharpening focus.' },
    { id: 'ember_feast', name: 'Ember Feast', skillReq: 20, tier: 3, profession: 'cooking', type: 'food', rarity: 'rare', buff: { attack: 0.2, duration: 2, bossOnly: true }, mats: { emberleaf: 2, raw_meat: 2 }, desc: 'Hunt-ready meal for boss attempts.' },
    { id: 'sky_salad', name: 'Sky Salad', skillReq: 35, tier: 4, profession: 'cooking', type: 'food', rarity: 'epic', buff: { speed: 0.1, dodge: 0.1, duration: 3 }, mats: { crystal_bloom: 1, dragonwood: 1, raw_meat: 1 }, desc: 'Light salad with floating herbs.' },
    { id: 'elder_feast', name: 'Elder Feast', skillReq: 50, tier: 5, profession: 'cooking', type: 'food', rarity: 'legendary', buff: { loot: 0.3, duration: 5 }, mats: { elderwood: 1, phoenix_herb: 1, dragonite_ore: 1 }, desc: 'Mythic banquet improving loot finds.' }
  ],
  alchemy: [
    { id: 'novice_potion', name: 'Novice Potion', skillReq: 1, tier: 1, profession: 'alchemy', type: 'potion', rarity: 'common', heal: 60, mats: { basic_herb: 2 }, desc: 'Simple healing brew.', autoUnlock: true },
    { id: 'resist_elixir', name: 'Venom Resist Elixir', skillReq: 10, tier: 2, profession: 'alchemy', type: 'potion', rarity: 'uncommon', buff: { defense: 0.08, duration: 3, resist: 'poison' }, mats: { venom_gland: 1, frostbud: 1 }, desc: 'Resists toxins for a few battles.' },
    { id: 'elemental_tonic', name: 'Elemental Tonic', skillReq: 20, tier: 3, profession: 'alchemy', type: 'potion', rarity: 'rare', buff: { elemental: 8, duration: 3 }, mats: { emberleaf: 1, steel_ore: 1 }, desc: 'Boosts elemental potency.' },
    { id: 'battle_elixir', name: 'Battle Elixir', skillReq: 35, tier: 4, profession: 'alchemy', type: 'potion', rarity: 'epic', buff: { attack: 0.15, crit: 0.08, duration: 3 }, mats: { mithril_ore: 2, crystal_bloom: 1 }, desc: 'Multi-stat combat brew.' },
    { id: 'eternal_elixir', name: 'Eternal Elixir', skillReq: 50, tier: 5, profession: 'alchemy', type: 'potion', rarity: 'legendary', buff: { attack: 0.2, defense: 0.15, duration: 2, bossOnly: true }, mats: { phoenix_herb: 1, ancient_essence: 1, dragonite_ore: 1 }, desc: 'Boss-only draught of legends.' }
  ],
  enchanting: [
    { id: 'minor_glow', name: 'Minor Glow', skillReq: 5, tier: 1, profession: 'enchanting', type: 'enchant', rarity: 'uncommon', mats: { copper_ore: 1, basic_herb: 1 }, desc: 'Adds small random stat.', effect: 'small' },
    { id: 'spark_of_renewal', name: 'Spark of Renewal', skillReq: 15, tier: 2, profession: 'enchanting', type: 'enchant', rarity: 'rare', mats: { iron_ore: 2, frostbud: 1 }, desc: 'Reroll stats on a chosen gear item.', effect: 'reroll' },
    { id: 'greater_affix', name: 'Greater Affix', skillReq: 25, tier: 3, profession: 'enchanting', type: 'enchant', rarity: 'epic', mats: { steel_ore: 2, darkwood: 1 }, desc: 'Adds an affix boosting damage.', effect: 'affix' },
    { id: 'mythic_upgrade', name: 'Mythic Upgrade', skillReq: 35, tier: 4, profession: 'enchanting', type: 'enchant', rarity: 'epic', mats: { mithril_ore: 3, crystal_bloom: 1 }, desc: 'Chance to upgrade item rarity.', effect: 'upgrade' },
    { id: 'cut_ruby', name: 'Cut Ruby', skillReq: 15, tier: 2, profession: 'enchanting', type: 'gem', rarity: 'rare', mats: { iron_ore: 2, cedar_wood: 1 }, desc: 'Cut a ruby for attack sockets.', output: { gemId: 'ruby_t1' } },
    { id: 'cut_emerald', name: 'Cut Emerald', skillReq: 25, tier: 3, profession: 'enchanting', type: 'gem', rarity: 'epic', mats: { steel_ore: 2, emberleaf: 1 }, desc: 'Shape an emerald for crit sockets.', output: { gemId: 'emerald_t3' } },
    { id: 'master_rune', name: 'Master Rune', skillReq: 50, tier: 5, profession: 'enchanting', type: 'rune', rarity: 'legendary', mats: { primordial_core: 1, crystal_bloom: 2 }, desc: 'Creates a powerful rune for sockets.', output: { runeId: 'rune_mastery' } }
  ],
};

const refineChains = [
  { input: 'copper_ore', output: 'iron_ore', ratio: 3, xp: 10 },
  { input: 'iron_ore', output: 'steel_ore', ratio: 4, xp: 14 },
  { input: 'steel_ore', output: 'mithril_ore', ratio: 5, xp: 18 },
  { input: 'mithril_ore', output: 'dragonite_ore', ratio: 6, xp: 25 },
];

const qualityTiers = [
  { key: 'poor', label: 'Poor', boost: -0.1, chance: 0.25, color: 'common' },
  { key: 'normal', label: 'Normal', boost: 0, chance: 0.5, color: 'uncommon' },
  { key: 'fine', label: 'Fine', boost: 0.1, chance: 0.15, color: 'rare' },
  { key: 'great', label: 'Great', boost: 0.2, chance: 0.07, color: 'epic' },
  { key: 'masterwork', label: 'Masterwork', boost: 0.35, chance: 0.03, color: 'legendary', affix: true },
];

const professionPerks = {
  blacksmithing: [
    { level: 10, desc: '+5% chance to craft Fine or higher gear.' },
    { level: 20, desc: '+10% chance to craft Fine or higher gear.' },
    { level: 35, desc: '+1 socket on crafted weapons.' },
    { level: 50, desc: 'Crafting gear has a chance to roll Masterwork twice.' },
  ],
  cooking: [
    { level: 10, desc: 'Meals last +1 battle.' },
    { level: 20, desc: 'Food grants +5% loot chance.' },
    { level: 35, desc: 'Food buffs gain +10% potency.' },
    { level: 50, desc: 'Legendary feasts last an extra battle.' },
  ],
  enchanting: [
    { level: 10, desc: '+5% chance to add a minor stat on enchant.' },
    { level: 20, desc: 'Affix enchants can add small crit bonuses.' },
    { level: 35, desc: 'Upgrade attempts gain +5% success.' },
    { level: 50, desc: 'Chance to add a second enchant automatically.' },
  ],
  dragonHandling: [
    { level: 10, desc: 'Eggs hatch 10% faster.' },
    { level: 20, desc: 'Dragons roll +5% better stats.' },
    { level: 25, desc: 'Eggs hatch 20% faster.' },
    { level: 50, desc: 'Dragons gain +1 bonus passive slot.' },
  ],
  dragonBonding: [
    { level: 10, desc: 'Dragons provide +2% more bonuses.' },
    { level: 20, desc: 'Dragon damage procs +5% more often.' },
    { level: 35, desc: 'Dragons may shield for a small barrier.' },
    { level: 50, desc: 'Dragons double their rare passive chance.' },
  ],
  trading: [
    { level: 10, desc: 'Shops show one extra slot.' },
    { level: 20, desc: '+5% better prices.' },
    { level: 35, desc: 'Chance to stock rare recipes.' },
    { level: 50, desc: 'Legendary shop slot unlocked.' },
  ],
};

const gemCatalog = [
  { id: 'ruby_t1', tier: 1, type: 'attack', stat: { attackPct: 0.04 }, color: 'rare' },
  { id: 'ruby_t2', tier: 2, type: 'attack', stat: { attackPct: 0.06 }, color: 'rare' },
  { id: 'ruby_t3', tier: 3, type: 'attack', stat: { attackPct: 0.08 }, color: 'epic' },
  { id: 'sapphire_t2', tier: 2, type: 'element', stat: { elemental: 5 }, color: 'rare' },
  { id: 'sapphire_t4', tier: 4, type: 'element', stat: { elemental: 12 }, color: 'epic' },
  { id: 'emerald_t3', tier: 3, type: 'crit', stat: { crit: 5 }, color: 'epic' },
  { id: 'emerald_t5', tier: 5, type: 'crit', stat: { crit: 9, critdmg: 0.08 }, color: 'legendary' },
  { id: 'topaz_t2', tier: 2, type: 'defense', stat: { defensePct: 0.06 }, color: 'uncommon' },
  { id: 'topaz_t4', tier: 4, type: 'defense', stat: { defensePct: 0.12, hpPct: 0.08 }, color: 'epic' },
  { id: 'amethyst_t5', tier: 5, type: 'shadow', stat: { lifesteal: 0.05, attackPct: 0.05 }, color: 'legendary' },
];

const gemStatPool = [
  { type: 'attack', statKey: 'attackPct' },
  { type: 'crit', statKey: 'crit' },
  { type: 'defense', statKey: 'defensePct' },
  { type: 'element', statKey: 'elemental' },
  { type: 'speed', statKey: 'speed' },
];

function rarityForTier(tier) {
  if (tier >= 5) return 'legendary';
  if (tier === 4) return 'epic';
  if (tier === 3) return 'rare';
  if (tier === 2) return 'uncommon';
  return 'common';
}

function createRandomGem(tier) {
  const statPick = gemStatPool[Math.floor(Math.random() * gemStatPool.length)];
  const scale = statPick.statKey.includes('Pct') ? +(0.03 * tier).toFixed(3) : 3 * tier;
  const stat = { [statPick.statKey]: scale };
  const gemDef = { id: `prismatic_t${tier}_${statPick.type}`, tier, type: statPick.type, stat, color: rarityForTier(tier) };
  return { id: crypto.randomUUID(), type: 'gem', name: `Gem: ${statPick.type.toUpperCase()} T${tier}`, rarity: gemDef.color, gem: gemDef };
}

const runeCatalog = [
  { id: 'rune_bleed', tier: 3, desc: 'Basic attacks have 10% chance to bleed.', modifier: { bleed: 0.1 }, rarity: 'epic' },
  { id: 'rune_focus', tier: 2, desc: 'Skills cost 10% less resource.', modifier: { resourceDiscount: 0.1 }, rarity: 'rare' },
  { id: 'rune_mastery', tier: 5, desc: 'Gain 5 rage when hit and +8% damage.', modifier: { fury: 0.05, attack: 0.08 }, rarity: 'legendary' },
];

const classData = {
  Warrior: { hp: 120, attack: 12, defense: 8, crit: 5, mana: 30, tag: 'melee' },
  Mage: { hp: 90, attack: 15, defense: 4, crit: 8, mana: 60, tag: 'caster' },
  Rogue: { hp: 95, attack: 13, defense: 5, crit: 12, mana: 40, tag: 'assassin' },
  Cleric: { hp: 100, attack: 10, defense: 7, crit: 6, mana: 55, tag: 'holy' },
  Ranger: { hp: 100, attack: 13, defense: 6, crit: 10, mana: 40, tag: 'ranged' },
  Paladin: { hp: 115, attack: 11, defense: 9, crit: 6, mana: 50, tag: 'holy' },
  Warlock: { hp: 90, attack: 14, defense: 5, crit: 9, mana: 65, tag: 'dark' },
};

const classResources = {
  Warrior: 'Rage',
  Mage: 'Mana',
  Rogue: 'Energy',
  Cleric: 'Mana',
  Ranger: 'Energy',
  Paladin: 'Faith',
  Warlock: 'Mana',
};

const zoneModifiers = {
  'Goblin Forest': { desc: 'Forest foes are nimble (+5 enemy speed).', enemySpeed: 5 },
  'Crystal Caverns': { desc: 'Crystal resonance reduces crits (-5% player crit).', playerCritDown: 5 },
  'Cursed Battlefield': { desc: 'Curses linger: periodic shadow burns each side.', dot: 4 },
  'Dragon Peaks': { desc: 'High winds grant enemies bonus attack (+8%).', enemyAttackMod: 0.08 },
};

const activeSkills = {
  Warrior: [
    { id: 'warriorStrike', name: 'Shield Bash', cost: 8, cooldown: 2, type: 'Active', tags: ['stun', 'physical'], description: 'Heavy bash that can stun.', action: (ctx) => {
      const dmg = CombatSystem.calculateDamage(ctx.playerStats, ctx.enemyStats, { variance: 0.1, bonus: 1.1 });
      ctx.enemy.currentHP -= dmg.amount;
      CombatSystem.log(`You bash ${ctx.enemy.name} for ${dmg.amount}${dmg.crit ? ' (CRIT)' : ''}.`, dmg.crit);
      CombatSystem.applyStatus('enemy', { key: 'stun', duration: 1, type: 'cc', label: 'Stunned' });
    } },
    { id: 'warriorRend', name: 'Rend', cost: 10, cooldown: 3, type: 'Proc', tags: ['bleed'], description: 'Inflict a bleeding wound.', action: (ctx) => {
      CombatSystem.applyStatus('enemy', { key: 'bleed', duration: 3, tick: Math.max(2, Math.round(ctx.playerStats.attack * 0.25)), type: 'dot', label: 'Bleeding' });
      CombatSystem.log('The target begins bleeding.', false, 'status');
    } },
    { id: 'warriorGuard', name: 'Guard Up', cost: 6, cooldown: 2, type: 'Buff', tags: ['defense'], description: 'Raise a barrier and defense.', action: (ctx) => {
      CombatSystem.applyStatus('player', { key: 'guard', duration: 2, defense: 0.2, barrier: 5, type: 'buff', label: 'Guarded' });
      CombatSystem.log('You brace behind your shield.', false, 'status');
    } },
  ],
  Mage: [
    { id: 'mageFire', name: 'Firebolt', cost: 12, cooldown: 2, type: 'Active', tags: ['fire'], description: 'Spell with high burn chance.', action: (ctx) => {
      const dmg = CombatSystem.calculateDamage(ctx.playerStats, ctx.enemyStats, { variance: 0.12, bonus: 1.2, element: 'fire' });
      ctx.enemy.currentHP -= dmg.amount;
      CombatSystem.log(`Firebolt scorches for ${dmg.amount}${dmg.crit ? ' (CRIT)' : ''}.`, dmg.crit);
      if (Math.random() < 0.5) CombatSystem.applyStatus('enemy', { key: 'burn', duration: 3, tick: Math.max(2, Math.round(ctx.playerStats.attack * 0.2)), type: 'dot', label: 'Burn' });
    } },
    { id: 'mageFrost', name: 'Frost Nova', cost: 10, cooldown: 3, type: 'Control', tags: ['ice'], description: 'Slow or freeze the enemy.', action: () => {
      CombatSystem.applyStatus('enemy', { key: 'freeze', duration: 1, type: 'cc', label: 'Frozen' });
      CombatSystem.log('Ice locks the foe in place.', false, 'status');
    } },
    { id: 'mageArcane', name: 'Arcane Surge', cost: 14, cooldown: 4, type: 'Buff', tags: ['arcane'], description: 'Boost crit and damage for a few turns.', action: () => {
      CombatSystem.applyStatus('player', { key: 'arcane', duration: 3, attack: 0.18, crit: 8, type: 'buff', label: 'Arcane Surge' });
      CombatSystem.log('Arcane power hums around you.', false, 'status');
    } },
  ],
  Rogue: [
    { id: 'rogueStrike', name: 'Shadowstab', cost: 8, cooldown: 2, type: 'Active', tags: ['shadow', 'crit'], description: 'Fast strike with high crit.', action: (ctx) => {
      const dmg = CombatSystem.calculateDamage(ctx.playerStats, ctx.enemyStats, { variance: 0.05, critBonus: 0.2 });
      ctx.enemy.currentHP -= dmg.amount;
      CombatSystem.log(`You shadowstab for ${dmg.amount}${dmg.crit ? ' (CRIT)' : ''}.`, dmg.crit);
      CombatSystem.applyStatus('player', { key: 'evasion', duration: 2, dodge: 0.12, type: 'buff', label: 'Evasion' });
    } },
    { id: 'roguePoison', name: 'Poisoned Blade', cost: 10, cooldown: 3, type: 'DoT', tags: ['poison'], description: 'Apply poison each turn.', action: (ctx) => {
      CombatSystem.applyStatus('enemy', { key: 'poison', duration: 4, tick: Math.max(2, Math.round(ctx.playerStats.attack * 0.22)), type: 'dot', label: 'Poison' });
      CombatSystem.log('Poison courses through the enemy.', false, 'status');
    } },
    { id: 'rogueFlurry', name: 'Flurry', cost: 14, cooldown: 4, type: 'Proc', tags: ['multi'], description: 'Two rapid strikes.', action: (ctx) => {
      for (let i = 0; i < 2; i++) {
        const dmg = CombatSystem.calculateDamage(ctx.playerStats, ctx.enemyStats, { variance: 0.1, bonus: 0.65 });
        ctx.enemy.currentHP -= dmg.amount;
        CombatSystem.log(`Flurry hit ${i + 1} deals ${dmg.amount}${dmg.crit ? ' (CRIT)' : ''}.`, dmg.crit);
      }
    } },
  ],
  Cleric: [
    { id: 'clericSmite', name: 'Smite', cost: 10, cooldown: 2, type: 'Active', tags: ['holy'], description: 'Holy damage with bonus to undead.', action: (ctx) => {
      const bonus = ctx.enemy.tag === 'undead' ? 1.25 : 1;
      const dmg = CombatSystem.calculateDamage(ctx.playerStats, ctx.enemyStats, { variance: 0.08, bonus });
      ctx.enemy.currentHP -= dmg.amount;
      CombatSystem.log(`Smite lands for ${dmg.amount}${dmg.crit ? ' (CRIT)' : ''}.`, dmg.crit);
    } },
    { id: 'clericHeal', name: 'Renew', cost: 12, cooldown: 3, type: 'Heal', tags: ['heal'], description: 'Restore health over time.', action: (ctx) => {
      CombatSystem.applyStatus('player', { key: 'renew', duration: 3, healTick: Math.max(3, Math.round(ctx.playerStats.maxHP * 0.06)), type: 'buff', label: 'Renew' });
      CombatSystem.log('Holy light mends your wounds.', false, 'status');
    } },
    { id: 'clericWard', name: 'Sanctuary', cost: 8, cooldown: 2, type: 'Buff', tags: ['holy', 'defense'], description: 'Gain barrier and defense.', action: () => {
      CombatSystem.applyStatus('player', { key: 'sanctuary', duration: 2, defense: 0.18, barrier: 8, type: 'buff', label: 'Sanctuary' });
      CombatSystem.log('A ward shields you.', false, 'status');
    } },
  ],
  Ranger: [
    { id: 'rangerShot', name: 'Aimed Shot', cost: 9, cooldown: 2, type: 'Active', tags: ['crit'], description: 'High precision shot.', action: (ctx) => {
      const dmg = CombatSystem.calculateDamage(ctx.playerStats, ctx.enemyStats, { variance: 0.05, bonus: 1.15, critBonus: 0.15 });
      ctx.enemy.currentHP -= dmg.amount;
      CombatSystem.log(`Aimed shot deals ${dmg.amount}${dmg.crit ? ' (CRIT)' : ''}.`, dmg.crit);
    } },
    { id: 'rangerVolley', name: 'Volley', cost: 12, cooldown: 3, type: 'Proc', tags: ['multi'], description: 'Three arrows raining down.', action: (ctx) => {
      for (let i = 0; i < 3; i++) {
        const dmg = CombatSystem.calculateDamage(ctx.playerStats, ctx.enemyStats, { variance: 0.1, bonus: 0.55 });
        ctx.enemy.currentHP -= dmg.amount;
        CombatSystem.log(`Volley arrow ${i + 1} hits for ${dmg.amount}.`, dmg.crit);
      }
    } },
    { id: 'rangerSnare', name: 'Snare Trap', cost: 8, cooldown: 3, type: 'Control', tags: ['snare'], description: 'Root the enemy briefly.', action: () => {
      CombatSystem.applyStatus('enemy', { key: 'snare', duration: 1, type: 'cc', label: 'Snared' });
      CombatSystem.log('A snare trap slows the foe.', false, 'status');
    } },
  ],
  Paladin: [
    { id: 'palStrike', name: 'Radiant Hammer', cost: 10, cooldown: 2, type: 'Active', tags: ['holy'], description: 'Holy empowered strike.', action: (ctx) => {
      const dmg = CombatSystem.calculateDamage(ctx.playerStats, ctx.enemyStats, { variance: 0.08, bonus: 1.1 });
      ctx.enemy.currentHP -= dmg.amount;
      CombatSystem.log(`Radiant hammer deals ${dmg.amount}${dmg.crit ? ' (CRIT)' : ''}.`, dmg.crit);
    } },
    { id: 'palWard', name: 'Aegis', cost: 8, cooldown: 3, type: 'Buff', tags: ['holy', 'defense'], description: 'Greatly reduce next hits.', action: () => {
      CombatSystem.applyStatus('player', { key: 'aegis', duration: 2, defense: 0.22, barrier: 10, type: 'buff', label: 'Aegis' });
      CombatSystem.log('A holy aegis surrounds you.', false, 'status');
    } },
    { id: 'palSmite', name: 'Judgement', cost: 12, cooldown: 4, type: 'Active', tags: ['holy', 'burst'], description: 'Heavy burst with bonus vs bosses.', action: (ctx) => {
      const bonus = ctx.isBoss ? 1.25 : 1;
      const dmg = CombatSystem.calculateDamage(ctx.playerStats, ctx.enemyStats, { variance: 0.12, bonus });
      ctx.enemy.currentHP -= dmg.amount;
      CombatSystem.log(`Judgement hits for ${dmg.amount}${dmg.crit ? ' (CRIT)' : ''}.`, dmg.crit, ctx.isBoss ? 'boss' : undefined);
    } },
  ],
  Warlock: [
    { id: 'wlCorrupt', name: 'Corruption', cost: 10, cooldown: 2, type: 'DoT', tags: ['shadow'], description: 'Shadow damage over time.', action: (ctx) => {
      CombatSystem.applyStatus('enemy', { key: 'corruption', duration: 4, tick: Math.max(3, Math.round(ctx.playerStats.attack * 0.24)), type: 'dot', label: 'Corruption' });
      CombatSystem.log('Darkness gnaws at the enemy.', false, 'status');
    } },
    { id: 'wlDrain', name: 'Life Drain', cost: 12, cooldown: 3, type: 'Leech', tags: ['shadow', 'heal'], description: 'Deal damage and heal.', action: (ctx) => {
      const dmg = CombatSystem.calculateDamage(ctx.playerStats, ctx.enemyStats, { variance: 0.08, bonus: 0.95 });
      ctx.enemy.currentHP -= dmg.amount;
      const heal = Math.max(3, Math.round(dmg.amount * 0.4));
      ctx.player.currentHP = Math.min(ctx.player.currentHP + heal, ctx.playerStats.maxHP);
      CombatSystem.log(`Drain hits for ${dmg.amount} and heals ${heal}.`, dmg.crit);
    } },
    { id: 'wlPact', name: 'Dark Pact', cost: 14, cooldown: 4, type: 'Buff', tags: ['shadow', 'crit'], description: 'Boost attack and crit damage.', action: () => {
      CombatSystem.applyStatus('player', { key: 'pact', duration: 3, attack: 0.2, critdmg: 0.25, type: 'buff', label: 'Dark Pact' });
      CombatSystem.log('Your pact empowers your blows.', false, 'status');
    } },
  ],
};

const zones = [
  {
    id: 1,
    name: 'Verdantwild',
    level: 1,
    recommendedLevel: 1,
    allowedMaterialTiers: [1],
    enemies: [
      { name: 'Wildling', tag: 'humanoid', hp: 55, attack: 8, defense: 2, xp: 14, gold: 8 },
      { name: 'Forest Wolf', tag: 'beast', hp: 50, attack: 9, defense: 2, xp: 12, gold: 7 },
    ],
    boss: { name: 'Verdant Alpha', tag: 'beast', hp: 120, attack: 16, defense: 5, xp: 48, gold: 25, boss: true }
  },
  {
    id: 2,
    name: 'Frostmarch',
    level: 5,
    recommendedLevel: 5,
    allowedMaterialTiers: [1, 2],
    enemies: [
      { name: 'Frost Imp', tag: 'elemental', hp: 85, attack: 13, defense: 6, xp: 22, gold: 13 },
      { name: 'Bandit Scout', tag: 'humanoid', hp: 75, attack: 15, defense: 4, xp: 20, gold: 12 },
    ],
    boss: { name: 'Prismatic Elemental', tag: 'elemental', hp: 190, attack: 24, defense: 8, xp: 82, gold: 45, boss: true }
  },
  {
    id: 3,
    name: 'Cinderpeak',
    level: 10,
    recommendedLevel: 10,
    allowedMaterialTiers: [2],
    enemies: [
      { name: 'Cinder Whelp', tag: 'dragon', hp: 110, attack: 17, defense: 8, xp: 34, gold: 20 },
      { name: 'Ash Stalker', tag: 'beast', hp: 105, attack: 18, defense: 7, xp: 32, gold: 19 },
    ],
    boss: { name: 'Ashen Tyrant', tag: 'dragon', hp: 240, attack: 30, defense: 12, xp: 120, gold: 70, boss: true }
  },
  {
    id: 4,
    name: 'Ironhaven',
    level: 15,
    recommendedLevel: 15,
    allowedMaterialTiers: [2, 3],
    enemies: [
      { name: 'Steel Golem', tag: 'construct', hp: 150, attack: 21, defense: 11, xp: 48, gold: 28 },
      { name: 'Rogue Knight', tag: 'humanoid', hp: 145, attack: 22, defense: 10, xp: 46, gold: 27 },
    ],
    boss: { name: 'Iron Colossus', tag: 'construct', hp: 300, attack: 34, defense: 14, xp: 150, gold: 90, boss: true }
  },
  {
    id: 5,
    name: 'Stormreach',
    level: 22,
    recommendedLevel: 22,
    allowedMaterialTiers: [3, 4],
    enemies: [
      { name: 'Sky Raider', tag: 'humanoid', hp: 175, attack: 24, defense: 12, xp: 60, gold: 32 },
      { name: 'Storm Drake', tag: 'dragon', hp: 185, attack: 25, defense: 12, xp: 64, gold: 34 },
    ],
    boss: { name: 'Tempest Guardian', tag: 'elemental', hp: 360, attack: 40, defense: 16, xp: 210, gold: 130, boss: true }
  },
  {
    id: 6,
    name: 'Umbravale',
    level: 30,
    recommendedLevel: 30,
    allowedMaterialTiers: [4, 5],
    enemies: [
      { name: 'Shadowstalker', tag: 'undead', hp: 205, attack: 27, defense: 13, xp: 78, gold: 40 },
      { name: 'Night Wraith', tag: 'undead', hp: 215, attack: 28, defense: 14, xp: 82, gold: 42 },
    ],
    boss: { name: 'Umbra Sovereign', tag: 'undead', hp: 420, attack: 46, defense: 18, xp: 260, gold: 150, boss: true }
  },
  {
    id: 7,
    name: 'Everscourge',
    level: 40,
    recommendedLevel: 40,
    allowedMaterialTiers: [5],
    enemies: [
      { name: 'Rotfiend', tag: 'undead', hp: 235, attack: 30, defense: 15, xp: 96, gold: 48 },
      { name: 'Bone Colossus', tag: 'undead', hp: 260, attack: 32, defense: 16, xp: 110, gold: 52 },
    ],
    boss: { name: 'Eternal Devourer', tag: 'boss', hp: 520, attack: 50, defense: 20, xp: 320, gold: 200, boss: true }
  },
];

const ACTIONS = {
  HUNT: { id: 'HUNT', label: 'Hunt', baseCooldownMs: 60 * 1000 },
  CHOP: { id: 'CHOP', label: 'Chop Wood', baseCooldownMs: 120 * 1000 },
  MINE: { id: 'MINE', label: 'Mine Ore', baseCooldownMs: 120 * 1000 },
  FISH: { id: 'FISH', label: 'Fish', baseCooldownMs: 120 * 1000 },
  FIGHT: { id: 'FIGHT', label: 'Fight', baseCooldownMs: 30 * 1000 },
  AUTO_BATTLE: { id: 'AUTO_BATTLE', label: 'Auto Battle', baseCooldownMs: 30 * 1000 },
  ADVENTURE: { id: 'ADVENTURE', label: 'Adventure', baseCooldownMs: 10 * 60 * 1000 },
  WORK: { id: 'WORK', label: 'Work Job', baseCooldownMs: 60 * 60 * 1000 },
  DUNGEON: { id: 'DUNGEON', label: 'Dungeon', baseCooldownMs: 60 * 60 * 1000 },
  MINIBOSS: { id: 'MINIBOSS', label: 'Miniboss', baseCooldownMs: 2 * 60 * 60 * 1000 },
  BOSS: { id: 'BOSS', label: 'Boss', baseCooldownMs: 4 * 60 * 60 * 1000 },
};

const epicActions = [
  { id: 'hunt', cooldownId: 'HUNT', label: 'Hunt', type: 'combat', difficulty: 0.9, description: 'Fast skirmish for quick loot.' },
  { id: 'adventure', cooldownId: 'ADVENTURE', label: 'Adventure', type: 'combat', difficulty: 1.1, description: 'Longer battle with better rewards.' },
  { id: 'dungeon', cooldownId: 'DUNGEON', label: 'Dungeon', type: 'combat', difficulty: 1.35, treatAsBoss: true, noUnlock: true, description: 'Hard encounter with superior loot.' },
  { id: 'miniboss', cooldownId: 'MINIBOSS', label: 'Miniboss', type: 'combat', difficulty: 1.22, treatAsBoss: true, noUnlock: true, description: 'Zone elite with higher stakes.' },
  { id: 'boss', cooldownId: 'BOSS', label: 'Boss', type: 'combat', difficulty: 1.45, treatAsBoss: true, description: 'Zone boss unlocks next realm.' },
  { id: 'chop', cooldownId: 'CHOP', label: 'Chop Wood', type: 'gather', skill: 'foraging', sourceType: 'foraging', description: 'Chop or forage timber in the area.' },
  { id: 'mine', cooldownId: 'MINE', label: 'Mine Ore', type: 'gather', skill: 'mining', sourceType: 'mining', description: 'Mine ore nodes tied to the zone tier.' },
  { id: 'fish', cooldownId: 'FISH', label: 'Fish', type: 'gather', skill: 'fishing', sourceType: 'fishing', description: 'Cast for fish or treasures.' },
  { id: 'job', cooldownId: 'WORK', label: 'Work Job', type: 'job', description: 'Do odd jobs for gold and XP.' },
];

const skillTrees = {
  Warrior: [
    { branch: 'Offense', skills: [
      { name: 'Power Strike', cost: 1, desc: '+8% Attack', effect: p => p.modifiers.attack += 0.08 },
      { name: 'Bloodlust', cost: 1, desc: '+5% Crit', effect: p => p.modifiers.crit += 0.05 },
      { name: 'Cleave', cost: 1, desc: '+5 flat Attack', effect: p => p.flat.attack += 5 },
      { name: 'Weapon Mastery', cost: 1, desc: '+10% Crit Damage', effect: p => p.modifiers.critdmg += 0.1 },
      { name: 'Rage', cost: 1, desc: 'Gain fury for more damage', effect: p => p.modifiers.fury += 0.06 },
      { name: 'Overpower', cost: 1, desc: '+6% Attack', effect: p => p.modifiers.attack += 0.06 },
    ]},
    { branch: 'Defense', skills: [
      { name: 'Bulwark', cost: 1, desc: '+10% Defense', effect: p => p.modifiers.defense += 0.1 },
      { name: 'Second Wind', cost: 1, desc: '+8% HP', effect: p => p.modifiers.hp += 0.08 },
      { name: 'Iron Skin', cost: 1, desc: '+12 flat HP', effect: p => p.flat.hp += 12 },
      { name: 'Shield Wall', cost: 1, desc: 'Barrier reduces damage', effect: p => p.modifiers.barrier += 2 },
      { name: 'Defy Pain', cost: 1, desc: 'Small regen each turn', effect: p => p.modifiers.regen += 0.01 },
    ]},
    { branch: 'Utility', skills: [
      { name: 'Stunning Blow', cost: 1, desc: 'Small chance to double attack', effect: p => p.modifiers.doubleHit += 0.08 },
      { name: 'War Banner', cost: 1, desc: '+6% loot rarity', effect: p => p.modifiers.lootBoost += 0.06 },
      { name: 'Rally', cost: 1, desc: '+10% gold gain', effect: p => p.modifiers.goldBoost += 0.1 },
      { name: 'Battle Tactics', cost: 1, desc: '+6% Dodge chance', effect: p => p.modifiers.dodge += 0.06 },
      { name: 'Guardian Bond', cost: 1, desc: 'Better dragon synergy', effect: p => p.modifiers.dragonBond += 0.08 },
    ]}
  ],
  Mage: [
    { branch: 'Fire', skills: [
      { name: 'Flame Tongue', cost: 1, desc: '+10 Elemental Damage', effect: p => p.flat.elemental += 10 },
      { name: 'Burning Focus', cost: 1, desc: '+10% Attack', effect: p => p.modifiers.attack += 0.1 },
      { name: 'Ignite', cost: 1, desc: 'Bleed the foe', effect: p => p.modifiers.bleed += 0.03 },
      { name: 'Wildfire', cost: 1, desc: '+8% Attack', effect: p => p.modifiers.attack += 0.08 },
      { name: 'Pyroclasm', cost: 1, desc: '+15% Crit Damage', effect: p => p.modifiers.critdmg += 0.15 },
    ]},
    { branch: 'Ice', skills: [
      { name: 'Frost Armor', cost: 1, desc: '+6% Defense', effect: p => p.modifiers.defense += 0.06 },
      { name: 'Chilling Precision', cost: 1, desc: '+6% Crit', effect: p => p.modifiers.crit += 0.06 },
      { name: 'Permafrost', cost: 1, desc: '+10 flat HP', effect: p => p.flat.hp += 10 },
      { name: 'Glacial Wall', cost: 1, desc: 'Barrier chills foes', effect: p => p.modifiers.barrier += 2 },
      { name: 'Shatter', cost: 1, desc: '+8% Crit vs slowed', effect: p => p.modifiers.crit += 0.04 },
    ]},
    { branch: 'Arcane', skills: [
      { name: 'Arcane Surge', cost: 1, desc: 'Chance to gain extra XP', effect: p => p.modifiers.xpBoost += 0.05 },
      { name: 'Spellweave', cost: 1, desc: '+5 flat Attack', effect: p => p.flat.attack += 5 },
      { name: 'Mana Font', cost: 1, desc: '+6% HP', effect: p => p.modifiers.hp += 0.06 },
      { name: 'Runic Focus', cost: 1, desc: '+8% Attack', effect: p => p.modifiers.attack += 0.08 },
      { name: 'Arcane Mastery', cost: 1, desc: '+10% Elemental power', effect: p => p.modifiers.spellAmp += 0.1 },
    ]}
  ],
  Rogue: [
    { branch: 'Assassination', skills: [
      { name: 'Backstab', cost: 1, desc: '+12% Crit Damage', effect: p => p.modifiers.critdmg += 0.12 },
      { name: 'Vanish', cost: 1, desc: 'Chance to dodge enemy hit', effect: p => p.modifiers.dodge += 0.07 },
      { name: 'Precision', cost: 1, desc: '+6% Crit', effect: p => p.modifiers.crit += 0.06 },
      { name: 'Deadly Toxin', cost: 1, desc: '+0.03 Bleed', effect: p => p.modifiers.bleed += 0.03 },
      { name: 'Ambush', cost: 1, desc: '+8% Attack', effect: p => p.modifiers.attack += 0.08 },
    ]},
    { branch: 'Evasion', skills: [
      { name: 'Quickstep', cost: 1, desc: '+5 Speed', effect: p => p.flat.speed += 5 },
      { name: 'Shadow Dance', cost: 1, desc: '+5% Dodge', effect: p => p.modifiers.dodge += 0.05 },
      { name: 'Agile', cost: 1, desc: '+4% HP', effect: p => p.modifiers.hp += 0.04 },
      { name: 'Feint', cost: 1, desc: 'Barrier vs opening blow', effect: p => p.modifiers.barrier += 2 },
      { name: 'Shadowstride', cost: 1, desc: '+6 Speed', effect: p => p.flat.speed += 6 },
    ]},
    { branch: 'Traps', skills: [
      { name: 'Poison Trap', cost: 1, desc: 'Small damage over time to enemy', effect: p => p.modifiers.poison += 0.05 },
      { name: 'Tripwire', cost: 1, desc: '+4% Crit', effect: p => p.modifiers.crit += 0.04 },
      { name: 'Explosive Snare', cost: 1, desc: '+10 Elemental', effect: p => p.flat.elemental += 10 },
      { name: 'Tinker', cost: 1, desc: '+6% Loot chance', effect: p => p.modifiers.lootBoost += 0.06 },
      { name: 'Scavenger', cost: 1, desc: '+8% Gold', effect: p => p.modifiers.goldBoost += 0.08 },
    ]}
  ],
  Cleric: [
    { branch: 'Faith', skills: [
      { name: 'Divine Shield', cost: 1, desc: '+8% Defense', effect: p => p.modifiers.defense += 0.08 },
      { name: 'Sacred Armor', cost: 1, desc: '+12 flat HP', effect: p => p.flat.hp += 12 },
      { name: 'Guardian Halo', cost: 1, desc: 'Barrier reduces damage', effect: p => p.modifiers.barrier += 2 },
      { name: 'Censure', cost: 1, desc: '+6% Attack', effect: p => p.modifiers.attack += 0.06 },
      { name: 'Radiant Poise', cost: 1, desc: '+5% Crit', effect: p => p.modifiers.crit += 0.05 },
    ]},
    { branch: 'Restoration', skills: [
      { name: 'Benediction', cost: 1, desc: 'Heal 5 HP after fights', effect: p => p.modifiers.heal += 5 },
      { name: 'Grace', cost: 1, desc: '+6% HP', effect: p => p.modifiers.hp += 0.06 },
      { name: 'Renewal', cost: 1, desc: 'Regenerate in combat', effect: p => p.modifiers.regen += 0.012 },
      { name: 'Soothing Light', cost: 1, desc: 'Potions heal more', effect: p => p.modifiers.potionBoost += 0.15 },
      { name: 'Beacon', cost: 1, desc: '+4% XP gain', effect: p => p.modifiers.xpBoost += 0.04 },
    ]},
    { branch: 'Judgement', skills: [
      { name: 'Radiant Burst', cost: 1, desc: 'Extra damage to undead', effect: p => p.modifiers.vsUndead += 0.12 },
      { name: 'Smite', cost: 1, desc: '+8% Attack', effect: p => p.modifiers.attack += 0.08 },
      { name: 'Zeal', cost: 1, desc: '+6% Crit Damage', effect: p => p.modifiers.critdmg += 0.06 },
      { name: 'Holy Wrath', cost: 1, desc: '+6 Elemental', effect: p => p.flat.elemental += 6 },
      { name: 'Shepherd', cost: 1, desc: 'Better dragon bond', effect: p => p.modifiers.dragonBond += 0.05 },
    ]}
  ],
  Ranger: [
    { branch: 'Sharpshot', skills: [
      { name: 'Eagle Eye', cost: 1, desc: '+7% Crit', effect: p => p.modifiers.crit += 0.07 },
      { name: 'Steady Aim', cost: 1, desc: '+9% Attack', effect: p => p.modifiers.attack += 0.09 },
      { name: 'Bullseye', cost: 1, desc: '+10% Crit Damage', effect: p => p.modifiers.critdmg += 0.1 },
      { name: 'Double Nock', cost: 1, desc: 'Chance to double hit', effect: p => p.modifiers.doubleHit += 0.06 },
      { name: 'Piercing Arrow', cost: 1, desc: '+6 shred', effect: p => p.modifiers.shred = (p.modifiers.shred || 0) + 6 },
    ]},
    { branch: 'Tracking', skills: [
      { name: 'Hunter', cost: 1, desc: 'Bonus vs beasts', effect: p => p.modifiers.vsBeast += 0.12 },
      { name: 'Field Rations', cost: 1, desc: 'Potions stronger', effect: p => p.modifiers.potionBoost += 0.1 },
      { name: 'Bushcraft', cost: 1, desc: '+5 flat HP', effect: p => p.flat.hp += 5 },
      { name: 'Trailblazer', cost: 1, desc: '+6 speed', effect: p => p.flat.speed += 6 },
      { name: 'Falconry', cost: 1, desc: 'Eggs hatch faster', effect: p => p.modifiers.eggBoost += 0.05 },
    ]},
    { branch: 'Agility', skills: [
      { name: 'Windrunner', cost: 1, desc: '+6 Speed', effect: p => p.flat.speed += 6 },
      { name: 'Rolling Shot', cost: 1, desc: '+6% Dodge', effect: p => p.modifiers.dodge += 0.06 },
      { name: 'Quick Draw', cost: 1, desc: '+6% Attack', effect: p => p.modifiers.attack += 0.06 },
      { name: 'Volley', cost: 1, desc: 'Double hit chance', effect: p => p.modifiers.doubleHit += 0.05 },
      { name: 'Swift Feet', cost: 1, desc: '+8 Speed', effect: p => p.flat.speed += 8 },
    ]}
  ],
  Paladin: [
    { branch: 'Valor', skills: [
      { name: 'Hammer of Light', cost: 1, desc: '+8% Attack', effect: p => p.modifiers.attack += 0.08 },
      { name: 'Crusade', cost: 1, desc: '+5% Crit', effect: p => p.modifiers.crit += 0.05 },
      { name: 'Justice', cost: 1, desc: '+6% Attack', effect: p => p.modifiers.attack += 0.06 },
      { name: 'Banner of Faith', cost: 1, desc: '+5% Loot', effect: p => p.modifiers.lootBoost += 0.05 },
      { name: 'Smite Evil', cost: 1, desc: '+6% Crit Damage', effect: p => p.modifiers.critdmg += 0.06 },
    ]},
    { branch: 'Fortitude', skills: [
      { name: 'Aegis', cost: 1, desc: '+10% HP', effect: p => p.modifiers.hp += 0.1 },
      { name: 'Faithful', cost: 1, desc: 'Reduced boss damage', effect: p => p.modifiers.bossResist += 0.08 },
      { name: 'Tempered Armor', cost: 1, desc: '+12 flat HP', effect: p => p.flat.hp += 12 },
      { name: 'Sacred Bulwark', cost: 1, desc: 'Barrier reduces damage', effect: p => p.modifiers.barrier += 2 },
      { name: 'Oathbound', cost: 1, desc: 'Regen in fights', effect: p => p.modifiers.regen += 0.01 },
    ]},
    { branch: 'Devotion', skills: [
      { name: 'Sanctuary', cost: 1, desc: 'Heals after boss fights', effect: p => p.modifiers.healAfterBoss += 10 },
      { name: 'Holy Guidance', cost: 1, desc: '+4% XP gain', effect: p => p.modifiers.xpBoost += 0.04 },
      { name: 'Vow of Charity', cost: 1, desc: '+8% Gold', effect: p => p.modifiers.goldBoost += 0.08 },
      { name: 'Blessed Edge', cost: 1, desc: '+8 Elemental', effect: p => p.flat.elemental += 8 },
      { name: 'Dragon Friend', cost: 1, desc: 'Dragons boost you more', effect: p => p.modifiers.dragonBond += 0.08 },
    ]}
  ],
  Warlock: [
    { branch: 'Dark Arts', skills: [
      { name: 'Soul Leech', cost: 1, desc: 'Lifesteal 5%', effect: p => p.modifiers.lifesteal += 0.05 },
      { name: 'Hex', cost: 1, desc: 'Reduce enemy defense slightly', effect: p => p.modifiers.shred += 2 },
      { name: 'Blood Pact', cost: 1, desc: '+8% Attack', effect: p => p.modifiers.attack += 0.08 },
      { name: 'Pain Mirror', cost: 1, desc: 'Thorns reflect damage', effect: p => p.modifiers.thorns += 0.08 },
      { name: 'Siphon Strength', cost: 1, desc: '+6 flat Attack', effect: p => p.flat.attack += 6 },
    ]},
    { branch: 'Void', skills: [
      { name: 'Void Knowledge', cost: 1, desc: '+12% Crit Damage', effect: p => p.modifiers.critdmg += 0.12 },
      { name: 'Umbral Edge', cost: 1, desc: '+5% Crit', effect: p => p.modifiers.crit += 0.05 },
      { name: 'Shadow Surge', cost: 1, desc: '+6% Attack', effect: p => p.modifiers.attack += 0.06 },
      { name: 'Astral Form', cost: 1, desc: 'Dodge incoming hits', effect: p => p.modifiers.dodge += 0.05 },
      { name: 'Void Feast', cost: 1, desc: 'Regen from darkness', effect: p => p.modifiers.regen += 0.012 },
    ]},
    { branch: 'Pact', skills: [
      { name: 'Imp Companion', cost: 1, desc: 'Small bonus to loot chance', effect: p => p.modifiers.lootBoost += 0.05 },
      { name: 'Demonic Bargain', cost: 1, desc: '+10% Gold', effect: p => p.modifiers.goldBoost += 0.1 },
      { name: 'Soul Furnace', cost: 1, desc: '+10 Elemental', effect: p => p.flat.elemental += 10 },
      { name: 'Fel Armor', cost: 1, desc: '+6% HP', effect: p => p.modifiers.hp += 0.06 },
      { name: 'Egg Hoarder', cost: 1, desc: 'Better egg drops', effect: p => p.modifiers.eggBoost += 0.08 },
    ]}
  ]
};

const extraSkillTemplates = [
  { name: 'Edge', desc: '+4% Attack and +5 flat Attack', effect: p => { p.modifiers.attack += 0.04; p.flat.attack += 5; } },
  { name: 'Bulwark', desc: '+4% Defense and +3% HP', effect: p => { p.modifiers.defense += 0.04; p.modifiers.hp += 0.03; } },
  { name: 'Finesse', desc: '+4% Crit and +4% Crit Damage', effect: p => { p.modifiers.crit += 0.04; p.modifiers.critdmg += 0.04; } },
  { name: 'Momentum', desc: '+5 Speed and 1% Dodge', effect: p => { p.flat.speed += 5; p.modifiers.dodge += 0.01; } },
  { name: 'Preparation', desc: '+4% Loot and +4% Gold gain', effect: p => { p.modifiers.lootBoost += 0.04; p.modifiers.goldBoost += 0.04; } },
  { name: 'Battle Wisdom', desc: '+5 flat HP and +0.5% XP gain', effect: p => { p.flat.hp += 5; p.modifiers.xpBoost += 0.005; } },
  { name: 'Resolve', desc: '+1 Barrier and +0.8% Regen', effect: p => { p.modifiers.barrier += 1; p.modifiers.regen += 0.008; } },
  { name: 'Precision', desc: '+0.5% Double Hit and +0.5% Dodge', effect: p => { p.modifiers.doubleHit += 0.005; p.modifiers.dodge += 0.005; } },
  { name: 'Veteran', desc: '+25 flat HP and +3 flat Attack', effect: p => { p.flat.hp += 25; p.flat.attack += 3; } },
  { name: 'Focus', desc: '+2% Spell/Elemental power and +2% Fury/Bleed', effect: p => { p.modifiers.spellAmp += 0.02; p.modifiers.fury += 0.02; p.modifiers.bleed += 0.02; } },
];

function enrichSkillTrees() {
  Object.values(skillTrees).forEach(branches => {
    branches.forEach(branch => {
      extraSkillTemplates.forEach((tpl, idx) => {
        branch.skills.push({
          name: `${branch.branch} ${tpl.name} ${idx + 1}`,
          cost: 1,
          desc: tpl.desc,
          effect: tpl.effect,
        });
      });
    });
  });
}

enrichSkillTrees();

const state = {
  player: null,
  inventory: [],
  eggs: [],
  activeDragon: null,
  currentZone: 0,
  unlockedZones: 1,
  currentEnemy: null,
  log: [],
  shop: [],
  filters: { slot: 'all', rarity: 'all', type: 'all' },
  prestige: 0,
  lifeSkills: {},
  materials: {},
  materialHistory: {},
  recipeUnlocks: {},
  foodBuff: null,
  selectedLifeSkill: 'mining',
  socketSelection: null,
  actionCooldowns: {},
};

function createPlayer(cls) {
  const base = classData[cls];
  return {
    name: 'Adventurer',
    class: cls,
    baseStats: { ...base },
    level: 1,
    xp: 0,
    xpToNext: 30,
    gold: 50,
    equipment: { weapon: null, armor: null, helmet: null, boots: null, accessory: null },
    skillPoints: 0,
    skills: {},
    modifiers: {
      attack: 0, defense: 0, hp: 0, crit: 0, critdmg: 0, doubleHit: 0, dodge: 0, poison: 0, heal: 0, vsUndead: 0, vsBeast: 0, xpBoost: 0, lootBoost: 0, bossResist: 0, healAfterBoss: 0, lifesteal: 0,
      regen: 0, thorns: 0, potionBoost: 0, goldBoost: 0, barrier: 0, eggBoost: 0, dragonBond: 0, spellAmp: 0, fury: 0, bleed: 0, shred: 0,
    },
    flat: { speed: 0, elemental: 0, hp: 0, attack: 0 },
    currentHP: base.hp,
    rage: 0,
    maxRage: 100,
    maxResource: base.mana,
    currentResource: base.mana,
  };
}

function ensureModifierDefaults(player) {
  const defaults = { attack: 0, defense: 0, hp: 0, crit: 0, critdmg: 0, doubleHit: 0, dodge: 0, poison: 0, heal: 0, vsUndead: 0, vsBeast: 0, xpBoost: 0, lootBoost: 0, bossResist: 0, healAfterBoss: 0, lifesteal: 0,
    regen: 0, thorns: 0, potionBoost: 0, goldBoost: 0, barrier: 0, eggBoost: 0, dragonBond: 0, spellAmp: 0, fury: 0, bleed: 0, shred: 0 };
  player.modifiers = { ...defaults, ...(player.modifiers || {}) };
  player.flat = { speed: 0, elemental: 0, hp: 0, attack: 0, ...(player.flat || {}) };
  player.maxResource = player.maxResource || player.baseStats.mana || 30;
  player.currentResource = player.currentResource || player.maxResource;
  player.maxRage = player.maxRage || 100;
  player.rage = Math.min(player.maxRage, Math.max(0, player.rage || 0));
}

function defaultLifeSkills() {
  const skills = {};
  Object.keys(lifeSkillDefs).forEach(k => { skills[k] = { level: 1, currentXP: 0, xpToNext: 50 }; });
  return skills;
}

function ensureLifeSkills() {
  if (!state.lifeSkills || !Object.keys(state.lifeSkills).length) {
    state.lifeSkills = defaultLifeSkills();
  }
  Object.keys(lifeSkillDefs).forEach(k => {
    if (!state.lifeSkills[k]) state.lifeSkills[k] = { level: 1, currentXP: 0, xpToNext: 50 };
  });
  if (!state.materialHistory) state.materialHistory = {};
  materialTemplates.forEach(mat => { if (!state.materials[mat]) state.materials[mat] = 0; });
  materialTemplates.forEach(mat => { if ((state.materials[mat] || 0) > 0) state.materialHistory[mat] = true; });
  ensureActionCooldowns();
  if (!state.recipeUnlocks) state.recipeUnlocks = {};
  Object.values(recipeBook).flat().forEach(rec => {
    if (rec.autoUnlock && !state.recipeUnlocks[rec.id]) state.recipeUnlocks[rec.id] = true;
  });
}

function hasSeenMaterial(id) {
  return (state.materials[id] || 0) > 0 || !!(state.materialHistory && state.materialHistory[id]);
}

function knownMaterials() {
  return materialCatalog.filter(m => hasSeenMaterial(m.id));
}

function formatCooldown(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function defaultActionCooldowns() {
  const defaults = {};
  Object.keys(ACTIONS).forEach(key => { defaults[key] = { lastUsedAt: 0 }; });
  return defaults;
}

function ensureActionCooldowns() {
  if (!state.actionCooldowns) state.actionCooldowns = {};
  const normalized = {};
  Object.entries(state.actionCooldowns).forEach(([key, value]) => {
    const upKey = key.toUpperCase();
    if (typeof value === 'number') {
      const duration = getActionCooldownMs(upKey);
      normalized[upKey] = { lastUsedAt: Math.max(0, value - duration) };
    } else {
      normalized[upKey] = { lastUsedAt: value.lastUsedAt || 0 };
    }
  });
  state.actionCooldowns = { ...defaultActionCooldowns(), ...normalized };
}

function getActionCooldownMs(actionId) {
  const key = actionId.toUpperCase();
  const config = ACTIONS[key];
  if (!config) return 0;
  const modifier = 1; // Placeholder for future perk-driven reductions
  return Math.floor(config.baseCooldownMs * modifier);
}

function getActionCooldownState(id) {
  const remaining = getActionRemainingMs(id);
  return { ready: remaining <= 0, remaining: Math.max(0, remaining) };
}

function getActionRemainingMs(actionId) {
  const key = actionId.toUpperCase();
  const config = ACTIONS[key];
  const tracker = state.actionCooldowns[key] || { lastUsedAt: 0 };
  if (!config) return 0;
  const readyAt = tracker.lastUsedAt + getActionCooldownMs(key);
  return Math.max(0, readyAt - Date.now());
}

function isActionReady(actionId) {
  return getActionRemainingMs(actionId) <= 0;
}

function startActionCooldown(id) {
  const key = id.toUpperCase();
  if (!ACTIONS[key]) return;
  state.actionCooldowns[key] = { lastUsedAt: Date.now() };
  saveGame();
}

const playerHpBar = document.getElementById('hp-bar');
const playerHpText = document.getElementById('hp-text');
const enemyHpBar = document.getElementById('enemy-hp');
const enemyHpText = document.getElementById('enemy-hp-text');
const playerRageBar = document.getElementById('player-rage-bar');
const playerRageText = document.getElementById('player-rage-text');
const rageContainer = document.getElementById('rage-container');

function usesRage(player = state.player) {
  return player && classResources[player.class] === 'Rage';
}

function updateHealthBar(entity, barElement, textElement, maxOverride) {
  if (!entity || !barElement) return;
  const max = maxOverride || entity.maxHP || 1;
  const percent = Math.max(0, Math.min(100, (entity.currentHP / max) * 100));
  barElement.style.width = `${percent}%`;
  if (textElement) {
    textElement.textContent = `${Math.max(0, Math.floor(entity.currentHP))} / ${Math.max(1, Math.floor(max))}`;
  }
}

function updateRageBar(player) {
  if (!player || !playerRageBar) return;
  const percent = Math.max(0, Math.min(100, (player.rage / player.maxRage) * 100));
  playerRageBar.style.width = `${percent}%`;
  if (playerRageText) playerRageText.textContent = `${Math.floor(player.rage)} / ${player.maxRage}`;
}

function addRage(amount) {
  if (!usesRage()) return;
  state.player.rage = Math.max(0, Math.min(state.player.maxRage, state.player.rage + amount));
  updateRageBar(state.player);
}

function spendRage(amount) {
  if (!usesRage()) return true;
  if (state.player.rage < amount) return false;
  state.player.rage = Math.max(0, state.player.rage - amount);
  updateRageBar(state.player);
  return true;
}

function weightedRarity(isBoss) {
  const totalWeight = rarities.reduce((t, r) => t + (isBoss ? r.weight * 1.25 : r.weight), 0);
  let roll = Math.random() * totalWeight;
  for (const r of rarities) {
    const weight = isBoss ? r.weight * 1.25 : r.weight;
    roll -= weight;
    if (roll <= 0) return r;
  }
  return rarities[0];
}

function rollStat(stat, level, rarity) {
  const variance = stat.base + level * 0.8;
  const value = Math.round((variance + Math.random() * variance) * rarity.scale);
  return { key: stat.key, label: stat.label, value };
}

function generateItem(level, isBoss = false) {
  const rarity = weightedRarity(isBoss);
  const slot = ['weapon', 'armor', 'helmet', 'boots', 'accessory'][Math.floor(Math.random() * 5)];
  const statCount = Math.floor(Math.random() * (rarity.stats[1] - rarity.stats[0] + 1)) + rarity.stats[0];
  const stats = [];
  const pool = [...statPool];
  for (let i = 0; i < statCount; i++) {
    const pick = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    stats.push(rollStat(pick, level, rarity));
  }
  const name = `${rarity.label} ${slot.charAt(0).toUpperCase() + slot.slice(1)}`;
  return { id: crypto.randomUUID(), type: 'gear', name, slot, rarity: rarity.key, stats, levelReq: Math.max(1, Math.floor(level * 0.8)), power: stats.reduce((t, s) => t + s.value, 0), sockets: socketsFromRarity(rarity.key), gems: [] };
}

function rerollGear(item) {
  const level = Math.max(state.player ? state.player.level : 1, item.levelReq || 1);
  const newItem = generateItem(level, false);
  item.stats = newItem.stats;
  item.power = newItem.power;
  item.rarity = newItem.rarity;
  item.name = `${item.name.split(' ')[0] || 'Refined'} ${item.slot}`;
}

function aggregateSockets(item) {
  const bonus = { hp: 0, attack: 0, defense: 0, crit: 0, critdmg: 0, speed: 0, elemental: 0, attackPct: 0, defensePct: 0, hpPct: 0, loot: 0, lifesteal: 0 };
  (item.gems || []).forEach(g => {
    if (!g.gem || !g.gem.stat) return;
    Object.entries(g.gem.stat).forEach(([k, v]) => { bonus[k] = (bonus[k] || 0) + v; });
  });
  if (item.rune && item.rune.modifier) {
    Object.entries(item.rune.modifier).forEach(([k, v]) => { bonus[k] = (bonus[k] || 0) + v; });
  }
  return bonus;
}

function applyBonuses(baseStats, player) {
  const prestigeBonus = 1 + (state.prestige || 0) * 0.03;
  const gearStats = { hp: 0, attack: 0, defense: 0, crit: 0, critdmg: 0, speed: 0, elemental: 0 };
  const gemFlat = { attackPct: 0, defensePct: 0, hpPct: 0, loot: 0, lifesteal: 0 };
  Object.values(player.equipment).forEach(item => {
    if (!item) return;
    item.stats.forEach(s => { gearStats[s.key] = (gearStats[s.key] || 0) + s.value; });
    const socketStats = aggregateSockets(item);
    ['hp', 'attack', 'defense', 'crit', 'critdmg', 'speed', 'elemental'].forEach(k => { gearStats[k] = (gearStats[k] || 0) + (socketStats[k] || 0); });
    Object.keys(gemFlat).forEach(k => { gemFlat[k] = (gemFlat[k] || 0) + (socketStats[k] || 0); });
  });
  const dragonFactor = 1 + (player.modifiers.dragonBond || 0) + ((state.lifeSkills.dragonBonding ? state.lifeSkills.dragonBonding.level : 0) * 0.01);
  const dragonStats = state.activeDragon ? Object.fromEntries(Object.entries(state.activeDragon.bonus).map(([k, v]) => [k, Math.round(v * dragonFactor)])) : {};
  const food = state.foodBuff && state.foodBuff.battles > 0 ? state.foodBuff : null;
  const foodAtk = food && food.attack ? food.attack : 0;
  const foodHp = food && food.hp ? food.hp : 0;
  const foodCrit = food && food.crit ? food.crit : 0;
  const foodDef = food && food.defense ? food.defense : 0;
  const foodSpeed = food && food.speed ? food.speed : 0;
  const foodLoot = food && food.loot ? food.loot : 0;
  return {
    maxHP: Math.round((baseStats.hp + (gearStats.hp || 0) + (dragonStats.hp || 0) + (player.flat.hp || 0)) * (1 + player.modifiers.hp + foodHp + (gemFlat.hpPct || 0)) * prestigeBonus),
    attack: Math.round((baseStats.attack + (gearStats.attack || 0) + (dragonStats.attack || 0) + (player.flat.attack || 0)) * (1 + player.modifiers.attack + foodAtk + (gemFlat.attackPct || 0)) * prestigeBonus) + (player.flat.elemental || 0) + (dragonStats.elemental || 0),
    defense: Math.round((baseStats.defense + (gearStats.defense || 0) + (dragonStats.defense || 0)) * (1 + player.modifiers.defense + foodDef + (gemFlat.defensePct || 0)) * prestigeBonus),
    crit: (baseStats.crit + (gearStats.crit || 0) + (dragonStats.crit || 0)) * (1 + player.modifiers.crit + foodCrit) * prestigeBonus,
    critdmg: 1.5 + (gearStats.critdmg || 0) / 100 + player.modifiers.critdmg + (dragonStats.critdmg || 0),
    speed: (baseStats.speed || 0) + (gearStats.speed || 0) + (player.flat.speed || 0) + (dragonStats.speed || 0) + foodSpeed,
    elemental: (gearStats.elemental || 0) + (dragonStats.elemental || 0),
    lootBuff: foodLoot + (gemFlat.loot || 0),
    lifesteal: gemFlat.lifesteal || 0,
  };
}

function pickEnemy(zone, boss = false) {
  const choice = boss ? zone.boss : zone.enemies[Math.floor(Math.random() * zone.enemies.length)];
  const scaledHP = Math.round(choice.hp * ENEMY_SCALE);
  const scaledAttack = Math.round(choice.attack * ENEMY_SCALE * ENEMY_ATTACK_MOD);
  return { ...choice, hp: scaledHP, attack: scaledAttack, currentHP: scaledHP };
}

function performEpicAction(actionId) {
  const action = epicActions.find(a => a.id === actionId);
  const wrap = document.getElementById('epic-actions');
  if (!action) return;
  const cd = getActionCooldownState(action.cooldownId || actionId);
  if (!cd.ready) { logMessage('Action is on cooldown.'); return; }
  if (state.currentZone >= state.unlockedZones) { logMessage('Unlock the zone boss first.'); return; }
  const zone = zones[state.currentZone];
  if (!zone) { logMessage('Choose a zone to act in.'); return; }
  if (action.type === 'combat') {
    const opts = { mode: actionId, difficulty: action.difficulty, treatAsBoss: action.treatAsBoss, noUnlock: action.noUnlock, skipFightCooldown: true };
    startActionCooldown(action.cooldownId || actionId);
    startFight(actionId === 'boss', false, opts);
  } else if (action.type === 'gather') {
    const lifeSet = lifeActions[action.skill] || [];
    if (!lifeSet.length) { logMessage('No gathering action available.'); return; }
    const base = { ...lifeSet[0], sourceType: action.sourceType || lifeSet[0].sourceType };
    startActionCooldown(action.cooldownId || actionId);
    performLifeAction(action.skill, base);
  } else if (action.type === 'job') {
    startActionCooldown(action.cooldownId || actionId);
    const goldEarned = Math.round(30 + state.player.level * 4);
    const xpEarned = Math.round(state.player.xpToNext * 0.15);
    state.player.gold += goldEarned;
    grantPlayerXP(xpEarned);
    logMessage(`You complete a job for ${goldEarned} gold and ${xpEarned} XP.`);
    updateAll();
  }
  if (wrap) renderEpicActionButtons();
}

function logMessage(msg, css) {
  state.log.unshift({ msg, css });
  const logBox = document.getElementById('combat-log');
  logBox.innerHTML = state.log
    .slice(0, 12)
    .map(line => `<div class="${line.css || ''}">${line.msg}</div>`)
    .join('');
}

const CombatSystem = {
  active: false,
  battle: null,
  usesRageResource() {
    return usesRage(this.battle?.player);
  },
  startBattle({ player, enemy, isBoss, zone, zoneMod, auto }) {
    ensureModifierDefaults(player);
    this.active = true;
    this.battle = {
      player,
      enemy,
      isBoss,
      zone,
      zoneMod,
      auto,
      turn: 'player',
      playerStatuses: [],
      enemyStatuses: [],
      skillCooldowns: {},
    };
    this.turn = 'player';
    const rageMode = this.usesRageResource();
    player.currentResource = rageMode ? 0 : player.maxResource;
    player.rage = rageMode ? 0 : player.rage;
    logMessage(`Battle start against ${enemy.name}${isBoss ? ' (Boss)' : ''}.`);
    const playerSpeed = this.computePlayerStats().speed || 10;
    const enemySpeed = this.computeEnemyStats().speed || 10;
    if (enemySpeed > playerSpeed + 15) {
      this.turn = 'enemy';
      logMessage(`${enemy.name} seizes the initiative!`, 'status');
    }
    updateBars();
    this.renderSkillButtons();
    this.updateStatusUI();
    renderTopbar();
    this.updateActionButtons();
    if (auto) {
      this.resolveAutoBattle();
    } else {
      this.beginTurn(this.turn || 'player');
    }
  },
  beginTurn(side) {
    if (!this.active) return;
    const skip = this.applyStartOfTurn(side);
    updateBars();
    this.updateStatusUI();
    if (this.checkVictory()) return;
    if (skip) {
      logMessage(`${side === 'player' ? 'You' : this.battle.enemy.name} are unable to act this turn.`, 'status');
      if (side === 'player') {
        return this.enemyTurn();
      }
      this.turn = 'player';
      return this.beginTurn('player');
    }
    if (side === 'player') {
      this.turn = 'player';
      this.updateActionButtons();
      if (this.battle.auto) this.autoPlay();
    } else {
      this.enemyTurn();
    }
  },
  applyStartOfTurn(target) {
    const statuses = target === 'player' ? this.battle.playerStatuses : this.battle.enemyStatuses;
    const entity = target === 'player' ? this.battle.player : this.battle.enemy;
    const stats = target === 'player' ? this.computePlayerStats() : this.computeEnemyStats();
    let skip = false;
    if (this.battle.zoneMod?.dot) {
      entity.currentHP -= this.battle.zoneMod.dot;
      logMessage(`${target === 'player' ? 'The zone harms you' : 'The zone harms the foe'} for ${this.battle.zoneMod.dot}.`, 'status');
    }
    if (target === 'player') {
      if (this.usesRageResource()) {
        addRage(5);
      } else {
        entity.currentResource = Math.min(entity.maxResource, entity.currentResource + 3);
      }
    }
    statuses.forEach(s => {
      if (s.type === 'dot' && s.tick) {
        entity.currentHP -= s.tick;
        logMessage(`${target === 'player' ? 'You' : entity.name} suffer ${s.tick} from ${s.label || s.key}.`, 'status');
      }
      if (s.healTick) {
        entity.currentHP = Math.min(stats.maxHP, entity.currentHP + s.healTick);
        logMessage(`${target === 'player' ? 'You' : entity.name} recover ${s.healTick} HP.`, 'status');
      }
      if (s.type === 'cc') skip = true;
      s.duration -= 1;
    });
    this.cleanStatuses();
    return skip;
  },
  cleanStatuses() {
    this.battle.playerStatuses = this.battle.playerStatuses.filter(s => s.duration > 0);
    this.battle.enemyStatuses = this.battle.enemyStatuses.filter(s => s.duration > 0);
  },
  autoPlay() {
    if (!this.active || this.turn !== 'player') return;
    const skill = activeSkills[this.battle.player.class][0];
    if (this.canUseSkill(skill)) {
      this.playerAction('skill', skill.id);
    } else {
      this.playerAction('attack');
    }
  },
  handlePlayerAction(type, skillId) {
    const playerStats = this.computePlayerStats();
    const enemyStats = this.computeEnemyStats();
    if (type === 'skill') {
      const skill = activeSkills[this.battle.player.class].find(s => s.id === skillId);
      if (!this.canUseSkill(skill)) return false;
      if (this.usesRageResource()) {
        if (!spendRage(skill.cost)) return false;
      } else {
        this.battle.player.currentResource -= skill.cost;
      }
      this.battle.skillCooldowns[skill.id] = skill.cooldown;
      skill.action({ player: this.battle.player, enemy: this.battle.enemy, playerStats, enemyStats, isBoss: this.battle.isBoss });
      if (this.usesRageResource()) addRage(4);
    } else {
      const dmg = this.calculateDamage(playerStats, enemyStats, { variance: 0.1, bonus: 1 });
      this.battle.enemy.currentHP -= dmg.amount;
      logMessage(`You strike for ${dmg.amount}${dmg.crit ? ' (CRIT)' : ''}.`, dmg.crit ? 'crit' : undefined);
      if (Math.random() < this.battle.player.modifiers.doubleHit) {
        this.battle.enemy.currentHP -= Math.round(dmg.amount * 0.5);
        logMessage('A quick follow-up hits again!');
      }
      if (this.battle.player.modifiers.bleed > 0) {
        const tick = Math.round(playerStats.attack * this.battle.player.modifiers.bleed);
        this.applyStatus('enemy', { key: 'bleed', duration: 2, tick, type: 'dot', label: 'Bleed' });
      }
      if (this.usesRageResource()) addRage(Math.max(3, Math.round(dmg.amount * 0.1)));
    }
    updateBars();
    return true;
  },
  playerAction(type, skillId) {
    if (!this.active || this.turn !== 'player') return;
    const acted = this.handlePlayerAction(type, skillId);
    if (!acted) return;
    if (this.checkVictory()) return;
    this.endPlayerTurn();
  },
  endPlayerTurn() {
    this.tickCooldowns();
    this.turn = 'enemy';
    this.enemyTurn();
  },
  enemyTurn() {
    if (!this.active) return;
    const enemyStats = this.computeEnemyStats();
    const playerStats = this.computePlayerStats();
    const skip = this.applyStartOfTurn('enemy');
    updateBars();
    if (this.checkVictory()) return;
    if (!skip) {
      const player = this.battle.player;
      const dodgeRoll = Math.random();
      const dodgeChance = player.modifiers.dodge + (this.hasStatus('player', 'evasion') ? 0.08 : 0);
      if (dodgeRoll < dodgeChance) {
        logMessage(`${this.battle.enemy.name} misses as you dodge!`, 'status');
      } else {
        const dmg = this.calculateDamage(enemyStats, playerStats, { variance: 0.12, bonus: 1 });
        let taken = dmg.amount;
        const barrier = this.totalBarrier('player');
        if (barrier > 0) taken = Math.max(1, taken - barrier);
        if (this.battle.isBoss && player.modifiers.bossResist) taken = Math.round(taken * (1 - player.modifiers.bossResist));
        player.currentHP -= taken;
        logMessage(`${this.battle.enemy.name} hits you for ${taken}${dmg.crit ? ' (CRIT)' : ''}.`);
        if (this.usesRageResource()) addRage(Math.max(2, Math.round(taken * 0.08)));
        if (player.modifiers.thorns) {
          const reflect = Math.max(1, Math.round(taken * player.modifiers.thorns));
          this.battle.enemy.currentHP -= reflect;
          logMessage(`Thorns deal ${reflect} back!`, 'status');
        }
        if (player.modifiers.lifesteal) {
          const heal = Math.round(taken * player.modifiers.lifesteal);
          player.currentHP = Math.min(player.currentHP + heal, playerStats.maxHP);
          logMessage(`You steal ${heal} life.`, 'status');
        }
      }
    }
    if (this.battle.player.modifiers.regen) {
      const heal = Math.max(1, Math.round(playerStats.maxHP * this.battle.player.modifiers.regen));
      this.battle.player.currentHP = Math.min(playerStats.maxHP, this.battle.player.currentHP + heal);
      logMessage(`You regenerate ${heal} HP.`, 'status');
    }
    this.turn = 'player';
    this.updateStatusUI();
    this.updateActionButtons();
    if (this.checkVictory()) return;
    if (this.battle.auto) this.autoPlay();
  },
  resolveAutoBattle() {
    let guard = 0;
    while (this.active && guard < 200) {
      const playerSkip = this.applyStartOfTurn('player');
      updateBars();
      this.updateStatusUI();
      if (this.checkVictory()) break;
      if (!playerSkip) {
        const skill = activeSkills[this.battle.player.class][0];
        if (this.canUseSkill(skill)) {
          this.handlePlayerAction('skill', skill.id);
        } else {
          this.handlePlayerAction('attack');
        }
        if (this.checkVictory()) break;
      }
      this.tickCooldowns();
      const enemySkip = this.applyStartOfTurn('enemy');
      updateBars();
      this.updateStatusUI();
      if (this.checkVictory()) break;
      if (!enemySkip) {
        const enemyStats = this.computeEnemyStats();
        const playerStats = this.computePlayerStats();
        const player = this.battle.player;
        const dodgeRoll = Math.random();
        const dodgeChance = player.modifiers.dodge + (this.hasStatus('player', 'evasion') ? 0.08 : 0);
        if (dodgeRoll < dodgeChance) {
          logMessage(`${this.battle.enemy.name} misses as you dodge!`, 'status');
        } else {
          const dmg = this.calculateDamage(enemyStats, playerStats, { variance: 0.12, bonus: 1 });
          let taken = dmg.amount;
          const barrier = this.totalBarrier('player');
          if (barrier > 0) taken = Math.max(1, taken - barrier);
          if (this.battle.isBoss && player.modifiers.bossResist) taken = Math.round(taken * (1 - player.modifiers.bossResist));
          player.currentHP -= taken;
          logMessage(`${this.battle.enemy.name} hits you for ${taken}${dmg.crit ? ' (CRIT)' : ''}.`);
          if (this.usesRageResource()) addRage(Math.max(2, Math.round(taken * 0.08)));
          if (player.modifiers.thorns) {
            const reflect = Math.max(1, Math.round(taken * player.modifiers.thorns));
            this.battle.enemy.currentHP -= reflect;
            logMessage(`Thorns deal ${reflect} back!`, 'status');
          }
          if (player.modifiers.lifesteal) {
            const heal = Math.round(taken * player.modifiers.lifesteal);
            player.currentHP = Math.min(playerStats.maxHP, player.currentHP + heal);
            logMessage(`You steal ${heal} life.`, 'status');
          }
        }
      }
      updateBars();
      if (this.checkVictory()) break;
      guard++;
    }
    this.turn = 'player';
    this.updateActionButtons();
  },
  tickCooldowns() {
    Object.keys(this.battle.skillCooldowns).forEach(id => {
      if (this.battle.skillCooldowns[id] > 0) this.battle.skillCooldowns[id] -= 1;
    });
  },
  hasStatus(target, key) {
    const list = target === 'player' ? this.battle.playerStatuses : this.battle.enemyStatuses;
    return list.some(s => s.key === key);
  },
  totalBarrier(target) {
    const list = target === 'player' ? this.battle.playerStatuses : this.battle.enemyStatuses;
    return list.reduce((t, s) => t + (s.barrier || 0), 0);
  },
  computePlayerStats() {
    const stats = applyBonuses(this.battle.player.baseStats, this.battle.player);
    if (this.battle.zoneMod && this.battle.zoneMod.playerCritDown) stats.crit = Math.max(0, stats.crit - this.battle.zoneMod.playerCritDown);
    this.battle.playerStatuses.forEach(s => {
      if (s.attack) stats.attack *= 1 + s.attack;
      if (s.defense) stats.defense *= 1 + s.defense;
      if (s.crit) stats.crit += s.crit;
      if (s.critdmg) stats.critdmg *= 1 + s.critdmg;
    });
    return stats;
  },
  computeEnemyStats() {
    const enemy = this.battle.enemy;
    const base = {
      attack: enemy.attack,
      defense: enemy.defense,
      maxHP: enemy.hp,
      crit: 5,
      critdmg: 1.5,
      speed: enemy.speed || 10,
    };
    if (this.battle.zoneMod?.enemySpeed) base.speed += this.battle.zoneMod.enemySpeed;
    if (this.battle.zoneMod?.enemyAttackMod) base.attack = Math.round(base.attack * (1 + this.battle.zoneMod.enemyAttackMod));
    this.battle.enemyStatuses.forEach(s => {
      if (s.attack) base.attack = Math.round(base.attack * (1 + s.attack));
      if (s.defense) base.defense = Math.round(base.defense * (1 + s.defense));
    });
    return base;
  },
  calculateDamage(attacker, defender, opts = {}) {
    const variance = opts.variance || 0.1;
    const bonus = opts.bonus || 1;
    let raw = attacker.attack * bonus;
    raw *= 1 + ((Math.random() * 2 - 1) * variance);
    let damage = Math.max(1, Math.round(raw - defender.defense * 0.6));
    let critChance = attacker.crit + (opts.critBonus ? opts.critBonus * 100 : 0);
    const crit = Math.random() * 100 < critChance;
    if (crit) damage = Math.round(damage * attacker.critdmg);
    if (state.activeDragon && Math.random() < 0.15) {
      const bonusDmg = Math.max(1, Math.round(attacker.attack * 0.2));
      damage += bonusDmg;
      logMessage(`${state.activeDragon.name} unleashes bonus damage (${bonusDmg}).`, 'status');
    }
    return { amount: Math.max(1, damage), crit };
  },
  applyStatus(target, effect) {
    const list = target === 'player' ? this.battle.playerStatuses : this.battle.enemyStatuses;
    list.push({ ...effect });
    this.updateStatusUI();
  },
  updateStatusUI() {
    const render = (list, el) => {
      el.innerHTML = list.map(s => `<div class="icon ${s.type}">${s.label || s.key} (${s.duration})</div>`).join('');
    };
    render(this.battle?.playerStatuses || [], document.getElementById('player-status'));
    render(this.battle?.enemyStatuses || [], document.getElementById('enemy-status'));
  },
  renderSkillButtons() {
    const wrap = document.getElementById('skill-actions');
    wrap.innerHTML = '';
    activeSkills[this.battle.player.class].forEach(skill => {
      const btn = document.createElement('button');
      btn.className = 'skill-btn';
      btn.id = `skill-${skill.id}`;
      btn.innerHTML = `<div>${skill.name}</div><div class="small">${skill.cost} ${classResources[this.battle.player.class]}</div><div class="cooldown"></div>`;
      btn.onclick = () => this.playerAction('skill', skill.id);
      wrap.appendChild(btn);
    });
  },
  canUseSkill(skill) {
    if (!skill) return false;
    const cd = this.battle.skillCooldowns[skill.id] || 0;
    if (cd > 0) return false;
    if (this.usesRageResource()) return this.battle.player.rage >= skill.cost;
    return this.battle.player.currentResource >= skill.cost;
  },
  updateActionButtons() {
    if (!this.battle) {
      const attackBtn = document.getElementById('attack-btn');
      if (attackBtn) attackBtn.disabled = true;
      document.querySelectorAll('#skill-actions button').forEach(btn => btn.disabled = true);
      return;
    }
    const attackBtn = document.getElementById('attack-btn');
    attackBtn.disabled = !this.active || this.turn !== 'player';
    activeSkills[this.battle.player.class].forEach(skill => {
      const btn = document.getElementById(`skill-${skill.id}`);
      if (!btn) return;
      const cd = this.battle.skillCooldowns[skill.id] || 0;
      const canCast = this.canUseSkill(skill) && this.turn === 'player';
      btn.classList.toggle('disabled', !canCast);
      btn.querySelector('.cooldown').textContent = cd > 0 ? `CD ${cd}` : '';
      btn.disabled = !canCast;
    });
  },
  checkVictory() {
    if (this.battle.enemy.currentHP <= 0) {
      logMessage('Enemy defeated!');
      this.finish(true);
      return true;
    }
    if (this.battle.player.currentHP <= 0) {
      logMessage('You have been defeated.');
      this.finish(false);
      return true;
    }
    updateBars();
    return false;
  },
  finish(victory) {
    this.active = false;
    finishCombat({ victory, boss: this.battle.isBoss });
    this.battle = null;
    this.updateActionButtons();
    this.updateStatusUI();
  },
};

function startFight(boss = false, auto = false, opts = {}) {
  if (CombatSystem.active) { logMessage('Finish the current fight first.'); return; }
  if (!opts.skipFightCooldown) {
    const fightCd = getActionCooldownState('FIGHT');
    if (!fightCd.ready) { logMessage(`Fight is on cooldown (${formatCooldown(fightCd.remaining)}).`); return; }
    startActionCooldown('FIGHT');
  }
  const zone = zones[state.currentZone];
  const bossLevelLock = zone.level + 2;
  let bossFight = boss || opts.mode === 'boss' || opts.treatAsBoss;
  if (bossFight && state.player.level < bossLevelLock) {
    logMessage(`Boss locked until level ${bossLevelLock}. Keep leveling!`);
    return;
  }
  if (!bossFight && !opts.mode) {
    if (state.player.level >= bossLevelLock && Math.random() < 0.2) {
      bossFight = true;
      logMessage('A roaming boss challenges you!');
    }
    if (bossFight && Math.random() < 0.35) {
      bossFight = false;
      logMessage('No boss this time—regular foes appear.');
    }
  }
  state.currentEnemy = pickEnemy(zone, bossFight);
  const diff = opts.difficulty || 1;
  state.currentEnemy.hp = Math.round(state.currentEnemy.hp * diff);
  state.currentEnemy.currentHP = state.currentEnemy.hp;
  state.currentEnemy.attack = Math.round(state.currentEnemy.attack * diff);
  state.currentEnemy.defense = Math.round(state.currentEnemy.defense * (0.9 + diff * 0.1));
  state.currentEnemy.gold = Math.round(state.currentEnemy.gold * (1 + (diff - 1) * 0.9));
  state.currentEnemy.xp = Math.round(state.currentEnemy.xp * (1 + (diff - 1)));
  state.currentEnemy.noUnlock = !!opts.noUnlock;
  document.getElementById('enemy-display').textContent = `${state.currentEnemy.name} (Lv ${zone.level}${bossFight ? ' Boss' : ''})`;
  const zoneMod = zoneModifiers[zone.name] || null;
  document.getElementById('battle-info').textContent = zoneMod ? zoneMod.desc : '';
  CombatSystem.startBattle({
    player: state.player,
    enemy: state.currentEnemy,
    isBoss: bossFight,
    zone,
    zoneMod,
    auto,
  });
}

function autoBattle(boss = false) {
  const cdState = getActionCooldownState('AUTO_BATTLE');
  if (!cdState.ready) { logMessage(`Auto battle ready in ${formatCooldown(cdState.remaining)}.`); return; }
  startActionCooldown('AUTO_BATTLE');
  const count = Math.max(1, Math.min(10, parseInt(document.getElementById('auto-count').value) || 1));
  state.autoMode = { remaining: count, boss };
  startFight(boss, true, { skipFightCooldown: true });
}

function finishCombat(result, bossFlag) {
  const payload = typeof result === 'object' ? result : { victory: result, boss: bossFlag };
  const victory = payload.victory;
  const boss = payload.boss;
  const player = state.player;
  const zone = zones[state.currentZone];
  if (victory) {
    const xpBoost = 1 + (player.modifiers.xpBoost || 0);
    const xpGain = Math.max(1, Math.round(state.currentEnemy.xp * (1 / 3) * 1.25 * 1.15 * xpBoost));
    const goldGain = Math.round(state.currentEnemy.gold * 1.18 * (1 + (player.modifiers.goldBoost || 0)));
    player.xp += xpGain;
    player.gold += goldGain;
    logMessage(`Victory! +${xpGain} XP, +${goldGain} gold.`);
    gainLifeSkillXP('hunting', 6);
    if (player.modifiers.heal) {
      player.currentHP += player.modifiers.heal;
      logMessage(`You recover ${player.modifiers.heal} HP after battle.`);
    }
    if (boss && player.modifiers.healAfterBoss) {
      player.currentHP += player.modifiers.healAfterBoss;
    }
    dropLoot(boss);
    hatchProgress();
    randomEvent();
    if (boss && !state.currentEnemy?.noUnlock && state.currentZone + 1 < zones.length) {
      state.unlockedZones = Math.max(state.unlockedZones, state.currentZone + 2);
    }
  } else {
    logMessage('You died... returning to town.');
    player.gold = Math.max(0, Math.floor(player.gold * 0.9));
  }
  levelCheck();
  player.currentHP = Math.min(applyBonuses(player.baseStats, player).maxHP, player.currentHP <= 0 ? applyBonuses(player.baseStats, player).maxHP : player.currentHP);
  if (usesRage(player)) {
    player.rage = Math.max(0, Math.min(player.maxRage, player.rage));
    updateRageBar(player);
  } else {
    player.currentResource = Math.min(player.currentResource + 4, player.maxResource);
  }
  if (state.foodBuff && state.foodBuff.battles > 0) {
    state.foodBuff.battles -= 1;
    if (state.foodBuff.battles <= 0) logMessage(`${state.foodBuff.source || 'Food buff'} fades.`);
  }
  updateAll();
  if (state.autoMode && state.autoMode.remaining > 1 && player.currentHP > 0) {
    state.autoMode.remaining -= 1;
    startFight(state.autoMode.boss, true, { skipFightCooldown: true });
  } else {
    state.autoMode = null;
  }
}

function levelCheck() {
  const player = state.player;
  while (player.xp >= player.xpToNext) {
    player.xp -= player.xpToNext;
    player.level++;
    player.baseStats.hp += 8;
    player.baseStats.attack += 2;
    player.baseStats.defense += 1;
    player.baseStats.crit += 0.5;
    player.xpToNext = Math.floor(player.xpToNext * 1.2);
    player.skillPoints++;
    const derived = applyBonuses(player.baseStats, player);
    player.currentHP = derived.maxHP;
    updateHealthBar(player, playerHpBar, playerHpText, derived.maxHP);
    logMessage(`Level up! You reached level ${player.level}.`);
  }
}

function grantPlayerXP(amount) {
  if (!state.player || amount <= 0) return;
  state.player.xp += amount;
  levelCheck();
}

function dropLoot(boss) {
  const derived = applyBonuses(state.player.baseStats, state.player);
  const baseLoot = boss ? 0.9 : 0.55;
  const lootChance = Math.min(0.98, baseLoot * 1.5 + (state.player.modifiers.lootBoost || 0) + (derived.lootBuff || 0));
  if (Math.random() < lootChance) {
    const item = generateItem(state.player.level, boss);
    state.inventory.push(item);
    logMessage(`Loot found: ${item.name}`);
  }
  if (Math.random() < 0.2) {
    const potion = createPotion(state.player.level);
    state.inventory.push(potion);
    logMessage('You found a healing brew.');
  }
  const zone = zones[state.currentZone];
  if (zone && Math.random() < 0.22) {
    const tier = Math.max(...(zone.allowedMaterialTiers || [1]));
    const gem = createRandomGem(Math.min(5, tier));
    state.inventory.push(gem);
    logMessage(`A socketable ${gem.name} drops.`);
  }
  const eggChance = (boss ? 0.35 : 0.15) * 0.5 * (1 + (state.player.modifiers.eggBoost || 0));
  if (Math.random() < eggChance) {
    const egg = createEgg(boss);
    state.eggs.push(egg);
    logMessage(`You obtained a ${egg.rarity} dragon egg!`);
  }
  grantCombatMaterials(boss);
}

function rollDragonBonus(rarity) {
  const ranges = {
    hp: [8, 16],
    attack: [3, 7],
    defense: [2, 6],
    crit: [1, 4],
    critdmg: [0.04, 0.1],
    elemental: [2, 6],
    speed: [1, 3],
  };
  const keys = Object.keys(ranges);
  const count = Math.min(keys.length, 3 + Math.floor(Math.random() * 3) + (rarity.key === 'legendary' ? 1 : 0));
  const picks = [];
  while (picks.length < count) {
    const k = keys[Math.floor(Math.random() * keys.length)];
    if (!picks.includes(k)) picks.push(k);
  }
  const bonus = {};
  picks.forEach(k => {
    const [min, max] = ranges[k];
    const roll = min + Math.random() * (max - min);
    const scaled = roll * rarity.scale;
    bonus[k] = k === 'critdmg' ? +(scaled.toFixed(3)) : Math.round(scaled);
  });
  return bonus;
}

function createEgg(boss) {
  const rar = weightedRarity(boss);
  const reduction = state.player ? (state.player.modifiers.eggBoost || 0) : 0;
  const bonus = rollDragonBonus(rar);
  const requirement = Math.max(1, Math.round((3 + Math.floor(Math.random() * 3)) * (1 - reduction)));
  return { id: crypto.randomUUID(), rarity: rar.key, progress: 0, requirement, hatched: false, bonus };
}

function createPotion(level) {
  const variants = [
    { name: 'Herbal Remedy', rarity: 'common', base: 20, scale: 4 },
    { name: 'Healing Brew', rarity: 'uncommon', base: 30, scale: 6 },
    { name: 'Greater Elixir', rarity: 'rare', base: 50, scale: 8 },
    { name: 'Vital Surge Draught', rarity: 'epic', base: 80, scale: 10 },
    { name: 'Sanctified Flask', rarity: 'epic', base: 95, scale: 11 },
    { name: 'Phoenix Tonic', rarity: 'legendary', base: 125, scale: 12 },
  ];
  const choice = variants[Math.floor(Math.random() * variants.length)];
  return { id: crypto.randomUUID(), type: 'potion', name: choice.name, rarity: choice.rarity, heal: choice.base + level * choice.scale, price: 15 + level * 5 + choice.scale };
}

function grantCombatMaterials(boss) {
  ensureLifeSkills();
  const huntingLevel = state.lifeSkills.hunting ? state.lifeSkills.hunting.level : 1;
  const bonusChance = 1 + huntingLevel * 0.03;
  const zone = zones[state.currentZone];
  const drops = getAvailableMaterialsForZone(zone?.id, state.player.level, m => (m.sourceType === 'enemy' || m.sourceType === 'hunting' || (boss && m.sourceType === 'boss')));
  drops.forEach(d => {
    const baseChance = d.dropRates && d.dropRates[zone?.id] ? d.dropRates[zone.id] : 0.2;
    if (Math.random() < baseChance * bonusChance) {
      const qty = 1 + Math.floor(Math.random() * Math.max(1, Math.floor(huntingLevel / 4)) + 1);
      addMaterial(d.id, qty);
      logMessage(`You recover ${d.name} x${qty} from the battle.`);
    }
  });
}

function hatchProgress() {
  state.eggs.forEach(egg => {
    if (!egg.hatched) {
      const handlerLevel = state.lifeSkills.dragonHandling ? state.lifeSkills.dragonHandling.level : 1;
      const bonus = 1 + Math.floor(handlerLevel / 3) * 0.2;
      egg.progress += bonus;
      if (egg.progress >= egg.requirement) {
        egg.hatched = true;
        egg.dragon = { name: `${egg.rarity} Dragonling`, rarity: egg.rarity, bonus: egg.bonus };
        logMessage(`${egg.dragon.name} has hatched!`);
        if (!state.activeDragon) state.activeDragon = egg.dragon;
        gainLifeSkillXP('dragonHandling', 10);
        gainLifeSkillXP('dragonBonding', 6);
      }
    }
  });
}

function randomEvent() {
  const events = [
    {
      title: 'Mysterious Traveler',
      desc: 'A cloaked traveler offers a risky bargain.',
      options: [
        { text: 'Trade HP for gold', resolve: () => { state.player.currentHP = Math.max(1, state.player.currentHP - 10); state.player.gold += 30; return 'You feel weaker but gain 30 gold.'; } },
        { text: 'Ignore', resolve: () => 'You ignore the offer.' }
      ]
    },
    {
      title: 'Hidden Treasure',
      desc: 'You spot a glimmering chest.',
      options: [
        { text: 'Open it', resolve: () => { if (Math.random() < 0.5) { const item = generateItem(state.player.level, true); state.inventory.push(item); return `You find ${item.name}!`; } return 'The chest was empty.'; } },
        { text: 'Leave it', resolve: () => 'You walk away cautiously.' }
      ]
    },
    {
      title: 'Cursed Shrine',
      desc: 'Dark energy pulses here.',
      options: [
        { text: 'Accept power', resolve: () => { state.player.modifiers.attack += 0.05; state.player.modifiers.defense -= 0.03; return 'Your attack rises but defenses falter.'; } },
        { text: 'Cleanse', resolve: () => { state.player.modifiers.hp += 0.02; return 'A gentle light blesses you.'; } }
      ]
    },
    {
      title: 'Blessed Fountain',
      desc: 'Sparkling waters restore vitality.',
      options: [
        { text: 'Drink', resolve: () => { const heal = 20; state.player.currentHP = Math.min(applyBonuses(state.player.baseStats, state.player).maxHP, state.player.currentHP + heal); return `You heal ${heal} HP.`; } },
        { text: 'Bottle it', resolve: () => { state.player.gold += 10; return 'You sell the water later for 10 gold.'; } }
      ]
    },
    {
      title: 'Lost Merchant',
      desc: 'A merchant offers wares at a discount.',
      options: [
        { text: 'Buy healing brew (15g)', resolve: () => { if (state.player.gold >= 15) { state.player.gold -= 15; state.inventory.push(createPotion(state.player.level)); return 'You purchase a healing brew.'; } return 'Not enough gold.'; } },
        { text: 'Haggle', resolve: () => { if (Math.random() < 0.5) { const gold = 20; state.player.gold += gold; return `You win the argument and gain ${gold} gold!`; } else { state.player.gold = Math.max(0, state.player.gold - 10); return 'You lose the haggle and pay 10 gold.'; } } }
      ]
    },
    {
      title: 'Ancient Rune',
      desc: 'A rune pulses with dormant power.',
      options: [
        { text: 'Touch it', resolve: () => { state.player.modifiers.attack += 0.04; state.player.modifiers.defense += 0.02; return 'Power surges through you.'; } },
        { text: 'Study', resolve: () => { state.player.skillPoints += 1; return 'You gain an extra skill point.'; } }
      ]
    },
    {
      title: 'Draconic Whisper',
      desc: 'A whisper offers insight into eggs.',
      options: [
        { text: 'Offer gold (20)', resolve: () => { if (state.player.gold >= 20) { state.player.gold -= 20; const egg = createEgg(false); state.eggs.push(egg); return 'A mysterious egg appears in your pack.'; } return 'You lack the gold.'; } },
        { text: 'Meditate', resolve: () => { state.player.modifiers.eggBoost += 0.02; return 'You feel more attuned to dragon eggs.'; } }
      ]
    },
    {
      title: 'Lost Alchemist',
      desc: 'A wandering alchemist offers potent brews.',
      options: [
        { text: 'Buy tonic (20g)', resolve: () => { if (state.player.gold >= 20) { state.player.gold -= 20; state.inventory.push(createPotion(state.player.level + 2)); return 'You purchase a strong tonic.'; } return 'Not enough gold.'; } },
        { text: 'Trade knowledge', resolve: () => { state.player.skillPoints += 1; return 'You learn a new trick (skill point gained).'; } }
      ]
    },
    {
      title: 'Forgotten Forge',
      desc: 'A broken anvil hums with power.',
      options: [
        { text: 'Reforge gear', resolve: () => { if (state.inventory.length) { const item = state.inventory[Math.floor(Math.random() * state.inventory.length)]; item.power += 5; return `${item.name} feels sturdier.`; } return 'No gear to reforge.'; } },
        { text: 'Salvage spark', resolve: () => { state.player.modifiers.attack += 0.03; return 'Your strikes feel sharper (+3% attack).'; } }
      ]
    }
  ];
  if (Math.random() < 0.043) {
    const ev = events[Math.floor(Math.random() * events.length)];
    renderEvent(ev);
  } else {
    document.getElementById('event-area').innerHTML = '';
  }
}

function renderEvent(ev) {
  const wrap = document.getElementById('event-area');
  wrap.innerHTML = `<strong>${ev.title}</strong><p>${ev.desc}</p>`;
  ev.options.forEach(opt => {
    const btn = document.createElement('button');
    btn.textContent = opt.text;
    btn.onclick = () => {
      const result = opt.resolve();
      wrap.innerHTML = `<p>${result}</p>`;
      updateAll();
    };
    wrap.appendChild(btn);
  });
}

function gainLifeSkillXP(id, amount) {
  ensureLifeSkills();
  const skill = state.lifeSkills[id];
  skill.currentXP += amount;
  let leveled = false;
  while (skill.currentXP >= skill.xpToNext) {
    skill.currentXP -= skill.xpToNext;
    skill.level += 1;
    skill.xpToNext = Math.floor(skill.xpToNext * 1.28 + 12);
    leveled = true;
  }
  if (leveled) logMessage(`${lifeSkillDefs[id].name} reached level ${skill.level}!`);
}

function addMaterial(id, qty) {
  ensureLifeSkills();
  state.materials[id] = (state.materials[id] || 0) + qty;
  if (!state.materialHistory[id]) state.materialHistory[id] = true;
}

function performLifeAction(skillId, action) {
  const skill = state.lifeSkills[skillId];
  const levelBonus = 1 + skill.level * 0.02;
  let gained = [];
  const zone = zones[state.currentZone];
  const available = getAvailableMaterialsForZone(zone?.id, state.player.level, m => (action.sourceType ? m.sourceType === action.sourceType : true));
  const rewardPool = action.rewards.filter(rew => {
    const mat = materialMap[rew.id];
    return available.some(a => a.id === rew.id) && materialAllowedInZone(mat, zone, state.player.level);
  });
  rewardPool.forEach(rew => {
    const mat = materialMap[rew.id];
    const zoneChance = mat && mat.dropRates && mat.dropRates[zone?.id] ? 1 + mat.dropRates[zone.id] * 0.5 : 1;
    if (Math.random() < rew.chance * levelBonus * zoneChance) {
      const qty = Math.max(1, Math.floor(Math.random() * (rew.max - rew.min + 1)) + rew.min);
      addMaterial(rew.id, qty);
      gained.push(`${mat ? mat.name : rew.id} x${qty}`);
    }
  });
  gainLifeSkillXP(skillId, action.xp);
  grantPlayerXP(Math.floor(state.player.xpToNext * 0.25));
  rollRecipeDiscovery(skillId);
  const msg = gained.length ? `You practice ${lifeSkillDefs[skillId].name} and gain ${gained.join(', ')}.` : `You practice ${lifeSkillDefs[skillId].name} but find nothing.`;
  logMessage(msg);
  updateAll();
}

function craftRecipe(skillId, recipe) {
  const skill = state.lifeSkills[skillId];
  const playerLevelGate = recipe.playerLevelReq || requiredPlayerLevelForTier(recipe.tier || recipe.gearTier || 1);
  if (state.player.level < playerLevelGate) { logMessage(`Requires level ${playerLevelGate} to craft.`); return; }
  if (skill.level < (recipe.skillReq || 1)) { logMessage('Skill level too low.'); return; }
  if (!state.recipeUnlocks[recipe.id]) { logMessage('Recipe not learned yet.'); return; }
  const missing = Object.entries(recipe.mats).find(([m, qty]) => (state.materials[m] || 0) < qty);
  if (missing) { logMessage(`Need more ${missing[0]}.`); return; }
  Object.entries(recipe.mats).forEach(([m, qty]) => { state.materials[m] -= qty; });
  gainLifeSkillXP(skillId, 18 + recipe.skillReq * 2);
  if (recipe.type === 'gear') {
    const quality = rollQuality(skill);
    const stats = recipe.stats.map(s => ({ ...s, value: Math.max(1, Math.round(s.value * (1 + quality.boost))) }));
    const socketBonus = getPerkBonus('blacksmithing', skill.level, 35) ? 1 : 0;
    const item = { id: crypto.randomUUID(), type: 'gear', name: `${quality.label} ${recipe.name}`, slot: recipe.slot, rarity: recipe.rarity, stats, levelReq: recipe.levelReq, power: stats.reduce((t, s) => t + s.value, 0), quality: quality.key, sockets: (recipe.sockets || 0) + socketBonus, gems: [] };
    if (!item.sockets) item.sockets = socketsFromRarity(item.rarity);
    if (quality.affix) item.affix = 'Bonus affix';
    state.inventory.push(item);
    logMessage(`You craft ${item.name}.`);
  } else if (recipe.type === 'potion') {
    const item = { id: crypto.randomUUID(), type: 'potion', name: recipe.name, rarity: recipe.rarity, heal: recipe.heal || 0, price: 25 };
    if (recipe.buff) item.buff = recipe.buff;
    state.inventory.push(item);
    logMessage(`You brew ${recipe.name}.`);
  } else if (recipe.type === 'food') {
    const perkedBuff = applyFoodPerks(recipe.buff, skill.level);
    const food = { id: crypto.randomUUID(), type: 'food', name: recipe.name, rarity: recipe.rarity, buff: perkedBuff, price: 20 };
    state.inventory.push(food);
    logMessage(`You cook ${recipe.name}.`);
  } else if (recipe.type === 'enchant') {
    renderEnchantSelection(recipe);
    return;
  } else if (recipe.type === 'rune') {
    const runeDef = runeCatalog.find(r => r.id === (recipe.output || {}).runeId) || runeCatalog.find(r => r.id === 'rune_focus');
    const runeItem = { id: crypto.randomUUID(), type: 'rune', rarity: runeDef.rarity, name: `Rune: ${runeDef.id}`, rune: runeDef };
    state.inventory.push(runeItem);
    logMessage(`You inscribe ${runeItem.name}.`);
  } else if (recipe.type === 'gem') {
    const gemDef = gemCatalog.find(g => g.id === (recipe.output || {}).gemId);
    if (gemDef) {
      const gemItem = { id: crypto.randomUUID(), type: 'gem', name: `Gem: ${gemDef.id}`, rarity: gemDef.color, gem: gemDef };
      state.inventory.push(gemItem);
      logMessage(`You cut ${gemItem.name}.`);
    }
  }
  updateAll();
}

function rollQuality(skill) {
  let roll = Math.random();
  const tiered = qualityTiers.map(q => ({ ...q }));
  const perkBonus = getPerkBonus('blacksmithing', skill.level, 20) ? 0.1 : 0;
  if (perkBonus) tiered.forEach(q => { if (['fine', 'great', 'masterwork'].includes(q.key)) q.chance += perkBonus * 0.5; });
  const total = tiered.reduce((t, q) => t + q.chance, 0);
  let current = 0;
  for (const q of tiered) {
    current += q.chance / total;
    if (roll <= current) return q;
  }
  return qualityTiers[1];
}

function socketsFromRarity(rarity) {
  switch (rarity) {
    case 'uncommon': return 1;
    case 'rare': return 1 + Math.round(Math.random());
    case 'epic': return 2;
    case 'legendary': return 3;
    default: return 0;
  }
}

function requiredPlayerLevelForTier(tier) {
  switch (tier) {
    case 1: return 1;
    case 2: return 10;
    case 3: return 20;
    case 4: return 30;
    case 5: return 40;
    default: return 1;
  }
}

function rollRecipeDiscovery(skillId) {
  const unknown = (recipeBook[skillId] || []).filter(r => !state.recipeUnlocks[r.id]);
  if (!unknown.length) return;
  const chance = 0.08 + state.lifeSkills[skillId].level * 0.002;
  if (Math.random() < chance) {
    const found = unknown[Math.floor(Math.random() * unknown.length)];
    state.recipeUnlocks[found.id] = true;
    logMessage(`You discover the recipe for ${found.name}!`);
  }
}

function applyFoodPerks(buff, level) {
  const extraBattles = getPerkBonus('cooking', level, 10) ? 1 : 0;
  const potency = getPerkBonus('cooking', level, 35) ? 1.1 : 1;
  const tuned = { ...buff };
  if (tuned.duration) tuned.duration += extraBattles;
  if (tuned.attack) tuned.attack *= potency;
  if (tuned.crit) tuned.crit *= potency;
  if (tuned.loot) tuned.loot *= potency;
  return tuned;
}

function getPerkBonus(skillId, level, threshold) {
  return level >= threshold;
}

function renderEnchantSelection(recipe) {
  const wrap = document.getElementById('life-recipes');
  const chooser = document.createElement('div');
  chooser.className = 'recipe-card';
  chooser.innerHTML = '<div class="small">Choose an item to enchant:</div>';
  state.inventory.filter(i => i.type === 'gear').forEach(item => {
    const btn = document.createElement('button');
    btn.textContent = item.name;
    btn.onclick = () => {
      if (recipe.effect === 'reroll') {
        rerollGear(item);
        logMessage(`${recipe.name} refreshes ${item.name}.`);
      } else if (recipe.effect === 'small') {
        const stat = statPool[Math.floor(Math.random() * statPool.length)];
        item.stats.push({ key: stat.key, label: stat.label, value: 3 });
        logMessage(`${recipe.name} adds a minor ${stat.label} bonus.`);
      } else if (recipe.effect === 'affix') {
        item.stats.push({ key: 'attack', label: 'Attack', value: 6 });
        logMessage(`${recipe.name} adds an offensive affix.`);
      } else if (recipe.effect === 'upgrade') {
        const next = rarities[Math.min(rarities.length - 1, rarities.findIndex(r => r.key === item.rarity) + 1)];
        item.rarity = next.key;
        item.name = `${next.label} ${item.name}`;
        logMessage(`${recipe.name} reforges ${item.name} to ${next.label}.`);
      }
      updateAll();
    };
    chooser.appendChild(btn);
  });
  wrap.appendChild(chooser);
}

function generateShop() {
  if (!state.player) return;
  ensureLifeSkills();
  state.shop = [];
  const level = state.player.level;
  const tradeLevel = state.lifeSkills.trading ? state.lifeSkills.trading.level : 1;
  const stock = 3 + Math.floor(tradeLevel / 5);
  for (let i = 0; i < stock; i++) {
    const item = generateItem(level + i, tradeLevel >= 6);
    item.price = Math.max(30, item.power * 3);
    state.shop.push(item);
  }
  for (let i = 0; i < 4; i++) {
    const potion = createPotion(level + i);
    potion.price = Math.max(potion.price, 20 + i * 5);
    state.shop.push(potion);
  }
  const egg = createEgg(false);
  egg.type = 'egg';
  egg.price = valueFromEgg(egg) * 2;
  state.shop.push(egg);
  if (tradeLevel >= 35) {
    const locked = Object.values(recipeBook).flat().filter(r => !state.recipeUnlocks[r.id]);
    if (locked.length) {
      const pick = locked[Math.floor(Math.random() * locked.length)];
      state.shop.push({ id: crypto.randomUUID(), type: 'recipe', recipeId: pick.id, name: `Recipe: ${pick.name}`, rarity: pick.rarity, price: 80 });
    }
  }
}

function renderShop() {
  const wrap = document.getElementById('shop-list');
  if (!wrap) return;
  wrap.innerHTML = '';
  if (!state.shop.length) { wrap.innerHTML = '<div class="small">Shop is empty.</div>'; return; }
  state.shop.forEach(item => {
    const card = document.createElement('div');
    card.className = `item shop-card rarity-${item.rarity || 'common'}`;
    if (item.type === 'potion') {
      card.innerHTML = `<div class="name ${item.rarity}">${item.name}</div><div class="small">Heals ${item.heal} HP</div><div class="small">${item.price} gold</div>`;
    } else if (item.type === 'egg') {
      card.innerHTML = `<div class="name ${item.rarity}">${item.rarity} Egg</div><div class="small">Hatching ${item.progress}/${item.requirement}</div><div class="small">${item.price} gold</div>`;
    } else if (item.type === 'recipe') {
      card.innerHTML = `<div class="name ${item.rarity || 'rare'}">${item.name}</div><div class="small">Unlocks crafting entry</div><div class="small">${item.price} gold</div>`;
    } else {
      card.innerHTML = `<div class="name ${item.rarity}">${item.name}</div><div class="small">Lv ${item.levelReq} • ${item.slot}</div>`;
      (item.stats || []).forEach(s => {
        const stat = document.createElement('div');
        stat.className = 'small';
        stat.textContent = `+${s.value} ${s.label}`;
        card.appendChild(stat);
      });
      const price = document.createElement('div');
      price.className = 'small';
      price.textContent = `${item.price} gold`;
      card.appendChild(price);
    }
    const btn = document.createElement('button');
    btn.textContent = 'Buy';
    btn.onclick = () => buyShopItem(item);
    card.appendChild(btn);
    wrap.appendChild(card);
  });
}

function buyShopItem(item) {
  const tradeLevel = state.lifeSkills.trading ? state.lifeSkills.trading.level : 1;
  const discount = 1 - Math.min(0.35, tradeLevel * 0.02);
  const finalPrice = Math.ceil(item.price * discount);
  if (state.player.gold < finalPrice) { logMessage('Not enough gold.'); return; }
  state.player.gold -= finalPrice;
  state.shop = state.shop.filter(i => i.id !== item.id);
  if (item.type === 'potion' || item.type === 'gear') {
    state.inventory.push(item);
  } else if (item.type === 'egg') {
    state.eggs.push(item);
  } else if (item.type === 'recipe') {
    const rec = Object.values(recipeBook).flat().find(r => r.id === item.recipeId);
    if (rec) {
      state.recipeUnlocks[rec.id] = true;
      logMessage(`Recipe ${rec.name} learned!`);
    }
  }
  logMessage(`Purchased ${item.name || item.rarity + ' egg'} for ${finalPrice}.`);
  updateAll();
}

function renderTabs() {
  document.querySelectorAll('.tabs button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tabs button').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(btn.dataset.tab).classList.add('active');
    });
  });
}

function wireNavigation() {
  const navLinks = document.querySelectorAll('.nav-link');
  navLinks.forEach(btn => {
    btn.addEventListener('click', () => {
      navLinks.forEach(n => n.classList.remove('active'));
      btn.classList.add('active');
      const target = btn.dataset.target;
      if (target) {
        const tabBtn = document.querySelector(`.tabs button[data-tab="${target}"]`);
        if (tabBtn) tabBtn.click();
        const section = document.getElementById(target);
        if (section) {
          section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    });
  });
}

function renderZones() {
  const zoneList = document.getElementById('zone-list');
  zoneList.innerHTML = zones.map((z, i) => {
    const locked = i >= state.unlockedZones;
    return `<div class="slot ${locked ? 'small' : ''}">
      <div class="flex"><strong>${z.name}</strong><span>Lv ${z.recommendedLevel || z.level}</span></div>
      <div class="tiny muted">Mat tiers: ${z.allowedMaterialTiers.join(', ')}</div>
      <div>${locked ? 'Locked' : ''}</div>
    </div>`;
  }).join('');
  zoneList.querySelectorAll('.slot').forEach((div, idx) => {
    if (idx < state.unlockedZones) {
      div.onclick = () => { state.currentZone = idx; updateAll(); };
    }
  });
  renderEpicActionButtons();
}

function renderEpicActionButtons() {
  const wrap = document.getElementById('epic-actions');
  if (!wrap) return;
  const zone = zones[state.currentZone];
  if (!zone) { wrap.innerHTML = '<div class="small">Pick a zone to start actions.</div>'; return; }
  wrap.innerHTML = '';
  const lockedZone = state.currentZone >= state.unlockedZones;
  epicActions.forEach(action => {
    const btn = document.createElement('button');
    const cd = getActionCooldownState(action.cooldownId || action.id);
    const bossLevelLock = zone.level + 2;
    let disabled = lockedZone || !cd.ready;
    let label = cd.ready ? action.label : `${action.label} (${formatCooldown(cd.remaining)})`;
    if (action.id === 'boss' && state.player.level < bossLevelLock) {
      disabled = true;
      label = `${action.label} (Lv ${bossLevelLock})`;
    }
    btn.textContent = label;
    btn.className = action.type === 'combat' ? 'primary' : action.type === 'job' ? 'secondary' : 'ghost';
    btn.disabled = disabled;
    btn.title = action.description;
    btn.dataset.actionKey = (action.cooldownId || action.id).toUpperCase();
    btn.dataset.action = (action.cooldownId || action.id).toUpperCase();
    btn.dataset.baseLabel = action.label;
    btn.dataset.actionId = action.id;
    btn.onclick = () => performEpicAction(action.id);
    wrap.appendChild(btn);
  });
  const cdSummary = document.getElementById('cooldown-summary');
  if (cdSummary) {
    const busy = epicActions.filter(a => !getActionCooldownState(a.cooldownId || a.id).ready).length;
    cdSummary.textContent = busy ? `${busy} actions on cooldown` : 'All actions ready';
  }
}

function updateEpicActionTimers() {
  const buttons = document.querySelectorAll('#epic-actions [data-action-key]');
  const zone = zones[state.currentZone];
  const lockedZone = state.currentZone >= state.unlockedZones;
  buttons.forEach(btn => {
    const key = btn.dataset.actionKey;
    const label = btn.dataset.baseLabel || key;
    const actionId = btn.dataset.actionId;
    const remaining = getActionRemainingMs(key);
    const bossLevelLock = zone ? zone.level + 2 : Infinity;
    const levelLocked = actionId === 'boss' && state.player && state.player.level < bossLevelLock;
    if (remaining <= 0 && !lockedZone && !levelLocked) {
      btn.disabled = false;
      btn.textContent = label;
    } else {
      btn.disabled = true;
      btn.textContent = remaining > 0 ? `${label} (${formatCooldown(remaining)})` : label;
    }
    if (levelLocked && remaining <= 0) btn.textContent = `${label} (Lv ${bossLevelLock})`;
  });
  const cdSummary = document.getElementById('cooldown-summary');
  if (cdSummary) {
    const busy = epicActions.filter(a => !getActionCooldownState(a.cooldownId || a.id).ready).length;
    cdSummary.textContent = busy ? `${busy} actions on cooldown` : 'All actions ready';
  }
  updateFightButtons();
}

function updateFightButtons() {
  const fightBtn = document.getElementById('fight-btn');
  const bossBtn = document.getElementById('boss-btn');
  const autoBtn = document.getElementById('auto-btn');
  const fightState = getActionCooldownState('FIGHT');
  const autoState = getActionCooldownState('AUTO_BATTLE');
  const zone = zones[state.currentZone];
  const bossLevelLock = zone ? zone.level + 2 : Infinity;
  const bossLocked = state.player ? state.player.level < bossLevelLock : true;
  const inCombat = CombatSystem.active;
  if (fightBtn) {
    const fightLocked = state.currentZone >= state.unlockedZones || inCombat;
    let fightLabel = 'Fight';
    if (!fightState.ready) fightLabel = `Fight (${formatCooldown(fightState.remaining)})`;
    if (fightLocked) fightLabel = `Fight (${state.currentZone >= state.unlockedZones ? 'Zone Locked' : 'In Combat'})`;
    fightBtn.textContent = fightLabel;
    fightBtn.disabled = fightLocked || !fightState.ready;
  }
  if (bossBtn) {
    const fightLocked = state.currentZone >= state.unlockedZones || inCombat;
    let bossLabel = 'Boss Fight';
    if (!fightState.ready) bossLabel = `Boss Fight (${formatCooldown(fightState.remaining)})`;
    if (fightLocked) bossLabel = `Boss Fight (${state.currentZone >= state.unlockedZones ? 'Zone Locked' : 'In Combat'})`;
    if (bossLocked) bossLabel = `Boss Fight (Lv ${bossLevelLock})`;
    bossBtn.textContent = bossLabel;
    bossBtn.disabled = fightLocked || !fightState.ready || bossLocked;
  }
  if (autoBtn) {
    let autoLabel = 'Auto Battle';
    if (!autoState.ready) autoLabel = `Auto Battle (${formatCooldown(autoState.remaining)})`;
    if (inCombat) autoLabel = 'Auto Battle (In Combat)';
    autoBtn.textContent = autoLabel;
    autoBtn.disabled = inCombat || !autoState.ready;
  }
}

function renderEquipment() {
  const wrap = document.getElementById('equipment-slots');
  wrap.innerHTML = '';
  Object.keys(state.player.equipment).forEach(slot => {
    const item = state.player.equipment[slot];
    const div = document.createElement('div');
    div.className = `slot ${item ? 'rarity-' + item.rarity : ''}`;
    div.innerHTML = `<strong>${slot.toUpperCase()}</strong><br>${item ? `<span class="name ${item.rarity}">${item.name}</span>` : '<span class="small">Empty</span>'}`;
    if (item) {
      const stats = item.stats.map(s => `<div class="small">+${s.value} ${s.label}</div>`).join('');
      const info = document.createElement('div');
      info.innerHTML = stats;
      const socketInfo = document.createElement('div');
      const openSockets = Math.max(0, (item.sockets || 0) - (item.gems ? item.gems.length : 0));
      socketInfo.className = 'small';
      socketInfo.textContent = `Sockets: ${(item.sockets || 0)} (open ${openSockets})`;
      info.appendChild(socketInfo);
      if (item.gems && item.gems.length) {
        item.gems.forEach(g => {
          const gemRow = document.createElement('div');
          gemRow.className = 'tiny';
          gemRow.textContent = `• ${g.name || g.gem?.id}`;
          info.appendChild(gemRow);
        });
      }
      if (item.rune) {
        const runeRow = document.createElement('div');
        runeRow.className = 'tiny';
        runeRow.textContent = `Rune: ${item.rune.id}`;
        info.appendChild(runeRow);
      }
      div.appendChild(info);
    }
    wrap.appendChild(div);
  });
}

function renderInventory() {
  const wrap = document.getElementById('inventory-list');
  if (!state.inventory.length) { wrap.innerHTML = '<div class="small">No items yet.</div>'; return; }
  wrap.innerHTML = '';
  const filtered = filteredInventoryItems();
  if (!filtered.length) { wrap.innerHTML = '<div class="small">No items match the filters.</div>'; return; }
  filtered.forEach(item => {
    const card = document.createElement('div');
    card.className = `item rarity-${item.rarity}`;
    if (item.type === 'potion') {
      const healingText = item.heal ? `Heals ${Math.round(item.heal * (1 + (state.player.modifiers.potionBoost || 0)))} HP` : 'Provides a temporary boon';
      card.innerHTML = `<div class="name ${item.rarity}">${item.name}</div><div class="small">${healingText}</div>`;
      const row = document.createElement('div');
      const useBtn = document.createElement('button');
      useBtn.textContent = 'Use';
      useBtn.onclick = (e) => { e.stopPropagation(); usePotion(item); };
      const sellBtn = document.createElement('button');
      sellBtn.textContent = `Sell (${valueFromItem(item)}g)`;
      sellBtn.onclick = (e) => { e.stopPropagation(); sellItem(item); };
      row.appendChild(useBtn);
      row.appendChild(sellBtn);
      card.appendChild(row);
    } else if (item.type === 'food') {
      card.innerHTML = `<div class="name ${item.rarity}">${item.name}</div><div class="small">Buffs for ${item.buff.duration} battles</div>`;
      const row = document.createElement('div');
      const eatBtn = document.createElement('button');
      eatBtn.textContent = 'Eat';
      eatBtn.onclick = (e) => { e.stopPropagation(); useFood(item); };
      const sellBtn = document.createElement('button');
      sellBtn.textContent = `Sell (${valueFromItem(item)}g)`;
      sellBtn.onclick = (e) => { e.stopPropagation(); sellItem(item); };
      row.appendChild(eatBtn);
      row.appendChild(sellBtn);
      card.appendChild(row);
    } else if (item.type === 'gem' || item.type === 'rune') {
      card.innerHTML = `<div class="name ${item.rarity}">${item.name}</div><div class="small">Socket into gear</div>`;
      const row = document.createElement('div');
      const socketBtn = document.createElement('button');
      socketBtn.textContent = 'Select';
      socketBtn.onclick = (e) => { e.stopPropagation(); selectSocketItem(item); };
      const sellBtn = document.createElement('button');
      sellBtn.textContent = `Sell (${valueFromItem(item)}g)`;
      sellBtn.onclick = (e) => { e.stopPropagation(); sellItem(item); };
      row.appendChild(socketBtn);
      row.appendChild(sellBtn);
      card.appendChild(row);
    } else {
      const better = isBetterThanEquipped(item);
      const arrow = better ? '<span class="better-arrow">↑</span>' : '';
      card.innerHTML = `<div class="name ${item.rarity}">${item.name}${arrow}</div><div class="small">Requires Lv ${item.levelReq} • Slot: ${item.slot}</div><div class="small">Power ${item.power}</div>`;
      (item.stats || []).forEach(s => {
        const stat = document.createElement('div');
        stat.className = 'small';
        stat.textContent = `+${s.value} ${s.label}`;
        card.appendChild(stat);
      });
      const row = document.createElement('div');
      const equipBtn = document.createElement('button');
      equipBtn.textContent = 'Equip';
      equipBtn.onclick = (e) => { e.stopPropagation(); equipItem(item); };
      const sellBtn = document.createElement('button');
      sellBtn.textContent = `Sell (${valueFromItem(item)}g)`;
      sellBtn.onclick = (e) => { e.stopPropagation(); sellItem(item); };
      row.appendChild(equipBtn);
      row.appendChild(sellBtn);
      card.appendChild(row);
    }
    wrap.appendChild(card);
  });
}

function renderSocketPanel() {
  const wrap = document.getElementById('socket-panel');
  if (!wrap) return;
  if (!state.player) { wrap.innerHTML = ''; return; }
  wrap.innerHTML = '<h4>Gems, Runes & Augments</h4>';
  if (state.socketSelection) {
    const sel = state.socketSelection;
    wrap.innerHTML += `<div class="small">Selected: ${sel.name}</div>`;
  }
  Object.entries(state.player.equipment).forEach(([slot, item]) => {
    if (!item) return;
    const open = Math.max(0, (item.sockets || 0) - (item.gems ? item.gems.length : 0));
    const card = document.createElement('div');
    card.className = 'socket-card';
    card.innerHTML = `<div class="flex"><strong>${slot.toUpperCase()}</strong><span class="small">${item.name}</span></div><div class="small">Sockets: ${item.sockets || 0} (open ${open})</div>`;
    const btn = document.createElement('button');
    btn.textContent = 'Apply selection';
    btn.disabled = !state.socketSelection;
    btn.onclick = () => socketInto(item);
    card.appendChild(btn);
    wrap.appendChild(card);
  });

  const gemFusion = document.createElement('div');
  gemFusion.className = 'socket-card';
  gemFusion.innerHTML = '<div class="flex"><strong>Gem Fusion</strong><span class="small">Combine 3 of a tier</span></div>';
  const grouped = {};
  state.inventory.filter(i => i.type === 'gem' && i.gem).forEach(g => { grouped[g.gem.tier] = (grouped[g.gem.tier] || 0) + 1; });
  Object.entries(grouped).forEach(([tier, count]) => {
    const row = document.createElement('div');
    row.className = 'flex';
    row.innerHTML = `<span class="small">Tier ${tier} gems: ${count}</span>`;
    const btn = document.createElement('button');
    btn.textContent = 'Combine';
    btn.disabled = count < 3 || tier >= 5;
    btn.onclick = () => combineGems(Number(tier));
    row.appendChild(btn);
    gemFusion.appendChild(row);
  });
  wrap.appendChild(gemFusion);
}

function selectSocketItem(item) {
  state.socketSelection = item;
  renderSocketPanel();
}

function socketInto(gear) {
  const sel = state.socketSelection;
  if (!sel) { logMessage('Select a gem or rune first.'); return; }
  if (sel.type === 'gem') {
    const open = Math.max(0, (gear.sockets || 0) - (gear.gems ? gear.gems.length : 0));
    if (open <= 0) { logMessage('No open sockets on this gear.'); return; }
    gear.gems = gear.gems || [];
    gear.gems.push(sel);
  } else if (sel.type === 'rune') {
    gear.rune = sel.rune;
  }
  state.inventory = state.inventory.filter(i => i.id !== sel.id);
  state.socketSelection = null;
  logMessage('Socket applied!');
  updateAll();
}

function combineGems(tier) {
  const available = state.inventory.filter(i => i.type === 'gem' && i.gem && i.gem.tier === tier);
  if (available.length < 3) { logMessage('You need 3 gems of the same tier to combine.'); return; }
  const consumed = available.slice(0, 3).map(g => g.id);
  state.inventory = state.inventory.filter(i => !consumed.includes(i.id));
  const newGem = createRandomGem(Math.min(5, tier + 1));
  state.inventory.push(newGem);
  logMessage(`Gems combined into ${newGem.name}.`);
  updateAll();
}

function valueFromItem(item) {
  if (item.type === 'potion') return Math.max(5, Math.round(item.price * 0.5));
  if (item.type === 'food') return Math.max(5, Math.round((item.price || 15) * 0.5));
  if (item.type === 'egg') return valueFromEgg(item);
  if (item.type === 'gem' || item.type === 'rune') return 25 + (item.gem ? item.gem.tier * 10 : 10);
  return Math.max(5, Math.round((item.power || 5) * 1.5));
}

function filteredInventoryItems() {
  return state.inventory.filter(item => {
    const type = item.type || 'gear';
    if (state.filters.type !== 'all' && type !== state.filters.type) return false;
    if (state.filters.slot !== 'all' && item.slot !== state.filters.slot) return false;
    if (state.filters.rarity !== 'all' && item.rarity !== state.filters.rarity) return false;
    return true;
  });
}

function sellFiltered() {
  const filtered = filteredInventoryItems();
  if (!filtered.length) { logMessage('No items to sell for current filters.'); return; }
  let total = 0;
  filtered.forEach(item => { total += valueFromItem(item); });
  const ids = new Set(filtered.map(i => i.id));
  state.inventory = state.inventory.filter(i => !ids.has(i.id));
  state.player.gold += total;
  logMessage(`Sold ${filtered.length} items for ${total} gold.`);
  updateAll();
}

function isBetterThanEquipped(item) {
  if (item.type !== 'gear') return false;
  const current = state.player.equipment[item.slot];
  if (!current) return true;
  return item.power > current.power;
}

function sellItem(item) {
  const value = valueFromItem(item);
  state.player.gold += value;
  state.inventory = state.inventory.filter(i => i.id !== item.id);
  logMessage(`Sold ${item.name} for ${value} gold.`);
  updateAll();
}

function usePotion(item) {
  const derived = applyBonuses(state.player.baseStats, state.player);
  const heal = Math.round(item.heal * (1 + (state.player.modifiers.potionBoost || 0)));
  if (item.heal) {
    state.player.currentHP = Math.min(derived.maxHP, state.player.currentHP + heal);
    logMessage(`You drink ${item.name} and heal ${heal} HP.`);
  }
  if (item.buff) {
    state.foodBuff = { ...item.buff, battles: item.buff.duration, source: item.name };
    logMessage(`${item.name} grants a temporary boon for ${item.buff.duration} battles.`);
  }
  state.inventory = state.inventory.filter(i => i.id !== item.id);
  updateAll();
}

function useFood(item) {
  state.foodBuff = { ...item.buff, battles: item.buff.duration, source: item.name };
  logMessage(`You eat ${item.name}. Buffs last ${item.buff.duration} battles.`);
  state.inventory = state.inventory.filter(i => i.id !== item.id);
  updateAll();
}

function equipItem(item) {
  if (item.type !== 'gear') { return; }
  if (state.player.level < item.levelReq) { logMessage('Level too low to equip.'); return; }
  const current = state.player.equipment[item.slot];
  state.player.equipment[item.slot] = item;
  state.inventory = state.inventory.filter(i => i.id !== item.id);
  if (current) state.inventory.push(current);
  logMessage(`Equipped ${item.name}.`);
  updateAll();
}

function renderDragonTab() {
  const eggWrap = document.getElementById('egg-list');
  eggWrap.innerHTML = '';
  if (!state.eggs.length) eggWrap.innerHTML = '<div class="small">No eggs yet.</div>';
  state.eggs.forEach(egg => {
    const card = document.createElement('div');
    card.className = `egg rarity-${egg.rarity}`;
    const prog = egg.hatched ? 'Hatched!' : `Hatching ${egg.progress}/${egg.requirement}`;
    card.innerHTML = `<div class="name ${egg.rarity}">${egg.rarity} Egg</div><div class="small">${prog}</div>`;
    if (egg.hatched) {
      const btn = document.createElement('button');
      btn.textContent = 'Set Active';
      btn.onclick = () => { state.activeDragon = egg.dragon; updateAll(); };
      card.appendChild(btn);
    }
    const sellBtn = document.createElement('button');
    sellBtn.textContent = `Sell (${valueFromEgg(egg)}g)`;
    sellBtn.onclick = () => { sellEgg(egg); };
    card.appendChild(sellBtn);
    eggWrap.appendChild(card);
  });
  const active = document.getElementById('active-dragon');
  if (state.activeDragon) {
    const d = state.activeDragon;
    active.innerHTML = `<div class="dragon-card rarity-${d.rarity}"><div class="name ${d.rarity}">${d.name}</div>` +
      Object.entries(d.bonus).map(([k,v]) => `<div class="small">+${v} ${k}</div>`).join('') + '</div>';
  } else {
    active.innerHTML = '<div class="small">No active dragon.</div>';
  }
  renderCombineArea();
}

function valueFromEgg(egg) {
  const base = rarities.findIndex(r => r.key === egg.rarity) + 1;
  return Math.max(10, base * 25);
}

function sellEgg(egg) {
  const value = valueFromEgg(egg);
  state.player.gold += value;
  state.eggs = state.eggs.filter(e => e.id !== egg.id);
  logMessage(`Sold a ${egg.rarity} egg for ${value} gold.`);
  updateAll();
}

function renderCombineArea() {
  const area = document.getElementById('combine-area');
  area.innerHTML = '<strong>Combine Eggs</strong><div class="small">Merge 3 of a kind into 1 higher rarity.</div>';
  const select = document.createElement('select');
  rarities.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.key;
    opt.textContent = r.label;
    select.appendChild(opt);
  });
  const btn = document.createElement('button');
  btn.textContent = 'Combine';
  btn.onclick = () => combineEggs(select.value);
  area.appendChild(select);
  area.appendChild(btn);
}

function combineEggs(rarityKey) {
  const available = state.eggs.filter(e => e.rarity === rarityKey && !e.hatched);
  if (available.length < 3) { logMessage('Not enough eggs to combine.'); return; }
  const nextIndex = rarities.findIndex(r => r.key === rarityKey) + 1;
  if (nextIndex >= rarities.length) { logMessage('Highest rarity cannot be combined further.'); return; }
  const toRemove = available.slice(0, 3).map(e => e.id);
  state.eggs = state.eggs.filter(e => !toRemove.includes(e.id));
  const newEgg = createEgg(true);
  newEgg.rarity = rarities[nextIndex].key;
  newEgg.progress = 0;
  newEgg.requirement = Math.max(1, newEgg.requirement - 1);
  state.eggs.push(newEgg);
  logMessage('The eggs resonate and form a stronger one!');
  updateAll();
}

function renderSkills() {
  const wrap = document.getElementById('skill-tree');
  wrap.className = 'skill-tree';
  wrap.innerHTML = '';
  document.getElementById('skill-points').textContent = `Skill Points: ${state.player.skillPoints}`;
  const tree = skillTrees[state.player.class];
  tree.forEach((branch, bIdx) => {
    const branchDiv = document.createElement('div');
    branchDiv.className = 'skill-branch';
    branchDiv.innerHTML = `<strong>${branch.branch}</strong>`;
    branch.skills.forEach((skill, sIdx) => {
      const key = `${bIdx}-${sIdx}`;
      const unlocked = state.player.skills[key];
      const node = document.createElement('div');
      node.className = `skill-node ${unlocked ? 'unlocked' : ''}`;
      node.innerHTML = `<div>${skill.name}</div><div class="small">${skill.desc}</div><div class="small">Cost ${skill.cost}</div>`;
      node.onclick = () => purchaseSkill(key, skill);
      branchDiv.appendChild(node);
    });
    wrap.appendChild(branchDiv);
  });
}

function renderLifeSkillsTab() {
  ensureLifeSkills();
  const list = document.getElementById('life-skill-list');
  if (!list) return;
  list.innerHTML = '';
  Object.entries(lifeSkillDefs).forEach(([id, def]) => {
    const skill = state.lifeSkills[id];
    const card = document.createElement('div');
    card.className = `life-skill ${state.selectedLifeSkill === id ? 'active' : ''}`;
    card.innerHTML = `<div class="flex"><strong>${def.name}</strong><span class="small">Lv ${skill.level}</span></div><div class="small">${def.desc}</div>`;
    const bar = document.createElement('div');
    bar.className = 'life-bar';
    const fill = document.createElement('div');
    fill.className = 'fill';
    fill.style.width = `${Math.min(1, skill.currentXP / skill.xpToNext) * 100}%`;
    const label = document.createElement('span');
    label.textContent = `${skill.currentXP}/${skill.xpToNext}`;
    bar.appendChild(fill); bar.appendChild(label);
    card.appendChild(bar);
    card.onclick = () => { state.selectedLifeSkill = id; renderLifeSkillsTab(); };
    list.appendChild(card);
  });
  renderMaterials();
  renderLifeActions();
}

function renderMaterials() {
  const matWrap = document.getElementById('materials-list');
  if (!matWrap) return;
  matWrap.innerHTML = '<h5>Materials</h5>';
  const grid = document.createElement('div');
  grid.className = 'materials';
  const materials = knownMaterials().sort((a, b) => (a.tier === b.tier ? a.name.localeCompare(b.name) : a.tier - b.tier));
  if (!materials.length) {
    matWrap.innerHTML += '<div class="small muted">Gather to discover materials.</div>';
    return;
  }
  materials.forEach(mat => {
    const qty = state.materials[mat.id] || 0;
    const div = document.createElement('div');
    const zonesLabel = (mat.sourceZones || []).map(z => zoneById(z)?.name || `Zone ${z}`).join(', ');
    div.className = `material rarity-${mat.rarityColor}`;
    div.innerHTML = `<div class="flex"><strong>${mat.name}</strong><span class="badge tier">T${mat.tier}</span></div><div class="small">${qty} owned • Drops in: ${zonesLabel}</div><div class="tiny">${mat.description}</div>`;
    grid.appendChild(div);
  });
  matWrap.appendChild(grid);
}

function renderLifeActions() {
  const actionsWrap = document.getElementById('life-actions');
  const recipeWrap = document.getElementById('life-recipes');
  const title = document.getElementById('life-selected-title');
  const meta = document.getElementById('life-selected-meta');
  const primary = document.getElementById('life-perform-btn');
  if (!actionsWrap || !recipeWrap || !title) return;
  actionsWrap.innerHTML = '';
  recipeWrap.innerHTML = '';
  const id = state.selectedLifeSkill || 'mining';
  const skill = state.lifeSkills[id];
  title.textContent = `${lifeSkillDefs[id].name} Actions`;
  if (meta) meta.textContent = `Level ${skill.level} • ${skill.currentXP}/${skill.xpToNext} XP`;
  const actionLabels = {
    mining: 'Mine', foraging: 'Forage', fishing: 'Fish', hunting: 'Hunt',
    blacksmithing: 'Craft Item', alchemy: 'Brew Potion', cooking: 'Cook Meal', enchanting: 'Apply Enchant',
    dragonHandling: 'Handle Dragon', dragonBonding: 'Bond Dragon', trading: 'Trade',
  };
  if (primary) {
    primary.textContent = actionLabels[id] || 'Perform';
    const actions = lifeActions[id] || [];
    primary.onclick = () => {
      if (actions.length) {
        performLifeAction(id, actions[0]);
      } else {
        const recipes = recipeBook[id] || [];
        if (recipes.length) {
          document.getElementById('life-recipes')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          logMessage('Select a recipe below to work this profession.');
        }
      }
    };
    primary.disabled = !(lifeActions[id] && lifeActions[id].length) && !(recipeBook[id] && recipeBook[id].length);
  }
  const actions = lifeActions[id] || [];
  if (!actions.length) { actionsWrap.innerHTML = '<div class="small">No active buttons here. Practice via crafting or battle hooks.</div>'; }
  actions.forEach(act => {
    const div = document.createElement('div');
    div.className = 'life-action';
    div.innerHTML = `<div class="flex"><strong>${act.label}</strong><span class="small">+${act.xp} XP</span></div><div class="tiny muted">Use the action button above.</div>`;
    actionsWrap.appendChild(div);
  });
  if (id === 'dragonHandling') {
    actionsWrap.innerHTML += `<div class="small">Higher levels reduce egg hatch battles.</div>`;
  }
  if (id === 'dragonBonding') {
    actionsWrap.innerHTML += `<div class="small">Higher levels boost dragon bonus scaling.</div>`;
  }
  if (id === 'trading') {
    actionsWrap.innerHTML += `<div class="small">Higher levels improve shop prices and rarer wares.</div>`;
  }
  const recipes = recipeBook[id] || [];
  recipes.forEach(rec => {
    const learned = !!state.recipeUnlocks[rec.id];
    const card = document.createElement('div');
    card.className = `recipe-card rarity-${rec.rarity} ${learned ? '' : 'locked'}`;
    const gearTier = rec.gearTier || rec.tier;
    const reqLevel = requiredPlayerLevelForTier(gearTier || 1);
    const lockedZone = rec.recommendedZones ? rec.recommendedZones.some(z => zones.findIndex(zn => zn.id === z) >= state.unlockedZones) : false;
    if (state.player.level < reqLevel || lockedZone) card.classList.add('locked');
    const zonesLabel = rec.recommendedZones ? `Zones: ${rec.recommendedZones.map(z => zoneById(z)?.name || `Zone ${z}`).join(', ')}` : '';
    card.innerHTML = `<div class="flex"><strong>${rec.name}</strong><span class="small"><span class="badge tier">T${gearTier || rec.tier}</span> Lv ${rec.skillReq}</span></div><div class="small">${rec.desc}</div><div class="tiny muted">${zonesLabel}</div>`;
    const matList = document.createElement('div');
    matList.className = 'small';
    const knownMats = Object.entries(rec.mats).filter(([m]) => hasSeenMaterial(m));
    matList.textContent = knownMats.length
      ? 'Mats: ' + knownMats.map(([m, q]) => `${(materialMap[m]?.name) || m} x${q} (${state.materials[m] || 0})`).join(', ')
      : 'Mats: ??? (discover required materials)';
    card.appendChild(matList);
    const btn = document.createElement('button');
    btn.textContent = learned ? 'Craft' : 'Locked';
    btn.disabled = !learned || state.player.level < reqLevel || lockedZone;
    btn.onclick = () => craftRecipe(id, rec);
    card.appendChild(btn);
    recipeWrap.appendChild(card);
  });
  if (!recipes.length) recipeWrap.innerHTML = '<div class="small">No recipes yet.</div>';

  if (id === 'blacksmithing' || id === 'mining') {
    renderRefinement();
  } else {
    const refine = document.getElementById('refine-panel');
    if (refine) refine.innerHTML = '';
  }
  renderPerksPanel(id);
}

function renderRefinement() {
  const refine = document.getElementById('refine-panel');
  if (!refine) return;
  refine.innerHTML = '<h5>Refine Materials</h5>';
  refineChains.forEach(chain => {
    const have = state.materials[chain.input] || 0;
    if (have <= 0) return;
    const can = Math.floor(have / chain.ratio);
    const matName = materialMap[chain.input]?.name || chain.input;
    const outName = materialMap[chain.output]?.name || chain.output;
    const card = document.createElement('div');
    card.className = 'recipe-card';
    card.innerHTML = `<div class="flex"><strong>${matName} → ${outName}</strong><span class="small">${chain.ratio}:1</span></div><div class="small">You can make ${can}</div>`;
    const btn = document.createElement('button');
    btn.textContent = 'Refine 1';
    btn.disabled = can <= 0;
    btn.onclick = () => {
      state.materials[chain.input] -= chain.ratio;
      addMaterial(chain.output, 1);
      gainLifeSkillXP('mining', chain.xp);
      updateAll();
    };
    card.appendChild(btn);
    refine.appendChild(card);
  });
}

function renderPerksPanel(skillId) {
  const panel = document.getElementById('perk-panel');
  if (!panel) return;
  panel.innerHTML = '<h5>Perks</h5>';
  const perks = professionPerks[skillId] || [];
  const ul = document.createElement('div');
  perks.forEach(p => {
    const row = document.createElement('div');
    const unlocked = state.lifeSkills[skillId].level >= p.level;
    row.className = `perk ${unlocked ? 'unlocked' : ''}`;
    row.textContent = `Lv ${p.level}: ${p.desc}`;
    ul.appendChild(row);
  });
  panel.appendChild(ul);
}

function purchaseSkill(key, skill) {
  if (state.player.skills[key]) return;
  if (state.player.skillPoints < skill.cost) { logMessage('Not enough skill points.'); return; }
  state.player.skillPoints -= skill.cost;
  state.player.skills[key] = true;
  skill.effect(state.player);
  logMessage(`Unlocked ${skill.name}!`);
  updateAll();
}

function renderTopbar() {
  const p = state.player;
  const derived = applyBonuses(p.baseStats, p);
  document.getElementById('player-class').textContent = p.class;
  document.getElementById('player-level').textContent = `Level ${p.level}`;
  document.getElementById('player-gold').textContent = `${p.gold} gold`;
  document.getElementById('player-dragon').textContent = state.activeDragon ? `Dragon: ${state.activeDragon.name}` : 'No dragon';
  document.getElementById('player-prestige').textContent = `Prestige ${state.prestige || 0}`;
  p.currentHP = Math.min(derived.maxHP, Math.max(0, p.currentHP));
  updateHealthBar(p, playerHpBar, playerHpText, derived.maxHP);
  const usesRageResource = usesRage(p);
  const manaBar = document.querySelector('.bar.mana');
  if (rageContainer) rageContainer.style.display = usesRageResource ? 'block' : 'none';
  if (manaBar) manaBar.style.display = usesRageResource ? 'none' : 'block';
  if (usesRageResource) {
    updateRageBar(p);
  }
  const resPct = Math.max(0, Math.min(1, p.currentResource / Math.max(1, p.maxResource)));
  document.getElementById('resource-bar').style.width = `${resPct * 100}%`;
  document.getElementById('resource-text').textContent = `${classResources[p.class]}: ${Math.floor(p.currentResource)}/${p.maxResource}`;
  const xpPct = Math.max(0, Math.min(1, p.xp / p.xpToNext));
  document.getElementById('xp-bar').style.width = `${xpPct * 100}%`;
  document.getElementById('xp-text').textContent = `${p.xp}/${p.xpToNext} XP`;
}

function updateBars() {
  if (state.player && playerHpBar) {
    const derived = applyBonuses(state.player.baseStats, state.player);
    state.player.currentHP = Math.min(derived.maxHP, Math.max(0, state.player.currentHP));
    updateHealthBar(state.player, playerHpBar, playerHpText, derived.maxHP);
    if (usesRage()) updateRageBar(state.player);
  }
  if (!state.currentEnemy) return;
  const enemyBar = document.querySelector('.bar.enemy');
  if (enemyBar) enemyBar.classList.toggle('boss', !!state.currentEnemy.boss);
  state.currentEnemy.currentHP = Math.min(state.currentEnemy.hp, Math.max(0, state.currentEnemy.currentHP));
  updateHealthBar(state.currentEnemy, enemyHpBar, enemyHpText, state.currentEnemy.hp);
}

function updateAll() {
  renderTopbar();
  renderZones();
  renderEquipment();
  renderInventory();
  renderSocketPanel();
  renderDragonTab();
  renderSkills();
  renderLifeSkillsTab();
  renderShop();
  updateBars();
  CombatSystem.updateActionButtons();
  updateFightButtons();
  saveGame();
}

function prestige() {
  if (!state.player) return;
  if (state.player.level < 20) { logMessage('Reach level 20 to prestige.'); return; }
  state.prestige = (state.prestige || 0) + 1;
  const cls = state.player.class;
  state.player = createPlayer(cls);
  state.inventory = [];
  state.eggs = [];
  state.activeDragon = null;
  state.unlockedZones = 1;
  state.currentZone = 0;
  logMessage(`You prestiged! Permanent bonus applied (x${state.prestige}).`);
  updateAll();
}

function resetGame() {
  localStorage.removeItem('rpgSave');
  state.player = null;
  state.inventory = [];
  state.eggs = [];
  state.activeDragon = null;
  state.currentZone = 0;
  state.unlockedZones = 1;
  state.currentEnemy = null;
  state.log = [];
  state.shop = [];
  state.prestige = 0;
  state.lifeSkills = defaultLifeSkills();
  state.materials = {};
  state.recipeUnlocks = {};
  state.foodBuff = null;
  document.getElementById('class-select').style.display = 'flex';
  setupClassSelection();
}

function saveGame() {
  const data = {
    player: state.player,
    inventory: state.inventory,
    eggs: state.eggs,
    activeDragon: state.activeDragon,
    currentZone: state.currentZone,
    unlockedZones: state.unlockedZones,
    shop: state.shop,
    prestige: state.prestige,
    lifeSkills: state.lifeSkills,
    materials: state.materials,
    materialHistory: state.materialHistory,
    recipeUnlocks: state.recipeUnlocks,
    foodBuff: state.foodBuff,
    actionCooldowns: state.actionCooldowns,
  };
  localStorage.setItem('rpgSave', JSON.stringify(data));
}

function loadGame() {
  const data = localStorage.getItem('rpgSave');
  if (data) {
    const parsed = JSON.parse(data);
    state.player = parsed.player;
    ensureModifierDefaults(state.player);
    Object.values(state.player.equipment || {}).forEach(it => { if (it && !it.gems) it.gems = []; });
    state.inventory = parsed.inventory || [];
    state.inventory.forEach(it => { if (!it.type) it.type = 'gear'; if (!it.gems) it.gems = []; });
    state.eggs = parsed.eggs || [];
    state.activeDragon = parsed.activeDragon || null;
    state.currentZone = parsed.currentZone || 0;
    state.unlockedZones = parsed.unlockedZones || 1;
    state.shop = parsed.shop || [];
    state.prestige = parsed.prestige || 0;
    state.lifeSkills = parsed.lifeSkills || defaultLifeSkills();
    state.materials = parsed.materials || {};
    state.materialHistory = parsed.materialHistory || {};
    state.foodBuff = parsed.foodBuff || null;
    state.recipeUnlocks = parsed.recipeUnlocks || {};
    state.actionCooldowns = parsed.actionCooldowns || {};
    ensureLifeSkills();
    return true;
  }
  return false;
}

function setupClassSelection() {
  const wrap = document.getElementById('class-options');
  wrap.innerHTML = '';
  Object.entries(classData).forEach(([name, stats]) => {
    const card = document.createElement('div');
    card.className = 'class-card';
    card.innerHTML = `<strong>${name}</strong><div class="small">HP ${stats.hp} | ATK ${stats.attack} | DEF ${stats.defense} | CRIT ${stats.crit}%</div>`;
    card.onclick = () => {
      state.player = createPlayer(name);
      document.getElementById('class-select').style.display = 'none';
      initGame();
    };
    wrap.appendChild(card);
  });
}

function initGame() {
  ensureLifeSkills();
  renderTabs();
  wireNavigation();
  renderZones();
  document.getElementById('fight-btn').onclick = () => startFight(false);
  document.getElementById('boss-btn').onclick = () => startFight(true);
  document.getElementById('auto-btn').onclick = () => autoBattle(false);
  document.getElementById('attack-btn').onclick = () => CombatSystem.playerAction('attack');
  document.getElementById('refresh-shop').onclick = () => { generateShop(); renderShop(); saveGame(); };
  setInterval(() => updateEpicActionTimers(), 1000);
  ['slot','rarity','type'].forEach(key => {
    document.getElementById(`filter-${key}`).addEventListener('change', (e) => {
      state.filters[key] = e.target.value;
      renderInventory();
      saveGame();
    });
  });
  document.getElementById('sell-filtered').onclick = sellFiltered;
  document.getElementById('reset-btn').onclick = resetGame;
  document.getElementById('prestige-btn').onclick = prestige;
  if (!state.shop.length) generateShop();
  updateAll();
}

window.onload = () => {
  if (!loadGame()) {
    setupClassSelection();
  } else {
    document.getElementById('class-select').style.display = 'none';
    initGame();
  }
};
