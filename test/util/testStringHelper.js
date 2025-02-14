import { sanitizeDescription } from '../../src/util/stringHelper.js';

function testSanitizeDescription() {
  const testDescriptions = [
    'IN HAND: Rocky Talkyie Radio - FREE SHIP!',
    'NEW Tesla Bottle Opener',
    '2023-2024 Panini Prizm NBA Box'
  ]

  for (const testDescription of testDescriptions) {
    console.log(`sanitizeDescription(${testDescription}) = ${sanitizeDescription(testDescription)}`);
  }
}

(() => {
  testSanitizeDescription();
})();