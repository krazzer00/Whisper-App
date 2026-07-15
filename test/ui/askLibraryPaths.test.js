const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('AskView loads vendored libraries relative to content.html', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '..', '..', 'src/ui/ask/AskView.js'), 'utf8');
    assert.doesNotMatch(source, /loadScript\('\.\.\/\.\.\/assets\//);
    assert.match(source, /loadScript\('\.\.\/assets\/highlight-11\.9\.0\.min\.js'\)/);
    assert.match(source, /loadScript\('\.\.\/assets\/dompurify-3\.0\.7\.min\.js'\)/);
});

test('SummaryView loads vendored libraries relative to content.html', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '..', '..', 'src/ui/listen/summary/SummaryView.js'), 'utf8');
    assert.doesNotMatch(source, /loadScript\('\.\.\/\.\.\/\.\.\/assets\//);
    assert.match(source, /loadScript\('\.\.\/assets\/highlight-11\.9\.0\.min\.js'\)/);
});
