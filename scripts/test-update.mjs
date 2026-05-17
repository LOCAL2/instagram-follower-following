import fs from 'fs';

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

async function runTests() {
  console.log('=== Update Logic Unit Tests ===');
  const testCases = [
    { r: '1.0.28', l: '1.0.27', expected: true,  desc: 'Patch version up' },
    { r: '1.1.0',  l: '1.0.28', expected: true,  desc: 'Minor version up' },
    { r: '2.0.0',  l: '1.9.9',  expected: true,  desc: 'Major version up' },
    { r: '1.0.28', l: '1.0.28', expected: false, desc: 'Same version' },
    { r: '1.0.25', l: '1.0.28', expected: false, desc: 'Older remote version' }
  ];

  testCases.forEach(({ r, l, expected, desc }) => {
    const result = isNewer(r, l);
    const pass = result === expected;
    console.log(`[${pass ? 'PASS' : 'FAIL'}] ${desc.padEnd(20)} | Remote: ${r} | Local: ${l} | Result: ${result}`);
  });

  console.log('\n=== Live Environment Check ===');
  try {
    const MANIFEST_PATH = './extension/manifest.json';
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
    const localV = manifest.version;
    
    // Fetch real remote data
    const url = 'https://raw.githubusercontent.com/LOCAL2/instagram-follower-following/main/public/version.json';
    const res = await fetch(url);
    const remoteData = await res.json();
    const remoteV = remoteData.version;

    console.log(`Current Local Manifest: ${localV}`);
    console.log(`Current Remote GitHub:   ${remoteV}`);
    
    const showBanner = isNewer(remoteV, localV);
    console.log(`Banner would show? ${showBanner ? 'YES ✅' : 'NO (เพราะเครื่องคุณใหม่กว่าหรือเท่ากับบน GitHub)'}`);
    
    if (!showBanner) {
      console.log('\n[!] สรุป: สาเหตุที่คุณไม่เห็นปุ่ม Update เป็นเพราะ Version ในเครื่องคุณตอนนี้คือ ' + localV + ' ซึ่ง "ใหม่กว่า" บน GitHub ('+remoteV+') ครับ');
      console.log('    หากต้องการเห็นปุ่มทดสอบ ให้ลองแก้ version ใน manifest.json เป็น 1.0.0 แล้วรีเฟรชหน้า Instagram ดูครับ');
    }

  } catch (err) {
    console.error('Environment check failed:', err.message);
  }
}

runTests();
