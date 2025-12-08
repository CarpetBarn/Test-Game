// Simple RNG Looter RPG built with vanilla JS
// Systems: combat, loot, skills, dragons, events, saving

const rarities = [
  { key: 'common', label: 'Common', color: 'common', weight: 55, stats: [1, 2], scale: 1 },
  { key: 'uncommon', label: 'Uncommon', color: 'uncommon', weight: 25, stats: [2, 3], scale: 1.1 },
  { key: 'rare', label: 'Rare', color: 'rare', weight: 12, stats: [3, 4], scale: 1.25 },
  { key: 'epic', label: 'Epic', color: 'epic', weight: 6, stats: [4, 5], scale: 1.4 },
  { key: 'legendary', label: 'Legendary', color: 'legendary', weight: 2, stats: [4, 5], scale: 1.6 },
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
      { name: 'Goblin', tag: 'humanoid', hp: 40, attack: 6, defense: 2, xp: 12, gold: 8 },
      { name: 'Wolf', tag: 'beast', hp: 35, attack: 7, defense: 1, xp: 11, gold: 7 },
    ],
    boss: { name: 'Goblin Chief', tag: 'humanoid', hp: 90, attack: 12, defense: 4, xp: 40, gold: 25, boss: true }
  },
  {
    name: 'Crystal Caverns', level: 5, enemies: [
      { name: 'Crystal Golem', tag: 'elemental', hp: 65, attack: 10, defense: 6, xp: 20, gold: 14 },
      { name: 'Bandit', tag: 'humanoid', hp: 55, attack: 11, defense: 3, xp: 18, gold: 12 },
    ],
    boss: { name: 'Prismatic Elemental', tag: 'elemental', hp: 130, attack: 18, defense: 7, xp: 70, gold: 45, boss: true }
  },
  {
    name: 'Cursed Battlefield', level: 10, enemies: [
      { name: 'Skeleton', tag: 'undead', hp: 80, attack: 13, defense: 6, xp: 30, gold: 20 },
      { name: 'Undead Knight', tag: 'undead', hp: 95, attack: 15, defense: 8, xp: 36, gold: 22 },
    ],
    boss: { name: 'Lich Warlord', tag: 'undead', hp: 180, attack: 24, defense: 10, xp: 110, gold: 70, boss: true }
  },
  {
    name: 'Dragon Peaks', level: 15, enemies: [
      { name: 'Wyrmling', tag: 'dragon', hp: 110, attack: 18, defense: 10, xp: 45, gold: 35 },
      { name: 'Frost Drake', tag: 'dragon', hp: 120, attack: 19, defense: 9, xp: 48, gold: 36 },
    ],
    boss: { name: 'Ancient Dragon', tag: 'dragon', hp: 260, attack: 32, defense: 14, xp: 170, gold: 120, boss: true }
  }
];

const skillTrees = {
  Warrior: [
    { branch: 'Offense', skills: [
      { name: 'Power Strike', cost: 1, desc: '+8% Attack', effect: p => p.modifiers.attack += 0.08 },
      { name: 'Bloodlust', cost: 1, desc: '+5% Crit', effect: p => p.modifiers.crit += 0.05 },
    ]},
    { branch: 'Defense', skills: [
      { name: 'Bulwark', cost: 1, desc: '+10% Defense', effect: p => p.modifiers.defense += 0.1 },
      { name: 'Second Wind', cost: 1, desc: '+8% HP', effect: p => p.modifiers.hp += 0.08 },
    ]},
    { branch: 'Utility', skills: [
      { name: 'Stunning Blow', cost: 1, desc: 'Small chance to double attack', effect: p => p.modifiers.doubleHit += 0.08 },
    ]}
  ],
  Mage: [
    { branch: 'Fire', skills: [
      { name: 'Flame Tongue', cost: 1, desc: '+10 Elemental Damage', effect: p => p.flat.elemental += 10 },
      { name: 'Burning Focus', cost: 1, desc: '+10% Attack', effect: p => p.modifiers.attack += 0.1 },
    ]},
    { branch: 'Ice', skills: [
      { name: 'Frost Armor', cost: 1, desc: '+6% Defense', effect: p => p.modifiers.defense += 0.06 },
      { name: 'Chilling Precision', cost: 1, desc: '+6% Crit', effect: p => p.modifiers.crit += 0.06 },
    ]},
    { branch: 'Arcane', skills: [
      { name: 'Arcane Surge', cost: 1, desc: 'Chance to gain extra XP', effect: p => p.modifiers.xpBoost += 0.05 },
    ]}
  ],
  Rogue: [
    { branch: 'Assassination', skills: [
      { name: 'Backstab', cost: 1, desc: '+12% Crit Damage', effect: p => p.modifiers.critdmg += 0.12 },
      { name: 'Vanish', cost: 1, desc: 'Chance to dodge enemy hit', effect: p => p.modifiers.dodge += 0.07 },
    ]},
    { branch: 'Evasion', skills: [
      { name: 'Quickstep', cost: 1, desc: '+5 Speed', effect: p => p.flat.speed += 5 },
    ]},
    { branch: 'Traps', skills: [
      { name: 'Poison Trap', cost: 1, desc: 'Small damage over time to enemy', effect: p => p.modifiers.poison += 0.05 },
    ]}
  ],
  Cleric: [
    { branch: 'Faith', skills: [
      { name: 'Divine Shield', cost: 1, desc: '+8% Defense', effect: p => p.modifiers.defense += 0.08 },
    ]},
    { branch: 'Restoration', skills: [
      { name: 'Benediction', cost: 1, desc: 'Heal 5 HP after fights', effect: p => p.modifiers.heal += 5 },
      { name: 'Grace', cost: 1, desc: '+6% HP', effect: p => p.modifiers.hp += 0.06 },
    ]},
    { branch: 'Judgement', skills: [
      { name: 'Radiant Burst', cost: 1, desc: 'Extra damage to undead', effect: p => p.modifiers.vsUndead += 0.12 },
    ]}
  ],
  Ranger: [
    { branch: 'Sharpshot', skills: [
      { name: 'Eagle Eye', cost: 1, desc: '+7% Crit', effect: p => p.modifiers.crit += 0.07 },
      { name: 'Steady Aim', cost: 1, desc: '+9% Attack', effect: p => p.modifiers.attack += 0.09 },
    ]},
    { branch: 'Tracking', skills: [
      { name: 'Hunter', cost: 1, desc: 'Bonus vs beasts', effect: p => p.modifiers.vsBeast += 0.12 },
    ]},
    { branch: 'Agility', skills: [
      { name: 'Windrunner', cost: 1, desc: '+6 Speed', effect: p => p.flat.speed += 6 },
    ]}
  ],
  Paladin: [
    { branch: 'Valor', skills: [
      { name: 'Hammer of Light', cost: 1, desc: '+8% Attack', effect: p => p.modifiers.attack += 0.08 },
    ]},
    { branch: 'Fortitude', skills: [
      { name: 'Aegis', cost: 1, desc: '+10% HP', effect: p => p.modifiers.hp += 0.1 },
      { name: 'Faithful', cost: 1, desc: 'Reduced boss damage', effect: p => p.modifiers.bossResist += 0.08 },
    ]},
    { branch: 'Devotion', skills: [
      { name: 'Sanctuary', cost: 1, desc: 'Heals after boss fights', effect: p => p.modifiers.healAfterBoss += 10 },
    ]}
  ],
  Warlock: [
    { branch: 'Dark Arts', skills: [
      { name: 'Soul Leech', cost: 1, desc: 'Lifesteal 5%', effect: p => p.modifiers.lifesteal += 0.05 },
      { name: 'Hex', cost: 1, desc: 'Reduce enemy defense slightly', effect: p => p.modifiers.shred += 2 },
    ]},
    { branch: 'Void', skills: [
      { name: 'Void Knowledge', cost: 1, desc: '+12% Crit Damage', effect: p => p.modifiers.critdmg += 0.12 },
    ]},
    { branch: 'Pact', skills: [
      { name: 'Imp Companion', cost: 1, desc: 'Small bonus to loot chance', effect: p => p.modifiers.lootBoost += 0.05 },
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
    modifiers: { attack: 0, defense: 0, hp: 0, crit: 0, critdmg: 0, doubleHit: 0, dodge: 0, poison: 0, heal: 0, vsUndead: 0, vsBeast: 0, xpBoost: 0, lootBoost: 0, bossResist: 0, healAfterBoss: 0, lifesteal: 0 },
    flat: { speed: 0, elemental: 0 },
    currentHP: base.hp,
  };
}

function weightedRarity(isBoss) {
  const totalWeight = rarities.reduce((t, r) => t + r.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const r of rarities.slice().reverse()) { // reverse for legendary bias check
    const weight = isBoss ? r.weight * 1.4 : r.weight;
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
  return { id: crypto.randomUUID(), name, slot, rarity: rarity.key, stats, levelReq: Math.max(1, Math.floor(level * 0.8)), power: stats.reduce((t, s) => t + s.value, 0) };
}

function applyBonuses(baseStats, player) {
  const gearStats = { hp: 0, attack: 0, defense: 0, crit: 0, critdmg: 0, speed: 0, elemental: 0 };
  Object.values(player.equipment).forEach(item => {
    if (!item) return;
    item.stats.forEach(s => { gearStats[s.key] = (gearStats[s.key] || 0) + s.value; });
  });
  const dragonStats = state.activeDragon ? state.activeDragon.bonus : {};
  return {
    maxHP: Math.round((baseStats.hp + (gearStats.hp || 0) + (dragonStats.hp || 0)) * (1 + player.modifiers.hp)),
    attack: Math.round((baseStats.attack + (gearStats.attack || 0) + (dragonStats.attack || 0)) * (1 + player.modifiers.attack)) + (player.flat.elemental || 0) + (dragonStats.elemental || 0),
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

function runCombat(boss) {
  const player = state.player;
  const derived = applyBonuses(player.baseStats, player);
  let enemy = state.currentEnemy;
  const poisonTick = player.modifiers.poison > 0 ? Math.round(derived.attack * player.modifiers.poison) : 0;

  while (player.currentHP > 0 && enemy.currentHP > 0) {
    // Player attack
    let damage = Math.max(1, derived.attack - enemy.defense + Math.floor(Math.random() * 4));
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

    // Enemy attack
    if (Math.random() < player.modifiers.dodge) {
      logMessage(`${enemy.name} misses as you dodge!`);
    } else {
      let taken = Math.max(1, enemy.attack - derived.defense + Math.floor(Math.random() * 4));
      if (boss && player.modifiers.bossResist) taken = Math.round(taken * (1 - player.modifiers.bossResist));
      player.currentHP -= taken;
      logMessage(`${enemy.name} hits you for ${taken}`);
      if (player.modifiers.lifesteal) {
        const heal = Math.round(taken * player.modifiers.lifesteal);
        player.currentHP = Math.min(player.currentHP + heal, derived.maxHP);
        logMessage(`You steal ${heal} life.`);
      }
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
    const goldGain = state.currentEnemy.gold;
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
  const eggChance = boss ? 0.35 : 0.15;
  if (Math.random() < eggChance) {
    const egg = createEgg(boss);
    state.eggs.push(egg);
    logMessage(`You obtained a ${egg.rarity} dragon egg!`);
  }
}

function createEgg(boss) {
  const rar = weightedRarity(boss);
  const bonus = {
    hp: Math.round(10 * rar.scale),
    attack: Math.round(4 * rar.scale),
    crit: Math.round(2 * rar.scale),
    critdmg: 0.05 * rar.scale,
    elemental: Math.round(3 * rar.scale),
  };
  return { id: crypto.randomUUID(), rarity: rar.key, progress: 0, requirement: 3 + Math.floor(Math.random() * 3), hatched: false, bonus };
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
    }
  ];
  if (Math.random() < 0.4) {
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
  state.inventory.forEach(item => {
    const card = document.createElement('div');
    card.className = `item rarity-${item.rarity}`;
    card.innerHTML = `<div class="name ${item.rarity}">${item.name}</div><div class="small">Requires Lv ${item.levelReq} • Slot: ${item.slot}</div><div class="small">Power ${item.power}</div>`;
    item.stats.forEach(s => {
      const stat = document.createElement('div');
      stat.className = 'small';
      stat.textContent = `+${s.value} ${s.label}`;
      card.appendChild(stat);
    });
    card.onclick = () => equipItem(item);
    wrap.appendChild(card);
  });
}

function equipItem(item) {
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
  eggWrap.innerHTML = state.eggs.map(egg => {
    const prog = egg.hatched ? 'Hatched!' : `Hatching ${egg.progress}/${egg.requirement}`;
    return `<div class="egg rarity-${egg.rarity}"><div class="name ${egg.rarity}">${egg.rarity} Egg</div><div class="small">${prog}</div></div>`;
  }).join('');
  const active = document.getElementById('active-dragon');
  if (state.activeDragon) {
    const d = state.activeDragon;
    active.innerHTML = `<div class="dragon-card rarity-${d.rarity}"><div class="name ${d.rarity}">${d.name}</div>` +
      Object.entries(d.bonus).map(([k,v]) => `<div class="small">+${v} ${k}</div>`).join('') + '</div>';
  } else {
    active.innerHTML = '<div class="small">No active dragon.</div>';
    state.eggs.filter(e => e.hatched).forEach(egg => {
      const btn = document.createElement('button');
      btn.textContent = `Summon ${egg.dragon.name}`;
      btn.onclick = () => { state.activeDragon = egg.dragon; updateAll(); };
      active.appendChild(btn);
    });
  }
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
  };
  localStorage.setItem('rpgSave', JSON.stringify(data));
}

function loadGame() {
  const data = localStorage.getItem('rpgSave');
  if (data) {
    const parsed = JSON.parse(data);
    state.player = parsed.player;
    state.inventory = parsed.inventory || [];
    state.eggs = parsed.eggs || [];
    state.activeDragon = parsed.activeDragon || null;
    state.currentZone = parsed.currentZone || 0;
    state.unlockedZones = parsed.unlockedZones || 1;
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
