// Instagram Follower Tracker — Content Script
// Features: realtime streaming + checkbox bulk unfollow/follow

;(function () {
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

  // ── Instagram API ─────────────────────────────────────────────────────────────

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const rand  = (a, b) => Math.floor(Math.random() * (b - a)) + a

  function getCsrf() {
    return document.cookie.split('; ')
      .find((c) => c.startsWith('csrftoken='))
      ?.split('=')[1] ?? ''
  }

  async function igGet(path) {
    const res = await fetch(`https://www.instagram.com${path}`, {
      credentials: 'include',
      headers: { 'X-IG-App-ID': '936619743392459' },
      method: 'GET',
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  }

  async function igPost(path) {
    const res = await fetch(`https://www.instagram.com${path}`, {
      credentials: 'include',
      method: 'POST',
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
    const result = data.users?.find((r) => r.user.username.toLowerCase() === lower)
    return result?.user?.pk ?? null
  }

  async function loadListStream(list, userId, maxId, onBatch) {
    let path = `/api/v1/friendships/${userId}/${list}/?count=50`
    if (maxId) path += `&max_id=${maxId}`
    const data = await igGet(path)
    onBatch(data.users)
    if (data.next_max_id) {
      await sleep(rand(800, 1500))
      await loadListStream(list, userId, data.next_max_id, onBatch)
    }
  }

  async function followUser(userId) {
    return igPost(`/api/v1/friendships/create/${userId}/`)
  }

  async function unfollowUser(userId) {
    return igPost(`/api/v1/friendships/destroy/${userId}/`)
  }

  // ── Panel HTML ────────────────────────────────────────────────────────────────

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

  // ── Helpers ───────────────────────────────────────────────────────────────────

  const $         = (id) => document.getElementById(id)
  const setStatus   = (t) => { const el = $('igt-status');        if (el) el.textContent = t }
  const setProgress = (v) => { const el = $('igt-progress-wrap'); if (el) el.hidden = !v }
  const setContent  = (h) => { const el = $('igt-content');       if (el) el.innerHTML = h }

  // ── User card with checkbox ───────────────────────────────────────────────────

  // actionType: 'unfollow' | 'follow'
  function userCard(u, actionType) {
    const label = actionType === 'unfollow' ? 'Unfollow' : 'Follow'
    const cls   = actionType === 'unfollow' ? 'igt-action-btn--unfollow' : 'igt-action-btn--follow'
    return `
      <li class="igt-user" data-uid="${u.pk}" data-username="${u.username}" data-action="${actionType}">
        <label class="igt-checkbox-wrap" aria-label="เลือก @${u.username}">
          <input type="checkbox" class="igt-checkbox" data-uid="${u.pk}"/>
          <span class="igt-checkbox-box"></span>
        </label>
        <img class="igt-avatar" src="${u.profile_pic_url}" loading="lazy"
          onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(u.username)}&size=40&background=random'" alt=""/>
        <div class="igt-info">
          <a class="igt-uname" href="https://www.instagram.com/${u.username}/" target="_blank">@${u.username}</a>
          ${u.full_name ? `<span class="igt-fname">${u.full_name}</span>` : ''}
        </div>
        <button class="igt-action-btn ${cls}" data-uid="${u.pk}" data-action="${actionType}" aria-label="${label} @${u.username}">
          ${label}
        </button>
      </li>`
  }

  // ── Bulk action toolbar ───────────────────────────────────────────────────────

  function renderBulkBar(actionType, selectedCount, totalCount, onSelectAll, onAction) {
    const bar = $('igt-bulk-bar')
    if (!bar) return
    const label = actionType === 'unfollow' ? 'Unfollow' : 'Follow'
    const cls   = actionType === 'unfollow' ? 'igt-bulk-btn--unfollow' : 'igt-bulk-btn--follow'
    bar.innerHTML = `
      <label class="igt-select-all-wrap">
        <input type="checkbox" id="igt-select-all" ${selectedCount === totalCount && totalCount > 0 ? 'checked' : ''}/>
        <span>เลือกทั้งหมด (${selectedCount}/${totalCount})</span>
      </label>
      ${selectedCount > 0 ? `
        <button class="igt-bulk-btn ${cls}" id="igt-bulk-action">
          ${label} ${selectedCount} คน
        </button>
      ` : ''}
    `
    $('igt-select-all').onchange = (e) => onSelectAll(e.target.checked)
    if (selectedCount > 0) {
      $('igt-bulk-action').onclick = onAction
    }
  }

  // ── Main search ───────────────────────────────────────────────────────────────

  async function runSearch(username) {
    const btn = $('igt-btn')
    btn.disabled = true
    btn.textContent = 'กำลังโหลด...'
    setProgress(true)
    setContent('')

    const followers = []
    const following = []
    let phase     = 'followers'
    let activeTab = 'notBack'

    // Track follow state per user: uid → 'following' | 'not_following' | 'pending'
    const followState = {}

    function getList() {
      const fSet = new Set(followers.map((u) => u.username.toLowerCase()))
      const gSet = new Set(following.map((u) => u.username.toLowerCase()))
      const fMap = new Map(followers.map((u) => [u.username.toLowerCase(), u]))
      const gMap = new Map(following.map((u) => [u.username.toLowerCase(), u]))
      return activeTab === 'notBack'
        ? [...gSet].filter((u) => !fSet.has(u)).map((u) => gMap.get(u))
        : [...fSet].filter((u) => !gSet.has(u)).map((u) => fMap.get(u))
    }

    function getActionType() {
      // notBack tab = people you follow but they don't follow back → unfollow
      // iDont tab   = people who follow you but you don't follow back → follow
      return activeTab === 'notBack' ? 'unfollow' : 'follow'
    }

    function getSelectedUids() {
      return [...document.querySelectorAll(`#${PANEL_ID} .igt-checkbox:checked`)]
        .map((cb) => cb.dataset.uid)
    }

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
      const tabNotBack = $('igt-tab-notback')
      const tabIDont   = $('igt-tab-idont')
      if (tabNotBack) tabNotBack.querySelector('.igt-badge').textContent = notBackCount
      if (tabIDont)   tabIDont.querySelector('.igt-badge').textContent   = iDontCount
    }

    function refreshBulkBar() {
      const list     = getList()
      const selected = getSelectedUids()
      renderBulkBar(
        getActionType(),
        selected.length,
        list.length,
        (checked) => {
          document.querySelectorAll(`#${PANEL_ID} .igt-checkbox`).forEach((cb) => {
            cb.checked = checked
          })
          refreshBulkBar()
        },
        () => bulkAction(selected),
      )
    }

    function renderList() {
      const wrap = $('igt-list-wrap')
      if (!wrap) return
      const list       = getList()
      const actionType = getActionType()

      if (!list.length) {
        wrap.innerHTML = phase === 'done'
          ? '<div class="igt-empty">🎉 ไม่มีรายการ</div>'
          : '<div class="igt-loading-hint">กำลังโหลด...</div>'
        return
      }

      const existingCount = wrap.querySelectorAll('.igt-user').length
      if (existingCount === 0) {
        wrap.innerHTML = `<ul class="igt-list">${list.map((u) => userCard(u, actionType)).join('')}</ul>`
      } else if (list.length > existingCount) {
        const ul = wrap.querySelector('.igt-list')
        if (ul) {
          const newItems = list.slice(existingCount).map((u) => userCard(u, actionType)).join('')
          ul.insertAdjacentHTML('beforeend', newItems)
        }
      }

      // Update action button states based on followState
      list.forEach((u) => {
        const state = followState[u.pk]
        if (!state) return
        const li  = wrap.querySelector(`[data-uid="${u.pk}"]`)
        const abtn = li?.querySelector('.igt-action-btn')
        if (!abtn) return
        if (state === 'pending') {
          abtn.disabled = true
          abtn.textContent = '...'
        } else if (state === 'done') {
          abtn.disabled = true
          abtn.textContent = actionType === 'unfollow' ? 'Unfollowed ✓' : 'Followed ✓'
          abtn.classList.add('igt-action-btn--done')
          li.classList.add('igt-user--done')
        }
      })

      // Attach single-button handlers
      wrap.querySelectorAll('.igt-action-btn:not([data-bound])').forEach((abtn) => {
        abtn.dataset.bound = '1'
        abtn.onclick = async () => {
          const uid    = abtn.dataset.uid
          const action = abtn.dataset.action
          await doAction(uid, action, abtn)
          refreshBulkBar()
        }
      })

      // Attach checkbox handlers
      wrap.querySelectorAll('.igt-checkbox:not([data-bound])').forEach((cb) => {
        cb.dataset.bound = '1'
        cb.onchange = () => refreshBulkBar()
      })

      refreshBulkBar()
    }

    // ── Single action ──
    async function doAction(uid, action, btn) {
      if (followState[uid] === 'pending' || followState[uid] === 'done') return
      followState[uid] = 'pending'
      if (btn) { btn.disabled = true; btn.textContent = '...' }
      try {
        if (action === 'unfollow') await unfollowUser(uid)
        else                       await followUser(uid)
        followState[uid] = 'done'
        if (btn) {
          btn.textContent = action === 'unfollow' ? 'Unfollowed ✓' : 'Followed ✓'
          btn.classList.add('igt-action-btn--done')
          btn.closest('.igt-user')?.classList.add('igt-user--done')
        }
      } catch (err) {
        followState[uid] = null
        if (btn) {
          btn.disabled = false
          btn.textContent = action === 'unfollow' ? 'Unfollow' : 'Follow'
        }
        setStatus(`❌ Error: ${err.message}`)
        setTimeout(() => setStatus(''), 3000)
      }
    }

    // ── Bulk action with rate-limit delay ──
    async function bulkAction(uids) {
      if (!uids.length) return
      const action  = getActionType()
      const bulkBtn = $('igt-bulk-action')
      if (bulkBtn) { bulkBtn.disabled = true; bulkBtn.textContent = `กำลังดำเนินการ...` }

      for (let i = 0; i < uids.length; i++) {
        const uid  = uids[i]
        const li   = document.querySelector(`#${PANEL_ID} [data-uid="${uid}"]`)
        const abtn = li?.querySelector('.igt-action-btn')
        setStatus(`${action === 'unfollow' ? 'Unfollow' : 'Follow'} ${i + 1}/${uids.length}...`)
        await doAction(uid, action, abtn)
        // Delay between actions to avoid rate limiting
        if (i < uids.length - 1) await sleep(rand(1200, 2200))
      }

      setStatus('')
      refreshBulkBar()
    }

    // ── Build UI skeleton ──
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
      <div class="igt-bulk-bar" id="igt-bulk-bar"></div>
      <div id="igt-list-wrap"></div>
    `)

    document.querySelectorAll(`#${PANEL_ID} .igt-tab`).forEach((tabBtn) => {
      tabBtn.onclick = () => {
        activeTab = tabBtn.dataset.tab
        document.querySelectorAll(`#${PANEL_ID} .igt-tab`).forEach((b) => b.classList.remove('active'))
        tabBtn.classList.add('active')
        const wrap = $('igt-list-wrap')
        if (wrap) wrap.innerHTML = ''
        renderList()
      }
    })

    try {
      setStatus('กำลังค้นหา user ID...')
      const userId = await getUserId(username)
      if (!userId) throw new Error(`ไม่พบ username "${username}"`)

      phase = 'followers'
      setStatus('โหลด followers... (0 คน)')
      await loadListStream('followers', userId, '', (batch) => {
        followers.push(...batch)
        setStatus(`โหลด followers... (${followers.length} คน)`)
        renderStats()
        renderList()
      })

      phase = 'following'
      setStatus('โหลด following... (0 คน)')
      const wrap = $('igt-list-wrap')
      if (wrap) wrap.innerHTML = ''

      await loadListStream('following', userId, '', (batch) => {
        following.push(...batch)
        setStatus(`โหลด following... (${following.length} คน)`)
        renderStats()
        renderList()
      })

      phase = 'done'
      setStatus('')
      setProgress(false)
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
