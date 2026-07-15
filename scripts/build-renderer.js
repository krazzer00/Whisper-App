const esbuild = require('esbuild');
const path = require('node:path');

const root = path.resolve(__dirname, '..');

const builds = [
    ['src/ui/app/WhisperApp.js', 'public/build/content.js'],
    ['src/ui/app/HeaderController.js', 'public/build/header.js'],
    ['src/ui/app/RecoveryToast.js', 'public/build/recovery-toast.js'],
];

async function main() {
    for (const [entry, outfile] of builds) {
        await esbuild.build({
            absWorkingDir: root,
            entryPoints: [entry],
            outfile,
            bundle: true,
            format: 'esm',
            platform: 'browser',
            target: ['chrome124'],
            sourcemap: true,
            logLevel: 'info',
        });
    }
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
