import { WEAPONS } from './config.js';

export function canResupply(game, choice) {
  if (choice === 'health') return game.health < 100;
  if (choice === 'armor') return game.armor < 50;
  if (choice === 'ammo') return game.weaponStates.some((state, index) => state.reserve < WEAPONS[index].reserve * 2);
  return choice === 'continue';
}

export function applyResupply(game, choice) {
  if (game.state !== 'RESUPPLY' || !canResupply(game, choice)) return false;
  if (choice === 'health') game.health = Math.min(100, game.health + 35);
  if (choice === 'armor') game.armor = Math.min(50, game.armor + 35);
  if (choice === 'ammo') game.weaponStates.forEach((state, index) => {
    state.reserve = Math.min(WEAPONS[index].reserve * 2, state.reserve + Math.ceil(WEAPONS[index].reserve / 2));
  });
  // Consume the choice synchronously; double-clicks cannot grant a second reward.
  game.state = 'PLAYING';
  return true;
}
