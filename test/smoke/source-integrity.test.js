const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..', '..');

test('reconstructed project exposes deterministic build and package scripts', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

    assert.equal(pkg.devDependencies.electron, '30.5.1');
    assert.ok(pkg.scripts.test);
    assert.ok(pkg.scripts['build:renderer']);
    assert.ok(pkg.scripts['build:native']);
    assert.ok(pkg.scripts['dist:win']);
    assert.equal(pkg.build.win.target[0].target, 'nsis');
    assert.deepEqual(pkg.build.win.target[0].arch, ['x64']);
    assert.ok(pkg.build.extraResources.some(item => item.to === 'native/windows-audio-helper'));
    assert.ok(pkg.build.extraResources.some(item => item.to === 'out'));
    assert.ok(pkg.build.extraResources.some(item => item.to === 'app-update.yml'));
});

test('renderer and native build entry points exist', () => {
    for (const relativePath of [
        'src/ui/app/WhisperApp.js',
        'src/ui/app/HeaderController.js',
        'src/ui/app/RecoveryToast.js',
        'scripts/build-renderer.js',
        'scripts/build-native.ps1',
        'whisper_web/backend_node/dist/index.js',
        'whisper_web/out/index.html',
    ]) {
        assert.ok(fs.existsSync(path.join(root, relativePath)), `${relativePath} is missing`);
    }
});
