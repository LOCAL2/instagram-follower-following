import fs from 'fs';

const MANIFEST_PATH = './extension/manifest.json';
const VERSION_URL = 'https://raw.githubusercontent.com/LOCAL2/instagram-follower-following/main/public/version.json';

function isNewer(remote, local) {
  const r = remote.split('.').map(Number);
  const l = local.split('.').map(Number);
  for (let i = 0; i < Math.max(r.length, l.length); i++) {
    const rv = r[i] || 0;
    const lv = l[i] || 0;
    if (rv > lv) return true;
    if (rv < lv) return false;
  }
  return false;
}

async function testUpdate() {
  console.log('--- IG Follower Tracker Update Logic Test ---');
  
  try {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    const localVersion = manifest.version;
    console.log(`Local Version: ${localVersion}`);

    console.log(`Fetching remote version from: ${VERSION_URL}...`);
    const res = await fetch(VERSION_URL);
    if (!res.ok) throw new Error(`HTTP Error: ${res.status}`);
    
    const remoteData = await res.json();
    const remoteVersion = remoteData.version;
    const remoteDate = remoteData.date;
    console.log(`Remote Version: ${remoteVersion} (Released: ${remoteDate})`);

    const hasUpdate = isNewer(remoteVersion, localVersion);
    console.log(`Update Available: ${hasUpdate ? 'YES ✅' : 'NO ❌'}`);

    if (hasUpdate) {
      console.log(`[PASS] Logic would show banner for v${remoteVersion}`);
    } else if (remoteVersion === localVersion) {
      console.log(`[NOTE] Local is already up-to-date with remote. No banner expected.`);
    } else {
      console.log(`[NOTE] Local version (${localVersion}) is actually AHEAD of remote (${remoteVersion}). No banner expected.`);
      console.log(`Tip: If you just bumped the version locally, you need to push to GitHub/Deploy to Vercel for the tracker to 'see' the update.`);
    }

  } catch (err) {
    console.error('Test Failed:', err.message);
  }
}

testUpdate();
