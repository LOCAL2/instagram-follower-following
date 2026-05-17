// Simple toggle — no state persistence across refreshes or tabs

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return

  // Not on Instagram — show toast
  if (!tab.url?.includes('instagram.com')) {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        document.getElementById('__igt_toast__')?.remove()
        const toast = document.createElement('div')
        toast.id = '__igt_toast__'
        toast.style.cssText = [
          'position:fixed','bottom:28px','left:50%',
          'transform:translateX(-50%) translateY(20px)',
          'z-index:2147483647','background:#1a1a2e','color:#fff',
          'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif',
          'font-size:14px','font-weight:500','padding:12px 20px 12px 16px',
          'border-radius:12px','box-shadow:0 8px 32px rgba(0,0,0,.35)',
          'display:flex','align-items:center','gap:10px',
          'border:1px solid rgba(255,255,255,.1)','opacity:0',
          'transition:opacity .25s ease,transform .25s ease',
          'max-width:340px','pointer-events:none',
        ].join(';')
        toast.innerHTML = `
          <svg width="32" height="32" viewBox="0 0 48 48" fill="none" style="flex-shrink:0">
            <defs><linearGradient id="tg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stop-color="#f09433"/>
              <stop offset="50%" stop-color="#dc2743"/>
              <stop offset="100%" stop-color="#bc1888"/>
            </linearGradient></defs>
            <rect width="48" height="48" rx="12" fill="url(#tg)"/>
            <rect x="9" y="9" width="30" height="30" rx="7" stroke="white" stroke-width="2.5" fill="none"/>
            <circle cx="24" cy="24" r="7.5" stroke="white" stroke-width="2.5" fill="none"/>
            <circle cx="33" cy="15" r="2" fill="white"/>
          </svg>
          <div>
            <div style="font-weight:700;margin-bottom:2px">ต้องเปิดบน Instagram เท่านั้น</div>
            <div style="font-size:12px;opacity:.7">ไปที่ instagram.com แล้วกดอีกครั้ง</div>
          </div>`
        document.body.appendChild(toast)
        requestAnimationFrame(() => requestAnimationFrame(() => {
          toast.style.opacity = '1'
          toast.style.transform = 'translateX(-50%) translateY(0)'
        }))
        setTimeout(() => {
          toast.style.opacity = '0'
          toast.style.transform = 'translateX(-50%) translateY(10px)'
          setTimeout(() => toast.remove(), 300)
        }, 3000)
      },
    })
    return
  }

  // Toggle panel on current tab only
  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_PANEL' })
  } catch {
    // Content script not ready — inject then toggle
    await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['content.css'] })
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] })
    await new Promise(r => setTimeout(r, 250))
    try { await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_PANEL' }) } catch {}
  }
})
