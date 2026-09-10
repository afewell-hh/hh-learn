/**
 * experience-player.entry — browser bootstrap for the Slice 1 Fabric Operator replay.
 *
 * Bundled (with player-core + player-view) into the shipped IIFE asset
 * clean-x-hedgehog-templates/assets/js/experience-player.js by
 * scripts/experiences/generate-player-asset.ts. Not loaded in Node.
 */
import { mountExperiencePlayer } from '../player-view';

function boot(): void {
  const roots = document.querySelectorAll('[data-hhl-experience]');
  roots.forEach((node) => mountExperiencePlayer(node as HTMLElement));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
