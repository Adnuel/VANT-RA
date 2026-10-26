import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';

const ROOT_DIR = process.cwd();

test('PWA Web Manifest: valid schema, standalone display, branding', () => {
  const manifestPath = path.resolve(ROOT_DIR, 'public/manifest.webmanifest');
  assert.ok(fs.existsSync(manifestPath), 'manifest.webmanifest must exist');
  
  const content = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  assert.equal(content.name, 'VANTÉRA — Technology, Elevated.');
  assert.equal(content.short_name, 'VANTÉRA');
  assert.equal(content.display, 'standalone');
  assert.equal(content.theme_color, '#10100f');
  assert.equal(content.background_color, '#f8f7f4');
  assert.ok(Array.isArray(content.icons) && content.icons.length >= 2, 'Must have at least 2 icons');
});

test('PWA Launcher Icons: files exist and have valid PNG byte signatures', () => {
  const iconFiles = [
    'public/pwa-192x192.png',
    'public/pwa-512x512.png',
    'public/pwa-maskable-512x512.png',
    'public/apple-touch-icon.png',
  ];

  for (const file of iconFiles) {
    const fullPath = path.resolve(ROOT_DIR, file);
    assert.ok(fs.existsSync(fullPath), `${file} must exist`);
    const buffer = fs.readFileSync(fullPath);
    assert.ok(buffer.length > 500, `${file} is too small`);
    // PNG magic bytes: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
    assert.equal(buffer[0], 0x89, `${file} should have PNG signature byte 0`);
    assert.equal(buffer[1], 0x50, `${file} should have PNG signature byte 1`);
    assert.equal(buffer[2], 0x4E, `${file} should have PNG signature byte 2`);
    assert.equal(buffer[3], 0x47, `${file} should have PNG signature byte 3`);
  }
});

test('Capacitor Configuration: verified appId and webDir', () => {
  const configPath = path.resolve(ROOT_DIR, 'capacitor.config.json');
  assert.ok(fs.existsSync(configPath), 'capacitor.config.json must exist');
  
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  assert.equal(config.appId, 'com.vantera.store');
  assert.equal(config.appName, 'VANTÉRA');
  assert.equal(config.webDir, 'dist');
});

test('Native Android Project: Gradle, Manifest, Strings & Mipmap Drawables', () => {
  const appBuildGradle = path.resolve(ROOT_DIR, 'android/app/build.gradle');
  assert.ok(fs.existsSync(appBuildGradle), 'android/app/build.gradle must exist');

  const manifestPath = path.resolve(ROOT_DIR, 'android/app/src/main/AndroidManifest.xml');
  assert.ok(fs.existsSync(manifestPath), 'android AndroidManifest.xml must exist');
  const manifestXml = fs.readFileSync(manifestPath, 'utf8');
  assert.ok(manifestXml.includes('android.intent.action.MAIN'), 'Manifest must have MAIN intent');
  assert.ok(manifestXml.includes('android.intent.category.LAUNCHER'), 'Manifest must have LAUNCHER category');

  const stringsPath = path.resolve(ROOT_DIR, 'android/app/src/main/res/values/strings.xml');
  assert.ok(fs.existsSync(stringsPath), 'strings.xml must exist');
  const stringsXml = fs.readFileSync(stringsPath, 'utf8');
  assert.ok(stringsXml.includes('VANTÉRA'), 'strings.xml must declare app_name VANTÉRA');
  assert.ok(stringsXml.includes('com.vantera.store'), 'strings.xml must declare package_name com.vantera.store');

  const mipmaps = ['mipmap-mdpi', 'mipmap-hdpi', 'mipmap-xhdpi', 'mipmap-xxhdpi', 'mipmap-xxxhdpi'];
  for (const density of mipmaps) {
    const iconPath = path.resolve(ROOT_DIR, `android/app/src/main/res/${density}/ic_launcher.png`);
    assert.ok(fs.existsSync(iconPath), `Missing launcher icon for ${density}`);
  }
});
