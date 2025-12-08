// Simple RNG Looter RPG built with vanilla JS
// Systems: combat, loot, skills, dragons, events, saving

const ENEMY_SCALE = 2;

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
  const prestigeBonus = 1 + (state.prestige || 0) * 0.03;
  const gearStats = { hp: 0, attack: 0, defense: 0, crit: 0, critdmg: 0, speed: 0, elemental: 0 };
  Object.values(player.equipment).forEach(item => {
    if (!item) return;
    item.stats.forEach(s => { gearStats[s.key] = (gearStats[s.key] || 0) + s.value; });
  });
  const dragonFactor = 1 + (player.modifiers.dragonBond || 0);
  const dragonStats = state.activeDragon ? Object.fromEntries(Object.entries(state.activeDragon.bonus).map(([k, v]) => [k, Math.round(v * dragonFactor)])) : {};
  return {
    maxHP: Math.round((baseStats.hp + (gearStats.hp || 0) + (dragonStats.hp || 0) + (player.flat.hp || 0)) * (1 + player.modifiers.hp) * prestigeBonus),
    attack: Math.round((baseStats.attack + (gearStats.attack || 0) + (dragonStats.attack || 0) + (player.flat.attack || 0)) * (1 + player.modifiers.attack) * prestigeBonus) + (player.flat.elemental || 0) + (dragonStats.elemental || 0),
    defense: Math.round((baseStats.defense + (gearStats.defense || 0) + (dragonStats.defense || 0)) * (1 + player.modifiers.defense) * prestigeBonus),
    crit: (baseStats.crit + (gearStats.crit || 0) + (dragonStats.crit || 0)) * (1 + player.modifiers.crit) * prestigeBonus,
    critdmg: 1.5 + (gearStats.critdmg || 0) / 100 + player.modifiers.critdmg + (dragonStats.critdmg || 0),
    speed: (baseStats.speed || 0) + (gearStats.speed || 0) + (player.flat.speed || 0) + (dragonStats.speed || 0),
    elemental: (gearStats.elemental || 0) + (dragonStats.elemental || 0),
  };
}

function pickEnemy(zone, boss = false) {
  const choice = boss ? zone.boss : zone.enemies[Math.floor(Math.random() * zone.enemies.length)];
  const scaledHP = Math.round(choice.hp * ENEMY_SCALE);
  const scaledAttack = Math.round(choice.attack * ENEMY_SCALE);
  return { ...choice, hp: scaledHP, attack: scaledAttack, currentHP: scaledHP };
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
    player.currentResource = player.maxResource;
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
    this.updateActionButtons();
    this.beginTurn(this.turn || 'player');
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
      entity.currentResource = Math.min(entity.maxResource, entity.currentResource + 3);
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
  playerAction(type, skillId) {
    if (!this.active || this.turn !== 'player') return;
    const playerStats = this.computePlayerStats();
    const enemyStats = this.computeEnemyStats();
    if (type === 'skill') {
      const skill = activeSkills[this.battle.player.class].find(s => s.id === skillId);
      if (!this.canUseSkill(skill)) return;
      this.battle.player.currentResource -= skill.cost;
      this.battle.skillCooldowns[skill.id] = skill.cooldown;
      skill.action({ player: this.battle.player, enemy: this.battle.enemy, playerStats, enemyStats, isBoss: this.battle.isBoss });
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
    }
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
    return this.battle.player.currentResource >= skill.cost && cd <= 0;
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

function startFight(boss = false, auto = false) {
  if (CombatSystem.active) { logMessage('Finish the current fight first.'); return; }
  const zone = zones[state.currentZone];
  const bossLevelLock = zone.level + 2;
  let bossFight = boss;
  if (bossFight && state.player.level < bossLevelLock) {
    logMessage(`Boss locked until level ${bossLevelLock}. Keep leveling!`);
    return;
  }
  if (!bossFight && state.player.level >= bossLevelLock && Math.random() < 0.2) {
    bossFight = true;
    logMessage('A roaming boss challenges you!');
  }
  if (bossFight && Math.random() < 0.35) {
    bossFight = false;
    logMessage('No boss this time—regular foes appear.');
  }
  state.currentEnemy = pickEnemy(zone, bossFight);
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
  const count = Math.max(1, Math.min(10, parseInt(document.getElementById('auto-count').value) || 1));
  state.autoMode = { remaining: count, boss };
  startFight(boss, true);
}

function finishCombat(result, bossFlag) {
  const payload = typeof result === 'object' ? result : { victory: result, boss: bossFlag };
  const victory = payload.victory;
  const boss = payload.boss;
  const player = state.player;
  const zone = zones[state.currentZone];
  if (victory) {
    const xpBoost = 1 + (player.modifiers.xpBoost || 0);
    const xpGain = Math.max(1, Math.round(state.currentEnemy.xp * (1/3) * xpBoost));
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
  player.currentResource = Math.min(player.currentResource + 4, player.maxResource);
  updateAll();
  if (state.autoMode && state.autoMode.remaining > 1 && player.currentHP > 0) {
    state.autoMode.remaining -= 1;
    startFight(state.autoMode.boss, true);
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

function generateShop() {
  if (!state.player) return;
  state.shop = [];
  const level = state.player.level;
  for (let i = 0; i < 3; i++) {
    const item = generateItem(level + i, false);
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
  const filtered = filteredInventoryItems();
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

function valueFromItem(item) {
  if (item.type === 'potion') return Math.max(5, Math.round(item.price * 0.5));
  if (item.type === 'egg') return valueFromEgg(item);
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
  document.getElementById('player-prestige').textContent = `Prestige ${state.prestige || 0}`;
  const hpPct = Math.max(0, Math.min(1, p.currentHP / derived.maxHP));
  document.getElementById('hp-bar').style.width = `${hpPct * 100}%`;
  document.getElementById('hp-text').textContent = `${p.currentHP}/${derived.maxHP} HP`;
  const resPct = Math.max(0, Math.min(1, p.currentResource / p.maxResource));
  document.getElementById('resource-bar').style.width = `${resPct * 100}%`;
  document.getElementById('resource-text').textContent = `${classResources[p.class]}: ${Math.floor(p.currentResource)}/${p.maxResource}`;
  const xpPct = Math.max(0, Math.min(1, p.xp / p.xpToNext));
  document.getElementById('xp-bar').style.width = `${xpPct * 100}%`;
  document.getElementById('xp-text').textContent = `${p.xp}/${p.xpToNext} XP`;
}

function updateBars() {
  if (!state.currentEnemy) return;
  const pct = Math.max(0, Math.min(1, state.currentEnemy.currentHP / state.currentEnemy.hp));
  const enemyBar = document.querySelector('.bar.enemy');
  if (enemyBar) enemyBar.classList.toggle('boss', !!state.currentEnemy.boss);
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
  CombatSystem.updateActionButtons();
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
    state.prestige = parsed.prestige || 0;
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
  document.getElementById('attack-btn').onclick = () => CombatSystem.playerAction('attack');
  document.getElementById('refresh-shop').onclick = () => { generateShop(); renderShop(); saveGame(); };
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
