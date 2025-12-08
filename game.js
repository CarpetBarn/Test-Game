// Simple RNG Looter RPG built with vanilla JS
// Systems: combat, loot, skills, dragons, events, saving

const rarities = [
  { key: 'common', label: 'Common', color: 'common', weight: 60, stats: [1, 2], scale: 1 },
  { key: 'uncommon', label: 'Uncommon', color: 'uncommon', weight: 25, stats: [2, 3], scale: 1.08 },
  { key: 'rare', label: 'Rare', color: 'rare', weight: 9, stats: [3, 4], scale: 1.2 },
  { key: 'epic', label: 'Epic', color: 'epic', weight: 4, stats: [4, 5], scale: 1.35 },
  { key: 'legendary', label: 'Legendary', color: 'legendary', weight: 1, stats: [4, 5], scale: 1.55 },
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

const classData = {
  Warrior: { hp: 120, attack: 12, defense: 8, crit: 5, mana: 30, tag: 'melee' },
  Mage: { hp: 90, attack: 15, defense: 4, crit: 8, mana: 60, tag: 'caster' },
  Rogue: { hp: 95, attack: 13, defense: 5, crit: 12, mana: 40, tag: 'assassin' },
  Cleric: { hp: 100, attack: 10, defense: 7, crit: 6, mana: 55, tag: 'holy' },
  Ranger: { hp: 100, attack: 13, defense: 6, crit: 10, mana: 40, tag: 'ranged' },
  Paladin: { hp: 115, attack: 11, defense: 9, crit: 6, mana: 50, tag: 'holy' },
  Warlock: { hp: 90, attack: 14, defense: 5, crit: 9, mana: 65, tag: 'dark' },
};

const zones = [
  {
    name: 'Goblin Forest', level: 1, enemies: [
      { name: 'Goblin', tag: 'humanoid', hp: 55, attack: 8, defense: 2, xp: 14, gold: 8 },
      { name: 'Wolf', tag: 'beast', hp: 50, attack: 9, defense: 2, xp: 12, gold: 7 },
    ],
    boss: { name: 'Goblin Chief', tag: 'humanoid', hp: 120, attack: 16, defense: 5, xp: 48, gold: 25, boss: true }
  },
  {
    name: 'Crystal Caverns', level: 5, enemies: [
      { name: 'Crystal Golem', tag: 'elemental', hp: 90, attack: 14, defense: 7, xp: 24, gold: 14 },
      { name: 'Bandit', tag: 'humanoid', hp: 75, attack: 15, defense: 4, xp: 20, gold: 12 },
    ],
    boss: { name: 'Prismatic Elemental', tag: 'elemental', hp: 190, attack: 24, defense: 8, xp: 82, gold: 45, boss: true }
  },
  {
    name: 'Cursed Battlefield', level: 10, enemies: [
      { name: 'Skeleton', tag: 'undead', hp: 110, attack: 17, defense: 8, xp: 34, gold: 20 },
      { name: 'Undead Knight', tag: 'undead', hp: 135, attack: 20, defense: 10, xp: 40, gold: 22 },
    ],
    boss: { name: 'Lich Warlord', tag: 'undead', hp: 260, attack: 32, defense: 12, xp: 130, gold: 70, boss: true }
  },
  {
    name: 'Dragon Peaks', level: 15, enemies: [
      { name: 'Wyrmling', tag: 'dragon', hp: 155, attack: 23, defense: 12, xp: 52, gold: 35 },
      { name: 'Frost Drake', tag: 'dragon', hp: 165, attack: 24, defense: 11, xp: 56, gold: 36 },
    ],
    boss: { name: 'Ancient Dragon', tag: 'dragon', hp: 350, attack: 40, defense: 16, xp: 200, gold: 120, boss: true }
  }
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
  };
}

function ensureModifierDefaults(player) {
  const defaults = { attack: 0, defense: 0, hp: 0, crit: 0, critdmg: 0, doubleHit: 0, dodge: 0, poison: 0, heal: 0, vsUndead: 0, vsBeast: 0, xpBoost: 0, lootBoost: 0, bossResist: 0, healAfterBoss: 0, lifesteal: 0,
    regen: 0, thorns: 0, potionBoost: 0, goldBoost: 0, barrier: 0, eggBoost: 0, dragonBond: 0, spellAmp: 0, fury: 0, bleed: 0, shred: 0 };
  player.modifiers = { ...defaults, ...(player.modifiers || {}) };
  player.flat = { speed: 0, elemental: 0, hp: 0, attack: 0, ...(player.flat || {}) };
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
  return { id: crypto.randomUUID(), type: 'gear', name, slot, rarity: rarity.key, stats, levelReq: Math.max(1, Math.floor(level * 0.8)), power: stats.reduce((t, s) => t + s.value, 0) };
}

function applyBonuses(baseStats, player) {
  const gearStats = { hp: 0, attack: 0, defense: 0, crit: 0, critdmg: 0, speed: 0, elemental: 0 };
  Object.values(player.equipment).forEach(item => {
    if (!item) return;
    item.stats.forEach(s => { gearStats[s.key] = (gearStats[s.key] || 0) + s.value; });
  });
  const dragonFactor = 1 + (player.modifiers.dragonBond || 0);
  const dragonStats = state.activeDragon ? Object.fromEntries(Object.entries(state.activeDragon.bonus).map(([k, v]) => [k, Math.round(v * dragonFactor)])) : {};
  return {
    maxHP: Math.round((baseStats.hp + (gearStats.hp || 0) + (dragonStats.hp || 0) + (player.flat.hp || 0)) * (1 + player.modifiers.hp)),
    attack: Math.round((baseStats.attack + (gearStats.attack || 0) + (dragonStats.attack || 0) + (player.flat.attack || 0)) * (1 + player.modifiers.attack)) + (player.flat.elemental || 0) + (dragonStats.elemental || 0),
    defense: Math.round((baseStats.defense + (gearStats.defense || 0) + (dragonStats.defense || 0)) * (1 + player.modifiers.defense)),
    crit: (baseStats.crit + (gearStats.crit || 0) + (dragonStats.crit || 0)) * (1 + player.modifiers.crit),
    critdmg: 1.5 + (gearStats.critdmg || 0) / 100 + player.modifiers.critdmg + (dragonStats.critdmg || 0),
    speed: (baseStats.speed || 0) + (gearStats.speed || 0) + (player.flat.speed || 0) + (dragonStats.speed || 0),
    elemental: (gearStats.elemental || 0) + (dragonStats.elemental || 0),
  };
}

function pickEnemy(zone, boss = false) {
  const choice = boss ? zone.boss : zone.enemies[Math.floor(Math.random() * zone.enemies.length)];
  return { ...choice, currentHP: choice.hp };
}

function logMessage(msg) {
  state.log.unshift(msg);
  const logBox = document.getElementById('combat-log');
  logBox.innerHTML = state.log.slice(0, 12).map(line => `<div>${line}</div>`).join('');
}

function startFight(boss = false) {
  const zone = zones[state.currentZone];
  state.currentEnemy = pickEnemy(zone, boss);
  document.getElementById('enemy-display').textContent = `${state.currentEnemy.name} (Lv ${zone.level}${boss ? ' Boss' : ''})`;
  updateBars();
  runCombat(boss);
}

function autoBattle(boss = false) {
  const count = Math.max(1, Math.min(10, parseInt(document.getElementById('auto-count').value) || 1));
  for (let i = 0; i < count; i++) {
    startFight(boss);
    if (state.player.currentHP <= 0) break;
  }
}

function runCombat(boss) {
  const player = state.player;
  const derived = applyBonuses(player.baseStats, player);
  let enemy = state.currentEnemy;
  const poisonTick = player.modifiers.poison > 0 ? Math.round(derived.attack * player.modifiers.poison) : 0;
  const bleedTick = player.modifiers.bleed > 0 ? Math.round(derived.attack * player.modifiers.bleed) : 0;

  while (player.currentHP > 0 && enemy.currentHP > 0) {
    // Player attack
    let damage = Math.max(1, derived.attack - enemy.defense + Math.floor(Math.random() * 4));
    damage = Math.round(damage * (1 + (player.modifiers.fury || 0) + (player.modifiers.spellAmp || 0)));
    if (player.modifiers.shred) damage += player.modifiers.shred;
    const critRoll = Math.random() * 100 < derived.crit;
    if (critRoll) damage = Math.round(damage * derived.critdmg);
    if (player.modifiers.vsUndead && enemy.tag === 'undead') damage = Math.round(damage * (1 + player.modifiers.vsUndead));
    if (player.modifiers.vsBeast && enemy.tag === 'beast') damage = Math.round(damage * (1 + player.modifiers.vsBeast));
    enemy.currentHP -= damage;
    logMessage(`You hit ${enemy.name} for ${damage}${critRoll ? ' (CRIT)' : ''}`);
    if (enemy.currentHP <= 0) break;

    if (Math.random() < player.modifiers.doubleHit) {
      enemy.currentHP -= Math.round(damage * 0.5);
      logMessage('Your follow up strike lands for extra damage!');
      if (enemy.currentHP <= 0) break;
    }

    if (poisonTick) {
      enemy.currentHP -= poisonTick;
      logMessage(`Traps poison ${enemy.name} for ${poisonTick}`);
      if (enemy.currentHP <= 0) break;
    }
    if (bleedTick) {
      enemy.currentHP -= bleedTick;
      logMessage(`Bleed cuts ${enemy.name} for ${bleedTick}`);
      if (enemy.currentHP <= 0) break;
    }

    // Enemy attack
    if (Math.random() < player.modifiers.dodge) {
      logMessage(`${enemy.name} misses as you dodge!`);
    } else {
      let taken = Math.max(1, enemy.attack - derived.defense + Math.floor(Math.random() * 4));
      taken = Math.max(1, Math.round(taken - (player.modifiers.barrier || 0)));
      if (boss && player.modifiers.bossResist) taken = Math.round(taken * (1 - player.modifiers.bossResist));
      player.currentHP -= taken;
      logMessage(`${enemy.name} hits you for ${taken}`);
      if (player.modifiers.thorns) {
        const thorn = Math.max(1, Math.round(taken * player.modifiers.thorns));
        enemy.currentHP -= thorn;
        logMessage(`Thorns deal ${thorn} back!`);
        if (enemy.currentHP <= 0) break;
      }
      if (player.modifiers.lifesteal) {
        const heal = Math.round(taken * player.modifiers.lifesteal);
        player.currentHP = Math.min(player.currentHP + heal, derived.maxHP);
        logMessage(`You steal ${heal} life.`);
      }
    }
    if (player.modifiers.regen) {
      const regen = Math.max(1, Math.round(derived.maxHP * player.modifiers.regen));
      player.currentHP = Math.min(player.currentHP + regen, derived.maxHP);
      logMessage(`You regenerate ${regen} HP.`);
    }
    if (player.currentHP <= 0) break;
  }
  finishCombat(enemy.currentHP <= 0, boss);
}

function finishCombat(victory, boss) {
  const player = state.player;
  const zone = zones[state.currentZone];
  if (victory) {
    const xpBoost = 1 + (player.modifiers.xpBoost || 0);
    const xpGain = Math.round(state.currentEnemy.xp * xpBoost);
    const goldGain = Math.round(state.currentEnemy.gold * (1 + (player.modifiers.goldBoost || 0)));
    player.xp += xpGain;
    player.gold += goldGain;
    logMessage(`Victory! +${xpGain} XP, +${goldGain} gold.`);
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
    if (boss && state.currentZone + 1 < zones.length) {
      state.unlockedZones = Math.max(state.unlockedZones, state.currentZone + 2);
    }
  } else {
    logMessage('You died... returning to town.');
    player.gold = Math.max(0, Math.floor(player.gold * 0.9));
  }
  levelCheck();
  player.currentHP = Math.min(applyBonuses(player.baseStats, player).maxHP, player.currentHP <= 0 ? applyBonuses(player.baseStats, player).maxHP : player.currentHP);
  updateAll();
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
    logMessage(`Level up! You reached level ${player.level}.`);
  }
}

function dropLoot(boss) {
  const lootChance = boss ? 0.9 : 0.55 + (state.player.modifiers.lootBoost || 0);
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
  const eggChance = (boss ? 0.35 : 0.15) * (1 + (state.player.modifiers.eggBoost || 0));
  if (Math.random() < eggChance) {
    const egg = createEgg(boss);
    state.eggs.push(egg);
    logMessage(`You obtained a ${egg.rarity} dragon egg!`);
  }
}

function createEgg(boss) {
  const rar = weightedRarity(boss);
  const reduction = state.player ? (state.player.modifiers.eggBoost || 0) : 0;
  const bonus = {
    hp: Math.round(10 * rar.scale),
    attack: Math.round(4 * rar.scale),
    crit: Math.round(2 * rar.scale),
    critdmg: 0.05 * rar.scale,
    elemental: Math.round(3 * rar.scale),
  };
  const requirement = Math.max(1, Math.round((3 + Math.floor(Math.random() * 3)) * (1 - reduction)));
  return { id: crypto.randomUUID(), rarity: rar.key, progress: 0, requirement, hatched: false, bonus };
}

function createPotion(level) {
  return { id: crypto.randomUUID(), type: 'potion', name: 'Healing Brew', rarity: 'uncommon', heal: 30 + level * 6, price: 20 + level * 4 };
}

function hatchProgress() {
  state.eggs.forEach(egg => {
    if (!egg.hatched) {
      egg.progress++;
      if (egg.progress >= egg.requirement) {
        egg.hatched = true;
        egg.dragon = { name: `${egg.rarity} Dragonling`, rarity: egg.rarity, bonus: egg.bonus };
        logMessage(`${egg.dragon.name} has hatched!`);
        if (!state.activeDragon) state.activeDragon = egg.dragon;
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
    }
  ];
  if (Math.random() < 0.13) {
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

function generateShop() {
  if (!state.player) return;
  state.shop = [];
  const level = state.player.level;
  for (let i = 0; i < 3; i++) {
    const item = generateItem(level + i, false);
    item.price = Math.max(30, item.power * 3);
    state.shop.push(item);
  }
  const potion = createPotion(level);
  potion.price = Math.max(potion.price, 25);
  state.shop.push(potion);
  const egg = createEgg(false);
  egg.type = 'egg';
  egg.price = valueFromEgg(egg) * 2;
  state.shop.push(egg);
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
  if (state.player.gold < item.price) { logMessage('Not enough gold.'); return; }
  state.player.gold -= item.price;
  state.shop = state.shop.filter(i => i.id !== item.id);
  if (item.type === 'potion' || item.type === 'gear') {
    state.inventory.push(item);
  } else if (item.type === 'egg') {
    state.eggs.push(item);
  }
  logMessage(`Purchased ${item.name || item.rarity + ' egg'}.`);
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

function renderZones() {
  const zoneList = document.getElementById('zone-list');
  zoneList.innerHTML = zones.map((z, i) => {
    const locked = i >= state.unlockedZones;
    return `<div class="slot ${locked ? 'small' : ''}">
      <div class="flex"><strong>${z.name}</strong><span>Lv ${z.level}</span></div>
      <div>${locked ? 'Locked' : ''}</div>
    </div>`;
  }).join('');
  zoneList.querySelectorAll('.slot').forEach((div, idx) => {
    if (idx < state.unlockedZones) {
      div.onclick = () => { state.currentZone = idx; updateAll(); };
    }
  });
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
      div.appendChild(info);
    }
    wrap.appendChild(div);
  });
}

function renderInventory() {
  const wrap = document.getElementById('inventory-list');
  if (!state.inventory.length) { wrap.innerHTML = '<div class="small">No items yet.</div>'; return; }
  wrap.innerHTML = '';
  const filtered = state.inventory.filter(item => {
    const type = item.type || 'gear';
    if (state.filters.type !== 'all' && type !== state.filters.type) return false;
    if (state.filters.slot !== 'all' && item.slot !== state.filters.slot) return false;
    if (state.filters.rarity !== 'all' && item.rarity !== state.filters.rarity) return false;
    return true;
  });
  if (!filtered.length) { wrap.innerHTML = '<div class="small">No items match the filters.</div>'; return; }
  filtered.forEach(item => {
    const card = document.createElement('div');
    card.className = `item rarity-${item.rarity}`;
    if (item.type === 'potion') {
      card.innerHTML = `<div class="name ${item.rarity}">${item.name}</div><div class="small">Heals ${Math.round(item.heal * (1 + (state.player.modifiers.potionBoost || 0)))} HP</div>`;
      const row = document.createElement('div');
      row.innerHTML = '';
      const useBtn = document.createElement('button');
      useBtn.textContent = 'Use';
      useBtn.onclick = (e) => { e.stopPropagation(); usePotion(item); };
      const sellBtn = document.createElement('button');
      sellBtn.textContent = `Sell (${valueFromItem(item)}g)`;
      sellBtn.onclick = (e) => { e.stopPropagation(); sellItem(item); };
      row.appendChild(useBtn);
      row.appendChild(sellBtn);
      card.appendChild(row);
    } else {
      card.innerHTML = `<div class="name ${item.rarity}">${item.name}</div><div class="small">Requires Lv ${item.levelReq} • Slot: ${item.slot}</div><div class="small">Power ${item.power}</div>`;
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

function valueFromItem(item) {
  if (item.type === 'potion') return Math.max(5, Math.round(item.price * 0.5));
  return Math.max(5, Math.round((item.power || 5) * 1.5));
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
  state.player.currentHP = Math.min(derived.maxHP, state.player.currentHP + heal);
  logMessage(`You drink ${item.name} and heal ${heal} HP.`);
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
  const hpPct = Math.max(0, Math.min(1, p.currentHP / derived.maxHP));
  document.getElementById('hp-bar').style.width = `${hpPct * 100}%`;
  document.getElementById('hp-text').textContent = `${p.currentHP}/${derived.maxHP} HP`;
  const xpPct = Math.max(0, Math.min(1, p.xp / p.xpToNext));
  document.getElementById('xp-bar').style.width = `${xpPct * 100}%`;
  document.getElementById('xp-text').textContent = `${p.xp}/${p.xpToNext} XP`;
}

function updateBars() {
  if (!state.currentEnemy) return;
  const pct = Math.max(0, Math.min(1, state.currentEnemy.currentHP / state.currentEnemy.hp));
  document.getElementById('enemy-hp').style.width = `${pct * 100}%`;
  document.getElementById('enemy-hp-text').textContent = `${Math.max(0, Math.floor(state.currentEnemy.currentHP))}/${state.currentEnemy.hp}`;
}

function updateAll() {
  renderTopbar();
  renderZones();
  renderEquipment();
  renderInventory();
  renderDragonTab();
  renderSkills();
  renderShop();
  updateBars();
  saveGame();
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
  };
  localStorage.setItem('rpgSave', JSON.stringify(data));
}

function loadGame() {
  const data = localStorage.getItem('rpgSave');
  if (data) {
    const parsed = JSON.parse(data);
    state.player = parsed.player;
    ensureModifierDefaults(state.player);
    state.inventory = parsed.inventory || [];
    state.inventory.forEach(it => { if (!it.type) it.type = 'gear'; });
    state.eggs = parsed.eggs || [];
    state.activeDragon = parsed.activeDragon || null;
    state.currentZone = parsed.currentZone || 0;
    state.unlockedZones = parsed.unlockedZones || 1;
    state.shop = parsed.shop || [];
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
  renderTabs();
  renderZones();
  document.getElementById('fight-btn').onclick = () => startFight(false);
  document.getElementById('boss-btn').onclick = () => startFight(true);
  document.getElementById('auto-btn').onclick = () => autoBattle(false);
  document.getElementById('refresh-shop').onclick = () => { generateShop(); renderShop(); saveGame(); };
  ['slot','rarity','type'].forEach(key => {
    document.getElementById(`filter-${key}`).addEventListener('change', (e) => {
      state.filters[key] = e.target.value;
      renderInventory();
      saveGame();
    });
  });
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
