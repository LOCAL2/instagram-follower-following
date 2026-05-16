// Instagram Follower Tracker — Content Script (realtime streaming)

;(function () {
  // Guard: ถ้า inject ซ้ำ ให้แค่ toggle panel
  if (window.__igt_loaded__) {
    const existing = document.getElementById('__igt_panel__')
    if (existing) existing.remove()
    else createPanel()
    return
  }
  window.__igt_loaded__ = true

  const PANEL_ID = '__igt_panel__'

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'TOGGLE_PANEL') togglePanel()
  })

  function togglePanel() {
    const existing = document.getElementById(PANEL_ID)
    if (existing) { existing.remove(); return }
    createPanel()
  }

  // ── API ──────────────────────────────────────────────────────────────────────

  const fetchOpts = {
    credentials: 'include',
    headers: { 'X-IG-App-ID': '936619743392459' },
    method: 'GET',
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const rand  = (a, b) => Math.floor(Math.random() * (b - a)) + a

  async function igFetch(path) {
    const res = await fetch(`https://www.instagram.com${path}`, fetchOpts)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  }

  async function getUserId(username) {
    const lower = username.toLowerCase()
    const data  = await igFetch(`/api/v1/web/search/topsearch/?context=blended&query=${lower}&include_reel=false`)
    const result = data.users?.find((r) => r.user.username.toLowerCase() === lower)
    return result?.user?.pk ?? null
  }

  // Streaming version — calls onBatch(users[]) after every page
  async function loadListStream(list, userId, maxId, onBatch) {
    let path = `/api/v1/friendships/${userId}/${list}/?count=50`
    if (maxId) path += `&max_id=${maxId}`
    const data = await igFetch(path)
    onBatch(data.users)                          // ← stream this batch immediately
    if (data.next_max_id) {
      await sleep(rand(800, 1500))
      await loadListStream(list, userId, data.next_max_id, onBatch)
    }
  }

  // ── Panel HTML ───────────────────────────────────────────────────────────────

  function createPanel() {
    const panel = document.createElement('div')
    panel.id = PANEL_ID
    panel.innerHTML = `
      <div class="igt-header">
        <div class="igt-header-left">
          <div class="igt-logo" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <rect x="2" y="2" width="20" height="20" rx="5" stroke="white" stroke-width="2"/>
              <circle cx="12" cy="12" r="4" stroke="white" stroke-width="2"/>
              <circle cx="17.5" cy="6.5" r="1.2" fill="white"/>
            </svg>
          </div>
          <div>
            <div class="igt-title">Follower Tracker</div>
            <div class="igt-subtitle">ตรวจสอบ follower</div>
          </div>
        </div>
        <button class="igt-close" id="igt-close" aria-label="ปิด">✕</button>
      </div>
      <div class="igt-body">
        <form class="igt-form" id="igt-form">
          <div class="igt-input-wrap">
            <span class="igt-at">@</span>
            <input id="igt-input" class="igt-input" type="text"
              placeholder="instagram_username"
              autocomplete="off" autocapitalize="none" spellcheck="false"/>
          </div>
          <button class="igt-btn" id="igt-btn" type="submit">ตรวจสอบ</button>
        </form>
        <div id="igt-status" class="igt-status" role="status" aria-live="polite"></div>
        <div id="igt-progress-wrap" class="igt-progress-wrap" hidden>
          <div class="igt-progress-bar"><div class="igt-progress-fill"></div></div>
        </div>
        <div id="igt-content"></div>
      </div>
    `
    document.body.appendChild(panel)
    document.getElementById('igt-close').onclick = () => panel.remove()
    document.getElementById('igt-form').onsubmit = async (e) => {
      e.preventDefault()
      const username = document.getElementById('igt-input').value.trim()
      if (username) await runSearch(username)
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const $ = (id) => document.getElementById(id)
  const setStatus   = (t) => { const el = $('igt-status');        if (el) el.textContent = t }
  const setProgress = (v) => { const el = $('igt-progress-wrap'); if (el) el.hidden = !v }
  const setContent  = (h) => { const el = $('igt-content');       if (el) el.innerHTML = h }

  function userCard(u) {
    return `<li class="igt-user">
      <img class="igt-avatar" src="${u.profile_pic_url}" loading="lazy"
        onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(u.username)}&size=40&background=random'" alt=""/>
      <div class="igt-info">
        <a class="igt-uname" href="https://www.instagram.com/${u.username}/" target="_blank">@${u.username}</a>
        ${u.full_name ? `<span class="igt-fname">${u.full_name}</span>` : ''}
      </div>
    </li>`
  }

  // ── Main search (realtime streaming) ─────────────────────────────────────────

  async function runSearch(username) {
    const btn = $('igt-btn')
    btn.disabled = true
    btn.textContent = 'กำลังโหลด...'
    setProgress(true)
    setContent('')

    // State
    const followers = []   // all followers collected so far
    const following = []   // all following collected so far
    let phase = 'followers' // 'followers' | 'following' | 'done'
    let activeTab = 'notBack'

    // ── Render stats bar ──
    function renderStats() {
      const fSet = new Set(followers.map((u) => u.username.toLowerCase()))
      const gSet = new Set(following.map((u) => u.username.toLowerCase()))
      const notBackCount = [...gSet].filter((u) => !fSet.has(u)).length
      const iDontCount   = [...fSet].filter((u) => !gSet.has(u)).length

      const statsEl = $('igt-stats-bar')
      if (!statsEl) return
      statsEl.innerHTML = `
        <div class="igt-stat"><span class="igt-stat-n">${followers.length}</span><span class="igt-stat-l">Followers</span></div>
        <div class="igt-stat"><span class="igt-stat-n">${following.length}</span><span class="igt-stat-l">Following</span></div>
        <div class="igt-stat danger"><span class="igt-stat-n">${notBackCount}</span><span class="igt-stat-l">ไม่ follow กลับ</span></div>
        <div class="igt-stat accent"><span class="igt-stat-n">${iDontCount}</span><span class="igt-stat-l">ฉันไม่ follow กลับ</span></div>
      `
      // update tab badges
      const tabNotBack = $('igt-tab-notback')
      const tabIDont   = $('igt-tab-idont')
      if (tabNotBack) tabNotBack.querySelector('.igt-badge').textContent = notBackCount
      if (tabIDont)   tabIDont.querySelector('.igt-badge').textContent   = iDontCount
    }

    // ── Render list for active tab ──
    function renderList() {
      const wrap = $('igt-list-wrap')
      if (!wrap) return

      const fSet = new Set(followers.map((u) => u.username.toLowerCase()))
      const gSet = new Set(following.map((u) => u.username.toLowerCase()))
      const fMap = new Map(followers.map((u) => [u.username.toLowerCase(), u]))
      const gMap = new Map(following.map((u) => [u.username.toLowerCase(), u]))

      const list = activeTab === 'notBack'
        ? [...gSet].filter((u) => !fSet.has(u)).map((u) => gMap.get(u))
        : [...fSet].filter((u) => !gSet.has(u)).map((u) => fMap.get(u))

      if (!list.length) {
        wrap.innerHTML = phase === 'done'
          ? '<div class="igt-empty">🎉 ไม่มีรายการ</div>'
          : '<div class="igt-loading-hint">กำลังโหลด...</div>'
        return
      }

      // Incremental update — only append new items instead of full re-render
      const existingCount = wrap.querySelectorAll('.igt-user').length
      if (existingCount === 0) {
        wrap.innerHTML = `<ul class="igt-list">${list.map(userCard).join('')}</ul>`
      } else if (list.length > existingCount) {
        const ul = wrap.querySelector('.igt-list')
        if (ul) {
          const newItems = list.slice(existingCount).map(userCard).join('')
          ul.insertAdjacentHTML('beforeend', newItems)
        }
      }
    }

    // ── Build initial UI skeleton ──
    setContent(`
      <div class="igt-stats" id="igt-stats-bar"></div>
      <div class="igt-tabs">
        <button class="igt-tab active" id="igt-tab-notback" data-tab="notBack">
          ไม่ follow กลับ <span class="igt-badge">0</span>
        </button>
        <button class="igt-tab" id="igt-tab-idont" data-tab="iDont">
          ฉันไม่ follow กลับ <span class="igt-badge">0</span>
        </button>
      </div>
      <div id="igt-list-wrap"></div>
    `)

    // Tab click handlers
    document.querySelectorAll(`#${PANEL_ID} .igt-tab`).forEach((tabBtn) => {
      tabBtn.onclick = () => {
        activeTab = tabBtn.dataset.tab
        document.querySelectorAll(`#${PANEL_ID} .igt-tab`).forEach((b) => b.classList.remove('active'))
        tabBtn.classList.add('active')
        // Full re-render on tab switch
        const wrap = $('igt-list-wrap')
        if (wrap) wrap.innerHTML = ''
        renderList()
      }
    })

    try {
      setStatus('กำลังค้นหา user ID...')
      const userId = await getUserId(username)
      if (!userId) throw new Error(`ไม่พบ username "${username}"`)

      // ── Stream followers ──
      phase = 'followers'
      setStatus(`โหลด followers... (0 คน)`)
      await loadListStream('followers', userId, '', (batch) => {
        followers.push(...batch)
        setStatus(`โหลด followers... (${followers.length} คน)`)
        renderStats()
        renderList()
      })

      // ── Stream following ──
      phase = 'following'
      setStatus(`โหลด following... (0 คน)`)
      // Reset list render for the active tab since following data changes the result
      const wrap = $('igt-list-wrap')
      if (wrap) wrap.innerHTML = ''

      await loadListStream('following', userId, '', (batch) => {
        following.push(...batch)
        setStatus(`โหลด following... (${following.length} คน)`)
        renderStats()
        renderList()
      })

      // ── Done ──
      phase = 'done'
      setStatus('')
      setProgress(false)
      // Final render to ensure accuracy
      const wrapFinal = $('igt-list-wrap')
      if (wrapFinal) wrapFinal.innerHTML = ''
      renderStats()
      renderList()

    } catch (err) {
      setProgress(false)
      setStatus('')
      setContent(`<div class="igt-error">❌ ${err.message}</div>`)
    } finally {
      btn.disabled = false
      btn.textContent = 'ตรวจสอบ'
    }
  }

})()
