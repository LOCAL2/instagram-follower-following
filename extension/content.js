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
    return res.json()
  }

  async function igPost(path) {
    const res = await fetch(`https://www.instagram.com${path}`, {
      method: 'POST', credentials: 'include',
      headers: {
        'X-IG-App-ID': '936619743392459',
        'X-CSRFToken': getCsrf(),
        'Content-Type': 'application/x-www-form-urlencoded',
        'Referer': 'https://www.instagram.com/',
      },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  }

  async function getUserId(username) {
    const lower = username.toLowerCase()
    const data  = await igGet(`/api/v1/web/search/topsearch/?context=blended&query=${lower}&include_reel=false`)
    return data.users?.find((r) => r.user.username.toLowerCase() === lower)?.user?.pk ?? null
  }

  // Get the currently logged-in user's ID and username
  async function getLoggedInUser() {
    // Most reliable: read ds_user_id from cookie (always available when logged in)
    const cookieMatch = document.cookie.match(/ds_user_id=(\d+)/)
    if (cookieMatch) {
      // Also try to get username from search if needed
      return { pk: cookieMatch[1], username: null }
    }
    return { pk: null, username: null }
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
    while (true) {
      try {
        // Use count=50 exactly like the original source — higher counts can cause missing data
        let path = `/api/v1/friendships/${userId}/${list}/?count=50`
        if (maxId) path += `&max_id=${maxId}`
        const data = await igGet(path)
        const users = data.users ?? []
        if (users.length) {
          onBatch(users, loaded + users.length)
          loaded += users.length
        }
        if (!data.next_max_id || loaded >= cap) break
        maxId   = data.next_max_id
        retries = 0
        // Same delay range as original: 800-1500ms
        await sleep(rand(800, 1500))
      } catch (err) {
        if (err.message.includes('429') && retries < 3) {
          retries++
          setStatus(`Rate limited — รอ ${retries * 2}s...`, true)
          await sleep(retries * 2000)
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
                placeholder="instagram_username"
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
    document.body.appendChild(panel)
    applyTheme()

    document.getElementById('igt-close').onclick = () => closePanel()
    document.getElementById('igt-theme-btn').onclick = toggleTheme
    document.getElementById('igt-form').onsubmit    = (e) => {
      e.preventDefault()
      const u = document.getElementById('igt-input').value.trim()
      if (u) runSearch(u)
    }
    document.getElementById('igt-filter').oninput = () => renderList()

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

  function setStatus(text, loading = false) {
    const bar = $('igt-status-bar')
    if (!bar) return
    bar.innerHTML = loading
      ? `<span class="igt-spinner"></span>${text}`
      : text
  }

  function setProgress(v) {
    const el = $('igt-progress-wrap')
    if (el) el.hidden = !v
  }

  function getFilteredList() {
    // Use username for comparison — exactly like the original source
    const followerSet = new Set(followers.map((u) => u.username.toLowerCase()))
    const followingSet = new Set(following.map((u) => u.username.toLowerCase()))

    // notBack = people you follow (following) but they don't follow you back
    // iDont   = people who follow you (followers) but you don't follow them back
    const list = activeTab === 'notBack'
      ? following.filter((u) => !followerSet.has(u.username.toLowerCase()))
      : followers.filter((u) => !followingSet.has(u.username.toLowerCase()))

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
    const followerSet = new Set(followers.map((u) => u.username.toLowerCase()))
    const followingSet = new Set(following.map((u) => u.username.toLowerCase()))
    const nb = following.filter((u) => !followerSet.has(u.username.toLowerCase())).length
    const id = followers.filter((u) => !followingSet.has(u.username.toLowerCase())).length

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
        <div style="font-size:28px;margin-bottom:8px">⏳</div>
        กำลังโหลดข้อมูล...<br/>
        <span style="font-size:11px;opacity:0.6">ผลลัพธ์จะแสดงเมื่อโหลดครบ</span>
      </div>`
      renderBulkBar()
      return
    }

    const list = getFilteredList()

    if (!list.length) {
      wrap.innerHTML = `<div class="igt-empty">${
        q ? `ไม่พบ "${q}"` : '🎉 ไม่มีรายการ'
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
        <img class="igt-avatar" src="${u.profile_pic_url}" loading="lazy"
          onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(u.username)}&size=40&background=random'" alt=""/>
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
        abtn.textContent = action === 'unfollow' ? 'Unfollowed ✓' : 'Followed ✓'
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
      setStatus(`❌ ${err.message}`)
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
      setStatus(`${action === 'unfollow' ? 'Unfollow' : 'Follow'} ${i + 1}/${uids.length}...`, true)
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
    btn.disabled = true; btn.textContent = 'กำลังโหลด...'
    setProgress(true)
    // Start indeterminate
    const fillEl = document.querySelector(`#${PANEL_ID} .igt-progress-fill`)
    if (fillEl) fillEl.classList.add('indeterminate')

    const main = $('igt-main')
    if (main) { main.style.display = 'flex'; $('igt-list-wrap').innerHTML = '' }

    try {
      setStatus('กำลังค้นหา...', true)
      
      // Get target user ID and logged-in user info in parallel
      const [targetId, loggedIn] = await Promise.all([
        getUserId(username),
        getLoggedInUser()
      ])

      if (!targetId) throw new Error(`ไม่พบ username "${username}"`)
      
      // Check if searching own account — compare target ID with logged-in user ID from cookie
      isOwnAccount = false
      if (loggedIn.pk && String(targetId) === String(loggedIn.pk)) {
        isOwnAccount = true
      } else if (!loggedIn.pk) {
        // Cookie not found — ask user
        isOwnAccount = confirm(`"${username}" เป็นบัญชีของคุณเองไหม?\n\nกด OK = ใช่ (จะแสดงปุ่ม Follow/Unfollow)\nกด Cancel = ไม่ใช่`)
      }

      const userId = targetId

      // Get counts for progress display
      setStatus('กำลังดึงข้อมูล...', true)
      const { followerCount, followingCount } = await getUserInfo(userId)

      // Warn if account is very large
      const isBigAccount = followerCount > FOLLOWERS_CAP
      if (isBigAccount) {
        setStatus(
          `⚡ ${followerCount.toLocaleString()} followers — โหลดแค่ ${FOLLOWERS_CAP.toLocaleString()} คนแรก`,
          false
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
        const eta     = remain > 5 ? ` · ~${remain}s` : ''
        setStatus(`โหลด ${loaded.toLocaleString()}/${total > 0 ? total.toLocaleString() : '?'} คน (${pct}%)${eta}`, true)
        // Switch from indeterminate to real progress
        const fill = document.querySelector(`#${PANEL_ID} .igt-progress-fill`)
        if (fill) {
          fill.classList.remove('indeterminate')
          fill.style.width = pct + '%'
        }
      }
      // Load SEQUENTIALLY like original source — followers first, then following
      // This ensures the diff is always accurate (no race condition)

      setStatus('กำลังโหลด followers...', true)
      await loadListStream('followers', userId, (batch, loaded) => {
        followers.push(...batch)
        fLoaded = loaded
        updateStatus()
        renderStats()
      })

      setStatus('กำลังโหลด following...', true)
      await loadListStream('following', userId, (batch, loaded) => {
        following.push(...batch)
        gLoaded = loaded
        updateStatus()
        renderStats()
      })

      // Done
      phase = 'done'
      setStatus(isBigAccount
        ? `⚡ โหลดครบ — followers แสดง ${FOLLOWERS_CAP.toLocaleString()} คนแรก (จาก ${followerCount.toLocaleString()})`
        : '', false)
      setProgress(false)
      $('igt-list-wrap').innerHTML = ''
      renderStats()
      renderList()

    } catch (err) {
      setProgress(false)
      setStatus('')
      const wrap = $('igt-list-wrap')
      if (wrap) wrap.innerHTML = `<div class="igt-error">❌ ${err.message}</div>`
    } finally {
      btn.disabled = false; btn.textContent = 'ตรวจสอบ'
    }
  }

})()
