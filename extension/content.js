// Instagram Follower Tracker — Content Script
// Features: realtime streaming, search filter, dark/light theme,
//           single + bulk follow/unfollow, live page DOM update

;(function () {
  if (window.__igt_loaded__) {
    const p = document.getElementById('__igt_panel__')
    if (p) p.remove(); else createPanel()
    return
  }
  window.__igt_loaded__ = true
  const PANEL_ID = '__igt_panel__'

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'TOGGLE_PANEL') togglePanel()
  })

  function togglePanel() {
    const p = document.getElementById(PANEL_ID)
    if (p) { closePanel(); return }
    createPanel()
  }

  function closePanel() {
    const p = document.getElementById(PANEL_ID)
    if (!p) return
    p.remove()
    followers.length = 0
    following.length = 0
    Object.keys(followState).forEach((k) => delete followState[k])
    phase        = 'idle'
    isOwnAccount = false
    document.documentElement.classList.remove('igt-split-active')
  }

  // ── Split Layout ──────────────────────────────────────────────────────────────
  let isSplit = localStorage.getItem('igt_split') === 'true' 
  if (localStorage.getItem('igt_split') === null) {
    isSplit = false;
    localStorage.setItem('igt_split', 'false');
  }

  function applySplit() {
    const active = isSplit
    document.documentElement.classList.toggle('igt-split-active', active)
    document.body.classList.toggle('igt-split-active', active)
    const btn = $('igt-split-btn')
    if (btn) {
      btn.style.color = active ? 'var(--accent)' : '#fff'
      btn.style.background = active ? 'var(--bg)' : 'rgba(255,255,255,0.18)'
    }
    // Force a minor layout recalculation for Instagram's React components
    window.dispatchEvent(new Event('resize'))
  }

  function toggleSplit() {
    isSplit = !isSplit
    localStorage.setItem('igt_split', isSplit)
    applySplit()
  }

  // ── Theme ─────────────────────────────────────────────────────────────────────
  let theme = localStorage.getItem('igt_theme') ||
    (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')

  function applyTheme() {
    const p = document.getElementById(PANEL_ID)
    if (!p) return
    p.classList.toggle('igt-dark',  theme === 'dark')
    p.classList.toggle('igt-light', theme === 'light')
  }

  function toggleTheme() {
    theme = theme === 'dark' ? 'light' : 'dark'
    localStorage.setItem('igt_theme', theme)
    applyTheme()
    const btn = document.getElementById('igt-theme-btn')
    if (btn) btn.innerHTML = themeIcon()
  }

  function themeIcon() {
    return theme === 'dark'
      ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
           <circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
         </svg>`
      : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
           <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>
         </svg>`
  }

  function splitIcon() {
    return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
             <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M15 3v18"/>
           </svg>`
  }

  // ── Auto Update Check ────────────────────────────────────────────────────────
  async function checkForUpdates() {
    const local = chrome.runtime.getManifest().version
    const sources = [
      `https://raw.githubusercontent.com/LOCAL2/instagram-follower-following/main/public/version.json?t=${Date.now()}`,
      `https://instagram-follower-tracker.vercel.app/version.json?t=${Date.now()}`
    ]

    for (const url of sources) {
      try {
        const res = await fetch(url, { cache: 'no-cache' })
        const text = await res.text()
        if (text.trim().startsWith('<!doctype') || text.trim().startsWith('<html')) {
           console.log(`[IGT] ${url} returned HTML instead of JSON`)
           continue
        }
        const data = JSON.parse(text)
        const remote = data.version
        
        if (isNewer(remote, local)) {
          showUpdateBanner(remote)
          return // Stop after first success
        }
        console.log(`[IGT] Up to date (${local}) via ${url}`)
        return // Stop if we got a valid response (even if up to date)
      } catch (e) {
        console.log(`[IGT] Update check failed for ${url}:`, e.message)
      }
    }
  }

  function isNewer(remote, local) {
    const r = remote.split('.').map(Number)
    const l = local.split('.').map(Number)
    for (let i = 0; i < Math.max(r.length, l.length); i++) {
        const rv = r[i] || 0
        const lv = l[i] || 0
        if (rv > lv) return true
        if (rv < lv) return false
    }
    return false
  }

  function showUpdateBanner(ver) {
    const wrap = document.getElementById('igt-update-wrap')
    if (!wrap) return
    wrap.innerHTML = `
      <div class="igt-update-banner">
        <div class="igt-update-text">
          <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"/>
          </svg>
          มีเวอร์ชันใหม่ให้ใช้งาน (v${ver})
        </div>
        <a href="https://instagram-follower-tracker.vercel.app/#install" target="_blank" class="igt-update-btn">อัปเดตเลย</a>
      </div>
    `
    wrap.hidden = false
  }

  // ── Instagram API ─────────────────────────────────────────────────────────────
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const rand  = (a, b) => Math.floor(Math.random() * (b - a)) + a

  function getCsrf() {
    return document.cookie.split('; ')
      .find((c) => c.startsWith('csrftoken='))?.split('=')[1] ?? ''
  }

  async function igGet(path) {
    const res = await fetch(`https://www.instagram.com${path}`, {
      credentials: 'include',
      headers: { 'X-IG-App-ID': '936619743392459' },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const text = await res.text()
    try {
      return JSON.parse(text)
    } catch(err) {
      if (text.trim().startsWith('<')) {
        throw new Error('IG_HTML_BLOCK') // Sent HTML instead of JSON
      }
      throw err
    }
  }

  async function igPost(path, bodyStr = '') {
    const opts = {
      method: 'POST', credentials: 'include',
      headers: {
        'X-IG-App-ID': '936619743392459',
        'X-CSRFToken': getCsrf(),
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': 'https://www.instagram.com/',
      }
    }
    if (bodyStr) opts.body = bodyStr
    const res = await fetch(`https://www.instagram.com${path}`, opts)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const text = await res.text()
    try {
      return JSON.parse(text)
    } catch(err) {
      if (text.trim().startsWith('<')) {
        throw new Error('IG_HTML_BLOCK')
      }
      throw err
    }
  }


  // Get the currently logged-in user's ID and username
  async function getLoggedInUser() {
    // Read ID from cookie (always reliable)
    const cookieMatch = document.cookie.match(/ds_user_id=(\d+)/)
    if (!cookieMatch) return { pk: null, username: null }
    const pk = cookieMatch[1]
    // Fetch real username from user info API
    try {
      const data = await igGet(`/api/v1/users/${pk}/info/`)
      return {
        pk,
        username: data.user?.username?.toLowerCase() ?? null,
      }
    } catch {
      return { pk, username: null }
    }
  }

  // Get follower/following counts to show accurate progress
  async function getUserInfo(userId) {
    try {
      const data = await igGet(`/api/v1/users/${userId}/info/`)
      return {
        followerCount: data.user?.follower_count ?? 0,
        followingCount: data.user?.following_count ?? 0,
      }
    } catch { return { followerCount: 0, followingCount: 0 } }
  }

  const FOLLOWERS_CAP = Infinity  // no cap — load all like original source

  async function loadListStream(list, userId, onBatch, cap = Infinity) {
    let maxId   = ''
    let loaded  = 0
    let retries = 0
    let recentlyThrottled = false

    while (true) {
      try {
        // Reduced count from 50 to 30 for smoothness
        let path = `/api/v1/friendships/${userId}/${list}/?count=30&search_surface=follow_list_page`
        if (maxId) path += `&max_id=${maxId}`
        const data = await igGet(path)
        const users = data.users ?? []
        if (users.length) {
          loaded += users.length
          onBatch(users, loaded)
        }
        if (!data.next_max_id || loaded >= cap) break
        maxId   = data.next_max_id
        retries = 0
        
        // Adaptive delay based on previous throttling
        const baseDelay = recentlyThrottled ? rand(3000, 5000) : rand(1800, 3000)
        await sleep(baseDelay)
      } catch (err) {
        const isBlock = err.message.includes('429') || err.message.includes('IG_HTML_BLOCK')
        if (isBlock && retries < 5) {
          retries++
          recentlyThrottled = true
          // Exponential backoff with jitter
          const wait = Math.pow(2, retries - 1) * 6000 + rand(0, 3000)
          setStatus(`Safety protocol engaged — pausing for ${Math.round(wait/1000)}s (retry ${retries}/5)`, 'warning')
          await sleep(wait)
        } else { throw err }
      }
    }
  }

  // ── Live page DOM update ──────────────────────────────────────────────────────
  // After follow/unfollow, update Instagram's own UI without page reload

  // Force Instagram's React router to re-fetch current page data
  // by pushing a dummy history state then immediately popping it
  function triggerIGRerender() {
    try {
      const cur = window.location.href
      // Push same URL to trigger React Router's route change handler
      window.history.pushState({}, '', cur)
      window.dispatchEvent(new PopStateEvent('popstate', { state: {} }))
      // Instagram uses its own router — also try their internal navigation event
      window.dispatchEvent(new CustomEvent('locationchange'))
    } catch (_) {}
  }

  // Update Instagram's own page UI after follow/unfollow
  // Uses React internal props to trigger state update without page reload
  function updatePageFollowButton(userId, action) {
    try {
      // Strategy 1: Find buttons via React fiber and trigger their onClick
      // This works for profile pages, explore, reels, etc.
      const allBtns = [...document.querySelectorAll('button')]

      for (const btn of allBtns) {
        const txt = btn.textContent.trim().toLowerCase()

        // Find the React fiber key on this element
        const fiberKey = Object.keys(btn).find(
          (k) => k.startsWith('__reactFiber') || k.startsWith('__reactInternalInstance')
        )
        if (!fiberKey) continue

        // Walk fiber tree to find onClick with follow/unfollow logic
        let fiber = btn[fiberKey]
        let depth = 0
        while (fiber && depth < 20) {
          const props = fiber.memoizedProps || fiber.pendingProps
          if (props?.onClick) {
            // Check if this button is a follow/unfollow button by text
            if (action === 'unfollow' && (txt === 'following' || txt === 'requested')) {
              // Simulate click via React's synthetic event system
              btn.click()
              // Auto-confirm the unfollow dialog that Instagram shows
              setTimeout(() => {
                const confirmBtns = [...document.querySelectorAll('button')]
                const confirmBtn = confirmBtns.find((b) => {
                  const t = b.textContent.trim().toLowerCase()
                  return t === 'unfollow' || t === 'ยกเลิกการติดตาม'
                })
                if (confirmBtn) confirmBtn.click()
              }, 500)
              break
            }
            if (action === 'follow' && (txt === 'follow' || txt === 'follow back' || txt === 'ติดตาม')) {
              btn.click()
              break
            }
          }
          fiber = fiber.return
          depth++
        }
      }

      // Strategy 2: Dispatch custom event so Instagram's React tree re-renders
      // Instagram listens to these events to sync follow state across components
      window.dispatchEvent(new CustomEvent('ig_follow_state_change', {
        detail: { userId, action }
      }))

      // Strategy 3: Find and update follow button state via data attributes
      // Instagram sometimes uses data-testid or aria-label
      const selectors = [
        `[data-testid="follow-button"]`,
        `[aria-label="Follow"]`,
        `[aria-label="Following"]`,
        `[aria-label="Unfollow"]`,
        `[aria-label="ติดตาม"]`,
        `[aria-label="กำลังติดตาม"]`,
      ]
      for (const sel of selectors) {
        const el = document.querySelector(sel)
        if (!el) continue
        const t = el.textContent.trim().toLowerCase()
        if (action === 'unfollow' && (t === 'following' || t === 'กำลังติดตาม')) {
          el.click()
          setTimeout(() => {
            const confirm = [...document.querySelectorAll('button')]
              .find((b) => ['unfollow', 'ยกเลิกการติดตาม'].includes(b.textContent.trim().toLowerCase()))
            if (confirm) confirm.click()
          }, 500)
        }
        if (action === 'follow' && (t === 'follow' || t === 'ติดตาม')) {
          el.click()
        }
      }
    } catch (_) { /* silent */ }
  }

  // ── Panel HTML ────────────────────────────────────────────────────────────────
  function createPanel() {
    const panel = document.createElement('div')
    panel.id = PANEL_ID
    panel.innerHTML = `
      <div id="igt-update-wrap" hidden></div>
      <div class="igt-header">
        <div class="igt-header-logo" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <rect x="2" y="2" width="20" height="20" rx="5" stroke="white" stroke-width="2"/>
            <circle cx="12" cy="12" r="4" stroke="white" stroke-width="2"/>
            <circle cx="17.5" cy="6.5" r="1.2" fill="white"/>
          </svg>
        </div>
        <div class="igt-header-text">
          <div class="igt-header-title">Follower Tracker</div>
          <div class="igt-header-sub">Instagram</div>
        </div>
        <div class="igt-header-actions">
          <button class="igt-icon-btn" id="igt-split-btn" title="Toggle Split View" aria-label="Toggle Split View">
            ${splitIcon()}
          </button>
          <button class="igt-icon-btn" id="igt-theme-btn" title="Toggle theme" aria-label="Toggle theme">
            ${themeIcon()}
          </button>
          <button class="igt-icon-btn" id="igt-close" aria-label="ปิด">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" d="M6 6l12 12M6 18L18 6"/>
            </svg>
          </button>
        </div>
      </div>

      <div class="igt-body">
        <div class="igt-search-section">
          <form class="igt-form" id="igt-form">
            <div class="igt-input-wrap">
              <span class="igt-at">@</span>
              <input id="igt-input" class="igt-input" type="text"
                placeholder="ชื่อบัญชีของคุณเอง"
                autocomplete="off" autocapitalize="none" spellcheck="false"/>
            </div>
            <button class="igt-btn" id="igt-btn" type="submit">ตรวจสอบ</button>
          </form>
        </div>

        <div class="igt-status-bar" id="igt-status-bar"></div>
        <div id="igt-progress-wrap" hidden>
          <div class="igt-progress-wrap">
            <div class="igt-progress-bar"><div class="igt-progress-fill"></div></div>
          </div>
        </div>

        <div id="igt-main" style="display:none; flex-direction:column; flex:1;">
          <div class="igt-stats" id="igt-stats"></div>

          <div class="igt-tabs">
            <button class="igt-tab active" id="igt-tab-notback" data-tab="notBack">
              ไม่ follow กลับ <span class="igt-badge" id="igt-badge-notback">0</span>
            </button>
            <button class="igt-tab" id="igt-tab-idont" data-tab="iDont">
              ฉันไม่ follow กลับ <span class="igt-badge" id="igt-badge-idont">0</span>
            </button>
          </div>

          <div class="igt-filter-wrap">
            <input class="igt-filter" id="igt-filter" type="text"
              placeholder="ค้นหา username หรือชื่อ..." autocomplete="off"/>
          </div>

          <div class="igt-bulk-bar" id="igt-bulk-bar"></div>

          <div class="igt-list-wrap" id="igt-list-wrap"></div>
        </div>
      </div>
    `
    document.documentElement.appendChild(panel)
    applyTheme()
    setTimeout(applySplit, 50)
    checkForUpdates()

    document.getElementById('igt-close').onclick = () => closePanel()
    document.getElementById('igt-theme-btn').onclick = toggleTheme
    document.getElementById('igt-split-btn').onclick = toggleSplit
    document.getElementById('igt-form').onsubmit    = (e) => {
      e.preventDefault()
      const u = document.getElementById('igt-input').value.trim()
      if (u) runSearch(u)
    }
    document.getElementById('igt-filter').oninput = () => renderList()

    // Pre-fetch logged-in user info silently for own-account detection only
    getLoggedInUser()

    document.querySelectorAll(`#${PANEL_ID} .igt-tab`).forEach((tab) => {
      tab.onclick = () => {
        activeTab = tab.dataset.tab
        document.querySelectorAll(`#${PANEL_ID} .igt-tab`).forEach((t) => t.classList.remove('active'))
        tab.classList.add('active')
        document.getElementById('igt-filter').value = ''
        // Clear list completely before rendering new tab's data
        const wrap = $('igt-list-wrap')
        if (wrap) wrap.innerHTML = ''
        renderList()
      }
    })
  }

  // ── State ─────────────────────────────────────────────────────────────────────
  let followers     = []
  let following     = []
  let phase         = 'idle'
  let activeTab     = 'notBack'
  let isOwnAccount  = false   // true only when searching your own account
  const followState = {} // uid → null | 'pending' | 'done'

  // ── Helpers ───────────────────────────────────────────────────────────────────
  const $  = (id) => document.getElementById(id)

  // Status types: 'loading' | 'success' | 'error' | 'info' | 'warning'
  const STATUS_ICONS = {
    loading: `<span class="igt-spinner"></span>`,
    success: `<svg class="igt-status-icon success" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5"/><path d="M5 8l2 2 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    error:   `<svg class="igt-status-icon error"   viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5"/><path d="M8 5v3.5M8 11h.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
    warning: `<svg class="igt-status-icon warning" viewBox="0 0 16 16" fill="none"><path d="M8 2L14 13H2L8 2z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M8 6v3M8 11h.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
    info:    `<svg class="igt-status-icon info"    viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5"/><path d="M8 7v4M8 5h.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  }

  function setStatus(text, type = 'info') {
    const bar = $('igt-status-bar')
    if (!bar) return
    if (!text) { bar.innerHTML = ''; bar.className = 'igt-status-bar'; return }
    const icon = STATUS_ICONS[type] || ''
    bar.innerHTML = `${icon}<span class="igt-status-text">${text}</span>`
    bar.className = `igt-status-bar igt-status-bar--${type}`
  }

  function setProgress(v) {
    const el = $('igt-progress-wrap')
    if (el) el.hidden = !v
  }

  function getFilteredList() {
    // Use User ID (pk) for 100% accurate comparison instead of username
    const followerSet = new Set(followers.map((u) => String(u.pk)))
    const followingSet = new Set(following.map((u) => String(u.pk)))

    // notBack = people you follow (following) but they don't follow you back
    // iDont   = people who follow you (followers) but you don't follow them back
    const list = activeTab === 'notBack'
      ? following.filter((u) => !followerSet.has(String(u.pk)))
      : followers.filter((u) => !followingSet.has(String(u.pk)))

    const q = ($('igt-filter')?.value ?? '').toLowerCase().trim()
    if (!q) return list
    return list.filter((u) =>
      u.username.toLowerCase().includes(q) ||
      (u.full_name || '').toLowerCase().includes(q)
    )
  }

  function getActionType() {
    return activeTab === 'notBack' ? 'unfollow' : 'follow'
  }

  // ── Render stats ──────────────────────────────────────────────────────────────
  function renderStats() {
    const followerSet = new Set(followers.map((u) => String(u.pk)))
    const followingSet = new Set(following.map((u) => String(u.pk)))
    const nb = following.filter((u) => !followerSet.has(String(u.pk))).length
    const id = followers.filter((u) => !followingSet.has(String(u.pk))).length

    const el = $('igt-stats')
    if (el) el.innerHTML = `
      <div class="igt-stat"><span class="igt-stat-n">${followers.length}</span><span class="igt-stat-l">Followers</span></div>
      <div class="igt-stat"><span class="igt-stat-n">${following.length}</span><span class="igt-stat-l">Following</span></div>
      <div class="igt-stat danger"><span class="igt-stat-n">${nb}</span><span class="igt-stat-l">ไม่ follow กลับ</span></div>
      <div class="igt-stat accent"><span class="igt-stat-n">${id}</span><span class="igt-stat-l">ฉันไม่ follow กลับ</span></div>
    `
    const bn = $('igt-badge-notback'); if (bn) bn.textContent = nb
    const bi = $('igt-badge-idont');   if (bi) bi.textContent = id
  }

  // ── Render bulk bar ───────────────────────────────────────────────────────────
  function renderBulkBar() {
    const bar = $('igt-bulk-bar')
    if (!bar) return
    if (!isOwnAccount) {
      bar.innerHTML = ''
      bar.style.display = 'none'
      return
    }
    bar.style.display = 'flex'

    const list     = getFilteredList()
    const action   = getActionType()
    const checked  = [...document.querySelectorAll(`#${PANEL_ID} .igt-cb:checked`)]
    const selCount = checked.length
    const allSel   = selCount > 0 && selCount === list.length
    const label    = action === 'unfollow' ? 'Unfollow' : 'Follow'
    const cls      = action === 'unfollow' ? 'igt-bulk-btn--unfollow' : 'igt-bulk-btn--follow'

    bar.innerHTML = `
      <label class="igt-select-all-wrap">
        <input type="checkbox" id="igt-sel-all" ${allSel ? 'checked' : ''}/>
        <span>เลือกทั้งหมด (${selCount}/${list.length})</span>
      </label>
      ${selCount > 0 ? `
        <button class="igt-bulk-btn ${cls}" id="igt-bulk-act">
          ${label} ${selCount} คน
        </button>` : ''}
    `
    $('igt-sel-all').onchange = (e) => {
      document.querySelectorAll(`#${PANEL_ID} .igt-cb`).forEach((cb) => { cb.checked = e.target.checked })
      renderBulkBar()
    }
    if (selCount > 0) {
      $('igt-bulk-act').onclick = () => {
        const uids = [...document.querySelectorAll(`#${PANEL_ID} .igt-cb:checked`)].map((cb) => cb.dataset.uid)
        bulkAction(uids, action)
      }
    }
  }

  // ── Render list ───────────────────────────────────────────────────────────────
  function renderList() {
    const wrap = $('igt-list-wrap')
    if (!wrap) return
    const action = getActionType()
    const q      = ($('igt-filter')?.value ?? '').trim()

    // During loading: don't show list yet — diff is incomplete and will be wrong
    if (phase !== 'done') {
      wrap.innerHTML = `<div class="igt-hint">
        Retrieving remote graph data...<br/>
        <span style="font-size:11px;opacity:0.6">Synchronizing local state with remote ledger</span>
      </div>`
      renderBulkBar()
      return
    }

    const list = getFilteredList()

    if (!list.length) {
      wrap.innerHTML = `<div class="igt-empty">${
        q ? `ไม่พบ "${q}"` : 'ไม่มีรายการ'
      }</div>`
      renderBulkBar()
      return
    }

    // When filtering: full re-render
    if (q) {
      wrap.innerHTML = `<ul class="igt-list">${list.map((u) => userRow(u, action)).join('')}</ul>`
      list.forEach((u) => bindRowEvents(u.pk, action))
      renderBulkBar()
      return
    }

    // Done + no filter: incremental append
    const existingUids = new Set(
      [...wrap.querySelectorAll('.igt-user')].map((li) => li.dataset.uid)
    )
    const newItems = list.filter((u) => !existingUids.has(String(u.pk)))

    if (existingUids.size === 0) {
      wrap.innerHTML = `<ul class="igt-list"></ul>`
    }

    const ul = wrap.querySelector('.igt-list')
    if (ul && newItems.length) {
      ul.insertAdjacentHTML('beforeend', newItems.map((u) => userRow(u, action)).join(''))
      newItems.forEach((u) => bindRowEvents(u.pk, action))
    }

    // Update state of all visible rows
    list.forEach((u) => updateRowState(u.pk, action))

    renderBulkBar()
  }

  function userRow(u, action) {
    const label = action === 'unfollow' ? 'Unfollow' : 'Follow'
    const cls   = action === 'unfollow' ? 'igt-action-btn--unfollow' : 'igt-action-btn--follow'
    const state = followState[u.pk]
    const done  = state === 'done'

    // Only show checkbox + action button when viewing own account
    const actionHtml = isOwnAccount ? `
        <label class="igt-cb-wrap" aria-label="เลือก @${u.username}">
          <input type="checkbox" class="igt-cb" data-uid="${u.pk}" ${done ? 'disabled' : ''}/>
          <span class="igt-cb-box"></span>
        </label>` : ''

    const btnHtml = isOwnAccount ? `
        <button class="igt-action-btn ${done ? 'igt-action-btn--done' : cls}"
          data-uid="${u.pk}" data-action="${action}"
          ${state === 'pending' || done ? 'disabled' : ''}
          aria-label="${label} @${u.username}">
          ${done ? (action === 'unfollow' ? 'Unfollowed ✓' : 'Followed ✓') : state === 'pending' ? '...' : label}
        </button>` : ''

    return `
      <li class="igt-user${done ? ' igt-user--done' : ''}" data-uid="${u.pk}">
        ${actionHtml}
        <img class="igt-avatar" src="${u.profile_pic_url}" loading="lazy" data-username="${encodeURIComponent(u.username)}" alt=""/>
        <div class="igt-info">
          <a class="igt-uname" href="https://www.instagram.com/${u.username}/" target="_blank">@${u.username}</a>
          ${u.full_name ? `<span class="igt-fname">${u.full_name}</span>` : ''}
        </div>
        ${btnHtml}
      </li>`
  }

  function bindRowEvents(uid, action) {
    const li   = document.querySelector(`#${PANEL_ID} [data-uid="${uid}"]`)
    if (!li) return
    const abtn = li.querySelector('.igt-action-btn')
    const cb   = li.querySelector('.igt-cb')
    const img  = li.querySelector('.igt-avatar')
    if (img && !img.dataset.errBound) {
      img.dataset.errBound = '1'
      img.onerror = () => {
        img.onerror = null
        img.src = `https://ui-avatars.com/api/?name=${img.dataset.username}&size=40&background=random`
      }
    }
    if (abtn && !abtn.dataset.bound) {
      abtn.dataset.bound = '1'
      abtn.onclick = () => doAction(uid, action)
    }
    if (cb && !cb.dataset.bound) {
      cb.dataset.bound = '1'
      cb.onchange = () => renderBulkBar()
    }
  }

  function updateRowState(uid, action) {
    const state = followState[uid]
    if (!state) return
    const li   = document.querySelector(`#${PANEL_ID} [data-uid="${uid}"]`)
    if (!li) return
    const abtn = li.querySelector('.igt-action-btn')
    const cb   = li.querySelector('.igt-cb')
    if (state === 'pending') {
      if (abtn) { abtn.disabled = true; abtn.textContent = '...' }
    } else if (state === 'done') {
      li.classList.add('igt-user--done')
      if (abtn) {
        abtn.disabled = true
        abtn.textContent = action === 'unfollow' ? 'Unfollowed' : 'Followed'
        abtn.className = 'igt-action-btn igt-action-btn--done'
      }
      if (cb) cb.disabled = true
    }
  }

  // ── Single action ─────────────────────────────────────────────────────────────
  async function doAction(uid, action) {
    if (followState[uid]) return
    followState[uid] = 'pending'
    updateRowState(uid, action)
    renderBulkBar()
    try {
      if (action === 'unfollow') await igPost(`/api/v1/friendships/destroy/${uid}/`)
      else                       await igPost(`/api/v1/friendships/create/${uid}/`)
      followState[uid] = 'done'
      updateRowState(uid, action)
      // Update Instagram's own page UI
      updatePageFollowButton(uid, action)
      // Force Instagram's React to re-render follow state by pushing/popping history
      // This is the most reliable way to sync UI without full page reload
      setTimeout(() => triggerIGRerender(), 600)
    } catch (err) {
      followState[uid] = null
      updateRowState(uid, action)
      setStatus(`❌ ${err.message}`, 'error')
      setTimeout(() => setStatus(''), 3000)
    }
    renderBulkBar()
  }

  // ── Bulk action ───────────────────────────────────────────────────────────────
  async function bulkAction(uids, action) {
    if (!uids.length) return
    const bulkBtn = $('igt-bulk-act')
    if (bulkBtn) { bulkBtn.disabled = true }

    for (let i = 0; i < uids.length; i++) {
      setStatus(`${action === 'unfollow' ? 'Unfollow' : 'Follow'} ${i + 1}/${uids.length} · processing request batch...`, 'loading')
      await doAction(uids[i], action)
      if (i < uids.length - 1) await sleep(rand(1200, 2200))
    }
    setStatus('')
  }

  // ── Main search ───────────────────────────────────────────────────────────────
  async function runSearch(username) {
    // Reset state
    followers.length = 0
    following.length = 0
    Object.keys(followState).forEach((k) => delete followState[k])
    phase     = 'idle'
    activeTab = 'notBack'
    document.querySelectorAll(`#${PANEL_ID} .igt-tab`).forEach((t) => t.classList.remove('active'))
    const nb = $('igt-tab-notback'); if (nb) nb.classList.add('active')
    if ($('igt-filter')) $('igt-filter').value = ''

    const btn = $('igt-btn')
    btn.disabled = true; btn.textContent = 'Initializing...'
    setProgress(true)
    // Start indeterminate
    const fillEl = document.querySelector(`#${PANEL_ID} .igt-progress-fill`)
    if (fillEl) fillEl.classList.add('indeterminate')

    const main = $('igt-main')
    if (main) { main.style.display = 'flex'; $('igt-list-wrap').innerHTML = '' }

    try {
      setStatus('Establishing secure handshake...', 'loading')
      
      // Get logged-in user info first
      const loggedIn = await getLoggedInUser()
      if (!loggedIn.pk) throw new Error('กรุณาล็อกอิน Instagram ก่อนใช้งาน')
      
      const targetLower = username.toLowerCase().replace(/^@/, '')
      
      // Strict check: only allow own account
      if (loggedIn.username && targetLower !== loggedIn.username) {
        throw new Error(`ขออภัยครับ ระบบพัฒนามาเพื่อเน้นความแม่นยำสูงสุด จึงอนุญาตให้ตรวจสอบเฉพาะบัญชีของคุณเอง (@${loggedIn.username}) เท่านั้นในขณะนี้ โปรดรอติดตามการอัปเดตในอนาคตครับ`)
      }

      // If we reach here, it's definitely the own account
      isOwnAccount = true
      const userId = loggedIn.pk

      // Get counts for progress display
      setStatus('Querying namespace metadata...', 'loading')
      const { followerCount, followingCount } = await getUserInfo(userId)

      // Warn if account is very large
      const isBigAccount = followerCount > FOLLOWERS_CAP
      if (isBigAccount) {
        setStatus(
          `${followerCount.toLocaleString()} followers detected — capped at ${FOLLOWERS_CAP.toLocaleString()} records`,
          'warning'
        )
        await sleep(1800)
      }

      phase = 'loading'

      // Progress tracker
      const fTotal = Math.min(followerCount, FOLLOWERS_CAP)
      const gTotal = followingCount
      let fLoaded  = 0
      let gLoaded  = 0
      let startTime = Date.now()

      function updateStatus() {
        const total   = fTotal + gTotal
        const loaded  = fLoaded + gLoaded
        const pct     = total > 0 ? Math.round(loaded / total * 100) : 0
        const elapsed = (Date.now() - startTime) / 1000
        const rate    = loaded / Math.max(elapsed, 1)
        const remain  = total > 0 && rate > 0 ? Math.round((total - loaded) / rate) : 0
        const eta     = remain > 5 ? ` ETA ${remain}s` : ''

        const phase = fLoaded < fTotal || fTotal === 0
          ? `Synchronizing ingress relationship subgraph · ${fLoaded.toLocaleString()}${fTotal > 0 ? `/${fTotal.toLocaleString()}` : ''} records`
          : `Analyzing outbound edge vectors · ${gLoaded.toLocaleString()}${gTotal > 0 ? `/${gTotal.toLocaleString()}` : ''} records`

        setStatus(`${phase} · ${pct}%${eta}`, 'loading')

        const fill = document.querySelector(`#${PANEL_ID} .igt-progress-fill`)
        if (fill) {
          fill.classList.remove('indeterminate')
          fill.style.width = pct + '%'
        }
      }
      // Load SEQUENTIALLY like original source — followers first, then following
      // This ensures the diff is always accurate (no race condition)

      setStatus('Synchronizing ingress relationship subgraph...', 'loading')
      await loadListStream('followers', userId, (batch, loaded) => {
        const currentPks = new Set(followers.map(u => String(u.pk)))
        const newEntries = batch.filter(u => !currentPks.has(String(u.pk)))
        followers.push(...newEntries)
        fLoaded = loaded
        updateStatus()
        renderStats()
      })

      setStatus('Analyzing outbound edge vectors...', 'loading')
      await loadListStream('following', userId, (batch, loaded) => {
        const currentPks = new Set(following.map(u => String(u.pk)))
        const newEntries = batch.filter(u => !currentPks.has(String(u.pk)))
        following.push(...newEntries)
        gLoaded = loaded
        updateStatus()
        renderStats()
      })

      // === SMART VERIFICATION CHECK ===
      // Verify reciprocal relationships for our own account to bypass IG API truncations
      if (isOwnAccount) {
        let fwSet = new Set(followers.map((u) => String(u.pk)))
        const missing = following.filter((u) => !fwSet.has(String(u.pk)))
        
        if (missing.length > 0) {
          setStatus(`Executing heuristic data validation · ${missing.length} unconfirmed records`, 'loading')
          const bSize = 30
          for (let i = 0; i < missing.length; i += bSize) {
            const chunk = missing.slice(i, i + bSize)
            const chunkIds = chunk.map((u) => String(u.pk)).join(',')
            try {
              const res = await igPost('/api/v1/friendships/show_many/', `user_ids=${chunkIds}`)
              if (res && res.friendship_statuses) {
                const currentFwPks = new Set(followers.map(u => String(u.pk)))
                for (const pk in res.friendship_statuses) {
                  const status = res.friendship_statuses[pk]
                  if (status.followed_by) {
                    if (!currentFwPks.has(String(pk))) {
                      const u = chunk.find((c) => String(c.pk) === pk)
                      if (u) {
                        followers.push(u)
                        currentFwPks.add(String(pk))
                      }
                    }
                  }
                }
              }
              setStatus(`Validating retrospective synchronization ${Math.min(i + chunk.length, missing.length)}/${missing.length} nodes...`, 'loading')
              renderStats()
              // More conservative delay for heuristic check
              if (i + bSize < missing.length) await sleep(rand(2000, 3500))
            } catch (err) {
              const isBlock = err.message.includes('429') || err.message.includes('IG_HTML_BLOCK')
              if (isBlock) {
                setStatus('Throttling detected during validation — cooling down 10s...', 'warning')
                await sleep(10000)
                i -= bSize // Retry this chunk once
              }
              console.warn('show_many skipped or throttled', err)
            }
          }
        }
      }

      // Done
      phase = 'done'
      setStatus(isBigAccount
        ? `โหลดครบ — followers แสดง ${FOLLOWERS_CAP.toLocaleString()} คนแรก (จาก ${followerCount.toLocaleString()})`
        : '', 'info')
      setProgress(false)
      $('igt-list-wrap').innerHTML = ''
      renderStats()
      renderList()

    } catch (err) {
      setProgress(false)
      setStatus(`เกิดข้อผิดพลาด`, 'error')
      const wrap = $('igt-list-wrap')
      if (wrap) {
        wrap.innerHTML = `
          <div class="igt-error-card">
            <div class="igt-error-header">
              <span>ไม่สามารถดำเนินการได้</span>
            </div>
            <div class="igt-error-msg">${err.message}</div>
          </div>
        `
      }
    } finally {
      btn.disabled = false; btn.textContent = 'ตรวจสอบ'
    }
  }

})()
