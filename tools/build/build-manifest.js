#!/usr/bin/env node

import { create, ts } from '@custom-elements-manifest/analyzer';
import { litPlugin } from '@custom-elements-manifest/analyzer/src/features/framework-plugins/lit/lit.js';
import { glob } from 'glob';
import fs from 'node:fs/promises';
import path from 'node:path';
import { cssPropertiesPlugin } from '@lime-soda/cem-plugin-css-properties';

/**
 * Runs Custom Elements Manifest analysis programmatically with CSS custom properties plugin
 * @returns {Promise<Object>} Generated manifest with CSS properties
 */
async function runCEMAnalysis() {
  console.log('🔍 Analyzing TypeScript files...');

  // Find all TypeScript files. Tests sit next to the source they cover, and a
  // manifest is a description of the published package — a test file in it is
  // noise at best, and at worst documents an element that only exists in a
  // fixture.
  const sourceFiles = await glob('src/**/*.ts', {
    ignore: ['src/**/*.test.ts', 'src/**/*.bench.ts'],
  });

  if (sourceFiles.length === 0) {
    throw new Error('No TypeScript files found in src/ directory');
  }

  console.log(`📄 Found ${sourceFiles.length} TypeScript files`);

  // Create TypeScript source files
  const modules = await Promise.all(
    sourceFiles.map(async (filePath) => {
      const content = await fs.readFile(filePath, 'utf-8');
      return ts.createSourceFile(filePath, content, ts.ScriptTarget.ES2015, true);
    }),
  );

  // Import design tokens
  const tokensModule = await import('@lime-soda/tokens');
  const tokens = tokensModule.default;

  // Prepare plugins array
  const plugins = [
    ...litPlugin(),
    cssPropertiesPlugin(tokens, {
      prefix: 'ls', // Remove 'ls-' prefix from element names (dash added automatically)
    }),
  ];

  // Run CEM analysis with plugins enabled
  const manifest = create({
    modules,
    plugins,
    context: { dev: false, litelement: true },
  });

  console.log('✅ Custom Elements Manifest analysis complete');
  return manifest;
}

/**
 * Main function to build manifest
 */
async function buildManifest() {
  const manifestPath = path.join(process.cwd(), 'custom-elements.json');

  try {
    console.log('🚀 Building Custom Elements Manifest...');

    // Run CEM analysis with CSS custom properties plugin
    const manifest = await runCEMAnalysis();

    // Write final manifest
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

    const tokenCount = manifest.modules?.[0]?.declarations?.[0]?.cssProperties?.length || 0;

    console.log('✨ Custom Elements Manifest built successfully!');
    console.log(`📁 Written to: ${manifestPath}`);
    if (tokenCount > 0) {
      console.log(`🎨 Includes ${tokenCount} CSS properties from design tokens`);
    }
  } catch (error) {
    console.error('❌ Error building manifest:', error.message);
    process.exit(1);
  }
}

// CLI usage
void buildManifest();
