// Instagram Follower Tracker — Content Script
// Injects a side panel into instagram.com when the extension icon is clicked.

;(function () {
  // Guard: ถ้า inject ซ้ำ ให้แค่ toggle panel แทน
  if (window.__igt_loaded__) {
    const existing = document.getElementById('__igt_panel__')
    if (existing) existing.remove()
    else createPanel()
    return
  }
  window.__igt_loaded__ = true

  const PANEL_ID = '__igt_panel__'

  // Listen for toggle message from background script
  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'TOGGLE_PANEL') togglePanel()
  })

  function togglePanel() {
    const existing = document.getElementById(PANEL_ID)
    if (existing) {
      existing.remove()
      return
    }
    createPanel()
  }

  // ── API helpers ──────────────────────────────────────────────────────────────

  const fetchOpts = {
    credentials: 'include',
    headers: { 'X-IG-App-ID': '936619743392459' },
    method: 'GET',
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  const rand = (a, b) => Math.floor(Math.random() * (b - a)) + a

  async function igFetch(path) {
    const res = await fetch(`https://www.instagram.com${path}`, fetchOpts)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  }

  async function getUserId(username) {
    const lower = username.toLowerCase()
    const data = await igFetch(
      `/api/v1/web/search/topsearch/?context=blended&query=${lower}&include_reel=false`,
    )
    const result = data.users?.find(
      (r) => r.user.username.toLowerCase() === lower,
    )
    return result?.user?.pk ?? null
  }

  async function loadList(list, userId, maxId, onBatch) {
    let path = `/api/v1/friendships/${userId}/${list}/?count=50`
    if (maxId) path += `&max_id=${maxId}`
    const data = await igFetch(path)
    onBatch(data.users.length)
    if (data.next_max_id) {
      await sleep(rand(800, 1500))
      return data.users.concat(
        await loadList(list, userId, data.next_max_id, onBatch),
      )
    }
    return data.users
  }

  // ── Panel UI ─────────────────────────────────────────────────────────────────

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

      <div class="igt-body" id="igt-body">
        <form class="igt-form" id="igt-form">
          <div class="igt-input-wrap">
            <span class="igt-at">@</span>
            <input
              id="igt-input"
              class="igt-input"
              type="text"
              placeholder="instagram_username"
              autocomplete="off"
              autocapitalize="none"
              spellcheck="false"
            />
          </div>
          <button class="igt-btn" id="igt-btn" type="submit">ตรวจสอบ</button>
        </form>

        <div id="igt-status" class="igt-status" role="status" aria-live="polite"></div>
        <div id="igt-progress-wrap" class="igt-progress-wrap" hidden>
          <div class="igt-progress-bar"><div class="igt-progress-fill" id="igt-progress-fill"></div></div>
        </div>
        <div id="igt-content"></div>
      </div>
    `

    document.body.appendChild(panel)

    document.getElementById('igt-close').onclick = () => panel.remove()

    document.getElementById('igt-form').onsubmit = async (e) => {
      e.preventDefault()
      const username = document.getElementById('igt-input').value.trim()
      if (!username) return
      await runSearch(username)
    }
  }

  function setStatus(text) {
    const el = document.getElementById('igt-status')
    if (el) el.textContent = text
  }

  function setProgress(show) {
    const el = document.getElementById('igt-progress-wrap')
    if (el) el.hidden = !show
  }

  function setContent(html) {
    const el = document.getElementById('igt-content')
    if (el) el.innerHTML = html
  }

  async function runSearch(username) {
    const btn = document.getElementById('igt-btn')
    btn.disabled = true
    btn.textContent = 'กำลังโหลด...'
    setContent('')
    setProgress(true)

    try {
      setStatus('กำลังค้นหา user ID...')
      const userId = await getUserId(username)
      if (!userId) throw new Error(`ไม่พบ username "${username}"`)

      let fc = 0, gc = 0

      setStatus('กำลังโหลด followers...')
      const followers = await loadList('followers', userId, '', (n) => {
        fc += n
        setStatus(`โหลด followers ${fc} คน...`)
      })

      setStatus('กำลังโหลด following...')
      const following = await loadList('following', userId, '', (n) => {
        gc += n
        setStatus(`โหลด following ${gc} คน...`)
      })

      setStatus('')
      setProgress(false)
      renderResults(followers, following)
    } catch (err) {
      setProgress(false)
      setStatus('')
      setContent(`<div class="igt-error">❌ ${err.message}</div>`)
    } finally {
      btn.disabled = false
      btn.textContent = 'ตรวจสอบ'
    }
  }

  function renderResults(followers, following) {
    const fSet = new Set(followers.map((u) => u.username.toLowerCase()))
    const gSet = new Set(following.map((u) => u.username.toLowerCase()))
    const fMap = new Map(followers.map((u) => [u.username.toLowerCase(), u]))
    const gMap = new Map(following.map((u) => [u.username.toLowerCase(), u]))

    const notBack = [...gSet].filter((u) => !fSet.has(u)).map((u) => gMap.get(u))
    const iDont = [...fSet].filter((u) => !gSet.has(u)).map((u) => fMap.get(u))

    let activeTab = 'notBack'

    function userCard(u) {
      return `
        <li class="igt-user">
          <img class="igt-avatar" src="${u.profile_pic_url}" loading="lazy"
            onerror="this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(u.username)}&size=40&background=random'" alt="" />
          <div class="igt-info">
            <a class="igt-uname" href="https://www.instagram.com/${u.username}/" target="_blank">@${u.username}</a>
            ${u.full_name ? `<span class="igt-fname">${u.full_name}</span>` : ''}
          </div>
        </li>`
    }

    function renderList() {
      const list = activeTab === 'notBack' ? notBack : iDont
      const wrap = document.getElementById('igt-list-wrap')
      if (!wrap) return
      if (!list.length) {
        wrap.innerHTML = '<div class="igt-empty">🎉 ไม่มีรายการ</div>'
      } else {
        wrap.innerHTML = `<ul class="igt-list">${list.map(userCard).join('')}</ul>`
      }
    }

    setContent(`
      <div class="igt-stats">
        <div class="igt-stat"><span class="igt-stat-n">${followers.length}</span><span class="igt-stat-l">Followers</span></div>
        <div class="igt-stat"><span class="igt-stat-n">${following.length}</span><span class="igt-stat-l">Following</span></div>
        <div class="igt-stat danger"><span class="igt-stat-n">${notBack.length}</span><span class="igt-stat-l">ไม่ follow กลับ</span></div>
        <div class="igt-stat accent"><span class="igt-stat-n">${iDont.length}</span><span class="igt-stat-l">ฉันไม่ follow กลับ</span></div>
      </div>
      <div class="igt-tabs">
        <button class="igt-tab active" data-tab="notBack">
          ไม่ follow กลับ <span class="igt-badge">${notBack.length}</span>
        </button>
        <button class="igt-tab" data-tab="iDont">
          ฉันไม่ follow กลับ <span class="igt-badge">${iDont.length}</span>
        </button>
      </div>
      <div id="igt-list-wrap"></div>
    `)

    renderList()

    document.querySelectorAll(`#${PANEL_ID} .igt-tab`).forEach((btn) => {
      btn.onclick = () => {
        activeTab = btn.dataset.tab
        document.querySelectorAll(`#${PANEL_ID} .igt-tab`).forEach((b) => b.classList.remove('active'))
        btn.classList.add('active')
        renderList()
      }
    })
  }
})()
