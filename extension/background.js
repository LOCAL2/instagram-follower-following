// When user clicks the extension icon, inject/toggle the panel
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id || !tab.url?.includes('instagram.com')) return

  try {
    // Try sending message to existing content script first
    await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_PANEL' })
  } catch {
    // Content script not ready (e.g. page just loaded) — inject it manually
    await chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      files: ['content.css'],
    })
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js'],
    })
    // After injecting, send the toggle message
    setTimeout(async () => {
      try {
        await chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_PANEL' })
      } catch (e) {
        console.error('IGT: failed to send message after inject', e)
      }
    }, 200)
  }
})
