document.addEventListener('DOMContentLoaded', () => {
    // --- UI Element References ---
    const downloadBtn = document.getElementById('downloadBtn');
    const statusEl = document.getElementById('status');
    const folderNameInput = document.getElementById('folderNameInput');
    const skipPendingCheckbox = document.getElementById('skipPendingCheckbox');
    const closeBtn = document.getElementById('closeBtn');
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');

    // --- State Variables ---
    let imageDataCache = [];
    const downloadIds = new Set();
    let completedCount = 0;
    let totalCount = 0;

    // --- Event Listeners ---
    closeBtn.addEventListener('click', () => window.close());
    downloadBtn.addEventListener('click', handleDownloadClick);
    skipPendingCheckbox.addEventListener('change', updateStatusText); // Update status on check/uncheck
    window.addEventListener('unload', cleanupListener);

    // --- Main Functions ---

    function handleDownloadChange(delta) {
        if (!downloadIds.has(delta.id)) return;
        if (delta.state && (delta.state.current === 'complete' || delta.state.current === 'interrupted')) {
            updateProgress();
            downloadIds.delete(delta.id);
        }
    }
    
    function updateProgress() {
        completedCount++;
        progressBar.value = completedCount;
        statusEl.textContent = `Processing ${completedCount} of ${totalCount}...`;
        if (completedCount === totalCount) {
            statusEl.textContent = '✅ Download complete!';
            cleanupListener();
            folderNameInput.disabled = false;
        }
    }

    function handleDownloadClick() {
        const folderName = sanitizeFolderName(folderNameInput.value);
        
        const itemsToDownload = skipPendingCheckbox.checked
            ? imageDataCache.filter(item => !item.isPending)
            : imageDataCache;

        if (itemsToDownload.length === 0) {
            statusEl.textContent = 'No items to download.';
            return;
        }
        
        completedCount = 0;
        totalCount = itemsToDownload.length;
        progressBar.value = 0;
        progressBar.max = totalCount;
        progressContainer.style.display = 'block';
        downloadBtn.disabled = true;
        folderNameInput.disabled = true;

        chrome.downloads.onChanged.addListener(handleDownloadChange);

        itemsToDownload.forEach(item => {
            chrome.downloads.download({
                url: item.url,
                filename: `${folderName}/${item.filename}`,
            }, (downloadId) => {
                if (chrome.runtime.lastError) {
                    console.error(`Download failed: ${chrome.runtime.lastError.message}`);
                    totalCount--;
                    progressBar.max = totalCount;
                } else if (downloadId) {
                    downloadIds.add(downloadId);
                }
            });
        });

        if (totalCount <= 0) {
            statusEl.textContent = 'Error: No downloads could be started.';
            progressContainer.style.display = 'none';
            cleanupListener();
        }
    }

    /**
     * Updates the status text to show how many items will be downloaded.
     * This provides immediate feedback when the checkbox is toggled.
     */
    function updateStatusText() {
        const totalItems = imageDataCache.length;
        if (totalItems === 0) return;

        const pendingCount = imageDataCache.filter(item => item.isPending).length;
        const itemsToDownloadCount = skipPendingCheckbox.checked ? totalItems - pendingCount : totalItems;

        statusEl.textContent = `Ready to download ${itemsToDownloadCount} of ${totalItems} items.`;
    }
    
    function cleanupListener() {
        if (chrome.downloads.onChanged.hasListener(handleDownloadChange)) {
            chrome.downloads.onChanged.removeListener(handleDownloadChange);
        }
    }

    function sanitizeFolderName(name) {
        if (!name) return 'Untitled-Auction';
        return name.replace(/[\\/:*?"<>|#]/g, ' ').trim() || 'Untitled-Auction';
    }

    async function initializePopup() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab.url || !tab.url.includes('seller.ctbids.com/sales/dashboard/')) {
            statusEl.textContent = 'Error: Must be on a CTBids dashboard page.';
            return;
        }
        try {
            statusEl.textContent = 'Loading auction data...';
            const results = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                files: ['content.js'],
            });
            const pageData = results[0].result;
            if (pageData && pageData.imageData) {
                folderNameInput.value = pageData.auctionName || '';
                imageDataCache = pageData.imageData;
                
                // Set initial status text and enable UI
                updateStatusText(); 
                folderNameInput.disabled = false;
                if (imageDataCache.length > 0) {
                    downloadBtn.disabled = false;
                }
            } else {
                throw new Error("No data received from page.");
            }
        } catch (error) {
            console.error('Initialization failed:', error);
            statusEl.textContent = 'Failed to load data from the page.';
        }
    }

    // --- Start the extension ---
    initializePopup();
});