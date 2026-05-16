// Run: node bookmarklet/generate.mjs
// This generates a bookmarklet you can drag to your browser bookmarks bar.
// When clicked on instagram.com, it injects the tracker UI directly.

const code = `
(function() {
  if (window.location.origin !== 'https://www.instagram.com') {
    alert('Please navigate to instagram.com first, then click the bookmarklet again.');
    window.location.href = 'https://www.instagram.com';
    return;
  }

  // Remove existing panel if present
  const existing = document.getElementById('__ig_tracker__');
  if (existing) { existing.remove(); return; }

  // ---- Styles ----
  const style = document.createElement('style');
  style.textContent = \`
    #__ig_tracker__ {
      position: fixed; top: 0; right: 0; width: 420px; max-width: 100vw;
      height: 100vh; background: #fff; box-shadow: -4px 0 24px rgba(0,0,0,.18);
      z-index: 999999; display: flex; flex-direction: column;
      font-family: system-ui, sans-serif; font-size: 14px; color: #333;
      border-left: 1px solid #e0e0e0;
    }
    @media (max-width: 480px) {
      #__ig_tracker__ { width: 100vw; height: 100vh; top: 0; left: 0; right: 0; bottom: 0; }
    }
    #__ig_tracker__ * { box-sizing: border-box; }
    #__igt_header__ {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px; border-bottom: 1px solid #eee;
      background: linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888);
    }
    #__igt_header__ h2 { color: #fff; margin: 0; font-size: 16px; font-weight: 700; }
    #__igt_close__ {
      background: rgba(255,255,255,.25); border: none; color: #fff;
      width: 28px; height: 28px; border-radius: 50%; cursor: pointer;
      font-size: 16px; display: flex; align-items: center; justify-content: center;
    }
    #__igt_body__ { flex: 1; overflow-y: auto; padding: 16px; }
    #__igt_form__ { display: flex; gap: 8px; margin-bottom: 16px; }
    #__igt_input__ {
      flex: 1; padding: 10px 12px; border: 2px solid #ddd; border-radius: 10px;
      font-size: 14px; outline: none; transition: border-color .2s;
    }
    #__igt_input__:focus { border-color: #c13584; }
    #__igt_btn__ {
      padding: 10px 16px; background: linear-gradient(135deg,#dc2743,#bc1888);
      color: #fff; border: none; border-radius: 10px; font-size: 14px;
      font-weight: 600; cursor: pointer; white-space: nowrap;
    }
    #__igt_btn__:disabled { opacity: .5; cursor: not-allowed; }
    #__igt_status__ { font-size: 13px; color: #888; margin-bottom: 12px; min-height: 20px; }
    #__igt_stats__ {
      display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 16px;
    }
    .igt-stat {
      background: #f8f7fb; border-radius: 10px; padding: 12px; text-align: center;
    }
    .igt-stat-n { font-size: 22px; font-weight: 700; color: #08060d; display: block; }
    .igt-stat-l { font-size: 11px; color: #888; }
    .igt-stat.danger .igt-stat-n { color: #ef4444; }
    .igt-stat.accent .igt-stat-n { color: #c13584; }
    #__igt_tabs__ { display: flex; gap: 4px; border-bottom: 2px solid #eee; margin-bottom: 12px; }
    .igt-tab {
      padding: 8px 12px; background: none; border: none; border-bottom: 2px solid transparent;
      margin-bottom: -2px; font-size: 13px; font-weight: 500; color: #888; cursor: pointer;
      display: flex; align-items: center; gap: 6px;
    }
    .igt-tab.active { color: #c13584; border-bottom-color: #c13584; }
    .igt-tab-count {
      background: #f0eef4; color: #888; font-size: 11px; font-weight: 600;
      padding: 1px 6px; border-radius: 99px;
    }
    .igt-tab.active .igt-tab-count { background: rgba(193,53,132,.12); color: #c13584; }
    #__igt_list__ { list-style: none; padding: 0; margin: 0; }
    .igt-user {
      display: flex; align-items: center; gap: 10px; padding: 8px 4px;
      border-radius: 8px; transition: background .15s;
    }
    .igt-user:hover { background: #f5f5f5; }
    .igt-avatar { width: 40px; height: 40px; border-radius: 50%; object-fit: cover; background: #eee; flex-shrink: 0; }
    .igt-info { flex: 1; min-width: 0; }
    .igt-uname {
      font-size: 13px; font-weight: 600; color: #08060d; text-decoration: none;
      display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .igt-uname:hover { color: #c13584; }
    .igt-fname { font-size: 11px; color: #888; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .igt-empty { text-align: center; padding: 32px; color: #aaa; }
    .igt-error { background: #fef2f2; border: 1px solid #fca5a5; color: #dc2626; border-radius: 8px; padding: 10px 14px; margin-bottom: 12px; font-size: 13px; }
  \`;
  document.head.appendChild(style);

  // ---- Panel HTML ----
  const panel = document.createElement('div');
  panel.id = '__ig_tracker__';
  panel.innerHTML = \`
    <div id="__igt_header__">
      <h2>📊 Follower Tracker</h2>
      <button id="__igt_close__" title="Close">✕</button>
    </div>
    <div id="__igt_body__">
      <form id="__igt_form__">
        <input id="__igt_input__" type="text" placeholder="instagram_username" autocomplete="off" autocapitalize="none" spellcheck="false" />
        <button id="__igt_btn__" type="submit">ตรวจสอบ</button>
      </form>
      <div id="__igt_status__"></div>
      <div id="__igt_content__"></div>
    </div>
  \`;
  document.body.appendChild(panel);

  document.getElementById('__igt_close__').onclick = () => panel.remove();

  // ---- API Logic ----
  const fetchOpts = { credentials: 'include', headers: { 'X-IG-App-ID': '936619743392459' }, method: 'GET' };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const rand = (a, b) => Math.floor(Math.random() * (b - a)) + a;

  const setStatus = t => { document.getElementById('__igt_status__').textContent = t; };
  const setContent = h => { document.getElementById('__igt_content__').innerHTML = h; };

  async function loadList(list, uid, count, maxId, onBatch) {
    let url = \`https://www.instagram.com/api/v1/friendships/\${uid}/\${list}/?count=\${count}\`;
    if (maxId) url += \`&max_id=\${maxId}\`;
    const d = await fetch(url, fetchOpts).then(r => r.json());
    onBatch(d.users.length);
    if (d.next_max_id) {
      await sleep(rand(800, 1500));
      return d.users.concat(await loadList(list, uid, count, d.next_max_id, onBatch));
    }
    return d.users;
  }

  async function getUserId(uname) {
    const url = \`https://www.instagram.com/api/v1/web/search/topsearch/?context=blended&query=\${uname.toLowerCase()}&include_reel=false\`;
    const d = await fetch(url, fetchOpts).then(r => r.json());
    const r = d.users?.find(x => x.user.username.toLowerCase() === uname.toLowerCase());
    return r?.user?.pk || null;
  }

  function renderResults(followers, following) {
    const fSet = new Set(followers.map(u => u.username.toLowerCase()));
    const gSet = new Set(following.map(u => u.username.toLowerCase()));
    const fMap = new Map(followers.map(u => [u.username.toLowerCase(), u]));
    const gMap = new Map(following.map(u => [u.username.toLowerCase(), u]));

    const notBack = [...gSet].filter(u => !fSet.has(u)).map(u => gMap.get(u));
    const iDont = [...fSet].filter(u => !gSet.has(u)).map(u => fMap.get(u));

    let activeTab = 'notBack';

    function renderList(list) {
      if (!list.length) return '<div class="igt-empty">🎉 ไม่มีรายการ</div>';
      return '<ul id="__igt_list__">' + list.map(u => \`
        <li class="igt-user">
          <img class="igt-avatar" src="\${u.profile_pic_url}" loading="lazy" onerror="this.src='https://ui-avatars.com/api/?name=\${u.username}&size=40'" alt="" />
          <div class="igt-info">
            <a class="igt-uname" href="https://www.instagram.com/\${u.username}/" target="_blank">@\${u.username}</a>
            \${u.full_name ? \`<span class="igt-fname">\${u.full_name}</span>\` : ''}
          </div>
        </li>
      \`).join('') + '</ul>';
    }

    function render() {
      const list = activeTab === 'notBack' ? notBack : iDont;
      document.getElementById('__igt_list_wrap__').innerHTML = renderList(list);
    }

    setContent(\`
      <div id="__igt_stats__">
        <div class="igt-stat"><span class="igt-stat-n">\${followers.length}</span><span class="igt-stat-l">Followers</span></div>
        <div class="igt-stat"><span class="igt-stat-n">\${following.length}</span><span class="igt-stat-l">Following</span></div>
        <div class="igt-stat danger"><span class="igt-stat-n">\${notBack.length}</span><span class="igt-stat-l">ไม่ follow กลับ</span></div>
        <div class="igt-stat accent"><span class="igt-stat-n">\${iDont.length}</span><span class="igt-stat-l">ฉันไม่ได้ follow กลับ</span></div>
      </div>
      <div id="__igt_tabs__">
        <button class="igt-tab active" data-tab="notBack">ไม่ follow กลับ <span class="igt-tab-count">\${notBack.length}</span></button>
        <button class="igt-tab" data-tab="iDont">ฉันไม่ได้ follow กลับ <span class="igt-tab-count">\${iDont.length}</span></button>
      </div>
      <div id="__igt_list_wrap__"></div>
    \`);

    render();

    document.querySelectorAll('.igt-tab').forEach(btn => {
      btn.onclick = () => {
        activeTab = btn.dataset.tab;
        document.querySelectorAll('.igt-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        render();
      };
    });
  }

  document.getElementById('__igt_form__').onsubmit = async (e) => {
    e.preventDefault();
    const uname = document.getElementById('__igt_input__').value.trim();
    if (!uname) return;
    const btn = document.getElementById('__igt_btn__');
    btn.disabled = true;
    setContent('');

    try {
      setStatus('กำลังค้นหา user ID...');
      const uid = await getUserId(uname);
      if (!uid) throw new Error(\`ไม่พบ username "\${uname}"\`);

      let fc = 0, gc = 0;
      setStatus('กำลังโหลด followers...');
      const followers = await loadList('followers', uid, 50, '', n => { fc += n; setStatus(\`โหลด followers \${fc} คน...\`); });
      setStatus('กำลังโหลด following...');
      const following = await loadList('following', uid, 50, '', n => { gc += n; setStatus(\`โหลด following \${gc} คน...\`); });

      setStatus('');
      renderResults(followers, following);
    } catch(err) {
      setContent(\`<div class="igt-error">❌ \${err.message}</div>\`);
      setStatus('');
    } finally {
      btn.disabled = false;
    }
  };
})();
`;

// Minify slightly and create bookmarklet
const bookmarklet = 'javascript:' + encodeURIComponent(code.trim());

console.log('\n=== BOOKMARKLET ===');
console.log('Copy the text below and create a new bookmark with this as the URL:\n');
console.log(bookmarklet);
console.log('\n=== INSTRUCTIONS ===');
console.log('1. Copy the text above');
console.log('2. In your browser, create a new bookmark');
console.log('3. Paste the text as the URL/address of the bookmark');
console.log('4. Navigate to https://www.instagram.com and make sure you are logged in');
console.log('5. Click the bookmark — a panel will slide in from the right');
console.log('6. Type your Instagram username and click ตรวจสอบ');
