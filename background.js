let creating; // A promise that resolves when the offscreen document is created
let offscreenDocumentClosed = false;

async function hasOffscreenDocument(path) {
  const offscreenUrl = chrome.runtime.getURL(path);
  if ('getContexts' in chrome.runtime) {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ['OFFSCREEN_DOCUMENT'],
      documentUrls: [offscreenUrl]
    });
    return contexts.length > 0;
  } else {
    const views = chrome.extension.getViews({ type: 'OFFSCREEN_DOCUMENT' });
    return views.some(view => view.location.href === offscreenUrl);
  }
}

async function setupOffscreenDocument(path) {
  if (await hasOffscreenDocument(path)) {
    return;
  }

  if (creating) {
    await creating;
  } else {
    creating = chrome.offscreen.createDocument({
      url: path,
      reasons: ['BLOBS'],
      justification: 'Image conversion',
    });
    await creating;
    creating = null;
    offscreenDocumentClosed = false;
  }
}

async function closeOffscreenDocument() {
    if (!(await hasOffscreenDocument('offscreen.html'))) {
        return;
    }
    if (chrome.offscreen && chrome.offscreen.closeDocument) {
        await chrome.offscreen.closeDocument();
        offscreenDocumentClosed = true;
    } else {
        // Fallback for older versions
        const offscreenUrl = chrome.runtime.getURL('offscreen.html');
        const views = chrome.extension.getViews({ type: 'OFFSCREEN_DOCUMENT' });
        const view = views.find(v => v.location.href === offscreenUrl);
        if (view) {
            view.close();
            offscreenDocumentClosed = true;
        }
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'convertImage') {
        setupOffscreenDocument('offscreen.html').then(() => {
            chrome.runtime.sendMessage({
                action: 'convertToFormat',
                url: request.url,
                format: request.format
            }, response => {
                sendResponse(response);
            });
        });
        return true; // Indicates that the response is sent asynchronously
    } else if (request.action === 'closeOffscreenDocument') {
        closeOffscreenDocument().then(() => sendResponse({success: true}));
        return true;
    }
});
