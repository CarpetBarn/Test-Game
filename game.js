// Simple RNG Looter RPG built with vanilla JS
// Systems: combat, loot, skills, dragons, events, saving

const ENEMY_SCALE = 2;
const ENEMY_ATTACK_MOD = 5 / 6; // global reduction to enemy attack power
const MAX_LEVEL = 200;
const MAX_COMBAT_LOG_ENTRIES = 10;
const EGG_DROP_BONUS = 0.06;
const EGG_CHANCE_MULT = 1.15;
const BOSS_SCALE = 1.12;
const LOOT_CHANCE_MULT = 1.25;
const SAVE_DEBOUNCE_MS = 6000;
const XP_REWARDS = {
  hunt: 30,
  adventure: 75,
  dungeon: 130,
  miniboss: 250,
  boss: 300,
  auto: 15,
};

function xpForLevel(level) {
  const base = 50;
  const growth = 1.85;
  return Math.floor(base * Math.pow(Math.max(1, level), growth));
}

function xpToNextLevel(currentLevel) {
  return xpForLevel(currentLevel + 1);
}

const EventBus = {
  listeners: {},
  on(event, cb) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(cb);
  },
  emit(event, payload) {
    (this.listeners[event] || []).forEach(cb => {
      try { cb(payload); } catch (e) { console.error(e); }
    });
  },
};

const zoneRarityWeights = {
  1: { common: 0.7, uncommon: 0.25, rare: 0.05, epic: 0, legendary: 0 },
  2: { common: 0.6, uncommon: 0.3, rare: 0.09, epic: 0.01, legendary: 0 },
  3: { common: 0.5, uncommon: 0.3, rare: 0.15, epic: 0.04, legendary: 0.01 },
  4: { common: 0.4, uncommon: 0.3, rare: 0.2, epic: 0.08, legendary: 0.02 },
  5: { common: 0.3, uncommon: 0.3, rare: 0.25, epic: 0.1, legendary: 0.05 },
  6: { common: 0.2, uncommon: 0.25, rare: 0.3, epic: 0.15, legendary: 0.1 },
  7: { common: 0.1, uncommon: 0.2, rare: 0.35, epic: 0.2, legendary: 0.15 },
};

const rarities = [
  { key: 'common', label: 'Common', color: 'common', weight: 70, stats: [1, 2], scale: 1 },
  { key: 'uncommon', label: 'Uncommon', color: 'uncommon', weight: 22, stats: [2, 3], scale: 1.08 },
  { key: 'rare', label: 'Rare', color: 'rare', weight: 6, stats: [3, 4], scale: 1.2 },
  { key: 'epic', label: 'Epic', color: 'epic', weight: 2, stats: [4, 5], scale: 1.35 },
  { key: 'legendary', label: 'Legendary', color: 'legendary', weight: 0.5, stats: [4, 5], scale: 1.55 },
];

const ELEMENTS = ['physical', 'fire', 'frost', 'nature', 'shadow', 'storm', 'earth', 'holy'];
const elementMatrix = {
  fire: { nature: 1.25, frost: 0.75, earth: 1.05 },
  frost: { fire: 1.25, storm: 0.9 },
  nature: { earth: 1.2, fire: 0.8 },
  shadow: { holy: 0.75 },
  holy: { shadow: 1.25, undead: 1.25 },
  storm: { frost: 1.15 },
  earth: { physical: 0.9, nature: 0.85 },
};

function getElementMultiplier(attacker = 'physical', defender = 'physical') {
  const source = elementMatrix[attacker] || {};
  return source[defender] || 1;
}

const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

const DEFAULT_SETTINGS = {
  uiScale: 'medium',
  animations: true,
  lootFilterMode: 'normal',
  colorblindMode: false,
  mobileLayoutMode: false,
};

let settings = { ...DEFAULT_SETTINGS };

function setVh() {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
}

function updateOrientationFlag() {
  const isPortrait = window.matchMedia('(orientation: portrait)').matches;
  document.body.dataset.orientation = isPortrait ? 'portrait' : 'landscape';
}

function ensureOrientationListeners() {
  updateOrientationFlag();
  window.addEventListener('orientationchange', () => {
    updateOrientationFlag();
    syncCombatActionBar();
  });
}
window.addEventListener('resize', () => {
  setVh();
  applySettings();
  updateOrientationFlag();
  syncCombatActionBar();
});

function loadSettings() {
  const raw = localStorage.getItem('gameSettings');
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    settings = { ...settings, ...parsed };
  } catch (e) {
    console.error('Failed to parse settings', e);
  }
}

function saveSettings() {
  localStorage.setItem('gameSettings', JSON.stringify(settings));
}

function isMobileViewport() {
  return window.innerWidth < 768;
}

function setNavOpen(open) {
  const sidebar = document.querySelector('.sidebar');
  const mobile = state.ui.mobileActive;
  const nextOpen = mobile ? !!open : true;
  state.ui.navOpen = nextOpen;
  if (sidebar) sidebar.classList.toggle('open', nextOpen || !mobile);
}

function toggleNav() {
  setNavOpen(!state.ui.navOpen);
}

function updateSettingsCardLabels() {
  const map = {
    'ui-scale': settings.uiScale === 'small' ? 'Small' : settings.uiScale === 'large' ? 'Large' : 'Medium',
    animations: settings.animations ? 'On' : 'Off',
    'loot-filters':
      settings.lootFilterMode === 'normal'
        ? 'All loot'
        : settings.lootFilterMode === 'hideCommons'
        ? 'Hide Commons'
        : 'Rare+ only',
    'colorblind-mode': settings.colorblindMode ? 'Enabled' : 'Disabled',
    'mobile-layout': settings.mobileLayoutMode ? 'Enabled' : 'Disabled',
  };
  document.querySelectorAll('[data-setting-value]').forEach(el => {
    const key = el.dataset.settingValue;
    if (map[key] != null) el.textContent = map[key];
  });
}

const actionDock = {
  actionPanel: null,
  autoActions: null,
  epicMount: null,
};

function ensureActionDockRefs() {
  if (!actionDock.actionPanel) {
    const el = document.getElementById('action-panel');
    if (el) actionDock.actionPanel = { el, home: el.parentElement, anchor: el.nextSibling };
  }
  if (!actionDock.autoActions) {
    const auto = document.getElementById('auto-actions');
    if (auto) actionDock.autoActions = { el: auto, home: auto.parentElement, anchor: auto.nextSibling };
  }
  if (!actionDock.epicMount) {
    const epic = document.getElementById('combat-epic-actions-mount');
    if (epic) actionDock.epicMount = { el: epic, home: epic.parentElement, anchor: epic.nextSibling };
  }
}

function restoreDockItem(entry) {
  if (!entry || !entry.el || !entry.home) return;
  if (entry.el.parentElement !== entry.home) {
    entry.home.insertBefore(entry.el, entry.anchor || null);
  }
}

function syncCombatActionBar() {
  ensureActionDockRefs();
  const bar = document.getElementById('combat-action-bar');
  const track = document.getElementById('combat-action-track');
  if (!bar || !track) return;
  const combatVisible = document.getElementById('combat-panel')?.classList.contains('is-visible');
  const active = state.ui.mobileActive && combatVisible;
  bar.hidden = !active;
  bar.classList.toggle('active', active);
  document.body.classList.toggle('combat-bar-active', active);
  if (active) {
    [actionDock.actionPanel, actionDock.autoActions, actionDock.epicMount]
      .filter(Boolean)
      .forEach(entry => {
        if (entry.el && entry.el.parentElement !== track) track.appendChild(entry.el);
      });
  } else {
    restoreDockItem(actionDock.actionPanel);
    restoreDockItem(actionDock.autoActions);
    restoreDockItem(actionDock.epicMount);
  }
}

function updateLootFilterBehavior() {
  const mode = settings.lootFilterMode || 'normal';
  const defaultMin = mode === 'hideCommons' ? 'uncommon' : mode === 'rarePlus' ? 'rare' : 'common';
  state.filters.minRarity = defaultMin;
  const raritySelect = document.getElementById('filter-rarity');
  if (raritySelect) {
    raritySelect.value = mode === 'normal' ? 'all' : defaultMin;
  }
  if (state.player) renderInventory();
}

function setLootFilter(opts = {}) {
  if (opts.minRarity) {
    state.filters.minRarity = opts.minRarity;
    const raritySelect = document.getElementById('filter-rarity');
    if (raritySelect && raritySelect.value === 'all') {
      raritySelect.value = opts.minRarity;
    }
  }
  if (state.player) renderInventory();
}

function applySettings() {
  const root = document.documentElement;
  const body = document.body;
  const autoMobile = isMobileViewport();
  const mobileActive = settings.mobileLayoutMode || autoMobile;
  const prevMobile = state.ui.mobileActive;
  state.ui.autoMobile = autoMobile;
  state.ui.mobileActive = mobileActive;
  if (settings.uiScale === 'small') {
    root.style.setProperty('--ui-scale', '0.9');
  } else if (settings.uiScale === 'large') {
    root.style.setProperty('--ui-scale', '1.1');
  } else {
    root.style.setProperty('--ui-scale', '1');
  }

  if (settings.animations) {
    body.classList.remove('animations-off');
  } else {
    body.classList.add('animations-off');
  }

  if (settings.colorblindMode) {
    body.classList.add('colorblind-mode');
  } else {
    body.classList.remove('colorblind-mode');
  }

  if (mobileActive) body.setAttribute('data-mobile', 'true');
  else body.removeAttribute('data-mobile');

  if (mobileActive && !prevMobile) {
    setNavOpen(false);
  } else if (!mobileActive && !state.ui.navOpen) {
    setNavOpen(true);
  } else {
    setNavOpen(state.ui.navOpen);
  }

  updateLootFilterBehavior();
  updateSettingsCardLabels();
  syncCombatActionBar();
}

function onSettingCardClick(settingId) {
  switch (settingId) {
    case 'ui-scale':
      settings.uiScale = settings.uiScale === 'small' ? 'medium' : settings.uiScale === 'medium' ? 'large' : 'small';
      break;
    case 'animations':
      settings.animations = !settings.animations;
      break;
    case 'loot-filters':
      if (settings.lootFilterMode === 'normal') settings.lootFilterMode = 'hideCommons';
      else if (settings.lootFilterMode === 'hideCommons') settings.lootFilterMode = 'rarePlus';
      else settings.lootFilterMode = 'normal';
      break;
    case 'colorblind-mode':
      settings.colorblindMode = !settings.colorblindMode;
      break;
    case 'mobile-layout':
      settings.mobileLayoutMode = !settings.mobileLayoutMode;
      break;
    default:
      break;
  }
  saveSettings();
  applySettings();
}

function initSettingsCards() {
  document.querySelectorAll('.setting-card').forEach(card => {
    const settingId = card.dataset.setting;
    if (!settingId) return;
    card.addEventListener('click', () => onSettingCardClick(settingId));
  });
}

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
  { id: 'copper_ore', name: 'Copper Ore', tier: 1, sourceZones: [1, 2], minPlayerLevel: 1, rarityColor: 'common', sourceType: 'mining', dropRates: { 1: 0.7, 2: 0.6 }, description: 'Soft metal used for novice gear.', usedInRecipes: ['copper_blade', 'copper_ingot', 'minor_glow'], usedInTiers: [1] },
  { id: 'soft_wood', name: 'Soft Wood', tier: 1, sourceZones: [1], minPlayerLevel: 1, rarityColor: 'common', sourceType: 'foraging', dropRates: { 1: 0.65 }, description: 'Young timber good for handles.', usedInRecipes: ['copper_blade'], usedInTiers: [1] },
  { id: 'basic_herb', name: 'Basic Herbs', tier: 1, sourceZones: [1], minPlayerLevel: 1, rarityColor: 'common', sourceType: 'foraging', dropRates: { 1: 0.7 }, description: 'Simple herbs for stew and poultices.', usedInRecipes: ['simple_stew', 'novice_potion', 'minor_glow', 'river_fillet'], usedInTiers: [1] },
  { id: 'raw_meat', name: 'Raw Meat', tier: 1, sourceZones: [1], minPlayerLevel: 1, rarityColor: 'common', sourceType: 'hunting', dropRates: { 1: 0.55 }, description: 'Fresh game meat.', usedInRecipes: ['simple_stew', 'ember_feast', 'sky_salad', 'wyrmling_feast'], usedInTiers: [1, 3, 4] },
  { id: 'brook_trout', name: 'Brook Trout', tier: 1, sourceZones: [1], minPlayerLevel: 1, rarityColor: 'common', sourceType: 'fishing', dropRates: { 1: 0.6 }, description: 'Common river catch used for light meals.', usedInRecipes: ['river_fillet'], usedInTiers: [1] },

  { id: 'iron_ore', name: 'Iron Ore', tier: 2, sourceZones: [2, 3, 4], minPlayerLevel: 8, rarityColor: 'uncommon', sourceType: 'mining', dropRates: { 2: 0.35, 3: 0.5, 4: 0.55 }, description: 'Sturdy ore for stronger blades.', usedInRecipes: ['iron_blade', 'frost_soup', 'iron_refine', 'spark_of_renewal', 'cut_ruby'], usedInTiers: [2] },
  { id: 'cedar_wood', name: 'Cedar Wood', tier: 2, sourceZones: [2], minPlayerLevel: 8, rarityColor: 'uncommon', sourceType: 'foraging', dropRates: { 2: 0.5 }, description: 'Resinous wood with bite.', usedInRecipes: ['iron_blade', 'lightning_roll', 'cut_ruby'], usedInTiers: [2] },
  { id: 'frostbud', name: 'Frostbud Herb', tier: 2, sourceZones: [2], minPlayerLevel: 8, rarityColor: 'uncommon', sourceType: 'foraging', dropRates: { 2: 0.55 }, description: 'Cold-loving herb for soups and resistance tonics.', usedInRecipes: ['frost_soup', 'resist_elixir', 'spark_of_renewal'], usedInTiers: [2] },
  { id: 'venom_gland', name: 'Venom Gland', tier: 2, sourceZones: [3], minPlayerLevel: 12, rarityColor: 'uncommon', sourceType: 'hunting', dropRates: { 3: 0.35 }, description: 'Toxic gland useful for alchemy.', usedInRecipes: ['resist_elixir'], usedInTiers: [2, 3] },

  { id: 'storm_eel', name: 'Stormreach Eel', tier: 3, sourceZones: [5], minPlayerLevel: 18, rarityColor: 'rare', sourceType: 'fishing', dropRates: { 5: 0.35 }, description: 'Eel crackling with latent lightning.', usedInRecipes: ['lightning_roll', 'stormbrew'], usedInTiers: [3, 4] },
  { id: 'steel_ore', name: 'Steel Ore', tier: 3, sourceZones: [3, 4, 5], minPlayerLevel: 18, rarityColor: 'rare', sourceType: 'mining', dropRates: { 3: 0.4, 4: 0.45, 5: 0.35 }, description: 'Refined ore able to hold great edges.', usedInRecipes: ['steel_greatsword', 'elemental_tonic', 'steel_refine', 'greater_affix', 'cut_emerald'], usedInTiers: [3] },
  { id: 'darkwood', name: 'Darkwood', tier: 3, sourceZones: [4], minPlayerLevel: 18, rarityColor: 'rare', sourceType: 'foraging', dropRates: { 4: 0.35 }, description: 'Dense lumber, ideal for hardy hafts.', usedInRecipes: ['steel_greatsword', 'greater_affix'], usedInTiers: [3] },
  { id: 'emberleaf', name: 'Emberleaf', tier: 3, sourceZones: [3], minPlayerLevel: 18, rarityColor: 'rare', sourceType: 'foraging', dropRates: { 3: 0.45 }, description: 'Smoldering leaf that spices hearty meals.', usedInRecipes: ['ember_feast', 'elemental_tonic', 'cut_emerald'], usedInTiers: [3] },
  { id: 'alpha_parts', name: 'Alpha Monster Parts', tier: 3, sourceZones: [5], minPlayerLevel: 18, rarityColor: 'rare', sourceType: 'hunting', dropRates: { 5: 0.32 }, description: 'Trophies from tough beasts.', usedInRecipes: ['steel_greatsword', 'wyrmling_feast'], usedInTiers: [3] },

  { id: 'sky_pearl', name: 'Sky Pearl', tier: 4, sourceZones: [5], minPlayerLevel: 26, rarityColor: 'epic', sourceType: 'fishing', dropRates: { 5: 0.2 }, description: 'Shimmering pearl infused with clouds.', usedInRecipes: ['stormbrew'], usedInTiers: [4] },
  { id: 'mithril_ore', name: 'Mithril Ore', tier: 4, sourceZones: [4, 5, 6], minPlayerLevel: 26, rarityColor: 'epic', sourceType: 'mining', dropRates: { 4: 0.35, 5: 0.4, 6: 0.35 }, description: 'Light but potent metal.', usedInRecipes: ['mithril_spear', 'battle_elixir', 'mithril_refine', 'mythic_upgrade'], usedInTiers: [4] },
  { id: 'dragonwood', name: 'Dragonwood', tier: 4, sourceZones: [4], minPlayerLevel: 26, rarityColor: 'epic', sourceType: 'foraging', dropRates: { 4: 0.35 }, description: 'Bark steeped in draconic heat.', usedInRecipes: ['mithril_spear', 'sky_salad', 'drake_treat', 'ancient_aegis'], usedInTiers: [4] },
  { id: 'crystal_bloom', name: 'Crystal Bloom', tier: 4, sourceZones: [5, 6], minPlayerLevel: 26, rarityColor: 'epic', sourceType: 'foraging', dropRates: { 5: 0.25, 6: 0.2 }, description: 'Fractal flowers pulsing with mana.', usedInRecipes: ['mithril_spear', 'battle_elixir', 'mythic_upgrade', 'master_rune'], usedInTiers: [4, 5] },
  { id: 'ancient_essence', name: 'Ancient Essence', tier: 5, sourceZones: [7], minPlayerLevel: 30, rarityColor: 'legendary', sourceType: 'enemy', dropRates: { 7: 0.2 }, description: 'Phantasmal energy from ruins.', usedInRecipes: ['eternal_elixir', 'ancient_aegis', 'core_catalyst'], usedInTiers: [5] },

  { id: 'dragonite_ore', name: 'Dragonite Ore', tier: 5, sourceZones: [6, 7], minPlayerLevel: 40, rarityColor: 'legendary', sourceType: 'boss', dropRates: { 6: 0.12, 7: 0.15 }, description: 'Legendary ore that hums with power.', usedInRecipes: ['dragonite_waraxe', 'eternal_elixir', 'elder_feast', 'mithril_refine'], usedInTiers: [5] },
  { id: 'elderwood', name: 'Elderwood', tier: 5, sourceZones: [7], minPlayerLevel: 40, rarityColor: 'legendary', sourceType: 'foraging', dropRates: { 7: 0.2 }, description: 'Wood from primordial trees.', usedInRecipes: ['dragonite_waraxe', 'elder_feast'], usedInTiers: [5] },
  { id: 'phoenix_herb', name: 'Phoenix Herb', tier: 5, sourceZones: [6, 7], minPlayerLevel: 40, rarityColor: 'legendary', sourceType: 'foraging', dropRates: { 6: 0.12, 7: 0.2 }, description: 'Self-rekindling herb with radiant oils.', usedInRecipes: ['elder_feast', 'eternal_elixir', 'drake_treat'], usedInTiers: [5] },
  { id: 'primordial_core', name: 'Primordial Core', tier: 5, sourceZones: [7], minPlayerLevel: 45, rarityColor: 'legendary', sourceType: 'boss', dropRates: { 7: 0.1 }, description: 'Rare core from ancient guardians.', usedInRecipes: ['dragonite_waraxe', 'master_rune', 'core_catalyst'], usedInTiers: [5] },
];

const materialTemplates = materialCatalog.map(m => m.id);
const materialMap = materialCatalog.reduce((acc, mat) => {
  acc[mat.id] = mat;
  return acc;
}, {});

function zoneById(id) {
  return zones.find(z => z.id === id) || zones[id];
}

function bossById(id) {
  if (!id) return null;
  return zones.find(z => z.boss?.id === id)?.boss || null;
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

const lifeSkillActionMap = {
  mining: 'MINE',
  foraging: 'FORAGE',
  fishing: 'FISH',
  hunting: 'HUNT_JOB',
  blacksmithing: 'SMITH',
  alchemy: 'BREW',
  cooking: 'COOK',
  enchanting: 'ENCHANT',
  refining: 'REFINE',
  dragonHandling: 'HANDLE',
  dragonBonding: 'BOND',
  trading: 'TRADE',
};

// =================== BLACKSMITHING RECIPES ===================
const recipes = {
  copper_blade: {
    id: 'copper_blade',
    name: 'Copper Blade',
    profession: 'blacksmithing',
    tier: 1,
    gearTier: 1,
    requiredSkillLevel: 1,
    skillReq: 1,
    requiredPlayerLevel: 1,
    playerLevelReq: 1,
    sourceActions: ['MINE', 'CHOP', 'FORAGE'],
    mats: { copper_ore: 4, soft_wood: 2 },
    type: 'gear',
    slot: 'weapon',
    rarity: 'uncommon',
    levelReq: 4,
    stats: [{ key: 'attack', label: 'Attack', value: 12 }, { key: 'crit', label: 'Crit %', value: 1 }],
    recommendedZones: [1, 2],
    desc: 'Basic blade using mined ore and chopped wood.',
    autoUnlock: true,
  },
  iron_blade: {
    id: 'iron_blade',
    name: 'Iron Blade',
    profession: 'blacksmithing',
    tier: 2,
    gearTier: 2,
    requiredSkillLevel: 10,
    skillReq: 10,
    requiredPlayerLevel: 10,
    playerLevelReq: 10,
    sourceActions: ['MINE', 'CHOP'],
    mats: { iron_ore: 6, cedar_wood: 2 },
    type: 'gear',
    slot: 'weapon',
    rarity: 'rare',
    levelReq: 10,
    stats: [{ key: 'attack', label: 'Attack', value: 18 }, { key: 'crit', label: 'Crit %', value: 3 }],
    recommendedZones: [2, 3],
    desc: 'Sharper iron-forged blade with cedar grip.',
  },
  steel_greatsword: {
    id: 'steel_greatsword',
    name: 'Steel Greatsword',
    profession: 'blacksmithing',
    tier: 3,
    gearTier: 3,
    requiredSkillLevel: 20,
    skillReq: 20,
    requiredPlayerLevel: 20,
    playerLevelReq: 20,
    sourceActions: ['MINE', 'HUNT', 'CHOP'],
    mats: { steel_ore: 8, darkwood: 2, alpha_parts: 2 },
    type: 'gear',
    slot: 'weapon',
    rarity: 'epic',
    levelReq: 18,
    stats: [{ key: 'attack', label: 'Attack', value: 32 }, { key: 'critdmg', label: 'Crit DMG %', value: 6 }],
    recommendedZones: [4, 5],
    desc: 'Heavy steel tempered with darkwood and trophies.',
  },
  mithril_spear: {
    id: 'mithril_spear',
    name: 'Mithril Spear',
    profession: 'blacksmithing',
    tier: 4,
    gearTier: 4,
    requiredSkillLevel: 35,
    skillReq: 35,
    requiredPlayerLevel: 30,
    playerLevelReq: 30,
    sourceActions: ['MINE', 'FORAGE'],
    mats: { mithril_ore: 8, crystal_bloom: 2, dragonwood: 2 },
    type: 'gear',
    slot: 'weapon',
    rarity: 'epic',
    levelReq: 28,
    stats: [{ key: 'attack', label: 'Attack', value: 48 }, { key: 'speed', label: 'Speed', value: 6 }],
    recommendedZones: [5, 6],
    desc: 'Lightweight spear laced with crystals and dragonwood.',
  },
  dragonite_waraxe: {
    id: 'dragonite_waraxe',
    name: 'Dragonite Waraxe',
    profession: 'blacksmithing',
    tier: 5,
    gearTier: 5,
    requiredSkillLevel: 50,
    skillReq: 50,
    requiredPlayerLevel: 40,
    playerLevelReq: 40,
    sourceActions: ['MINE', 'BOSS'],
    mats: { dragonite_ore: 10, elderwood: 3, primordial_core: 1 },
    type: 'gear',
    slot: 'weapon',
    rarity: 'legendary',
    levelReq: 40,
    stats: [{ key: 'attack', label: 'Attack', value: 76 }, { key: 'elemental', label: 'Elemental Dmg', value: 20 }],
    recommendedZones: [6, 7],
    desc: 'Mythic axe infused with primal cores and timber.',
  },
  // =================== REFINING RECIPES ===================
  copper_ingot: {
    id: 'copper_ingot',
    name: 'Smelt Copper',
    profession: 'blacksmithing',
    tier: 1,
    requiredSkillLevel: 1,
    skillReq: 1,
    sourceActions: ['MINE'],
    mats: { copper_ore: 3 },
    type: 'refine',
    rarity: 'common',
    output: { materialId: 'iron_ore', qty: 1 },
    desc: 'Refine copper ore into sturdier iron shards.',
    autoUnlock: true,
  },
  iron_refine: {
    id: 'iron_refine',
    name: 'Forge Iron Bars',
    profession: 'blacksmithing',
    tier: 2,
    requiredSkillLevel: 8,
    skillReq: 8,
    sourceActions: ['MINE'],
    mats: { iron_ore: 4 },
    type: 'refine',
    rarity: 'uncommon',
    output: { materialId: 'steel_ore', qty: 1 },
    desc: 'Smelt iron into steel-ready bars.',
  },
  steel_refine: {
    id: 'steel_refine',
    name: 'Fold Steel',
    profession: 'blacksmithing',
    tier: 3,
    requiredSkillLevel: 18,
    skillReq: 18,
    sourceActions: ['MINE'],
    mats: { steel_ore: 5 },
    type: 'refine',
    rarity: 'rare',
    output: { materialId: 'mithril_ore', qty: 1 },
    desc: 'Fold steel bars into mithril precursor.',
  },
  mithril_refine: {
    id: 'mithril_refine',
    name: 'Transmute Mithril',
    profession: 'blacksmithing',
    tier: 4,
    requiredSkillLevel: 26,
    skillReq: 26,
    sourceActions: ['MINE'],
    mats: { mithril_ore: 6 },
    type: 'refine',
    rarity: 'epic',
    output: { materialId: 'dragonite_ore', qty: 1 },
    desc: 'Slowly coax mithril into dragonite quality.',
  },

  // =================== COOKING RECIPES ===================
  simple_stew: {
    id: 'simple_stew',
    name: 'Simple Stew',
    profession: 'cooking',
    tier: 1,
    requiredSkillLevel: 1,
    skillReq: 1,
    sourceActions: ['HUNT', 'FORAGE'],
    mats: { raw_meat: 1, basic_herb: 2 },
    type: 'food',
    rarity: 'common',
    buff: { xpBoost: 0.05, duration: 3 },
    desc: 'Comfort stew that boosts XP gain.',
    autoUnlock: true,
  },
  river_fillet: {
    id: 'river_fillet',
    name: 'River Fillet',
    profession: 'cooking',
    tier: 1,
    requiredSkillLevel: 4,
    skillReq: 4,
    sourceActions: ['FISH'],
    mats: { brook_trout: 2, basic_herb: 1 },
    type: 'food',
    rarity: 'common',
    buff: { crit: 0.05, duration: 2 },
    desc: 'Light fish meal that sharpens reflexes.',
  },
  frost_soup: {
    id: 'frost_soup',
    name: 'Frost Soup',
    profession: 'cooking',
    tier: 2,
    requiredSkillLevel: 10,
    skillReq: 10,
    sourceActions: ['FORAGE', 'MINE'],
    mats: { frostbud: 2, iron_ore: 1 },
    type: 'food',
    rarity: 'uncommon',
    buff: { crit: 0.1, duration: 3 },
    desc: 'Chilled soup sharpening focus.',
  },
  lightning_roll: {
    id: 'lightning_roll',
    name: 'Lightning Roll',
    profession: 'cooking',
    tier: 2,
    requiredSkillLevel: 14,
    skillReq: 14,
    sourceActions: ['FISH', 'CHOP'],
    mats: { storm_eel: 1, cedar_wood: 1 },
    type: 'food',
    rarity: 'uncommon',
    buff: { speed: 0.08, duration: 3 },
    desc: 'Crackling eel wrap boosting speed.',
  },
  ember_feast: {
    id: 'ember_feast',
    name: 'Ember Feast',
    profession: 'cooking',
    tier: 3,
    requiredSkillLevel: 20,
    skillReq: 20,
    sourceActions: ['HUNT', 'FORAGE'],
    mats: { raw_meat: 2, emberleaf: 2 },
    type: 'food',
    rarity: 'rare',
    buff: { attack: 0.2, duration: 2, bossOnly: true },
    desc: 'Hunt-ready meal for boss attempts.',
  },
  sky_salad: {
    id: 'sky_salad',
    name: 'Sky Salad',
    profession: 'cooking',
    tier: 4,
    requiredSkillLevel: 35,
    skillReq: 35,
    sourceActions: ['FORAGE', 'HUNT'],
    mats: { crystal_bloom: 1, dragonwood: 1, raw_meat: 1 },
    type: 'food',
    rarity: 'epic',
    buff: { speed: 0.1, dodge: 0.1, duration: 3 },
    desc: 'Light salad with floating herbs.',
  },
  elder_feast: {
    id: 'elder_feast',
    name: 'Elder Feast',
    profession: 'cooking',
    tier: 5,
    requiredSkillLevel: 50,
    skillReq: 50,
    sourceActions: ['BOSS', 'FORAGE'],
    mats: { elderwood: 1, phoenix_herb: 1, dragonite_ore: 1 },
    type: 'food',
    rarity: 'legendary',
    buff: { loot: 0.3, duration: 5 },
    desc: 'Mythic banquet improving loot finds.',
  },

  // =================== ALCHEMY RECIPES ===================
  novice_potion: {
    id: 'novice_potion',
    name: 'Novice Potion',
    profession: 'alchemy',
    tier: 1,
    requiredSkillLevel: 1,
    skillReq: 1,
    sourceActions: ['FORAGE'],
    mats: { basic_herb: 2 },
    type: 'potion',
    rarity: 'common',
    heal: 60,
    desc: 'Simple healing brew.',
    autoUnlock: true,
  },
  resist_elixir: {
    id: 'resist_elixir',
    name: 'Venom Resist Elixir',
    profession: 'alchemy',
    tier: 2,
    requiredSkillLevel: 10,
    skillReq: 10,
    sourceActions: ['HUNT', 'FORAGE'],
    mats: { venom_gland: 1, frostbud: 1 },
    type: 'potion',
    rarity: 'uncommon',
    buff: { defense: 0.08, duration: 3, resist: 'poison' },
    desc: 'Resists toxins for a few battles.',
  },
  elemental_tonic: {
    id: 'elemental_tonic',
    name: 'Elemental Tonic',
    profession: 'alchemy',
    tier: 3,
    requiredSkillLevel: 20,
    skillReq: 20,
    sourceActions: ['FORAGE', 'MINE'],
    mats: { emberleaf: 1, steel_ore: 1 },
    type: 'potion',
    rarity: 'rare',
    buff: { elemental: 8, duration: 3 },
    desc: 'Boosts elemental potency.',
  },
  battle_elixir: {
    id: 'battle_elixir',
    name: 'Battle Elixir',
    profession: 'alchemy',
    tier: 4,
    requiredSkillLevel: 35,
    skillReq: 35,
    sourceActions: ['MINE', 'FORAGE'],
    mats: { mithril_ore: 2, crystal_bloom: 1 },
    type: 'potion',
    rarity: 'epic',
    buff: { attack: 0.15, crit: 0.08, duration: 3 },
    desc: 'Multi-stat combat brew.',
  },
  stormbrew: {
    id: 'stormbrew',
    name: 'Stormbrew Draught',
    profession: 'alchemy',
    tier: 4,
    requiredSkillLevel: 32,
    skillReq: 32,
    sourceActions: ['FISH'],
    mats: { storm_eel: 1, sky_pearl: 1 },
    type: 'potion',
    rarity: 'epic',
    buff: { speed: 0.1, crit: 0.08, duration: 3 },
    desc: 'Bottle storm-touched eel oils for agile strikes.',
  },
  eternal_elixir: {
    id: 'eternal_elixir',
    name: 'Eternal Elixir',
    profession: 'alchemy',
    tier: 5,
    requiredSkillLevel: 50,
    skillReq: 50,
    sourceActions: ['BOSS', 'FORAGE', 'MINE'],
    mats: { phoenix_herb: 1, ancient_essence: 1, dragonite_ore: 1 },
    type: 'potion',
    rarity: 'legendary',
    buff: { attack: 0.2, defense: 0.15, duration: 2, bossOnly: true },
    desc: 'Boss-only draught of legends.',
  },

  // =================== ENCHANTING RECIPES ===================
  minor_glow: {
    id: 'minor_glow',
    name: 'Minor Glow',
    profession: 'enchanting',
    tier: 1,
    requiredSkillLevel: 5,
    skillReq: 5,
    sourceActions: ['MINE', 'FORAGE'],
    mats: { copper_ore: 1, basic_herb: 1 },
    type: 'enchant',
    rarity: 'uncommon',
    desc: 'Adds small random stat.',
    effect: 'small',
  },
  spark_of_renewal: {
    id: 'spark_of_renewal',
    name: 'Spark of Renewal',
    profession: 'enchanting',
    tier: 2,
    requiredSkillLevel: 15,
    skillReq: 15,
    sourceActions: ['MINE', 'FORAGE'],
    mats: { iron_ore: 2, frostbud: 1 },
    type: 'enchant',
    rarity: 'rare',
    desc: 'Reroll stats on a chosen gear item.',
    effect: 'reroll',
  },
  greater_affix: {
    id: 'greater_affix',
    name: 'Greater Affix',
    profession: 'enchanting',
    tier: 3,
    requiredSkillLevel: 25,
    skillReq: 25,
    sourceActions: ['MINE', 'CHOP'],
    mats: { steel_ore: 2, darkwood: 1 },
    type: 'enchant',
    rarity: 'epic',
    desc: 'Adds an affix boosting damage.',
    effect: 'affix',
  },
  mythic_upgrade: {
    id: 'mythic_upgrade',
    name: 'Mythic Upgrade',
    profession: 'enchanting',
    tier: 4,
    requiredSkillLevel: 35,
    skillReq: 35,
    sourceActions: ['MINE', 'FORAGE'],
    mats: { mithril_ore: 3, crystal_bloom: 1 },
    type: 'enchant',
    rarity: 'epic',
    desc: 'Chance to upgrade item rarity.',
    effect: 'upgrade',
  },
  ancient_aegis: {
    id: 'ancient_aegis',
    name: 'Ancient Aegis',
    profession: 'enchanting',
    tier: 5,
    requiredSkillLevel: 42,
    skillReq: 42,
    sourceActions: ['BOSS', 'FORAGE'],
    mats: { ancient_essence: 1, dragonwood: 1 },
    type: 'enchant',
    rarity: 'legendary',
    desc: 'Legendary shield glyph drawn from ancient essence.',
    effect: 'shield',
  },
  cut_ruby: {
    id: 'cut_ruby',
    name: 'Cut Ruby',
    profession: 'enchanting',
    tier: 2,
    requiredSkillLevel: 15,
    skillReq: 15,
    sourceActions: ['MINE', 'CHOP'],
    mats: { iron_ore: 2, cedar_wood: 1 },
    type: 'gem',
    rarity: 'rare',
    desc: 'Cut a ruby for attack sockets.',
    output: { gemId: 'ruby_t1' },
  },
  cut_emerald: {
    id: 'cut_emerald',
    name: 'Cut Emerald',
    profession: 'enchanting',
    tier: 3,
    requiredSkillLevel: 25,
    skillReq: 25,
    sourceActions: ['MINE', 'FORAGE'],
    mats: { steel_ore: 2, emberleaf: 1 },
    type: 'gem',
    rarity: 'epic',
    desc: 'Shape an emerald for crit sockets.',
    output: { gemId: 'emerald_t3' },
  },
  master_rune: {
    id: 'master_rune',
    name: 'Master Rune',
    profession: 'enchanting',
    tier: 5,
    requiredSkillLevel: 50,
    skillReq: 50,
    sourceActions: ['BOSS'],
    mats: { primordial_core: 1, crystal_bloom: 2 },
    type: 'rune',
    rarity: 'legendary',
    desc: 'Creates a powerful rune for sockets.',
    output: { runeId: 'rune_mastery' },
  },

  // =================== DRAGON HANDLING / BONDING RECIPES ===================
  wyrmling_feast: {
    id: 'wyrmling_feast',
    name: 'Wyrmling Feast',
    profession: 'dragonHandling',
    tier: 2,
    requiredSkillLevel: 12,
    skillReq: 12,
    sourceActions: ['HUNT'],
    mats: { raw_meat: 2, alpha_parts: 1 },
    type: 'food',
    rarity: 'uncommon',
    buff: { dragonXp: 20, durationBattles: 3 },
    desc: 'Feed a wyrmling to accelerate growth.',
  },
  drake_treat: {
    id: 'drake_treat',
    name: 'Drake Treat',
    profession: 'dragonBonding',
    tier: 3,
    requiredSkillLevel: 22,
    skillReq: 22,
    sourceActions: ['FORAGE', 'BOSS'],
    mats: { dragonwood: 1, phoenix_herb: 1 },
    type: 'food',
    rarity: 'rare',
    buff: { dragonBond: 0.08, durationBattles: 4 },
    desc: 'Rare treat that deepens dragon bonds.',
  },
  core_catalyst: {
    id: 'core_catalyst',
    name: 'Core Catalyst',
    profession: 'dragonHandling',
    tier: 5,
    requiredSkillLevel: 45,
    skillReq: 45,
    sourceActions: ['WORLD_BOSS', 'BOSS'],
    mats: { primordial_core: 1, ancient_essence: 1 },
    type: 'food',
    rarity: 'legendary',
    buff: { dragonEvolve: true },
    desc: 'Catalyst for evolving a loyal dragon.',
  },
};

const recipeBook = Object.values(recipes).reduce((acc, rec) => {
  if (!acc[rec.profession]) acc[rec.profession] = [];
  acc[rec.profession].push(rec);
  return acc;
}, {});

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
  Warrior: 'rage',
  Mage: 'mana',
  Rogue: 'energy',
  Cleric: 'devotion',
  Ranger: 'focus',
  Paladin: 'devotion',
  Warlock: 'mana',
};

const resourceRules = {
  rage: { max: 100, start: 0, gainOnHit: 10, gainOnAttack: 6 },
  energy: { max: 100, start: 80, regen: 15 },
  mana: { max: 120, start: 100, regen: 10 },
  focus: { max: 100, start: 0, regen: 5, gainOnAttack: 12 },
  devotion: { max: 110, start: 30, regen: 6, gainOnHeal: 12 },
  chi: { max: 100, start: 50, regen: 8 },
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
    requiredLevel: 1,
    gateBossId: null,
    level: 1,
    recommendedLevel: 1,
    allowedMaterialTiers: [1],
    element: 'nature',
    enemies: [
      { name: 'Wildling', tag: 'humanoid', hp: 55, attack: 8, defense: 2, xp: 14, gold: 8 },
      { name: 'Forest Wolf', tag: 'beast', hp: 50, attack: 9, defense: 2, xp: 12, gold: 7 },
    ],
    boss: { id: 'boss_verdant_alpha', name: 'Verdant Alpha', tag: 'beast', hp: 120, attack: 16, defense: 5, xp: 48, gold: 25, boss: true, powerRating: 70 }
  },
  {
    id: 2,
    name: 'Frostmarch',
    requiredLevel: 5,
    gateBossId: 'boss_verdant_alpha',
    level: 5,
    recommendedLevel: 5,
    allowedMaterialTiers: [1, 2],
    element: 'frost',
    enemies: [
      { name: 'Frost Imp', tag: 'elemental', hp: 85, attack: 13, defense: 6, xp: 22, gold: 13 },
      { name: 'Bandit Scout', tag: 'humanoid', hp: 75, attack: 15, defense: 4, xp: 20, gold: 12 },
    ],
    boss: { id: 'boss_prismatic_elemental', name: 'Prismatic Elemental', tag: 'elemental', hp: 190, attack: 24, defense: 8, xp: 82, gold: 45, boss: true, powerRating: 110 }
  },
  {
    id: 3,
    name: 'Cinderpeak',
    requiredLevel: 10,
    gateBossId: 'boss_prismatic_elemental',
    level: 10,
    recommendedLevel: 10,
    allowedMaterialTiers: [2],
    element: 'fire',
    enemies: [
      { name: 'Cinder Whelp', tag: 'dragon', hp: 110, attack: 17, defense: 8, xp: 34, gold: 20 },
      { name: 'Ash Stalker', tag: 'beast', hp: 105, attack: 18, defense: 7, xp: 32, gold: 19 },
    ],
    boss: { id: 'boss_ashen_tyrant', name: 'Ashen Tyrant', tag: 'dragon', hp: 240, attack: 30, defense: 12, xp: 120, gold: 70, boss: true, powerRating: 150 }
  },
  {
    id: 4,
    name: 'Ironhaven',
    requiredLevel: 15,
    gateBossId: 'boss_ashen_tyrant',
    level: 15,
    recommendedLevel: 15,
    allowedMaterialTiers: [2, 3],
    element: 'earth',
    enemies: [
      { name: 'Steel Golem', tag: 'construct', hp: 150, attack: 21, defense: 11, xp: 48, gold: 28 },
      { name: 'Rogue Knight', tag: 'humanoid', hp: 145, attack: 22, defense: 10, xp: 46, gold: 27 },
    ],
    boss: { id: 'boss_iron_colossus', name: 'Iron Colossus', tag: 'construct', hp: 300, attack: 34, defense: 14, xp: 150, gold: 90, boss: true, powerRating: 190 }
  },
  {
    id: 5,
    name: 'Stormreach',
    requiredLevel: 22,
    gateBossId: 'boss_iron_colossus',
    level: 22,
    recommendedLevel: 22,
    allowedMaterialTiers: [3, 4],
    element: 'storm',
    enemies: [
      { name: 'Sky Raider', tag: 'humanoid', hp: 175, attack: 24, defense: 12, xp: 60, gold: 32 },
      { name: 'Storm Drake', tag: 'dragon', hp: 185, attack: 25, defense: 12, xp: 64, gold: 34 },
    ],
    boss: { id: 'boss_tempest_guardian', name: 'Tempest Guardian', tag: 'elemental', hp: 360, attack: 40, defense: 16, xp: 210, gold: 130, boss: true, powerRating: 230 }
  },
  {
    id: 6,
    name: 'Umbravale',
    requiredLevel: 30,
    gateBossId: 'boss_tempest_guardian',
    level: 30,
    recommendedLevel: 30,
    allowedMaterialTiers: [4, 5],
    element: 'shadow',
    enemies: [
      { name: 'Shadowstalker', tag: 'undead', hp: 205, attack: 27, defense: 13, xp: 78, gold: 40 },
      { name: 'Night Wraith', tag: 'undead', hp: 215, attack: 28, defense: 14, xp: 82, gold: 42 },
    ],
    boss: { id: 'boss_umbra_sovereign', name: 'Umbra Sovereign', tag: 'undead', hp: 420, attack: 46, defense: 18, xp: 260, gold: 150, boss: true, powerRating: 270 }
  },
  {
    id: 7,
    name: 'Everscourge',
    requiredLevel: 40,
    gateBossId: 'boss_umbra_sovereign',
    level: 40,
    recommendedLevel: 40,
    allowedMaterialTiers: [5],
    element: 'shadow',
    enemies: [
      { name: 'Rotfiend', tag: 'undead', hp: 235, attack: 30, defense: 15, xp: 96, gold: 48 },
      { name: 'Bone Colossus', tag: 'undead', hp: 260, attack: 32, defense: 16, xp: 110, gold: 52 },
    ],
    boss: { id: 'boss_eternal_devourer', name: 'Eternal Devourer', tag: 'boss', hp: 520, attack: 50, defense: 20, xp: 320, gold: 200, boss: true, powerRating: 320 }
  },
];

const ACTIONS = {
  HUNT: { id: 'HUNT', label: 'Hunt', baseCooldownMs: 60 * 1000 },
  CHOP: { id: 'CHOP', label: 'Chop Wood', baseCooldownMs: 120 * 1000 },
  MINE: { id: 'MINE', label: 'Mine Ore', baseCooldownMs: 120 * 1000 },
  FISH: { id: 'FISH', label: 'Fish', baseCooldownMs: 120 * 1000 },
  FORAGE: { id: 'FORAGE', label: 'Forage', baseCooldownMs: 120 * 1000 },
  HUNT_JOB: { id: 'HUNT_JOB', label: 'Hunt Materials', baseCooldownMs: 120 * 1000 },
  COOK: { id: 'COOK', label: 'Cook', baseCooldownMs: 5 * 60 * 1000 },
  BREW: { id: 'BREW', label: 'Brew', baseCooldownMs: 5 * 60 * 1000 },
  ENCHANT: { id: 'ENCHANT', label: 'Enchant', baseCooldownMs: 10 * 60 * 1000 },
  REFINE: { id: 'REFINE', label: 'Refine', baseCooldownMs: 5 * 60 * 1000 },
  SMITH: { id: 'SMITH', label: 'Forge', baseCooldownMs: 5 * 60 * 1000 },
  HANDLE: { id: 'HANDLE', label: 'Handle Dragon', baseCooldownMs: 6 * 60 * 1000 },
  BOND: { id: 'BOND', label: 'Bond Dragon', baseCooldownMs: 6 * 60 * 1000 },
  TRADE: { id: 'TRADE', label: 'Trade', baseCooldownMs: 4 * 60 * 1000 },
  FIGHT: { id: 'FIGHT', label: 'Fight', baseCooldownMs: 30 * 1000 },
  AUTO_BATTLE: { id: 'AUTO_BATTLE', label: 'Auto Battle', baseCooldownMs: 15 * 1000 },
  ADVENTURE: { id: 'ADVENTURE', label: 'Adventure', baseCooldownMs: 10 * 60 * 1000 },
  WORK: { id: 'WORK', label: 'Work Job', baseCooldownMs: 60 * 60 * 1000 },
  TRAIN: { id: 'TRAIN', label: 'Train', baseCooldownMs: 45 * 60 * 1000 },
  STUDY: { id: 'STUDY', label: 'Study', baseCooldownMs: 30 * 60 * 1000 },
  SCOUT: { id: 'SCOUT', label: 'Scout', baseCooldownMs: 20 * 60 * 1000 },
  DUNGEON: { id: 'DUNGEON', label: 'Dungeon', baseCooldownMs: 60 * 60 * 1000 },
  MINIBOSS: { id: 'MINIBOSS', label: 'Miniboss', baseCooldownMs: 2 * 60 * 60 * 1000 },
  BOSS: { id: 'BOSS', label: 'Boss', baseCooldownMs: 4 * 60 * 60 * 1000 },
  WORLD_BOSS: { id: 'WORLD_BOSS', label: 'World Boss', baseCooldownMs: 24 * 60 * 60 * 1000 },
  TOWER: { id: 'TOWER', label: 'Tower Run', baseCooldownMs: 30 * 60 * 1000 },
  TRAVEL_ZONE: { id: 'TRAVEL_ZONE', label: 'Travel Zone', baseCooldownMs: 20 * 60 * 1000 },
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

const dungeonCatalog = [
  { id: 'verdant-mini', zone: 1, name: 'Verdant Burrow', waves: [{ difficulty: 1 }, { difficulty: 1.05 }, { difficulty: 1.1, boss: true }], recommendedLevel: 4, loot: 'Early mats and ore.' },
  { id: 'frost-hollow', zone: 2, name: 'Frost Hollow', waves: [{ difficulty: 1.1 }, { difficulty: 1.2 }, { difficulty: 1.3, boss: true }], recommendedLevel: 8, loot: 'Frost herbs, iron, and chests.' },
  { id: 'cinder-forge', zone: 3, name: 'Cinder Forge', waves: [{ difficulty: 1.2 }, { difficulty: 1.35 }, { difficulty: 1.5, boss: true }], recommendedLevel: 14, loot: 'Emberleaf, venom, steel ore.' },
  { id: 'ironhaven-depths', zone: 4, name: 'Ironhaven Depths', waves: [{ difficulty: 1.3 }, { difficulty: 1.45 }, { difficulty: 1.6, boss: true }], recommendedLevel: 18, loot: 'Darkwood, mithril scraps, gems.' },
  { id: 'stormreach-keep', zone: 5, name: 'Stormreach Keep', waves: [{ difficulty: 1.4 }, { difficulty: 1.6 }, { difficulty: 1.8, boss: true }], recommendedLevel: 24, loot: 'Sky pearls, alpha parts, runes.' },
  { id: 'umbra-depths', zone: 6, name: 'Umbral Sanctum', waves: [{ difficulty: 1.55 }, { difficulty: 1.75 }, { difficulty: 2, boss: true }], recommendedLevel: 32, loot: 'Crystal bloom, ancient essence.' },
  { id: 'everscourge-core', zone: 7, name: 'Everscourge Core', waves: [{ difficulty: 1.8 }, { difficulty: 2 }, { difficulty: 2.2, boss: true }], recommendedLevel: 42, loot: 'Primordial cores, dragonite.' },
];

const jobCatalog = [
  { id: 'work', action: 'WORK', label: 'Work', desc: 'Earn gold through odd jobs.', gold: lvl => 30 + lvl * 6, xp: lvl => Math.round(10 + lvl * 1.5) },
  { id: 'train', action: 'TRAIN', label: 'Train', desc: 'Improve core combat stats slowly.', stat: 'attack', bonus: 1, xp: lvl => Math.round(8 + lvl), permanent: true },
  { id: 'study', action: 'STUDY', label: 'Study', desc: 'Gain life skill XP.', lifeSkill: 'alchemy', xpReward: 18 },
  { id: 'scout', action: 'SCOUT', label: 'Scout', desc: 'Survey for treasure maps and mats.', loot: true, gold: () => 15, xp: () => 12 },
];

const questTemplates = {
  daily: [
    { id: 'daily-hunt', name: 'Hunt 5 foes', target: 5, type: 'combat', reward: { gold: 35, xp: 25 } },
    { id: 'daily-mine', name: 'Mine 3 nodes', target: 3, type: 'gather_mining', reward: { materials: { copper_ore: 2, iron_ore: 1 } } },
  ],
  weekly: [
    { id: 'weekly-dungeon', name: 'Clear 2 dungeons', target: 2, type: 'dungeon', reward: { chest: 'gold_chest' } },
    { id: 'weekly-boss', name: 'Defeat 3 bosses', target: 3, type: 'boss', reward: { materials: { dragonite_ore: 1 } } },
  ],
  zone: [
    { id: 'zone-2', name: 'Verdantwild Sweep', zone: 1, target: 15, type: 'combat', reward: { recipe: 'iron_blade' } },
    { id: 'zone-5', name: 'Stormreach Hunter', zone: 5, target: 20, type: 'combat', reward: { materials: { storm_eel: 2 } } },
  ],
};

const chestTypes = {
  wood_chest: { id: 'wood_chest', name: 'Wood Chest', rarity: 'common', gearTier: 1, mats: 2 },
  iron_chest: { id: 'iron_chest', name: 'Iron Chest', rarity: 'uncommon', gearTier: 2, mats: 3 },
  gold_chest: { id: 'gold_chest', name: 'Gold Chest', rarity: 'rare', gearTier: 3, mats: 4 },
  epic_chest: { id: 'epic_chest', name: 'Epic Chest', rarity: 'epic', gearTier: 4, mats: 5 },
};

const towerConfig = { baseDifficulty: 1.15, maxFloors: 50 };

const worldBossConfig = {
  id: 'world-hydra',
  name: 'World Hydra',
  desc: 'A colossal beast that resurfaces rarely.',
  difficulty: 2.5,
  levelReq: 25,
  loot: 'Legendary gear, eggs, gems',
};

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
normalizeSkillCosts();

function normalizeSkillCosts() {
  Object.values(skillTrees).forEach(branches => {
    branches.forEach(branch => {
      branch.skills.forEach(skill => {
        let target = skill.cost || 1;
        const pctMatch = skill.desc && skill.desc.match(/([0-9]+)%/);
        if (pctMatch) {
          const pctVal = Number(pctMatch[1]);
          target = Math.max(target, Math.ceil(pctVal / 6));
        }
        const flatMatch = skill.desc && skill.desc.match(/\+(\d+)/);
        if (flatMatch) {
          const flatVal = Number(flatMatch[1]);
          target = Math.max(target, Math.ceil(flatVal / 12));
        }
        skill.cost = Math.max(1, target);
      });
    });
  });
}

const state = {
  player: null,
  inventory: [],
  eggs: [],
  dragons: [],
  activeDragon: null,
  currentZone: 0,
  unlockedZones: 1,
  defeatedBossIds: [],
  currentEnemy: null,
  log: [],
  shop: [],
  filters: { slot: 'all', rarity: 'all', type: 'all', minRarity: 'common' },
  fusionFilters: { slot: 'all', tier: 'all', rarity: 'all' },
  prestige: 0,
  lifeSkills: {},
  materials: {},
  materialHistory: {},
  recipeUnlocks: {},
  foodBuff: null,
  selectedLifeSkill: 'mining',
  socketSelection: null,
  actionCooldowns: {},
  dungeonRun: null,
  questProgress: { daily: {}, weekly: {}, zone: {} },
  chests: {},
  tower: { floor: 1, best: 1 },
  worldBoss: { lastClear: 0 },
  history: { combat: [], dungeon: [], loot: [] },
  ascension: { count: 0, points: 0 },
  shopRefresh: 0,
  ui: { navOpen: false, mobileActive: false, autoMobile: false },
};

const gameState = state;

function createPlayer(cls) {
  const base = classData[cls];
  const player = {
    name: 'Adventurer',
    class: cls,
    baseStats: { ...base },
    level: 1,
    xp: 0,
    xpToNext: xpToNextLevel(1),
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
    resources: {},
  };
  ensureResources(player);
  return player;
}

function ensureModifierDefaults(player) {
  const defaults = { attack: 0, defense: 0, hp: 0, crit: 0, critdmg: 0, doubleHit: 0, dodge: 0, poison: 0, heal: 0, vsUndead: 0, vsBeast: 0, xpBoost: 0, lootBoost: 0, bossResist: 0, healAfterBoss: 0, lifesteal: 0,
    regen: 0, thorns: 0, potionBoost: 0, goldBoost: 0, barrier: 0, eggBoost: 0, dragonBond: 0, spellAmp: 0, fury: 0, bleed: 0, shred: 0 };
  player.modifiers = { ...defaults, accuracy: 0, fire: 0, frost: 0, shadow: 0, fireRes: 0, frostRes: 0, shadowRes: 0, cooldownReduction: 0, bossDamage: 0, dungeonDamage: 0, autoBattle: 0, ...(player.modifiers || {}) };
  player.flat = { speed: 0, elemental: 0, hp: 0, attack: 0, ...(player.flat || {}) };
  ensureResources(player);
  const asc = state.ascension?.bonuses || {};
  if (asc.attackPct) player.modifiers.attack += asc.attackPct;
  if (asc.hpPct) player.modifiers.hp += asc.hpPct;
  if (asc.critPct) player.modifiers.crit += asc.critPct;
  if (asc.drop) player.modifiers.lootBoost += asc.drop;
  if (asc.egg) player.modifiers.eggBoost += asc.egg;
  if (asc.regen) player.modifiers.regen += asc.regen / 100;
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
  ensureMetaSystems();
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

function ensureMetaSystems() {
  if (!state.questProgress) state.questProgress = { daily: {}, weekly: {}, zone: {} };
  ['daily', 'weekly', 'zone'].forEach(type => {
    questTemplates[type].forEach(q => {
      if (!state.questProgress[type][q.id]) state.questProgress[type][q.id] = { progress: 0, completed: false, claimed: false };
    });
  });
  if (!state.chests) state.chests = {};
  Object.keys(chestTypes).forEach(id => { if (!state.chests[id]) state.chests[id] = 0; });
  if (!state.tower) state.tower = { floor: 1, best: 1 };
  if (!state.worldBoss) state.worldBoss = { lastClear: 0 };
  if (!state.history) state.history = { combat: [], dungeon: [], loot: [] };
  if (!state.ascension) state.ascension = { count: 0, points: 0 };
  if (!state.shopRefresh) state.shopRefresh = 0;
  if (!state.defeatedBossIds) state.defeatedBossIds = [];
}

function hasDefeatedBoss(bossId) {
  if (!bossId) return true;
  return (state.defeatedBossIds || []).includes(bossId);
}

function getZoneRequiredLevel(zone) {
  if (!zone) return 1;
  return zone.requiredLevel || zone.level || zone.recommendedLevel || 1;
}

function isZoneUnlocked(zoneIndex, player = state.player) {
  const zone = zones[zoneIndex];
  if (!zone || !player) return false;
  const requiredLevel = getZoneRequiredLevel(zone);
  if (player.level < requiredLevel) return false;
  if (zone.gateBossId && !hasDefeatedBoss(zone.gateBossId)) return false;
  return true;
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

function resourceKeyForPlayer(player = state.player) {
  return classResources[player?.class] || 'mana';
}

function ensureResources(player = state.player) {
  if (!player) return;
  if (!player.resources) player.resources = {};
  const key = resourceKeyForPlayer(player);
  const rule = resourceRules[key] || { max: 100, start: 0 };
  if (!player.resources[key]) player.resources[key] = { current: rule.start ?? rule.max, max: rule.max };
  const res = player.resources[key];
  res.max = rule.max;
  if (res.current == null) res.current = rule.start ?? rule.max;
  player.maxResource = res.max;
  player.currentResource = res.current;
  player.maxRage = rule.max;
  if (key === 'rage') player.rage = res.current;
}

function getResourceState(player = state.player) {
  ensureResources(player);
  const key = resourceKeyForPlayer(player);
  return { key, state: player.resources[key] };
}

function usesRage(player = state.player) {
  return resourceKeyForPlayer(player) === 'rage';
}

function formatResourceName(key) {
  return (key || '').charAt(0).toUpperCase() + (key || '').slice(1);
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
  addResourceAmount(state.player, 'rage', amount);
}

function spendRage(amount) {
  return spendResourceAmount(state.player, 'rage', amount);
}

function addResourceAmount(player, key, amount) {
  if (!player || !key) return;
  ensureResources(player);
  const res = player.resources[key];
  const rule = resourceRules[key] || {};
  res.current = Math.max(0, Math.min(res.max, res.current + amount));
  if (key === 'rage') player.rage = res.current;
  player.currentResource = res.current;
  player.maxResource = res.max;
  if (key === 'rage') updateRageBar(player);
}

function spendResourceAmount(player, key, amount) {
  if (!player || !key) return true;
  ensureResources(player);
  const res = player.resources[key];
  if (res.current < amount) return false;
  res.current = Math.max(0, res.current - amount);
  if (key === 'rage') player.rage = res.current;
  player.currentResource = res.current;
  player.maxResource = res.max;
  if (key === 'rage') updateRageBar(player);
  return true;
}

function weightedRarity(input = {}) {
  const opts = typeof input === 'boolean' ? { isBoss: input } : input || {};
  const isBoss = !!opts.isBoss;
  const zoneId = opts.zoneId ?? state.currentZone;
  const playerLevel = opts.playerLevel ?? (state.player?.level || 1);
  const zoneWeights = zoneRarityWeights[zoneId] || null;
  const weights = {};
  rarities.forEach(r => {
    let weight = zoneWeights ? zoneWeights[r.key] || 0 : r.weight;
    if (playerLevel < 20) {
      if (r.key === 'common') weight *= 1.15;
      if (r.key === 'uncommon') weight *= 1.1;
    }
    if (isBoss) weight *= 1.25;
    weights[r.key] = weight;
  });
  const totalWeight = Object.values(weights).reduce((t, w) => t + w, 0) || 1;
  let roll = Math.random() * totalWeight;
  for (const r of rarities) {
    roll -= weights[r.key];
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
  const zoneElem = zones[state.currentZone]?.element || 'physical';
  const gearTier = Math.max(1, Math.min(5, Math.ceil(level / 10)));
  return { id: crypto.randomUUID(), type: 'gear', name, slot, rarity: rarity.key, stats, levelReq: Math.max(1, Math.floor(level * 0.8)), power: stats.reduce((t, s) => t + s.value, 0), sockets: socketsFromRarity(rarity.key), gems: [], gearTier, enhancementLevel: 0, maxEnhancementLevel: 10, element: zoneElem };
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

function ensureItemMeta(item) {
  if (!item) return item;
  if (item.enhancementLevel === undefined) item.enhancementLevel = 0;
  if (!item.maxEnhancementLevel) item.maxEnhancementLevel = 10;
  if (!item.gearTier) item.gearTier = Math.max(1, Math.min(5, Math.ceil((item.levelReq || 1) / 10)));
  if (!item.element) item.element = 'physical';
  if (!item.gems) item.gems = [];
  return item;
}

function getEnhancementMultiplier(item) {
  const lvl = item?.enhancementLevel || 0;
  return 1 + lvl * 0.05;
}

function applyBonuses(baseStats, player) {
  const prestigeBonus = 1 + (state.prestige || 0) * 0.03;
  const gearStats = { hp: 0, attack: 0, defense: 0, crit: 0, critdmg: 0, speed: 0, elemental: 0 };
  const gemFlat = { attackPct: 0, defensePct: 0, hpPct: 0, loot: 0, lifesteal: 0 };
  let element = 'physical';
  Object.values(player.equipment).forEach(item => {
    if (!item) return;
    ensureItemMeta(item);
    const mult = getEnhancementMultiplier(item);
    if (item.element && element === 'physical') element = item.element;
    item.stats.forEach(s => { gearStats[s.key] = (gearStats[s.key] || 0) + Math.round(s.value * mult); });
    const socketStats = aggregateSockets(item);
    ['hp', 'attack', 'defense', 'crit', 'critdmg', 'speed', 'elemental'].forEach(k => { gearStats[k] = (gearStats[k] || 0) + (socketStats[k] || 0); });
    Object.keys(gemFlat).forEach(k => { gemFlat[k] = (gemFlat[k] || 0) + (socketStats[k] || 0); });
  });
  const dragonFactor = 1 + (player.modifiers.dragonBond || 0) + ((state.lifeSkills.dragonBonding ? state.lifeSkills.dragonBonding.level : 0) * 0.01);
  const dragonStats = state.activeDragon ? Object.fromEntries(Object.entries(state.activeDragon.bonus).map(([k, v]) => [k, Math.round(v * dragonFactor)])) : {};
  if (element === 'physical' && state.activeDragon?.element) element = state.activeDragon.element;
  if (element === 'physical' && zones[state.currentZone]?.element) element = zones[state.currentZone].element;
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
    element: element || 'physical',
    lootBuff: foodLoot + (gemFlat.loot || 0),
    lifesteal: gemFlat.lifesteal || 0,
  };
}

function pickEnemy(zone, boss = false) {
  const choice = boss ? zone.boss : zone.enemies[Math.floor(Math.random() * zone.enemies.length)];
  const scaledHP = Math.round(choice.hp * ENEMY_SCALE);
  const scaledAttack = Math.round(choice.attack * ENEMY_SCALE * ENEMY_ATTACK_MOD);
  return { ...choice, hp: scaledHP, attack: scaledAttack, currentHP: scaledHP, element: choice.element || zone.element || 'physical' };
}

function performEpicAction(actionId) {
  const action = epicActions.find(a => a.id === actionId);
  if (!action) return;
  const cd = getActionCooldownState(action.cooldownId || actionId);
  if (!cd.ready) { logMessage('Action is on cooldown.'); return; }
  if (!isZoneUnlocked(state.currentZone)) { logMessage(zoneRequirements(zones[state.currentZone], state.player, false)); return; }
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
    performLifeAction(action.skill, base, { skipLifeProgress: true });
  } else if (action.type === 'job') {
    startActionCooldown(action.cooldownId || actionId);
    const goldEarned = Math.round(30 + state.player.level * 4);
    const xpEarned = Math.round(state.player.xpToNext * 0.15);
    state.player.gold += goldEarned;
    grantPlayerXP(xpEarned);
    logMessage(`You complete a job for ${goldEarned} gold and ${xpEarned} XP.`);
    updateAll();
  }
  updateEpicActionTimers();
}

function logMessage(msg, css) {
  state.log.unshift({ msg, css });
  if (state.log.length > MAX_COMBAT_LOG_ENTRIES) state.log = state.log.slice(0, MAX_COMBAT_LOG_ENTRIES);
  const logBox = document.getElementById('combat-log');
  if (logBox) {
    logBox.innerHTML = state.log
      .slice(0, MAX_COMBAT_LOG_ENTRIES)
      .map(line => `<div class="${line.css || ''}">${line.msg}</div>`)
      .join('');
  }
}

function recordHistory(type, msg) {
  if (!state.history[type]) state.history[type] = [];
  state.history[type].unshift({ msg, at: Date.now() });
  state.history[type] = state.history[type].slice(0, 25);
}

function progressQuest(kind, amount = 1, zoneId = state.currentZone) {
  ['daily', 'weekly', 'zone'].forEach(type => {
    questTemplates[type].forEach(q => {
      const entry = state.questProgress[type][q.id];
      if (!entry || entry.completed) return;
      if (q.type === kind && (!q.zone || q.zone === zoneId)) {
        entry.progress = Math.min(q.target, (entry.progress || 0) + amount);
        if (entry.progress >= q.target) entry.completed = true;
      }
    });
  });
}

function claimQuestReward(type, id) {
  const entry = state.questProgress[type][id];
  const q = questTemplates[type].find(x => x.id === id);
  if (!entry || !q || !entry.completed || entry.claimed) return;
  const reward = q.reward || {};
  if (reward.gold) state.player.gold += reward.gold;
  if (reward.xp) grantPlayerXP(reward.xp);
  if (reward.materials) Object.entries(reward.materials).forEach(([mat, qty]) => addMaterial(mat, qty));
  if (reward.recipe) state.recipeUnlocks[reward.recipe] = true;
  if (reward.chest) state.chests[reward.chest] = (state.chests[reward.chest] || 0) + 1;
  entry.claimed = true;
  logMessage(`Claimed quest: ${q.name}`);
  recordHistory('loot', `Quest reward from ${q.name}`);
  updateAll();
}

function startDungeonRun(zoneId) {
  const config = dungeonCatalog.find(d => d.zone === zoneId);
  if (!config) { logMessage('No dungeon available here.'); return; }
  const cd = getActionCooldownState('DUNGEON');
  if (!cd.ready) { logMessage(`Dungeon on cooldown (${formatCooldown(cd.remaining)}).`); return; }
  if (CombatSystem.active) { logMessage('Finish your current battle first.'); return; }
  startActionCooldown('DUNGEON');
  state.dungeonRun = { config, waveIndex: 0 };
  logMessage(`You enter ${config.name}.`);
  recordHistory('dungeon', `Started ${config.name}`);
  continueDungeonWave();
}

function continueDungeonWave() {
  if (!state.dungeonRun) return;
  const { config, waveIndex } = state.dungeonRun;
  if (waveIndex >= config.waves.length) {
    logMessage(`${config.name} cleared!`);
    recordHistory('dungeon', `Cleared ${config.name}`);
    progressQuest('dungeon', 1, config.zone);
    state.dungeonRun = null;
    updateAll();
    return;
  }
  const wave = config.waves[waveIndex];
  state.dungeonRun.waveIndex += 1;
  startFight(false, false, { skipFightCooldown: true, difficulty: wave.difficulty || 1, treatAsBoss: !!wave.boss, mode: 'dungeon', noUnlock: true });
}

function startWorldBoss() {
  const ready = getActionCooldownState('WORLD_BOSS');
  if (!ready.ready) { logMessage(`World boss ready in ${formatCooldown(ready.remaining)}.`); return; }
  if (state.player.level < worldBossConfig.levelReq) { logMessage(`Requires level ${worldBossConfig.levelReq}.`); return; }
  if (CombatSystem.active) { logMessage('Finish your current battle first.'); return; }
  startActionCooldown('WORLD_BOSS');
  startFight(true, false, { skipFightCooldown: true, difficulty: worldBossConfig.difficulty, treatAsBoss: true, mode: 'boss', noUnlock: true });
  logMessage(`You challenge the ${worldBossConfig.name}!`);
}

function startTowerRun() {
  const ready = getActionCooldownState('TOWER');
  if (!ready.ready) { logMessage(`Tower run ready in ${formatCooldown(ready.remaining)}.`); return; }
  if (CombatSystem.active) { logMessage('Finish your current battle first.'); return; }
  startActionCooldown('TOWER');
  const floor = (state.tower.floor || 1);
  const difficulty = Math.min(3, 1 + (floor - 1) * (towerConfig.baseDifficulty - 1));
  state.tower.active = true;
  startFight(false, false, { skipFightCooldown: true, difficulty, mode: 'tower', noUnlock: true });
  logMessage(`Climbing tower floor ${floor}...`);
}

function finishTowerRun(victory) {
  if (!state.tower.active) return;
  if (victory) {
    state.tower.best = Math.max(state.tower.best || 1, state.tower.floor || 1);
    state.tower.floor = (state.tower.floor || 1) + 1;
    recordHistory('dungeon', `Tower floor ${state.tower.floor - 1} cleared`);
  } else {
    state.tower.floor = Math.max(1, state.tower.floor - 1);
  }
  state.tower.active = false;
}

function performJob(jobId) {
  const job = jobCatalog.find(j => j.id === jobId);
  if (!job) return;
  const cd = getActionCooldownState(job.action);
  if (!cd.ready) { logMessage(`Job on cooldown (${formatCooldown(cd.remaining)}).`); return; }
  startActionCooldown(job.action);
  const lvl = state.player.level;
  if (job.gold) state.player.gold += typeof job.gold === 'function' ? job.gold(lvl) : job.gold;
  if (job.xp) grantPlayerXP(typeof job.xp === 'function' ? job.xp(lvl) : job.xp);
  if (job.lifeSkill) gainLifeSkillXP(job.lifeSkill, job.xpReward || 12);
  if (job.stat && job.permanent) state.player.baseStats[job.stat] = (state.player.baseStats[job.stat] || 0) + (job.bonus || 1);
  if (job.loot) {
    const mat = materialCatalog.find(m => m.tier === zones[state.currentZone].allowedMaterialTiers[0]);
    if (mat) addMaterial(mat.id, 1);
  }
  logMessage(`${job.label} complete.`);
  progressQuest('job', 1, zones[state.currentZone]?.id);
  updateAll();
}

function openChest(chestId) {
  const chest = chestTypes[chestId];
  if (!chest || (state.chests[chestId] || 0) <= 0) { logMessage('No chest to open.'); return; }
  state.chests[chestId] -= 1;
  const tier = Math.min(5, chest.gearTier || 1);
  const item = generateItem(state.player.level + tier, tier >= 4);
  const matPool = materialCatalog.filter(m => m.tier <= tier);
  if (matPool.length) {
    const mat = matPool[Math.floor(Math.random() * matPool.length)];
    addMaterial(mat.id, chest.mats || 1);
  }
  state.inventory.push(item);
  logMessage(`Opened ${chest.name} and found ${item.name}.`);
  recordHistory('loot', `Opened ${chest.name}`);
  progressQuest('chest', 1, zones[state.currentZone]?.id);
  updateAll();
}

const CombatSystem = {
  active: false,
  battle: null,
  usesRageResource() {
    return usesRage(this.battle?.player);
  },
  startBattle({ player, enemy, isBoss, zone, zoneMod, auto, options }) {
    ensureModifierDefaults(player);
    this.active = true;
    this.battle = {
      player,
      enemy,
      isBoss,
      zone,
      zoneMod,
      auto,
      options,
      turn: 'player',
      playerStatuses: [],
      enemyStatuses: [],
      skillCooldowns: {},
    };
    this.turn = 'player';
    ensureResources(player);
    const { key, state: resState } = getResourceState(player);
    const rule = resourceRules[key] || {};
    resState.max = rule.max || resState.max;
    resState.current = rule.start ?? (key === 'rage' ? 0 : resState.max);
    player.currentResource = resState.current;
    player.maxResource = resState.max;
    if (key === 'rage') player.rage = resState.current;
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
      const { key, state: resState } = getResourceState(entity);
      const rule = resourceRules[key] || {};
      if (rule.regen) addResourceAmount(entity, key, rule.regen);
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
    const { key: resKey } = getResourceState(this.battle.player);
    if (type === 'heal') {
      const healed = consumeCombatHeal();
      if (!healed) return false;
    } else if (type === 'skill') {
      const skill = activeSkills[this.battle.player.class].find(s => s.id === skillId);
      if (!this.canUseSkill(skill)) return false;
      if (!spendResourceAmount(this.battle.player, resKey, skill.cost)) { this.log('Not enough resources.', false, 'status'); return false; }
      this.battle.skillCooldowns[skill.id] = skill.cooldown;
      this.log(`You use ${skill.name}.`, false, 'status');
      skill.action({ player: this.battle.player, enemy: this.battle.enemy, playerStats, enemyStats, isBoss: this.battle.isBoss });
      const gainAfterSkill = resourceRules[resKey]?.gainOnAttack || 0;
      if (gainAfterSkill) addResourceAmount(this.battle.player, resKey, gainAfterSkill / 2);
      if (resourceRules[resKey]?.gainOnHeal && skill.tags?.includes('heal')) addResourceAmount(this.battle.player, resKey, resourceRules[resKey].gainOnHeal);
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
      const gain = resourceRules[resKey]?.gainOnAttack;
      if (gain) addResourceAmount(this.battle.player, resKey, gain);
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
        const { key } = getResourceState(player);
        const gain = resourceRules[key]?.gainOnHit;
        if (gain) addResourceAmount(player, key, Math.max(gain, Math.round(taken * 0.05)));
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
      element: enemy.element || this.battle.zone?.element || 'physical',
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
    const elementMult = getElementMultiplier(attacker.element || 'physical', defender.element || 'physical');
    damage = Math.round(damage * elementMult);
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
    wrap.className = 'skill-bar';
    activeSkills[this.battle.player.class].forEach(skill => {
      const btn = document.createElement('button');
      btn.className = 'skill-btn skill-slot';
      btn.id = `skill-${skill.id}`;
      btn.type = 'button';
      btn.innerHTML = `
        <div class="skill-icon" title="${skill.description || ''}">${skill.name.charAt(0)}</div>
        <div class="skill-meta">${skill.cost} ${formatResourceName(classResources[this.battle.player.class])}</div>
        <div class="cooldown"></div>
        <div class="cooldown-overlay"></div>
        <div class="skill-label">${skill.name}</div>`;
      btn.addEventListener('click', () => this.playerAction('skill', skill.id));
      wrap.appendChild(btn);
    });
    syncCombatActionBar();
  },
  canUseSkill(skill) {
    if (!skill) return false;
    const cd = this.battle.skillCooldowns[skill.id] || 0;
    if (cd > 0) return false;
    const { key, state: resState } = getResourceState(this.battle.player);
    return resState.current >= skill.cost;
  },
  updateActionButtons() {
    if (!this.battle) {
      const attackBtn = document.getElementById('attack-btn');
      if (attackBtn) attackBtn.disabled = true;
      const healBtn = document.getElementById('heal-btn');
      if (healBtn) healBtn.disabled = true;
      document.querySelectorAll('#skill-actions button').forEach(btn => btn.disabled = true);
      return;
    }
    const attackBtn = document.getElementById('attack-btn');
    attackBtn.disabled = !this.active || this.turn !== 'player';
    const healBtn = document.getElementById('heal-btn');
    if (healBtn) healBtn.disabled = !this.active || this.turn !== 'player' || !hasHealingItem();
    const { key: resKey, state: resState } = getResourceState(this.battle.player);
    activeSkills[this.battle.player.class].forEach(skill => {
      const btn = document.getElementById(`skill-${skill.id}`);
      if (!btn) return;
      const cd = this.battle.skillCooldowns[skill.id] || 0;
      const enough = resState.current >= skill.cost;
      const canCast = this.canUseSkill(skill) && this.turn === 'player' && enough;
      btn.classList.toggle('disabled', !canCast);
      btn.classList.toggle('no-resource', !enough);
      const overlay = btn.querySelector('.cooldown-overlay');
      if (overlay && skill.cooldown) {
        const pct = Math.min(1, Math.max(0, cd / (skill.cooldown || 1)));
        overlay.style.height = `${pct * 100}%`;
      }
      const cdEl = btn.querySelector('.cooldown');
      if (cdEl) cdEl.textContent = cd > 0 ? `CD ${cd}` : '';
      const meta = btn.querySelector('.skill-meta');
      if (meta) meta.textContent = `${skill.cost} ${formatResourceName(resKey)}`;
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
    finishCombat({ victory, boss: this.battle.isBoss, zone: this.battle.zone, options: this.battle.options });
    this.battle = null;
    this.updateActionButtons();
    this.updateStatusUI();
  },
};

function startFight(boss = false, auto = false, opts = {}) {
  if (CombatSystem.active) { logMessage('Finish the current fight first.'); return; }
  if (boss) opts.mode = opts.mode || 'boss';
  if (!opts.skipFightCooldown) {
    const fightCd = getActionCooldownState('FIGHT');
    if (!fightCd.ready) { logMessage(`Fight is on cooldown (${formatCooldown(fightCd.remaining)}).`); return; }
    startActionCooldown('FIGHT');
  }
  const zone = opts.zoneOverride || zones[state.currentZone];
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
  if (bossFight && !opts.mode) opts.mode = 'boss';
  const baseEnemy = pickEnemy(zone, bossFight);
  state.currentEnemy = { ...baseEnemy };
  const diff = opts.difficulty || 1;
  if (bossFight) {
    state.currentEnemy.hp = Math.round(state.currentEnemy.hp * BOSS_SCALE);
    state.currentEnemy.attack = Math.round(state.currentEnemy.attack * BOSS_SCALE);
    state.currentEnemy.defense = Math.round(state.currentEnemy.defense * BOSS_SCALE);
    state.currentEnemy.xp = Math.round(state.currentEnemy.xp * BOSS_SCALE);
  }
  state.currentEnemy.hp = Math.round(state.currentEnemy.hp * diff);
  state.currentEnemy.currentHP = state.currentEnemy.hp;
  state.currentEnemy.attack = Math.round(state.currentEnemy.attack * diff);
  state.currentEnemy.defense = Math.round(state.currentEnemy.defense * (0.9 + diff * 0.1));
  state.currentEnemy.gold = Math.round(state.currentEnemy.gold * (1 + (diff - 1) * 0.9));
  state.currentEnemy.xp = Math.round(state.currentEnemy.xp * (1 + (diff - 1)));
  state.currentEnemy.noUnlock = !!opts.noUnlock;
  state.currentEnemy.unlocksZoneId = opts.unlocksZoneId || null;
  state.currentEnemy.isGateBoss = !!opts.isGateBoss;
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
    options: opts,
  });
}

function calculateSimDamage(attacker, defender) {
  const variance = 0.1;
  let raw = attacker.attack * (1 + ((Math.random() * 2 - 1) * variance));
  let dmg = Math.max(1, Math.round(raw - (defender.defense || 0) * 0.6));
  const critChance = attacker.crit || 0;
  const crit = Math.random() * 100 < critChance;
  if (crit) dmg = Math.round(dmg * (attacker.critdmg || 1.5));
  const elementMult = getElementMultiplier(attacker.element || 'physical', defender.element || 'physical');
  dmg = Math.round(dmg * elementMult);
  return Math.max(1, dmg);
}

function simulateAutoFight(playerStats, startingHP, zone) {
  const enemy = pickEnemy(zone, false);
  const enemyStats = { attack: enemy.attack, defense: enemy.defense, element: enemy.element || zone.element || 'physical', crit: 5, critdmg: 1.5 };
  let playerHP = startingHP;
  let enemyHP = enemy.hp;
  let damageTaken = 0;
  let rounds = 0;
  while (playerHP > 0 && enemyHP > 0 && rounds < 50) {
    const pDmg = calculateSimDamage({ attack: playerStats.attack, defense: playerStats.defense, crit: playerStats.crit || 5, critdmg: playerStats.critdmg || 1.5, element: playerStats.element || 'physical' }, enemyStats);
    enemyHP -= pDmg;
    if (playerStats.lifesteal) playerHP = Math.min(playerStats.maxHP, playerHP + Math.round(pDmg * playerStats.lifesteal));
    if (enemyHP <= 0) break;
    const eDmg = calculateSimDamage(enemyStats, { defense: playerStats.defense, element: playerStats.element || 'physical' });
    damageTaken += eDmg;
    playerHP -= eDmg;
    rounds += 1;
  }
  const victory = enemyHP <= 0 && playerHP > 0;
  const xpBoost = 1 + (state.player.modifiers.xpBoost || 0);
  const goldBoost = 1 + (state.player.modifiers.goldBoost || 0);
  const autoBase = XP_REWARDS.auto || 15;
  const xpGain = victory ? Math.max(1, Math.round(autoBase * xpBoost)) : 0;
  const goldGain = victory ? Math.round(enemy.gold * 1.18 * 0.9 * goldBoost) : 0;
  const summary = { loot: [], materials: {}, chests: {}, eggs: 0 };
  if (victory) {
    dropLoot(false, { silent: true, summary });
    progressQuest('combat', 1, zone.id);
  }
  return { victory, remainingHP: Math.max(0, Math.round(playerHP)), damageTaken, xp: xpGain, gold: goldGain, loot: summary.loot, materials: summary.materials, chests: summary.chests, eggs: summary.eggs };
}

function autoBattle() {
  const cdState = getActionCooldownState('AUTO_BATTLE');
  if (!cdState.ready) { logMessage(`Auto battle ready in ${formatCooldown(cdState.remaining)}.`); return; }
  if (CombatSystem.active) { logMessage('Finish the current battle before auto battling.'); return; }
  if (!isZoneUnlocked(state.currentZone)) { logMessage('Defeat the zone boss to progress before auto battling.'); return; }
  const zone = zones[state.currentZone];
  const countEl = document.getElementById('auto-count');
  let count = parseInt(countEl ? countEl.value : '1', 10);
  if (Number.isNaN(count) || count < 1) count = 1;
  count = Math.min(20, count);
  const derived = applyBonuses(state.player.baseStats, state.player);
  if (state.player.currentHP < derived.maxHP * 0.15) logMessage('Warning: low HP could end your auto run early.');
  startActionCooldown('AUTO_BATTLE');
  const initialHP = state.player.currentHP;
  let playerHP = state.player.currentHP;
  const summary = { fights: 0, wins: 0, losses: 0, xp: 0, gold: 0, loot: [], materials: {}, chests: {}, eggs: 0 };
  for (let i = 0; i < count; i++) {
    if (playerHP <= 0) { summary.losses += 1; break; }
    const result = simulateAutoFight(derived, playerHP, zone);
    summary.fights += 1;
    playerHP = result.remainingHP;
    if (result.victory) {
      summary.wins += 1;
      summary.xp += result.xp;
      summary.gold += result.gold;
      summary.loot.push(...result.loot);
      Object.entries(result.materials).forEach(([k, v]) => { summary.materials[k] = (summary.materials[k] || 0) + v; });
      Object.entries(result.chests).forEach(([k, v]) => { summary.chests[k] = (summary.chests[k] || 0) + v; });
      summary.eggs += result.eggs || 0;
    } else {
      summary.losses += 1;
      break;
    }
  }
  state.player.currentHP = Math.max(0, Math.round(playerHP));
  if (summary.xp > 0) grantPlayerXP(summary.xp);
  if (summary.gold > 0) state.player.gold += summary.gold;
  Object.entries(summary.materials).forEach(([k, v]) => addMaterial(k, v));
  Object.entries(summary.chests).forEach(([k, v]) => { state.chests[k] = (state.chests[k] || 0) + v; });
  const fightsCompleted = summary.fights;
  if (state.foodBuff && state.foodBuff.battles > 0 && fightsCompleted > 0) {
    state.foodBuff.battles -= fightsCompleted;
    if (state.foodBuff.battles <= 0) logMessage(`${state.foodBuff.source || 'Food buff'} fades.`);
  }
  const hpLost = Math.max(0, initialHP - state.player.currentHP);
  const lootText = summary.loot.length ? summary.loot.slice(0, 4).join(', ') + (summary.loot.length > 4 ? '…' : '') : 'none';
  const chestText = Object.entries(summary.chests).map(([k, v]) => `${chestTypes[k]?.name || k} x${v}`).join(', ');
  const matText = Object.entries(summary.materials).map(([k, v]) => `${materialMap[k]?.name || k} x${v}`).join(', ');
  const extras = [lootText, chestText, matText].filter(Boolean).join(' | ');
  const summaryLine = `Auto battle ran ${summary.fights} fight${summary.fights === 1 ? '' : 's'}: ${summary.wins} win${summary.wins === 1 ? '' : 's'}${summary.losses ? `, ${summary.losses} loss` : ''}, +${summary.xp} XP, +${summary.gold} gold, loot: ${extras || 'none'}, HP lost: ${hpLost}.`;
  const summaryEl = document.getElementById('auto-summary');
  if (summaryEl) summaryEl.textContent = summaryLine;
  logMessage(summaryLine);
  saveGame();
  updateAll();
}

function finishCombat(result, bossFlag) {
  const payload = typeof result === 'object' ? result : { victory: result, boss: bossFlag };
  const victory = payload.victory;
  const boss = payload.boss;
  const player = state.player;
  const zone = payload.zone || zones[state.currentZone];
  const gateUnlock = payload.options?.unlocksZoneId;
  const isGateBoss = payload.options?.isGateBoss;
  if (victory) {
    const xpBoost = 1 + (player.modifiers.xpBoost || 0);
    const modeKey = payload.options?.mode || (boss ? 'boss' : undefined);
    const baseXp = modeKey && XP_REWARDS[modeKey] != null ? XP_REWARDS[modeKey] : state.currentEnemy.xp;
    const xpGain = Math.max(1, Math.round(baseXp * xpBoost));
    const goldGain = Math.round(state.currentEnemy.gold * 1.18 * (1 + (player.modifiers.goldBoost || 0)));
    player.xp += xpGain;
    player.gold += goldGain;
    logMessage(`Victory! +${xpGain} XP, +${goldGain} gold.`);
    recordHistory('combat', `Victory in ${zone.name}`);
    progressQuest('combat', 1, zone.id);
    if (boss) progressQuest('boss', 1, zone.id);
    gainLifeSkillXP('hunting', 6);
    if (player.modifiers.heal) {
      player.currentHP += player.modifiers.heal;
      logMessage(`You recover ${player.modifiers.heal} HP after battle.`);
    }
    if (boss && player.modifiers.healAfterBoss) {
      player.currentHP += player.modifiers.healAfterBoss;
    }
    dropLoot(boss);
    hatchProgress({ count: 1, source: payload.options?.mode || 'battle' });
    randomEvent();
    if (boss && !state.currentEnemy?.noUnlock) {
      onBossDefeated(state.currentEnemy?.id || state.currentEnemy?.name, { unlocksZoneId: gateUnlock, isGateBoss });
    }
  } else {
    logMessage('You died... returning to town.');
    player.gold = Math.max(0, Math.floor(player.gold * 0.75));
    player.xp = Math.max(0, Math.floor(player.xp * 0.25));
    recordHistory('combat', `Defeated in ${zone.name}`);
  }
  levelCheck();
  if (state.tower?.active) finishTowerRun(victory);
  if (state.dungeonRun) {
    if (victory) { continueDungeonWave(); return; }
    state.dungeonRun = null;
  }
  player.currentHP = Math.min(applyBonuses(player.baseStats, player).maxHP, player.currentHP <= 0 ? applyBonuses(player.baseStats, player).maxHP : player.currentHP);
  const { key: resKey } = getResourceState(player);
  if (resKey === 'rage') {
    player.rage = Math.max(0, Math.min(player.maxRage, player.rage));
    updateRageBar(player);
  } else {
    const rule = resourceRules[resKey] || {};
    addResourceAmount(player, resKey, rule.regen || 4);
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

function onBossDefeated(bossId, opts = {}) {
  if (!bossId) return;
  if (!state.defeatedBossIds.includes(bossId)) {
    state.defeatedBossIds.push(bossId);
  }
  if (opts.unlocksZoneId) {
    const unlockedZone = zones[opts.unlocksZoneId - 1];
    if (unlockedZone) logMessage(`${unlockedZone.name} is now unlocked!`);
  }
  EventBus.emit('BOSS_DEFEATED', { bossId, unlocks: opts.unlocksZoneId });
  renderZones();
  renderMapPanel();
  updateGateBossUI();
  scheduleSave();
}

function levelCheck() {
  const player = state.player;
  while (player.xp >= player.xpToNext) {
    if (player.level >= MAX_LEVEL) { player.xp = player.xpToNext; break; }
    player.xp -= player.xpToNext;
    player.level++;
    player.baseStats.hp += 8;
    player.baseStats.attack += 2;
    player.baseStats.defense += 1;
    player.baseStats.crit += 0.5;
    player.xpToNext = xpToNextLevel(player.level);
    player.skillPoints++;
    const derived = applyBonuses(player.baseStats, player);
    player.currentHP = derived.maxHP;
    updateHealthBar(player, playerHpBar, playerHpText, derived.maxHP);
    logMessage(`Level up! You reached level ${player.level}.`);
    EventBus.emit('PLAYER_LEVEL_CHANGED', player.level);
  }
  updateGateBossUI();
}

function grantPlayerXP(amount) {
  if (!state.player || amount <= 0) return;
  state.player.xp += amount;
  levelCheck();
}

function dropLoot(boss, opts = {}) {
  const silent = opts.silent;
  const summary = opts.summary;
  const derived = applyBonuses(state.player.baseStats, state.player);
  const baseLoot = (boss ? 0.9 : 0.55) * LOOT_CHANCE_MULT;
  const lootChance = Math.min(0.98, baseLoot * 1.5 + (state.player.modifiers.lootBoost || 0) + (derived.lootBuff || 0));
  if (Math.random() < lootChance) {
    const item = generateItem(state.player.level, boss);
    state.inventory.push(item);
    if (summary) summary.loot.push(item.name);
    if (!silent) logMessage(`Loot found: ${item.name}`);
  }
  if (Math.random() < 0.2) {
    const potion = createPotion(state.player.level);
    state.inventory.push(potion);
    if (summary) summary.loot.push(potion.name || 'Healing Brew');
    if (!silent) logMessage('You found a healing brew.');
  }
  const zone = zones[state.currentZone];
  if (zone && Math.random() < 0.22) {
    const tier = Math.max(...(zone.allowedMaterialTiers || [1]));
    const gem = createRandomGem(Math.min(5, tier));
    state.inventory.push(gem);
    if (summary) summary.loot.push(gem.name);
    if (!silent) logMessage(`A socketable ${gem.name} drops.`);
  }
  const chestChance = boss ? 0.25 : 0.08;
  if (Math.random() < chestChance) {
    const chestId = boss ? 'gold_chest' : 'wood_chest';
    state.chests[chestId] = (state.chests[chestId] || 0) + 1;
    if (summary) summary.chests[chestId] = (summary.chests[chestId] || 0) + 1;
    if (!silent) logMessage(`You found a ${chestTypes[chestId].name}.`);
  }
  const eggChance = Math.min(
    0.95,
    ((boss ? 0.35 : 0.15) * 0.5 * (1 + (state.player.modifiers.eggBoost || 0)) + EGG_DROP_BONUS) * EGG_CHANCE_MULT
  );
  if (Math.random() < eggChance) {
    const egg = createEgg(boss);
    state.eggs.push(egg);
    if (summary) summary.eggs = (summary.eggs || 0) + 1;
    if (!silent) logMessage(`You obtained a ${egg.rarity} dragon egg!`);
  }
  grantCombatMaterials(boss, opts);
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

function eggRequirementForRarity(rarityKey) {
  const base = 10 + Math.floor(Math.random() * 11);
  const idx = Math.max(0, rarities.findIndex(r => r.key === rarityKey));
  const multiplier = 1 + idx * 0.25;
  return Math.max(1, Math.round(base * multiplier));
}

function createEgg(boss) {
  const rar = weightedRarity(boss);
  const reduction = state.player ? (state.player.modifiers.eggBoost || 0) : 0;
  const bonus = rollDragonBonus(rar);
  const baseReq = eggRequirementForRarity(rar.key);
  const requirement = Math.max(1, Math.round(baseReq * (1 - reduction)));
  const element = zones[state.currentZone]?.element || ELEMENTS[Math.floor(Math.random() * ELEMENTS.length)];
  const traits = [element];
  return { id: crypto.randomUUID(), rarity: rar.key, progress: 0, requirement, ready: false, hatched: false, bonus, element, traits };
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

function grantCombatMaterials(boss, opts = {}) {
  const silent = opts.silent;
  const summary = opts.summary;
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
      if (summary) summary.materials[d.id] = (summary.materials[d.id] || 0) + qty;
      if (!silent) logMessage(`You recover ${d.name} x${qty} from the battle.`);
    }
  });
}

function hatchProgress(opts = {}) {
  const source = opts.source || 'battle';
  if (source === 'auto') return;
  const count = opts.count || 1;
  state.eggs.forEach(egg => {
    if (egg.hatched) return;
    const handlerLevel = state.lifeSkills.dragonHandling ? state.lifeSkills.dragonHandling.level : 1;
    const bonus = 1 + Math.floor(handlerLevel / 3) * 0.2;
    egg.progress = Math.min(egg.requirement, egg.progress + count * bonus);
    if (egg.progress >= egg.requirement) {
      egg.ready = true;
      logMessage(`${egg.rarity} egg is ready to hatch!`);
    }
  });
}

function hatchEgg(eggId) {
  const egg = state.eggs.find(e => e.id === eggId);
  if (!egg || egg.hatched || !egg.ready) { logMessage('Egg is not ready to hatch.'); return; }
  const element = egg.element || zones[state.currentZone]?.element || 'physical';
  const dragon = { id: crypto.randomUUID(), name: `${egg.rarity} Dragonling`, rarity: egg.rarity, bonus: egg.bonus, element, traits: egg.traits || [], nextBreedAvailableAt: 0 };
  egg.dragon = dragon;
  egg.hatched = true;
  egg.ready = false;
  state.dragons.push(dragon);
  logMessage(`${dragon.name} has hatched!`);
  if (!state.activeDragon) state.activeDragon = dragon;
  gainLifeSkillXP('dragonHandling', 10);
  gainLifeSkillXP('dragonBonding', 6);
  updateAll();
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

function performLifeAction(skillId, action, opts = {}) {
  const actionKey = lifeSkillActionMap[skillId];
  if (actionKey && !isActionReady(actionKey)) { logMessage('Action is on cooldown.'); return; }
  if (actionKey) startActionCooldown(actionKey);
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
  if (!opts.skipLifeProgress) {
    gainLifeSkillXP(skillId, action.xp);
    grantPlayerXP(Math.floor(state.player.xpToNext * 0.25));
    rollRecipeDiscovery(skillId);
  }
  const msg = gained.length ? `You practice ${lifeSkillDefs[skillId].name} and gain ${gained.join(', ')}.` : `You practice ${lifeSkillDefs[skillId].name} but find nothing.`;
  logMessage(msg);
  progressQuest(`gather_${skillId}`, 1, zone?.id);
  updateAll();
}

function handleLifeSkillCardClick(skillId) {
  state.selectedLifeSkill = skillId;
  const actionKey = lifeSkillActionMap[skillId];
  const cd = actionKey ? getActionCooldownState(actionKey) : { ready: true, remaining: 0 };
  const actions = lifeActions[skillId] || [];
  const recipes = recipeBook[skillId] || [];
  if (actionKey && !cd.ready) {
    logMessage(`${lifeSkillDefs[skillId].name} is on cooldown (${formatCooldown(cd.remaining)}).`);
    renderLifeSkillsTab();
    return;
  }
  if (actions.length) {
    performLifeAction(skillId, actions[0]);
    return;
  }
  if (recipes.length) {
    renderLifeSkillsTab();
    document.getElementById('life-recipes')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    logMessage('Select a recipe below to work this profession.');
    return;
  }
  renderLifeSkillsTab();
}

function craftRecipe(skillId, recipe) {
  const actionKey = lifeSkillActionMap[skillId];
  if (actionKey && !isActionReady(actionKey)) { logMessage('Action is on cooldown.'); return; }
  const skill = state.lifeSkills[skillId];
  const playerLevelGate = recipe.playerLevelReq || requiredPlayerLevelForTier(recipe.tier || recipe.gearTier || 1);
  if (state.player.level < playerLevelGate) { logMessage(`Requires level ${playerLevelGate} to craft.`); return; }
  if (skill.level < (recipe.skillReq || 1)) { logMessage('Skill level too low.'); return; }
  if (!state.recipeUnlocks[recipe.id]) { logMessage('Recipe not learned yet.'); return; }
  const missing = Object.entries(recipe.mats).find(([m, qty]) => (state.materials[m] || 0) < qty);
  if (missing) { logMessage(`Need more ${missing[0]}.`); return; }
  if (actionKey) startActionCooldown(actionKey);
  Object.entries(recipe.mats).forEach(([m, qty]) => { state.materials[m] -= qty; });
  gainLifeSkillXP(skillId, 18 + recipe.skillReq * 2);
  if (recipe.type === 'refine') {
    const outId = recipe.output?.materialId;
    const outQty = recipe.output?.qty || 1;
    if (!outId) { logMessage('No output defined.'); return; }
    addMaterial(outId, outQty);
    gainLifeSkillXP(skillId, Math.max(8, recipe.skillReq + 6));
    logMessage(`You refine materials into ${(materialMap[outId]?.name) || outId} x${outQty}.`);
  } else if (recipe.type === 'gear') {
    const quality = rollQuality(skill);
    const stats = recipe.stats.map(s => ({ ...s, value: Math.max(1, Math.round(s.value * (1 + quality.boost))) }));
    const socketBonus = getPerkBonus('blacksmithing', skill.level, 35) ? 1 : 0;
    const item = { id: crypto.randomUUID(), type: 'gear', name: `${quality.label} ${recipe.name}`, slot: recipe.slot, rarity: recipe.rarity, stats, levelReq: recipe.levelReq, power: stats.reduce((t, s) => t + s.value, 0), quality: quality.key, sockets: (recipe.sockets || 0) + socketBonus, gems: [], gearTier: recipe.gearTier || recipe.tier || 1, enhancementLevel: 0, maxEnhancementLevel: 10, element: recipe.element || zones[state.currentZone]?.element || 'physical' };
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

const upgradeMats = { 1: 'copper_ore', 2: 'iron_ore', 3: 'steel_ore', 4: 'mithril_ore', 5: 'dragonite_ore' };

function enhancementRequirement(item) {
  const tier = item.gearTier || 1;
  const mat = upgradeMats[tier] || 'copper_ore';
  const qty = Math.max(1, item.enhancementLevel + 1);
  const gold = 30 * (item.enhancementLevel + 1);
  return { mat, qty, gold };
}

function enhanceItem(itemId) {
  const items = [...state.inventory, ...Object.values(state.player.equipment || {})].filter(Boolean);
  const item = items.find(i => i.id === itemId);
  if (!item) { logMessage('Select gear to enhance.'); return; }
  ensureItemMeta(item);
  if (item.enhancementLevel >= item.maxEnhancementLevel) { logMessage('Item is at maximum enhancement.'); return; }
  const req = enhancementRequirement(item);
  if ((state.materials[req.mat] || 0) < req.qty) { logMessage(`Need ${req.qty} ${req.mat}.`); return; }
  if (state.player.gold < req.gold) { logMessage('Not enough gold.'); return; }
  state.materials[req.mat] -= req.qty;
  state.player.gold -= req.gold;
  item.enhancementLevel += 1;
  logMessage(`Enhanced ${item.name} to +${item.enhancementLevel}.`);
  updateAll();
}

function fuseItemsById(idA, idB) {
  const inv = state.inventory.filter(i => i.type === 'gear');
  if (inv.length < 2) { logMessage('Store at least two gear pieces in inventory to fuse.'); return; }
  if (!idA || !idB || idA === idB) { logMessage('Choose two different items.'); return; }
  const a = inv.find(i => i.id === idA);
  const b = inv.find(i => i.id === idB);
  if (!a || !b) { logMessage('Fusion uses inventory gear only.'); return; }
  ensureItemMeta(a); ensureItemMeta(b);
  if (a.slot !== b.slot) { logMessage('Items must be same slot.'); return; }
  if ((a.gearTier || 1) !== (b.gearTier || 1)) { logMessage('Items must share gear tier.'); return; }
  const tier = a.gearTier || 1;
  const successChance = Math.max(0.45, 0.95 - tier * 0.1);
  const roll = Math.random();
  const consumeInputs = () => { state.inventory = state.inventory.filter(i => i.id !== a.id && i.id !== b.id); };
  if (roll > successChance) {
    consumeInputs();
    logMessage('Fusion failed. No new item was created.');
    updateAll();
    return;
  }
  const newTier = Math.min(5, (a.gearTier || 1) + (a.rarity === b.rarity ? 1 : 0));
  const newItem = generateItem(state.player.level + newTier, false);
  newItem.slot = a.slot;
  newItem.name = `Fused ${a.slot.charAt(0).toUpperCase() + a.slot.slice(1)}`;
  newItem.gearTier = newTier;
  ensureItemMeta(newItem);
  consumeInputs();
  state.inventory.push(newItem);
  logMessage(`Fusion created ${newItem.name} (Tier ${newTier}).`);
  updateAll();
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
  state.shopRefresh = Date.now() + 4 * 60 * 60 * 1000;
}

function renderShop() {
  const wrap = document.getElementById('shop-list');
  if (!wrap) return;
  if (state.shopRefresh && state.shopRefresh < Date.now()) generateShop();
  wrap.innerHTML = '';
  if (!state.shop.length) { wrap.innerHTML = '<div class="small">Shop is empty.</div>'; return; }
  const timer = document.getElementById('shop-timer');
  if (timer) {
    const remaining = Math.max(0, (state.shopRefresh || 0) - Date.now());
    timer.textContent = remaining ? `Refreshes in ${formatCooldown(remaining)}` : 'Refreshed';
  }
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

function renderDungeonPanel() {
  const panel = document.getElementById('dungeon-panel');
  if (!panel) return;
  const zone = zones[state.currentZone];
  const dungeon = dungeonCatalog.find(d => d.zone === zone.id);
  if (!dungeon) { panel.innerHTML = '<div class="system-card"><h5>No dungeon</h5><div class="small muted">Clear this zone boss to unlock more.</div></div>'; return; }
  const cd = getActionCooldownState('DUNGEON');
  panel.innerHTML = `<div class="system-card"><div class="epic-meta"><div><h5>${dungeon.name}</h5><div class="small">${dungeon.loot}</div></div><span class="badge-tier t${zone.allowedMaterialTiers[0]}">Zone ${zone.id}</span></div>
    <div class="small muted">${dungeon.waves.length} waves • Recommended Lv ${dungeon.recommendedLevel}</div>
    <button id="dungeon-start" class="primary" ${cd.ready ? '' : 'disabled'}>${cd.ready ? 'Enter Dungeon' : 'Dungeon (' + formatCooldown(cd.remaining) + ')'}</button>
  </div>`;
  const btn = document.getElementById('dungeon-start');
  if (btn) btn.onclick = () => startDungeonRun(zone.id);
}

function renderJobsPanel() {
  const panel = document.getElementById('jobs-panel');
  if (!panel) return;
  const entries = jobCatalog.map(job => {
    const cd = getActionCooldownState(job.action);
    const label = cd.ready ? job.label : `${job.label} (${formatCooldown(cd.remaining)})`;
    return `<div class="system-card"><div class="epic-meta"><h5>${job.label}</h5><span class="badge">${job.action}</span></div><div class="small muted">${job.desc}</div><button class="ghost" data-job="${job.id}" ${cd.ready ? '' : 'disabled'}>${label}</button></div>`;
  }).join('');
  panel.innerHTML = `<div class="epic-grid">${entries}</div>`;
  panel.querySelectorAll('[data-job]').forEach(btn => btn.onclick = () => performJob(btn.dataset.job));
}

function renderQuestPanel() {
  const panel = document.getElementById('quests-panel');
  if (!panel) return;
  const buildSection = (type, title) => {
    const list = questTemplates[type].map(q => {
      const entry = state.questProgress[type][q.id] || { progress: 0 };
      const pct = Math.min(1, (entry.progress || 0) / q.target);
      const btnLabel = entry.completed && !entry.claimed ? 'Claim' : `${entry.progress || 0}/${q.target}`;
      const disabled = !(entry.completed && !entry.claimed);
      const reward = q.reward?.chest ? `${q.reward.chest.replace('_', ' ')}` : q.reward?.gold ? `${q.reward.gold} gold` : 'Mixed rewards';
      return `<div class="quest-entry"><div class="flex between"><div><strong>${q.name}</strong><div class="small muted">Reward: ${reward}</div></div><button class="ghost" data-quest="${q.id}" data-type="${type}" ${disabled ? 'disabled' : ''}>${btnLabel}</button></div><div class="progress"><div class="fill" style="width:${pct * 100}%"></div></div></div>`;
    }).join('');
    return `<div><h5>${title}</h5><div class="quest-list">${list}</div></div>`;
  };
  panel.innerHTML = `<div class="system-card">${buildSection('daily', 'Daily Quests')}${buildSection('weekly', 'Weekly Quests')}${buildSection('zone', 'Zone Quests')}</div>`;
  panel.querySelectorAll('[data-quest]').forEach(btn => btn.onclick = () => claimQuestReward(btn.dataset.type, btn.dataset.quest));
}

function renderTowerPanel() {
  const panel = document.getElementById('tower-panel');
  if (!panel) return;
  const cd = getActionCooldownState('TOWER');
  const label = cd.ready ? 'Start Tower Run' : `Tower (${formatCooldown(cd.remaining)})`;
  panel.innerHTML = `<div class="system-card"><h5>Endless Tower</h5><div class="small muted">Floor ${state.tower.floor || 1} • Best ${state.tower.best || 1}</div><button class="primary" id="tower-btn" ${cd.ready ? '' : 'disabled'}>${label}</button></div>`;
  const btn = document.getElementById('tower-btn');
  if (btn) btn.onclick = startTowerRun;
}

function renderWorldBossPanel() {
  const panel = document.getElementById('worldboss-panel');
  if (!panel) return;
  const cd = getActionCooldownState('WORLD_BOSS');
  const label = cd.ready ? `Fight ${worldBossConfig.name}` : `${worldBossConfig.name} (${formatCooldown(cd.remaining)})`;
  const locked = state.player.level < worldBossConfig.levelReq;
  panel.innerHTML = `<div class="system-card"><div class="epic-meta"><div><h5>${worldBossConfig.name}</h5><div class="small muted">${worldBossConfig.desc}</div></div><span class="badge-tier t5">World</span></div><div class="small">Loot: ${worldBossConfig.loot}</div><button class="warning" id="worldboss-btn" ${cd.ready && !locked ? '' : 'disabled'}>${locked ? 'Req Lv ' + worldBossConfig.levelReq : label}</button></div>`;
  const btn = document.getElementById('worldboss-btn');
  if (btn) btn.onclick = startWorldBoss;
}

function renderChestPanel() {
  const panel = document.getElementById('chest-panel');
  if (!panel) return;
  const entries = Object.values(chestTypes).map(c => {
    const count = state.chests[c.id] || 0;
    return `<div class="system-card"><div class="epic-meta"><h5>${c.name}</h5><span class="badge-tier t${c.gearTier}">T${c.gearTier}</span></div><div class="small muted">${c.rarity.toUpperCase()} • Gear Tier ${c.gearTier}</div><div class="small">Owned: ${count}</div><button class="ghost" data-chest="${c.id}" ${count ? '' : 'disabled'}>Open</button></div>`;
  }).join('');
  panel.innerHTML = `<div class="epic-grid">${entries}</div>`;
  panel.querySelectorAll('[data-chest]').forEach(btn => btn.onclick = () => openChest(btn.dataset.chest));
}

function renderMapPanel() {
  const panel = document.getElementById('map-panel');
  if (!panel) return;
  const cards = zones.map((z, idx) => {
    const unlocked = isZoneUnlocked(idx);
    const reqText = zoneRequirements(z, state.player, unlocked);
    return `<div class="system-card"><div class="flex between"><strong>${z.name}</strong><span class="badge-tier t${z.allowedMaterialTiers[0]}">T${z.allowedMaterialTiers.join('/')}</span></div><div class="small muted">Lv ${getZoneRequiredLevel(z)}</div><div class="small">Drops: Tier ${z.allowedMaterialTiers.join(',')}</div><div class="small ${unlocked ? '' : 'muted'}">${unlocked ? 'Unlocked' : reqText}</div></div>`;
  }).join('');
  panel.innerHTML = `<div class="epic-grid">${cards}</div>`;
}

function renderRebirthPanel() {
  const panel = document.getElementById('rebirth-panel');
  if (!panel) return;
  panel.innerHTML = `<div class="system-card"><h5>Ascension</h5><div class="small muted">Reset at level 50+ for permanent bonuses (up to 30 ascensions).</div><div class="small">Ascensions: ${state.ascension.count || 0}</div><div class="small">Points: ${state.ascension.points || 0}</div><button class="danger" id="ascend-btn">Ascend</button></div>`;
  const btn = document.getElementById('ascend-btn');
  if (btn) btn.onclick = () => ascend();
}

function renderHistoryPanel() {
  const panel = document.getElementById('history-panel');
  if (!panel) return;
  const format = (list) => list.map(e => `<div>${new Date(e.at).toLocaleTimeString()} - ${e.msg}</div>`).join('');
  panel.innerHTML = `<div class="system-card"><h5>History</h5><div class="small muted">Recent dungeon, combat, and loot moments.</div><div class="history-log">${format(state.history.dungeon || [])}${format(state.history.combat || [])}${format(state.history.loot || [])}</div></div>`;
}

function renderEpicSystems() {
  renderDungeonPanel();
  renderJobsPanel();
  renderQuestPanel();
  renderTowerPanel();
  renderWorldBossPanel();
  renderChestPanel();
  renderMapPanel();
  renderRebirthPanel();
  renderHistoryPanel();
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

function initSidebarNavigation() {
  const navItems = document.querySelectorAll('.nav-item');
  const panels = document.querySelectorAll('.main-panel');
  function showPanel(panelId) {
    panels.forEach(panel => panel.classList.toggle('is-visible', panel.id === panelId));
    syncCombatActionBar();
  }
  navItems.forEach(btn => {
    const targetId = btn.dataset.section;
    btn.addEventListener('click', () => {
      navItems.forEach(n => n.classList.remove('is-active'));
      btn.classList.add('is-active');
      if (targetId) showPanel(targetId);
      if (state.ui.mobileActive) setNavOpen(false);
    });
  });
  const initiallyActive = document.querySelector('.nav-item.is-active');
  if (initiallyActive && initiallyActive.dataset.section) {
    showPanel(initiallyActive.dataset.section);
  }
}

function initMenuToggle() {
  const btn = document.getElementById('menu-toggle');
  if (!btn) return;
  btn.addEventListener('click', () => toggleNav());
}

function zoneRequirements(zone, player, unlocked) {
  if (!zone || !player) return 'Locked';
  const requirements = [];
  const reqLevel = getZoneRequiredLevel(zone);
  if (player.level < reqLevel) requirements.push(`Requires Lv ${reqLevel}`);
  if (zone.gateBossId && !hasDefeatedBoss(zone.gateBossId)) {
    const gateBoss = bossById(zone.gateBossId);
    requirements.push(`Defeat ${gateBoss?.name || 'Gate Boss'}`);
  }
  if (!requirements.length && !unlocked) return 'Locked';
  return requirements.join(' • ');
}

function renderZones() {
  const zoneList = document.getElementById('zone-list');
  if (!zoneList) return;
  zoneList.innerHTML = zones.map((z, i) => {
    const unlocked = isZoneUnlocked(i);
    const classes = ['zone-card'];
    if (!unlocked) classes.push('zone-card--locked');
    if (i === state.currentZone) classes.push('zone-card--active');
    const req = zoneRequirements(z, state.player, unlocked);
    const lockedLabel = unlocked ? '' : `<div class="zone-locked-label">${req || 'Locked'}</div>`;
    return `<button class="${classes.join(' ')}" data-zone-id="${i}" ${!unlocked ? 'disabled' : ''}>
      <div class="zone-name">${z.name}</div>
      <div class="zone-level">Lv ${getZoneRequiredLevel(z)}</div>
      <div class="zone-mats">Mat tiers: ${z.allowedMaterialTiers.join(', ')}</div>
      ${lockedLabel}
    </button>`;
  }).join('');
  zoneList.querySelectorAll('.zone-card').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = Number(btn.dataset.zoneId);
      handleZoneCardClick(target);
    });
  });
  updateZoneHeader();
  updateEpicActionTimers();
}

function handleZoneCardClick(targetZone) {
  const zone = zones[targetZone];
  if (!zone || !state.player) return;
  if (!isZoneUnlocked(targetZone)) {
    logMessage(zoneRequirements(zone, state.player, false) || 'You have not unlocked this zone yet.');
    return;
  }
  if (targetZone === state.currentZone) { updateZoneHeader(); return; }
  const travelCd = getActionCooldownState('TRAVEL_ZONE');
  if (!travelCd.ready) { logMessage(`Travel ready in ${formatCooldown(travelCd.remaining)}.`); return; }
  state.currentZone = targetZone;
  startActionCooldown('TRAVEL_ZONE');
  logMessage(`Traveling to ${zone.name}. Next move available in 20 minutes.`);
  EventBus.emit('ZONE_CHANGED', state.currentZone);
  updateAll();
}

function updateZoneHeader() {
  const label = document.getElementById('current-zone-label');
  const zone = zones[state.currentZone];
  if (label) label.textContent = zone ? `Current: ${zone.name}` : 'Current: -';
  updateTravelCooldownUI();
}

function updateTravelCooldownUI() {
  const travel = document.getElementById('travel-cooldown-label');
  if (!travel) return;
  const remaining = getActionRemainingMs('TRAVEL_ZONE');
  travel.textContent = remaining <= 0 ? 'Travel ready' : `Travel in ${formatCooldown(remaining)}`;
}

function updateEpicActionsSummary() {
  const busy = epicActions.filter(a => !getActionCooldownState(a.cooldownId || a.id).ready).length;
  document.querySelectorAll('.epic-actions-summary').forEach(el => {
    el.textContent = busy ? `${busy} actions on cooldown` : 'All actions ready';
  });
}

function getNextLockedZone() {
  const sorted = [...zones].sort((a, b) => a.id - b.id);
  for (const zone of sorted) {
    if (zone.id === 1) continue;
    if (!isZoneUnlocked(zone.id - 1, state.player)) return zone;
  }
  return null;
}

function getGateBossForZone(zone) {
  if (!zone || !zone.gateBossId) return null;
  return bossById(zone.gateBossId) || zone.boss;
}

function updateGateBossUI() {
  const btn = document.getElementById('gate-boss-button');
  const info = document.getElementById('gate-boss-info');
  if (!btn || !info) return;
  const nextZone = getNextLockedZone();
  if (!nextZone) {
    btn.disabled = true;
    btn.textContent = 'All zones unlocked';
    info.textContent = '';
    return;
  }
  const boss = getGateBossForZone(nextZone);
  const meetsLevel = state.player?.level >= (nextZone.requiredLevel || nextZone.level || 1);
  if (!boss) {
    btn.disabled = true;
    btn.textContent = 'Gate boss unavailable';
    info.textContent = '';
    return;
  }
  btn.disabled = !meetsLevel;
  btn.textContent = meetsLevel ? `Challenge ${boss.name}` : `Requires Lv ${nextZone.requiredLevel}`;
  info.textContent = `Unlocks ${nextZone.name}`;
}

function initGateBossButton() {
  const btn = document.getElementById('gate-boss-button');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const nextZone = getNextLockedZone();
    if (!nextZone) return;
    const boss = getGateBossForZone(nextZone);
    if (!boss) return;
    if (state.player.level < (nextZone.requiredLevel || nextZone.level || 1)) {
      logMessage(`You must be level ${nextZone.requiredLevel || nextZone.level} to challenge this gate boss.`);
      return;
    }
    const opts = { isGateBoss: true, unlocksZoneId: nextZone.id, zoneOverride: nextZone };
    startFight(true, false, opts);
  });
}

function renderEpicLoopActions(container) {
  if (!container) return;
  container.innerHTML = `<div class="panel-subhead epic-actions-head">
      <div>
        <strong>EPIC Loop Actions</strong>
        <div class="tiny muted">Hunt, adventure, dungeon, and jobs are button-first with cooldowns.</div>
      </div>
      <div class="tiny muted epic-actions-summary"></div>
    </div>
    <div class="epic-actions" data-epic-actions-row></div>`;
  const row = container.querySelector('[data-epic-actions-row]');
  const zone = zones[state.currentZone];
  const lockedZone = !isZoneUnlocked(state.currentZone);
  epicActions.forEach(action => {
    const btn = document.createElement('button');
    const cd = getActionCooldownState(action.cooldownId || action.id);
    const bossLevelLock = zone ? zone.level + 2 : Infinity;
    const levelLocked = action.id === 'boss' && state.player && state.player.level < bossLevelLock;
    btn.className = `${action.type === 'combat' ? 'primary' : action.type === 'job' ? 'secondary' : 'ghost'} epic-action-btn`;
    btn.dataset.actionKey = (action.cooldownId || action.id).toUpperCase();
    btn.dataset.action = (action.cooldownId || action.id).toUpperCase();
    btn.dataset.baseLabel = action.label;
    btn.dataset.actionId = action.id;
    btn.title = action.description;
    btn.textContent = cd.ready && !lockedZone && !levelLocked ? action.label : levelLocked ? `${action.label} (Lv ${bossLevelLock})` : `${action.label} (${formatCooldown(cd.remaining)})`;
    btn.disabled = !cd.ready || lockedZone || levelLocked;
    btn.onclick = () => performEpicAction(action.id);
    row.appendChild(btn);
  });
  updateEpicActionsSummary();
  syncCombatActionBar();
}

function renderEpicActionsMounts() {
  const combatMount = document.getElementById('combat-epic-actions-mount');
  if (combatMount) renderEpicLoopActions(combatMount);
}

function updateEpicActionTimers() {
  const zone = zones[state.currentZone];
  const lockedZone = !isZoneUnlocked(state.currentZone);
  document.querySelectorAll('.epic-action-btn').forEach(btn => {
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
      const lockLabel = levelLocked ? ` (Lv ${bossLevelLock})` : '';
      btn.textContent = remaining > 0 && !levelLocked ? `${label} (${formatCooldown(remaining)})` : `${label}${lockLabel}`;
    }
  });
  updateEpicActionsSummary();
  updateFightButtons();
  renderDungeonPanel();
  renderJobsPanel();
  renderTowerPanel();
  renderWorldBossPanel();
  updateLifeSkillCooldownCards();
  updateTravelCooldownUI();
}

function updateLifeSkillCooldownCards() {
  const cards = document.querySelectorAll('#life-skill-list .life-skill');
  cards.forEach(card => {
    const skillId = card.dataset.skillId;
    const actionId = lifeSkillActionMap[skillId];
    if (!actionId) return;
    const cd = getActionCooldownState(actionId);
    card.classList.toggle('on-cooldown', !cd.ready);
    card.style.display = cd.ready ? '' : 'none';
    const status = card.querySelector('.life-skill-cooldown');
    if (status) status.textContent = cd.ready ? 'Ready' : `Cooldown ${formatCooldown(cd.remaining)}`;
  });
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
    const fightLocked = !isZoneUnlocked(state.currentZone) || inCombat;
    let fightLabel = 'Fight';
    if (!fightState.ready) fightLabel = `Fight (${formatCooldown(fightState.remaining)})`;
    if (fightLocked) fightLabel = `Fight (${!isZoneUnlocked(state.currentZone) ? 'Zone Locked' : 'In Combat'})`;
    fightBtn.textContent = fightLabel;
    fightBtn.disabled = fightLocked || !fightState.ready;
  }
  if (bossBtn) {
    const fightLocked = !isZoneUnlocked(state.currentZone) || inCombat;
    let bossLabel = 'Boss Fight';
    if (!fightState.ready) bossLabel = `Boss Fight (${formatCooldown(fightState.remaining)})`;
    if (fightLocked) bossLabel = `Boss Fight (${!isZoneUnlocked(state.currentZone) ? 'Zone Locked' : 'In Combat'})`;
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

function registerGearHover(element, item) {
  if (!element || !item) return;
  element.classList.add('gear-item');
  element.dataset.itemId = item.id;
  element._itemRef = item;
}

function renderEquipment() {
  const wrap = document.getElementById('equipment-slots');
  wrap.innerHTML = '';
  Object.keys(state.player.equipment).forEach(slot => {
    const item = state.player.equipment[slot];
    const div = document.createElement('div');
    div.className = `slot ${item ? 'rarity-' + item.rarity : ''}`;
    const enh = item && item.enhancementLevel ? `+${item.enhancementLevel} ` : '';
    const element = item?.element ? `<span class="tiny muted">${item.element}</span>` : '';
    div.innerHTML = `<strong>${slot.toUpperCase()}</strong><br>${item ? `<span class="name ${item.rarity}">${enh}${item.name}</span>${element}` : '<span class="small">Empty</span>'}`;
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
      registerGearHover(div, item);
    }
    wrap.appendChild(div);
  });
}

function renderInventory() {
  const wrap = document.getElementById('inventory-list');
  const hasInventory = state.inventory.length || Object.keys(state.materials || {}).length;
  if (!hasInventory) { wrap.innerHTML = '<div class="small">No items yet.</div>'; return; }
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
    } else if (item.type === 'material') {
      card.innerHTML = `<div class="name ${item.rarity}">${item.name}</div><div class="small">Qty: ${item.qty}</div>`;
    } else {
      const better = isBetterThanEquipped(item);
      const arrow = better ? '<span class="better-arrow">↑</span>' : '';
      const enh = item.enhancementLevel ? `+${item.enhancementLevel} ` : '';
      const element = item.element ? `<span class="tiny muted">${item.element}</span>` : '';
      card.classList.add('gear-item');
      card.dataset.itemId = item.id;
      card.innerHTML = `<div class="name ${item.rarity}">${enh}${item.name}${arrow}</div><div class="small">Requires Lv ${item.levelReq} • Slot: ${item.slot}</div><div class="small">Power ${item.power}</div>${element}`;
      (item.stats || []).forEach(s => {
        const stat = document.createElement('div');
        stat.className = 'small';
        stat.textContent = `+${s.value} ${s.label}`;
        card.appendChild(stat);
      });
      registerGearHover(card, item);
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

function formatItemTooltip(item) {
  if (!item) return '';
  const lines = [];
  const enh = item.enhancementLevel ? `+${item.enhancementLevel} ` : '';
  lines.push(`<div class="item-name item-rarity-${item.rarity}">${enh}${item.name}</div>`);
  if (item.rarity) lines.push(`<div class="item-rarity">${item.rarity.toUpperCase()}</div>`);
  if (item.levelReq) lines.push(`<div class="item-level">Requires Lv ${item.levelReq}</div>`);
  if (item.slot) lines.push(`<div class="item-slot tiny muted">Slot: ${item.slot}</div>`);
  lines.push('<hr />');
  if (item.stats && item.stats.length) {
    item.stats.forEach(s => {
      lines.push(`<div class="stat-line"><span>${s.label}</span><span>+${s.value}</span></div>`);
    });
  }
  if (item.power) lines.push(`<div class="stat-line"><span>Power</span><span>${item.power}</span></div>`);
  if (item.element) lines.push(`<div class="stat-line"><span>Element</span><span>${item.element}</span></div>`);
  if (item.sockets) lines.push(`<div class="stat-line"><span>Sockets</span><span>${item.sockets}</span></div>`);
  return lines.join('');
}

function findItemById(id) {
  if (!id) return null;
  const equipped = Object.values(state.player?.equipment || {}).find(it => it?.id === id);
  if (equipped) return equipped;
  return state.inventory.find(it => it.id === id) || null;
}

function initGearTooltips() {
  const tooltip = document.getElementById('gear-tooltip');
  if (!tooltip) return;
  function showTooltip(item, x, y) {
    tooltip.innerHTML = formatItemTooltip(item);
    tooltip.style.left = `${x + 12}px`;
    tooltip.style.top = `${y + 12}px`;
    tooltip.hidden = false;
  }
  function hideTooltip() { tooltip.hidden = true; }
  document.addEventListener('mouseover', (e) => {
    const el = e.target.closest('.gear-item');
    if (!el) return;
    const item = el._itemRef || findItemById(el.dataset.itemId);
    if (!item) return;
    showTooltip(item, e.clientX, e.clientY);
  });
  document.addEventListener('mousemove', (e) => {
    if (tooltip.hidden) return;
    tooltip.style.left = `${e.clientX + 12}px`;
    tooltip.style.top = `${e.clientY + 12}px`;
  });
  document.addEventListener('mouseout', (e) => {
    if (e.relatedTarget && e.relatedTarget.closest('.gear-item')) return;
    hideTooltip();
  });
}

function renderForgePanel() {
  const enhanceWrap = document.getElementById('enhance-panel');
  const fusionWrap = document.getElementById('fusion-panel');
  if (!enhanceWrap || !fusionWrap) return;
  const gear = [...Object.values(state.player.equipment || {}), ...state.inventory.filter(i => i.type === 'gear')].filter(Boolean);
  const filters = state.fusionFilters || (state.fusionFilters = { slot: 'all', tier: 'all', rarity: 'all' });
  const invGear = state.inventory.filter(i => i.type === 'gear').filter(item => {
    const tierOk = filters.tier === 'all' || String(item.gearTier || 1) === String(filters.tier);
    const slotOk = filters.slot === 'all' || item.slot === filters.slot;
    const rarityOk = filters.rarity === 'all' || item.rarity === filters.rarity;
    return tierOk && slotOk && rarityOk;
  });
  const buildSelect = (id, list) => {
    const select = document.createElement('select');
    select.id = id;
    if (!list.length) {
      const opt = document.createElement('option');
      opt.value = '';
      opt.textContent = 'No gear available';
      select.appendChild(opt);
      select.disabled = true;
      return select;
    }
    list.forEach(item => {
      ensureItemMeta(item);
      const opt = document.createElement('option');
      opt.value = item.id;
      opt.textContent = `${item.slot} • ${item.name} (+${item.enhancementLevel || 0})`;
      select.appendChild(opt);
    });
    return select;
  };
  enhanceWrap.innerHTML = '';
  const selectEnh = buildSelect('enhance-select', gear);
  const enhanceBtn = document.createElement('button');
  enhanceBtn.textContent = 'Enhance';
  enhanceBtn.onclick = () => enhanceItem(selectEnh.value);
  const reqInfo = document.createElement('div');
  reqInfo.className = 'tiny muted';
  if (gear.length) {
    const req = enhancementRequirement(gear[0]);
    reqInfo.textContent = `Costs ${req.qty} ${req.mat} + ${req.gold} gold for next level.`;
  }
  enhanceWrap.appendChild(selectEnh);
  enhanceWrap.appendChild(enhanceBtn);
  enhanceWrap.appendChild(reqInfo);

  fusionWrap.innerHTML = '';
  const filterRow = document.createElement('div');
  filterRow.className = 'filters';
  const makeFilter = (id, values) => {
    const sel = document.createElement('select');
    sel.id = `fuse-filter-${id}`;
    values.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.value;
      opt.textContent = v.label;
      if (filters[id] === v.value) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.onchange = () => { filters[id] = sel.value; renderForgePanel(); };
    return sel;
  };
  const slotSel = makeFilter('slot', [{ value: 'all', label: 'All Slots' }, ...['weapon','armor','helmet','boots','accessory'].map(s => ({ value: s, label: s }))]);
  const tierSel = makeFilter('tier', [{ value: 'all', label: 'All Tiers' }, ...[1,2,3,4,5].map(t => ({ value: String(t), label: `Tier ${t}` }))]);
  const rarSel = makeFilter('rarity', [{ value: 'all', label: 'All Rarities' }, ...rarityOrder.map(r => ({ value: r, label: r.charAt(0).toUpperCase() + r.slice(1) }))]);
  filterRow.appendChild(slotSel);
  filterRow.appendChild(tierSel);
  filterRow.appendChild(rarSel);
  fusionWrap.appendChild(filterRow);
  const fuseA = buildSelect('fuse-a', invGear);
  const fuseB = buildSelect('fuse-b', invGear);
  const fuseBtn = document.createElement('button');
  fuseBtn.textContent = 'Fuse';
  fuseBtn.disabled = invGear.length < 2;
  fuseBtn.onclick = () => fuseItemsById(fuseA.value, fuseB.value);
  fusionWrap.appendChild(fuseA);
  fusionWrap.appendChild(fuseB);
  fusionWrap.appendChild(fuseBtn);
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
    if (item.gems && item.gems.length) {
      if ((item.gearTier || 1) >= 4) {
        item.gems.forEach((g, idx) => {
          const row = document.createElement('div');
          row.className = 'small flex between';
          row.innerHTML = `<span>${g.name}</span>`;
          const removeBtn = document.createElement('button');
          removeBtn.textContent = 'Remove';
          removeBtn.onclick = () => removeGemFromGear(item, idx);
          row.appendChild(removeBtn);
          card.appendChild(row);
        });
      } else {
        const warn = document.createElement('div');
        warn.className = 'tiny muted';
        warn.textContent = 'Requires Tier 4+ gear to remove gems.';
        card.appendChild(warn);
      }
    }
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

function removeGemFromGear(gear, index) {
  if ((gear.gearTier || 1) < 4) { logMessage('Requires Tier 4+ gear to remove gems.'); return; }
  if (!gear.gems || !gear.gems[index]) { logMessage('No gem in that socket.'); return; }
  const [removed] = gear.gems.splice(index, 1);
  state.inventory.push(removed);
  logMessage(`Removed ${removed.name} from ${gear.name}.`);
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
  const baseItems = [...state.inventory];
  const materials = Object.entries(state.materials || {}).map(([id, qty]) => ({
    id: `mat-${id}`,
    type: 'material',
    materialId: id,
    qty,
    name: materialMap[id]?.name || id,
    rarity: materialMap[id]?.rarityColor || 'common',
  }));
  return [...baseItems, ...materials].filter(item => {
    const type = item.type || 'gear';
    const rarityIndex = rarityOrder.indexOf(item.rarity || 'common');
    const minIdx = rarityOrder.indexOf(state.filters.minRarity || 'common');
    if (rarityIndex !== -1 && minIdx !== -1 && rarityIndex < minIdx) return false;
    if (state.filters.type !== 'all' && type !== state.filters.type) return false;
    if (state.filters.slot !== 'all' && item.slot !== state.filters.slot) return false;
    if (state.filters.rarity !== 'all' && item.rarity !== state.filters.rarity) return false;
    return true;
  });
}

function sellFiltered() {
  const filtered = filteredInventoryItems().filter(i => i.type !== 'material');
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

function hasHealingItem() {
  return state.inventory.some(i => i.type === 'potion' && i.heal);
}

function consumeCombatHeal() {
  const potion = state.inventory.find(i => i.type === 'potion' && i.heal);
  if (!potion) { logMessage('No healing items available'); return false; }
  const derived = applyBonuses(state.player.baseStats, state.player);
  const heal = Math.round(potion.heal * (1 + (state.player.modifiers.potionBoost || 0)));
  state.player.currentHP = Math.min(derived.maxHP, state.player.currentHP + heal);
  state.inventory = state.inventory.filter(i => i.id !== potion.id);
  logMessage(`You drink ${potion.name} and heal ${heal} HP.`);
  return true;
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
  const shouldConsumeTurn = CombatSystem?.active && CombatSystem.turn === 'player';
  updateAll();
  if (shouldConsumeTurn) {
    logMessage('Using the potion costs your turn.', 'status');
    CombatSystem.endPlayerTurn();
  }
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
  state.eggs.filter(e => e.hatched && e.dragon && !state.dragons.find(d => d.id === e.dragon.id)).forEach(e => state.dragons.push(e.dragon));
  if (state.activeDragon && !state.dragons.find(d => d.id === state.activeDragon.id)) state.dragons.push(state.activeDragon);
  state.eggs.forEach(egg => {
    const card = document.createElement('div');
    card.className = `egg rarity-${egg.rarity}`;
    const statusText = egg.hatched ? 'Hatched!' : egg.ready ? 'Ready to hatch' : `Progress ${Math.floor(egg.progress)}/${egg.requirement}`;
    card.innerHTML = `<div class="name ${egg.rarity}">${egg.rarity} Egg</div><div class="small">${statusText}</div>`;
    if (egg.ready && !egg.hatched) {
      const hatchBtn = document.createElement('button');
      hatchBtn.textContent = 'Hatch Egg';
      hatchBtn.onclick = () => hatchEgg(egg.id);
      card.appendChild(hatchBtn);
    }
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
    active.innerHTML = `<div class="dragon-card rarity-${d.rarity}"><div class="name ${d.rarity}">${d.name}</div><div class="tiny muted">${d.element || 'physical'}</div>` +
      Object.entries(d.bonus).map(([k,v]) => `<div class="small">+${v} ${k}</div>`).join('') + '</div>';
  } else {
    active.innerHTML = '<div class="small">No active dragon.</div>';
  }
  renderCombineArea();
  renderBreedingPanel();
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
  newEgg.ready = false;
  newEgg.requirement = eggRequirementForRarity(newEgg.rarity);
  state.eggs.push(newEgg);
  logMessage('The eggs resonate and form a stronger one!');
  updateAll();
}

function renderBreedingPanel() {
  const panel = document.getElementById('breeding-panel');
  if (!panel) return;
  const dragons = state.dragons || [];
  if (!dragons.length) { panel.innerHTML = '<div class="small">Hatch dragons to begin breeding.</div>'; return; }
  const now = Date.now();
  const buildSelect = (id) => {
    const select = document.createElement('select');
    select.id = id;
    dragons.forEach(d => {
      const readyIn = Math.max(0, (d.nextBreedAvailableAt || 0) - now);
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = `${d.name} (${d.rarity}, ${d.element || 'physical'}) ${readyIn ? '• ' + formatCooldown(readyIn) : ''}`;
      select.appendChild(opt);
    });
    return select;
  };
  panel.innerHTML = '<h5>Breed Dragons</h5><div class="tiny muted">Pair two dragons to create a new egg.</div>';
  const row = document.createElement('div');
  row.className = 'breeding-row';
  const selectA = buildSelect('breed-a');
  const selectB = buildSelect('breed-b');
  row.appendChild(selectA);
  row.appendChild(selectB);
  const btn = document.createElement('button');
  btn.textContent = 'Breed';
  btn.onclick = () => breedDragons(selectA.value, selectB.value);
  panel.appendChild(row);
  panel.appendChild(btn);
}

function breedDragons(aId, bId) {
  if (!aId || !bId || aId === bId) { logMessage('Pick two different dragons.'); return; }
  const a = (state.dragons || []).find(d => d.id === aId);
  const b = (state.dragons || []).find(d => d.id === bId);
  if (!a || !b) { logMessage('Missing dragons.'); return; }
  const now = Date.now();
  if ((a.nextBreedAvailableAt || 0) > now || (b.nextBreedAvailableAt || 0) > now) { logMessage('One parent is still resting.'); return; }
  const cost = 50;
  if (state.player.gold < cost) { logMessage('Not enough gold to breed.'); return; }
  state.player.gold -= cost;
  const rarA = rarities.findIndex(r => r.key === a.rarity);
  const rarB = rarities.findIndex(r => r.key === b.rarity);
  const baseRarity = Math.max(rarA, rarB);
  const rarityIndex = Math.min(rarities.length - 1, baseRarity + (Math.random() < 0.25 ? 1 : 0));
  const element = Math.random() < 0.5 ? a.element : b.element;
  const rar = rarities[rarityIndex];
  const egg = { id: crypto.randomUUID(), rarity: rar.key, progress: 0, requirement: eggRequirementForRarity(rar.key), ready: false, hatched: false, bonus: rollDragonBonus(rar), element, traits: [element], parentIds: [a.id, b.id] };
  state.eggs.push(egg);
  const cooldownMs = (4 + baseRarity) * 60 * 60 * 1000;
  a.nextBreedAvailableAt = now + cooldownMs;
  b.nextBreedAvailableAt = now + cooldownMs;
  logMessage(`Dragons breed and produce a ${egg.rarity} ${element} egg.`);
  updateAll();
}

function renderSkills() {
  const wrap = document.getElementById('skill-trees-container');
  const sp = document.getElementById('skill-points');
  if (!wrap || !sp) return;
  wrap.innerHTML = '';
  sp.textContent = state.player.skillPoints;
  const tree = skillTrees[state.player.class] || [];
  tree.forEach((branch, bIdx) => {
    const cat = document.createElement('div');
    cat.className = 'skill-category';
    cat.dataset.categoryId = branch.branch;
    const header = document.createElement('button');
    header.className = 'skill-category-header';
    const name = document.createElement('span');
    name.className = 'category-name';
    name.textContent = branch.branch;
    const meta = document.createElement('span');
    meta.className = 'category-meta';
    const spentLabel = document.createElement('span');
    spentLabel.dataset.categorySpent = branch.branch;
    const indicator = document.createElement('span');
    indicator.className = 'category-toggle-indicator';
    indicator.textContent = '▼';
    meta.appendChild(spentLabel);
    meta.appendChild(indicator);
    header.appendChild(name);
    header.appendChild(meta);
    const body = document.createElement('div');
    body.className = 'skill-category-body';
    const list = document.createElement('div');
    list.className = 'skill-list';
    list.dataset.skillList = branch.branch;
    let spentInBranch = 0;
    branch.skills.forEach((skill, sIdx) => {
      const key = `${bIdx}-${sIdx}`;
      const unlocked = !!state.player.skills[key];
      if (unlocked) { spentInBranch += skill.cost || 1; return; }
      const row = document.createElement('div');
      row.className = 'skill-row';
      row.dataset.skillId = key;
      row.innerHTML = `<div class="skill-title">${skill.name}</div><div class="skill-effects">${formatSkillEffect(skill)}</div><div class="skill-cost">Cost ${skill.cost}</div>`;
      row.onclick = () => purchaseSkill(key, skill);
      list.appendChild(row);
    });
    if (!list.children.length) {
      const empty = document.createElement('div');
      empty.className = 'small muted';
      empty.textContent = 'All skills unlocked in this branch.';
      list.appendChild(empty);
    }
    spentLabel.textContent = spentInBranch ? `Points spent: ${spentInBranch}` : '';
    body.appendChild(list);
    cat.appendChild(header);
    cat.appendChild(body);
    header.addEventListener('click', () => {
      const collapsed = body.classList.toggle('is-collapsed');
      indicator.textContent = collapsed ? '►' : '▼';
    });
    wrap.appendChild(cat);
  });
}

function formatSkillEffect(skill) {
  if (skill.desc) return skill.desc;
  const eff = skill.effect || {};
  const parts = [];
  if (eff.attackPct) parts.push(`+${Math.round(eff.attackPct * 100)}% Attack`);
  if (eff.attackFlat) parts.push(`+${eff.attackFlat} Attack`);
  if (eff.critPct) parts.push(`+${Math.round(eff.critPct * 100)}% Crit`);
  if (eff.critDamagePct) parts.push(`+${Math.round(eff.critDamagePct * 100)}% Crit Damage`);
  if (eff.hpPct) parts.push(`+${Math.round(eff.hpPct * 100)}% HP`);
  if (eff.defensePct) parts.push(`+${Math.round(eff.defensePct * 100)}% Defense`);
  return parts.join(' • ');
}

function renderLifeSkillsTab() {
  ensureLifeSkills();
  const list = document.getElementById('life-skill-list');
  if (!list) return;
  if (!state.selectedLifeSkill) state.selectedLifeSkill = Object.keys(lifeSkillDefs)[0];
  list.innerHTML = '';
  Object.entries(lifeSkillDefs).forEach(([id, def]) => {
    const skill = state.lifeSkills[id];
    const card = document.createElement('div');
    const actionKey = lifeSkillActionMap[id];
    const cd = actionKey ? getActionCooldownState(actionKey) : { ready: true, remaining: 0 };
    card.className = `life-skill life-skill-card ${state.selectedLifeSkill === id ? 'active' : ''} ${cd.ready ? '' : 'on-cooldown'}`;
    card.dataset.skillId = id;
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
    if (actionKey) {
      const status = document.createElement('div');
      status.className = 'life-skill-cooldown';
      status.textContent = cd.ready ? 'Ready' : `Cooldown ${formatCooldown(cd.remaining)}`;
      card.appendChild(status);
    }
    card.onclick = () => handleLifeSkillCardClick(id);
    list.appendChild(card);
  });
  renderMaterials();
  renderLifeActions();
  updateLifeSkillCooldownCards();
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
  if (!actionsWrap || !recipeWrap || !title) return;
  actionsWrap.innerHTML = '';
  recipeWrap.innerHTML = '';
  const id = state.selectedLifeSkill || 'mining';
  const skill = state.lifeSkills[id];
  title.textContent = `${lifeSkillDefs[id].name} Actions`;
  const actionKey = lifeSkillActionMap[id];
  const cd = actionKey ? getActionCooldownState(actionKey) : { ready: true, remaining: 0 };
  if (meta) {
    const readyText = actionKey ? (cd.ready ? 'Ready' : `Cooldown ${formatCooldown(cd.remaining)}`) : '';
    meta.textContent = `Level ${skill.level} • ${skill.currentXP}/${skill.xpToNext} XP${readyText ? ' • ' + readyText : ''}`;
  }
  const actions = lifeActions[id] || [];
  if (!actions.length) { actionsWrap.innerHTML = '<div class="small">No active buttons here. Practice via crafting or battle hooks.</div>'; }
  actions.forEach(act => {
    const div = document.createElement('div');
    div.className = 'life-action';
    div.innerHTML = `<div class="flex"><strong>${act.label}</strong><span class="small">+${act.xp} XP</span></div><div class="tiny muted">Tap the skill card to perform.</div>`;
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
    const lockedZone = rec.recommendedZones ? rec.recommendedZones.some(z => {
      const idx = zones.findIndex(zn => zn.id === z);
      return idx < 0 ? true : !isZoneUnlocked(idx);
    }) : false;
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
  ensureResources(p);
  const { key: resKey, state: resState } = getResourceState(p);
  const usesRageResource = resKey === 'rage';
  const manaBar = document.querySelector('.bar.mana');
  if (rageContainer) rageContainer.style.display = usesRageResource ? 'block' : 'none';
  if (manaBar) manaBar.style.display = usesRageResource ? 'none' : 'block';
  if (usesRageResource) {
    updateRageBar(p);
  }
  const resPct = Math.max(0, Math.min(1, resState.current / Math.max(1, resState.max)));
  document.getElementById('resource-bar').style.width = `${resPct * 100}%`;
  document.getElementById('resource-text').textContent = `${formatResourceName(resKey)}: ${Math.floor(resState.current)}/${resState.max}`;
  const xpPct = Math.max(0, Math.min(1, p.xp / p.xpToNext));
  document.getElementById('xp-bar').style.width = `${xpPct * 100}%`;
  document.getElementById('xp-text').textContent = `${p.xp}/${p.xpToNext} XP`;
}

function formatPercent(val) {
  const num = Math.round((val || 0) * 100) / 100;
  return `${num}%`;
}

function refreshPlayerStats() {
  if (!state.player) return null;
  const p = state.player;
  const derived = applyBonuses(p.baseStats, p);
  const stats = {
    maxHP: derived.maxHP,
    attack: derived.attack,
    defense: derived.defense,
    critChance: Math.round(derived.crit || 0),
    critDamage: Math.round((derived.critdmg || 0) * 100),
    speed: Math.round(derived.speed || 0),
    accuracy: Math.round(100 + (p.modifiers.accuracy || 0) * 100),
    evasion: Math.round((p.modifiers.dodge || 0) * 100),
    blockChance: Math.round((p.modifiers.barrier || 0) * 100),
    lifeSteal: Math.round((derived.lifesteal || p.modifiers.lifesteal || 0) * 100),
    elementalAttackFire: Math.round(p.modifiers.fire || 0),
    elementalAttackFrost: Math.round(p.modifiers.frost || 0),
    elementalAttackShadow: Math.round(p.modifiers.shadow || 0),
    elementalResFire: Math.round((p.modifiers.fireRes || 0) * 100),
    elementalResFrost: Math.round((p.modifiers.frostRes || 0) * 100),
    elementalResShadow: Math.round((p.modifiers.shadowRes || 0) * 100),
    bonusXP: Math.round((p.modifiers.xpBoost || 0) * 100),
    bonusGold: Math.round((p.modifiers.goldBoost || 0) * 100),
    bonusLoot: Math.round(((p.modifiers.lootBoost || 0) + (derived.lootBuff || 0)) * 100),
    cooldownReduction: Math.round((p.modifiers.cooldownReduction || 0) * 100),
    bossDamageBonus: Math.round((p.modifiers.bossDamage || 0) * 100),
    dungeonDamageBonus: Math.round((p.modifiers.dungeonDamage || 0) * 100),
    autoBattleEfficiency: Math.round((p.modifiers.autoBattle || 0) * 100),
    element: derived.element || 'physical',
  };
  p.stats = stats;
  EventBus.emit('PLAYER_STATS_CHANGED', { ...stats });
  return { derived, stats };
}

function updatePlayerHeader() {
  if (!state.player) return;
  if (!state.player.stats) refreshPlayerStats();
  const p = state.player;
  const s = p.stats || {};
  const nameEl = document.getElementById('player-name');
  const classEl = document.getElementById('player-class');
  const lvlEl = document.getElementById('player-level');
  const hpEl = document.getElementById('player-hp');
  const atkEl = document.getElementById('player-atk');
  const defEl = document.getElementById('player-def');
  const critEl = document.getElementById('player-crit');
  const critDmgEl = document.getElementById('player-crit-dmg');
  const elemEl = document.getElementById('player-element');
  const speedEl = document.getElementById('player-speed');
  if (nameEl) nameEl.textContent = p.name;
  if (classEl) classEl.textContent = p.class;
  if (lvlEl) lvlEl.textContent = `Lv ${p.level}`;
  if (hpEl) hpEl.textContent = `${Math.floor(p.currentHP)}/${s.maxHP || 0}`;
  if (atkEl) atkEl.textContent = s.attack ?? '-';
  if (defEl) defEl.textContent = s.defense ?? '-';
  if (critEl) critEl.textContent = `${s.critChance ?? 0}%`;
  if (critDmgEl) critDmgEl.textContent = `${s.critDamage ?? 0}%`;
  if (elemEl) {
    const elements = [
      { label: 'Fire', value: s.elementalAttackFire },
      { label: 'Frost', value: s.elementalAttackFrost },
      { label: 'Shadow', value: s.elementalAttackShadow },
    ].filter((e) => e.value && e.value !== 0);
    elemEl.textContent = elements.length
      ? elements.map((e) => `${e.label} ${e.value}`).join(' | ')
      : 'None';
  }
  if (speedEl) speedEl.textContent = s.speed ?? '-';

  const setVal = (id, val, percent) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = percent ? formatPercent(val) : (val ?? '-');
  };
  setVal('stat-accuracy', s.accuracy, true);
  setVal('stat-evasion', s.evasion, true);
  setVal('stat-block', s.blockChance, true);
  setVal('stat-crit-dmg', s.critDamage, true);
  setVal('stat-life-steal', s.lifeSteal, true);
  setVal('stat-fire-atk', s.elementalAttackFire);
  setVal('stat-frost-atk', s.elementalAttackFrost);
  setVal('stat-shadow-atk', s.elementalAttackShadow);
  setVal('stat-fire-res', s.elementalResFire, true);
  setVal('stat-frost-res', s.elementalResFrost, true);
  setVal('stat-shadow-res', s.elementalResShadow, true);
  setVal('stat-bonus-xp', s.bonusXP, true);
  setVal('stat-bonus-gold', s.bonusGold, true);
  setVal('stat-bonus-loot', s.bonusLoot, true);
  setVal('stat-cdr', s.cooldownReduction, true);
  setVal('stat-boss-dmg', s.bossDamageBonus, true);
  setVal('stat-dungeon-dmg', s.dungeonDamageBonus, true);
}

function initPlayerStatsToggle() {
  const toggleBtn = document.getElementById('player-stats-toggle');
  const details = document.getElementById('player-stats-details');
  if (!toggleBtn || !details) return;
  toggleBtn.addEventListener('click', () => {
    const isHidden = details.hidden;
    details.hidden = !isHidden;
    toggleBtn.textContent = isHidden ? 'Hide details' : 'Show details';
  });
}

function updateBars() {
  if (state.player && playerHpBar) {
    const derived = state.player.stats || refreshPlayerStats()?.stats || applyBonuses(state.player.baseStats, state.player);
    const maxHP = derived.maxHP || derived.hp || 0;
    state.player.currentHP = Math.min(maxHP, Math.max(0, state.player.currentHP));
    updateHealthBar(state.player, playerHpBar, playerHpText, maxHP);
    ensureResources(state.player);
    const { key, state: resState } = getResourceState(state.player);
    if (key === 'rage') {
      updateRageBar(state.player);
    } else {
      const resPct = Math.max(0, Math.min(1, resState.current / Math.max(1, resState.max)));
      const resBar = document.getElementById('resource-bar');
      const resText = document.getElementById('resource-text');
      if (resBar) resBar.style.width = `${resPct * 100}%`;
      if (resText) resText.textContent = `${formatResourceName(key)}: ${Math.floor(resState.current)}/${resState.max}`;
    }
  }
  if (!state.currentEnemy) return;
  const enemyBar = document.querySelector('.bar.enemy');
  if (enemyBar) enemyBar.classList.toggle('boss', !!state.currentEnemy.boss);
  state.currentEnemy.currentHP = Math.min(state.currentEnemy.hp, Math.max(0, state.currentEnemy.currentHP));
  updateHealthBar(state.currentEnemy, enemyHpBar, enemyHpText, state.currentEnemy.hp);
}

function updateAll() {
  refreshPlayerStats();
  renderTopbar();
  updatePlayerHeader();
  renderZones();
  renderEquipment();
  renderInventory();
  renderSocketPanel();
  renderForgePanel();
  renderDragonTab();
  renderSkills();
  renderLifeSkillsTab();
  renderShop();
  renderEpicSystems();
  updateGateBossUI();
  updateBars();
  CombatSystem.updateActionButtons();
  updateFightButtons();
  scheduleSave();
}

function ascend() {
  if (!state.player) return;
  if (state.player.level < 50) { logMessage('Reach level 50 to ascend.'); return; }
  if ((state.ascension.count || 0) >= 30) { logMessage('Ascension cap reached.'); return; }
  state.ascension.count = (state.ascension.count || 0) + 1;
  state.ascension.points = (state.ascension.points || 0) + 1;
  const bonus = state.ascension.bonuses || { attackPct: 0, critPct: 0, hpPct: 0, regen: 0, drop: 0, egg: 0 };
  bonus.attackPct += 0.02;
  bonus.critPct += 0.02;
  bonus.hpPct += 0.02;
  bonus.regen += 1;
  bonus.drop += 0.01;
  bonus.egg += 0.01;
  state.ascension.bonuses = bonus;
  const cls = state.player.class;
  state.player = createPlayer(cls);
  state.inventory = [];
  state.eggs = [];
  state.dragons = [];
  state.activeDragon = null;
  state.unlockedZones = 1;
  state.defeatedBossIds = [];
  state.currentZone = 0;
  state.questProgress = { daily: {}, weekly: {}, zone: {} };
  state.chests = {};
  state.tower = { floor: 1, best: 1 };
  state.worldBoss = { lastClear: 0 };
  ensureMetaSystems();
  logMessage('You ascended! Permanent bonuses applied.');
  updateAll();
}

function prestige() {
  if (!state.player) return;
  if (state.player.level < 20) { logMessage('Reach level 20 to prestige.'); return; }
  state.prestige = (state.prestige || 0) + 1;
  const cls = state.player.class;
  state.player = createPlayer(cls);
  state.inventory = [];
  state.eggs = [];
  state.dragons = [];
  state.activeDragon = null;
  state.unlockedZones = 1;
  state.defeatedBossIds = [];
  state.currentZone = 0;
  state.questProgress = { daily: {}, weekly: {}, zone: {} };
  state.chests = {};
  state.tower = { floor: 1, best: 1 };
  state.worldBoss = { lastClear: 0 };
  ensureMetaSystems();
  logMessage(`You prestiged! Permanent bonus applied (x${state.prestige}).`);
  updateAll();
}

function resetGame() {
  localStorage.removeItem('rpgSave');
  state.player = null;
  state.inventory = [];
  state.eggs = [];
  state.dragons = [];
  state.activeDragon = null;
  state.currentZone = 0;
  state.unlockedZones = 1;
  state.defeatedBossIds = [];
  state.currentEnemy = null;
  state.log = [];
  state.shop = [];
  state.prestige = 0;
  state.lifeSkills = defaultLifeSkills();
  state.materials = {};
  state.recipeUnlocks = {};
  state.foodBuff = null;
  state.questProgress = { daily: {}, weekly: {}, zone: {} };
  state.chests = {};
  state.tower = { floor: 1, best: 1 };
  state.worldBoss = { lastClear: 0 };
  state.history = { combat: [], dungeon: [], loot: [] };
  state.ascension = { count: 0, points: 0 };
  document.getElementById('class-select').style.display = 'flex';
  setupClassSelection();
}

let saveTimer = null;
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveGame();
  }, SAVE_DEBOUNCE_MS);
}

function saveGame() {
  const data = {
    player: state.player,
    inventory: state.inventory,
    eggs: state.eggs,
    dragons: state.dragons,
    activeDragon: state.activeDragon,
    currentZone: state.currentZone,
    unlockedZones: state.unlockedZones,
    defeatedBossIds: state.defeatedBossIds,
    shop: state.shop,
    prestige: state.prestige,
    lifeSkills: state.lifeSkills,
    materials: state.materials,
    materialHistory: state.materialHistory,
    recipeUnlocks: state.recipeUnlocks,
    foodBuff: state.foodBuff,
    actionCooldowns: state.actionCooldowns,
    questProgress: state.questProgress,
    chests: state.chests,
    tower: state.tower,
    worldBoss: state.worldBoss,
    history: state.history,
    ascension: state.ascension,
    shopRefresh: state.shopRefresh,
  };
  localStorage.setItem('rpgSave', JSON.stringify(data));
}

function loadGame() {
  const data = localStorage.getItem('rpgSave');
  if (data) {
    const parsed = JSON.parse(data);
    state.player = parsed.player;
    ensureModifierDefaults(state.player);
    state.player.xpToNext = xpToNextLevel(state.player.level || 1);
    Object.values(state.player.equipment || {}).forEach(it => { if (it) { ensureItemMeta(it); } });
    state.inventory = parsed.inventory || [];
    state.inventory.forEach(it => { if (!it.type) it.type = 'gear'; ensureItemMeta(it); });
    state.eggs = parsed.eggs || [];
    state.dragons = parsed.dragons || [];
    state.activeDragon = parsed.activeDragon || null;
    state.currentZone = parsed.currentZone || 0;
    state.unlockedZones = parsed.unlockedZones || 1;
    state.defeatedBossIds = parsed.defeatedBossIds || [];
    if ((!parsed.defeatedBossIds || !parsed.defeatedBossIds.length) && state.unlockedZones > 1) {
      state.defeatedBossIds = zones.slice(0, state.unlockedZones - 1).map(z => z.boss?.id).filter(Boolean);
    }
    state.shop = parsed.shop || [];
    state.prestige = parsed.prestige || 0;
    state.lifeSkills = parsed.lifeSkills || defaultLifeSkills();
    state.materials = parsed.materials || {};
    state.materialHistory = parsed.materialHistory || {};
    state.foodBuff = parsed.foodBuff || null;
    state.recipeUnlocks = parsed.recipeUnlocks || {};
    state.actionCooldowns = parsed.actionCooldowns || {};
    state.questProgress = parsed.questProgress || { daily: {}, weekly: {}, zone: {} };
    state.chests = parsed.chests || {};
    state.tower = parsed.tower || { floor: 1, best: 1 };
    state.worldBoss = parsed.worldBoss || { lastClear: 0 };
    state.history = parsed.history || { combat: [], dungeon: [], loot: [] };
    state.ascension = parsed.ascension || { count: 0, points: 0 };
    state.shopRefresh = parsed.shopRefresh || 0;
    ensureLifeSkills();
    const unlockedFallback = zones.reduce((idx, _, i) => (isZoneUnlocked(i) ? i : idx), 0);
    if (!isZoneUnlocked(state.currentZone)) state.currentZone = unlockedFallback;
    levelCheck();
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
  initSidebarNavigation();
  initMenuToggle();
  initPlayerStatsToggle();
  initGateBossButton();
  renderZones();
  renderEpicActionsMounts();
  const fightBtn = document.getElementById('fight-btn');
  if (fightBtn) fightBtn.addEventListener('click', () => startFight(false));
  const bossBtn = document.getElementById('boss-btn');
  if (bossBtn) bossBtn.addEventListener('click', () => startFight(true));
  const autoBtn = document.getElementById('auto-btn');
  if (autoBtn) autoBtn.addEventListener('click', () => autoBattle());
  const attackBtn = document.getElementById('attack-btn');
  if (attackBtn) attackBtn.addEventListener('click', () => CombatSystem.playerAction('attack'));
  const healBtn = document.getElementById('heal-btn');
  if (healBtn) healBtn.addEventListener('click', () => CombatSystem.playerAction('heal'));
  document.getElementById('refresh-shop').onclick = () => { generateShop(); renderShop(); saveGame(); };
  setInterval(() => updateEpicActionTimers(), 1000);
  EventBus.on('PLAYER_LEVEL_CHANGED', updateGateBossUI);
  EventBus.on('BOSS_DEFEATED', updateGateBossUI);
  EventBus.on('ZONE_CHANGED', updateGateBossUI);
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
  syncCombatActionBar();
}

window.onload = () => {
  setVh();
  ensureOrientationListeners();
  updateOrientationFlag();
  loadSettings();
  applySettings();
  initSettingsCards();
  initGearTooltips();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(err => console.error('SW registration failed', err));
  }
  if (!loadGame()) {
    setupClassSelection();
  } else {
    document.getElementById('class-select').style.display = 'none';
    initGame();
  }
  syncCombatActionBar();
};
