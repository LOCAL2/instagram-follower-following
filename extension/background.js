// When user clicks the extension icon, inject/toggle the panel
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url?.includes('instagram.com')) return

  // Toggle persisted open state
  const key = 'igt_panel_open'
  const data = await chrome.storage.session.get(key)
  const isOpen = !!data[key]
  await chrome.storage.session.set({ [key]: !isOpen })

  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_PANEL' })
  } catch {
    await chrome.scripting.insertCSS({ target: { tabId: tab.id }, files: ['content.css'] })
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] })
    setTimeout(async () => {
      try { await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_PANEL' }) } catch {}
    }, 200)
  }
})

// When a tab finishes loading, re-open panel if it was open before
chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
  if (info.status !== 'complete') return
  if (!tab.url?.includes('instagram.com')) return

  const data = await chrome.storage.session.get('igt_panel_open')
  if (!data.igt_panel_open) return

  try {
    await chrome.tabs.sendMessage(tabId, { type: 'OPEN_PANEL' })
  } catch {
    await chrome.scripting.insertCSS({ target: { tabId }, files: ['content.css'] })
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] })
    setTimeout(async () => {
      try { await chrome.tabs.sendMessage(tabId, { type: 'OPEN_PANEL' }) } catch {}
    }, 300)
  }
})
