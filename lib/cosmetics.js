// Cosmetics catalog and chest drop tables

export const PIECE_SKINS = [
  { id: 'classic-wood', name: 'Classic Wood', rarity: 'common', image: '/cosmetics/pieces/classic-wood.png' },
  { id: 'carbon', name: 'Carbon Fiber', rarity: 'common', image: '/cosmetics/pieces/carbon.png' },
  { id: 'marble', name: 'White Marble', rarity: 'uncommon', image: '/cosmetics/pieces/marble.png' },
  { id: 'crystal', name: 'Crystal Clear', rarity: 'rare', image: '/cosmetics/pieces/crystal.png' },
  { id: 'neon', name: 'Neon Glow', rarity: 'rare', image: '/cosmetics/pieces/neon.png' },
  { id: 'gold', name: 'Pure Gold', rarity: 'epic', image: '/cosmetics/pieces/gold.png' },
  { id: 'solana-gradient', name: 'Solana Gradient', rarity: 'legendary', image: '/cosmetics/pieces/solana.png' },
  { id: 'diamond', name: 'Diamond', rarity: 'legendary', image: '/cosmetics/pieces/diamond.png' },
];

export const BOARD_THEMES = [
  { id: 'classic', name: 'Classic', rarity: 'common', colors: { light: '#f0d9b5', dark: '#b58863' } },
  { id: 'dark-marble', name: 'Dark Marble', rarity: 'uncommon', colors: { light: '#aeaeae', dark: '#4a4a4a' } },
  { id: 'neon-grid', name: 'Neon Grid', rarity: 'rare', colors: { light: '#1a1a2e', dark: '#16213e' } },
  { id: 'galaxy', name: 'Galaxy', rarity: 'rare', colors: { light: '#2d1b69', dark: '#11073b' } },
  { id: 'solana-gradient', name: 'Solana Gradient', rarity: 'epic', colors: { light: '#14F195', dark: '#9945FF' } },
  { id: 'minimal-pro', name: 'Minimal Pro', rarity: 'epic', colors: { light: '#ffffff', dark: '#1a1a1a' } },
  { id: 'emerald', name: 'Emerald', rarity: 'legendary', colors: { light: '#50C878', dark: '#0b5345' } },
  { id: 'sunset', name: 'Sunset', rarity: 'legendary', colors: { light: '#ff7e5f', dark: '#feb47b' } },
];

export const AVATARS = [
  { id: 'default', name: 'Default', rarity: 'common' },
  { id: 'pawn', name: 'Pawn Master', rarity: 'uncommon' },
  { id: 'knight', name: 'Knight Rider', rarity: 'rare' },
  { id: 'bishop', name: 'Bishop', rarity: 'rare' },
  { id: 'rook', name: 'Rook', rarity: 'epic' },
  { id: 'queen', name: 'Queen', rarity: 'epic' },
  { id: 'king', name: 'King', rarity: 'legendary' },
  { id: 'grandmaster', name: 'Grandmaster', rarity: 'legendary' },
];

export const RARITY_WEIGHTS = {
  common: 50,
  uncommon: 30,
  rare: 15,
  epic: 4,
  legendary: 1
};

// Chest drop rates
export const CHEST_DROP_RATES = {
  bronze: {
    common: 0.60,
    uncommon: 0.30,
    rare: 0.08,
    epic: 0.018,
    legendary: 0.002,
    itemCount: 1
  },
  silver: {
    common: 0.40,
    uncommon: 0.35,
    rare: 0.18,
    epic: 0.05,
    legendary: 0.02,
    itemCount: 2
  },
  gold: {
    common: 0.15,
    uncommon: 0.30,
    rare: 0.35,
    epic: 0.15,
    legendary: 0.05,
    itemCount: 3
  }
};

// Shard values for duplicates
export const SHARD_VALUES = {
  common: 5,
  uncommon: 10,
  rare: 25,
  epic: 75,
  legendary: 200
};

// Crafting costs
export const CRAFTING_COSTS = {
  common: 25,
  uncommon: 50,
  rare: 150,
  epic: 400,
  legendary: 1000
};

export function getAllCosmetics() {
  return [
    ...PIECE_SKINS.map(s => ({ ...s, type: 'piece' })),
    ...BOARD_THEMES.map(b => ({ ...b, type: 'board' })),
    ...AVATARS.map(a => ({ ...a, type: 'avatar' }))
  ];
}

export function openChest(chestType, ownedItems = []) {
  const rates = CHEST_DROP_RATES[chestType];
  if (!rates) throw new Error('Invalid chest type');
  
  const allItems = getAllCosmetics();
  const rewards = [];
  let shards = 0;
  
  for (let i = 0; i < rates.itemCount; i++) {
    // Determine rarity
    const roll = Math.random();
    let cumulative = 0;
    let rarity = 'common';
    
    for (const [r, chance] of Object.entries(rates)) {
      if (r === 'itemCount') continue;
      cumulative += chance;
      if (roll < cumulative) {
        rarity = r;
        break;
      }
    }
    
    // Pick item of that rarity
    const itemsOfRarity = allItems.filter(item => item.rarity === rarity);
    if (itemsOfRarity.length === 0) continue;
    
    const item = itemsOfRarity[Math.floor(Math.random() * itemsOfRarity.length)];
    
    // Check if owned (duplicate)
    const itemKey = `${item.type}_${item.id}`;
    if (ownedItems.includes(itemKey)) {
      shards += SHARD_VALUES[rarity];
      rewards.push({ ...item, isDuplicate: true, shardsAwarded: SHARD_VALUES[rarity] });
    } else {
      rewards.push({ ...item, isDuplicate: false });
    }
  }
  
  return { rewards, shards };
}
