document.addEventListener('DOMContentLoaded', () => {
    const downloadBtn = document.getElementById('downloadBtn');
    const statusEl = document.getElementById('status');
    const folderNameInput = document.getElementById('folderNameInput');
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
    // Add a cleanup listener for when the popup closes unexpectedly
    window.addEventListener('unload', cleanupListener);

    // --- Main Functions ---

    /**
     * This function is called every time a download's state changes.
     * It's defined once and referenced by the listener.
     */
    function handleDownloadChange(delta) {
        // We only care about downloads started by this extension instance
        if (!downloadIds.has(delta.id)) {
            return;
        }

        // Check if the download has completed successfully
        if (delta.state && delta.state.current === 'complete') {
            updateProgress();
            downloadIds.delete(delta.id); // Remove from tracking set
        }
        // Also check for failed or interrupted downloads
        else if (delta.state && (delta.state.current === 'interrupted' || delta.error)) {
            console.error(`Download ${delta.id} failed or was interrupted.`);
            // Treat failed downloads as "complete" for progress bar purposes
            updateProgress();
            downloadIds.delete(delta.id);
        }
    }
    
    /**
     * Updates the progress bar and status text.
     */
    function updateProgress() {
        completedCount++;
        progressBar.value = completedCount;
        statusEl.textContent = `Processing ${completedCount} of ${totalCount}...`;

        // If all downloads are accounted for (completed or failed)
        if (completedCount === totalCount) {
            statusEl.textContent = '✅ Download complete!';
            cleanupListener(); // Stop listening for changes
            folderNameInput.disabled = false;
            // You can re-enable the download button if you want to allow another run
            // downloadBtn.disabled = false;
        }
    }

    /**
     * Initiates the download process when the button is clicked.
     */
    function handleDownloadClick() {
        const folderName = sanitizeFolderName(folderNameInput.value);
        if (imageDataCache.length === 0) {
            statusEl.textContent = 'No images to download.';
            return;
        }
        
        // Reset progress and UI
        completedCount = 0;
        totalCount = imageDataCache.length;
        progressBar.value = 0;
        progressBar.max = totalCount;
        progressContainer.style.display = 'block';
        downloadBtn.disabled = true;
        folderNameInput.disabled = true;

        // Start listening for download changes
        chrome.downloads.onChanged.addListener(handleDownloadChange);

        imageDataCache.forEach(item => {
            chrome.downloads.download({
                url: item.url,
                filename: `${folderName}/${item.filename}`,
            }, (downloadId) => {
                // This callback is crucial. Check for errors first.
                if (chrome.runtime.lastError) {
                    console.error(`Download failed to start: ${chrome.runtime.lastError.message}`);
                    // If a download fails to start, we must decrement totalCount
                    // to ensure the progress bar can still reach 100%
                    totalCount--;
                    progressBar.max = totalCount;
                } else if (downloadId) {
                    // Keep track of which downloads we started
                    downloadIds.add(downloadId);
                }
            });
        });

        // Handle case where no downloads started at all
        if (totalCount === 0) {
            statusEl.textContent = 'Error: No downloads could be started.';
            progressContainer.style.display = 'none';
            cleanupListener();
        }
    }
    
    /**
     * Removes the event listener to prevent memory leaks.
     */
    function cleanupListener() {
        if (chrome.downloads.onChanged.hasListener(handleDownloadChange)) {
            chrome.downloads.onChanged.removeListener(handleDownloadChange);
        }
    }

    /**
     * Sanitizes a string for use as a folder name.
     */
    function sanitizeFolderName(name) {
        if (!name) return 'Untitled-Auction';
        return name.replace(/[\\/:*?"<>|#]/g, ' ').trim() || 'Untitled-Auction';
    }

    /**
     * Runs once when the popup opens to fetch data from the page.
     */
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
                statusEl.textContent = `Ready to download ${imageDataCache.length} images.`;
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