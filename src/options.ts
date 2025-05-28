const DOM = {
  statusDiv: document.getElementById('currentKeyStatus') as HTMLElement,
  apiKeyInput: document.getElementById('apiKey') as HTMLInputElement,
  saveButton: document.getElementById('save') as HTMLButtonElement,
  deleteButton: document.getElementById('delete') as HTMLButtonElement,
  statusMsg: document.getElementById('status') as HTMLElement
};

function updateStatus(): void {
  chrome.storage.sync.get('geminiApiKey', (data: { geminiApiKey?: string }) => {
    if (data.geminiApiKey) {
      DOM.statusDiv.textContent = "API key is currently set.";
      DOM.apiKeyInput.value = data.geminiApiKey;
    } else {
      DOM.statusDiv.textContent = "No API key stored.";
      DOM.apiKeyInput.value = "";
    }
  });
}

DOM.saveButton.addEventListener('click', () => {
  const apiKey = DOM.apiKeyInput.value.trim();
  if (apiKey) {
    chrome.storage.sync.set({ geminiApiKey: apiKey }, () => {
      DOM.statusMsg.textContent = "API Key saved successfully!";
      updateStatus();
      setTimeout(() => {
        DOM.statusMsg.textContent = "";
      }, 3000);
    });
  } else {
    DOM.statusMsg.textContent = "Please enter a valid API key.";
  }
});

DOM.deleteButton.addEventListener('click', () => {
  chrome.storage.sync.remove('geminiApiKey', () => {
    DOM.statusMsg.textContent = "API Key removed.";
    updateStatus();
    setTimeout(() => {
      DOM.statusMsg.textContent = "";
    }, 3000);
  });
});

document.addEventListener('DOMContentLoaded', updateStatus);
