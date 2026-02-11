#!/usr/bin/env ts-node
/**
 * Validate that inline constants in action-runner.html match constants.json
 *
 * This prevents configuration drift between the source JSON file and the
 * inlined HubL dictionary (required due to HubL's inability to fetch JSON).
 *
 * Usage: npm run validate:inline-constants
 */

import 'dotenv/config';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const CONSTANTS_JSON_PATH = 'clean-x-hedgehog-templates/config/constants.json';
const ACTION_RUNNER_PATH = 'clean-x-hedgehog-templates/learn/action-runner.html';

interface Constants {
  [key: string]: string | number | boolean;
}

function parseConstantsJson(): Constants {
  const content = readFileSync(CONSTANTS_JSON_PATH, 'utf-8');
  return JSON.parse(content);
}

function extractInlineConstants(templateContent: string): Constants | null {
  // Extract the {% set constants = { ... } %} block more precisely
  // Match from "{% set constants = {" to the closing "} %}"
  const startMatch = templateContent.match(/{% set constants = \{/);
  if (!startMatch) {
    console.error('❌ Could not find start of constants block');
    return null;
  }

  const startIndex = startMatch.index! + startMatch[0].length;
  let braceCount = 1;
  let endIndex = startIndex;

  // Find matching closing brace
  for (let i = startIndex; i < templateContent.length; i++) {
    if (templateContent[i] === '{') braceCount++;
    if (templateContent[i] === '}') braceCount--;
    if (braceCount === 0) {
      endIndex = i;
      break;
    }
  }

  const blockContent = templateContent.substring(startIndex, endIndex);

  // Parse the HubL dictionary into a JavaScript object
  const constants: Constants = {};

  // Match key-value pairs: 'KEY': value
  const keyValueRegex = /'([^']+)':\s*(?:'([^']*)'|(\d+)|true|false)/g;
  let kvMatch;

  while ((kvMatch = keyValueRegex.exec(blockContent)) !== null) {
    const key = kvMatch[1];
    const stringValue = kvMatch[2];
    const numberValue = kvMatch[3];

    if (stringValue !== undefined) {
      constants[key] = stringValue;
    } else if (numberValue !== undefined) {
      constants[key] = numberValue;
    } else if (blockContent.includes(`'${key}': true`)) {
      constants[key] = true;
    } else if (blockContent.includes(`'${key}': false`)) {
      constants[key] = false;
    }
  }

  return constants;
}

function compareConstants(jsonConstants: Constants, inlineConstants: Constants): boolean {
  console.log('🔍 Validating inline constants against constants.json...\n');

  let hasErrors = false;
  const allKeys = new Set([...Object.keys(jsonConstants), ...Object.keys(inlineConstants)]);

  // Check for differences
  for (const key of allKeys) {
    const jsonValue = jsonConstants[key];
    const inlineValue = inlineConstants[key];

    if (jsonValue === undefined) {
      console.log(`⚠️  Extra key in inline: ${key} = ${inlineValue}`);
      hasErrors = true;
    } else if (inlineValue === undefined) {
      console.log(`⚠️  Missing key in inline: ${key} (should be ${jsonValue})`);
      hasErrors = true;
    } else if (jsonValue !== inlineValue) {
      console.log(`❌ Mismatch for ${key}:`);
      console.log(`   JSON:   ${jsonValue}`);
      console.log(`   Inline: ${inlineValue}`);
      hasErrors = true;
    } else {
      console.log(`✅ ${key}: ${jsonValue}`);
    }
  }

  return !hasErrors;
}

async function main() {
  console.log('📋 Inline Constants Validation');
  console.log('═'.repeat(60));
  console.log('');

  try {
    // Read constants.json
    const jsonConstants = parseConstantsJson();
    console.log(`📄 Loaded ${Object.keys(jsonConstants).length} constants from ${CONSTANTS_JSON_PATH}`);

    // Read action-runner.html
    const templateContent = readFileSync(ACTION_RUNNER_PATH, 'utf-8');
    const inlineConstants = extractInlineConstants(templateContent);

    if (!inlineConstants) {
      throw new Error('Failed to parse inline constants from template');
    }

    console.log(`📄 Extracted ${Object.keys(inlineConstants).length} constants from ${ACTION_RUNNER_PATH}`);
    console.log('');

    // Compare
    const isValid = compareConstants(jsonConstants, inlineConstants);

    console.log('');
    console.log('═'.repeat(60));

    if (isValid) {
      console.log('✅ Validation passed! Inline constants match constants.json');
      console.log('');
      return true;
    } else {
      console.log('❌ Validation failed! Inline constants are out of sync');
      console.log('');
      console.log('💡 To fix:');
      console.log('   1. Update clean-x-hedgehog-templates/learn/action-runner.html');
      console.log('   2. Copy values from clean-x-hedgehog-templates/config/constants.json');
      console.log('   3. Run this script again to verify');
      console.log('   4. Publish the template: npm run publish:template');
      console.log('');
      throw new Error('Inline constants validation failed');
    }
  } catch (err: any) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Script failed:', err.message);
  process.exit(1);
});
