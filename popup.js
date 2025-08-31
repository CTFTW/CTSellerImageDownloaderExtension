document.addEventListener('DOMContentLoaded', () => {
    // --- UI Element References ---
    const downloadBtn = document.getElementById('downloadBtn');
    const abortBtn = document.getElementById('abortBtn');
    const statusEl = document.getElementById('status');
    const folderNameInput = document.getElementById('folderNameInput');
    const skipPendingCheckbox = document.getElementById('skipPendingCheckbox');
    const allImagesCheckbox = document.getElementById('allImagesCheckbox');
    const subfolderCheckbox = document.getElementById('subfolderCheckbox');
    const closeBtn = document.getElementById('closeBtn');
    const progressContainer = document.getElementById('progressContainer');
    const progressBar = document.getElementById('progressBar');
    const ctControls = document.getElementById('showControls');
    
    // --- State Variables ---
    let lotsDataCache = [];
    const downloadIds = new Set();
    let completedCount = 0;
    let isAborted = false;

    // --- Event Listeners ---
    closeBtn.addEventListener('click', () => window.close());
    downloadBtn.addEventListener('click', handleDownloadClick);
    abortBtn.addEventListener('click', handleAbortClick);
    window.addEventListener('unload', cleanupListener);

    // --- Core Functions ---

    function handleAbortClick() {
        isAborted = true;
        statusEl.textContent = 'Aborting...';
        downloadIds.forEach(id => chrome.downloads.cancel(id));
        downloadIds.clear();
        resetUiToReadyState('Operation aborted.');
    }

    async function handleDownloadClick() {
        isAborted = false;
        setUiToInProgressState();

        const baseFolderName = sanitizeFolderName(folderNameInput.value);
        let lotsToProcess = skipPendingCheckbox.checked ? lotsDataCache.filter(lot => !lot.isPending) : lotsDataCache;

        if (lotsToProcess.length === 0) {
            resetUiToReadyState('No items to process.');
            return;
        }

        let finalDownloadList;
        if (allImagesCheckbox.checked) {
            statusEl.textContent = 'Discovering all images...';
            finalDownloadList = await discoverAllImages(lotsToProcess, baseFolderName);
        } else {
            finalDownloadList = lotsToProcess.map(lot => {
                const extension = lot.thumbnailUrl.split('.').pop() || 'jpeg';
                const filename = `${lot.title}.${extension}`;
                return {
                    url: lot.thumbnailUrl,
                    filename: subfolderCheckbox.checked ? `${baseFolderName}/${lot.title}/${filename}` : `${baseFolderName}/${filename}`
                };
            });
        }
        
        if (isAborted) {
            resetUiToReadyState('Operation aborted.');
            return;
        }

        if (finalDownloadList.length === 0) {
            resetUiToReadyState('No images found to download.');
            return;
        }
        
        startDownloadProcess(finalDownloadList);
    }
    
    async function discoverAllImages(lots, baseFolderName) {
        const directoryCache = new Map();
        const allImages = [];
        
        for (const lot of lots) {
            if (isAborted) break;

            const directoryUrl = lot.thumbnailUrl.substring(0, lot.thumbnailUrl.lastIndexOf('/') + 1);
            let fileList = [];

            if (directoryCache.has(directoryUrl)) {
                fileList = directoryCache.get(directoryUrl);
            } else {
                try {
                    const response = await fetch(directoryUrl);
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    const listingHtml = await response.text();
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(listingHtml, 'text/html');
                    const links = Array.from(doc.querySelectorAll('a[href]')).map(a => a.getAttribute('href'));
                    directoryCache.set(directoryUrl, links);
                    fileList = links;
                } catch (error) {
                    console.error(`Failed to fetch directory ${directoryUrl}:`, error);
                    continue;
                }
            }
            
            const lotImages = fileList.filter(file => file.startsWith(lot.lotId + '_') && /\.(jpe?g|png|gif|webp)$/i.test(file));
            
            const imagesToProcess = lotImages.length > 0 ? lotImages : [lot.thumbnailUrl.substring(lot.thumbnailUrl.lastIndexOf('/') + 1)];

            imagesToProcess.forEach((imgFilename, index) => {
                const suffix = String(index + 1).padStart(3, '0');
                const extension = imgFilename.split('.').pop();
                const filename = `${lot.title}-${suffix}.${extension}`;
                allImages.push({
                    url: directoryUrl + imgFilename,
                    filename: subfolderCheckbox.checked ? `${baseFolderName}/${lot.title}/${filename}` : `${baseFolderName}/${filename}`
                });
            });
        }
        return allImages;
    }

    function startDownloadProcess(downloadList) {
        if (isAborted) {
            resetUiToReadyState('Operation aborted before downloads started.');
            return;
        }
        const totalCount = downloadList.length;
        completedCount = 0;
        progressBar.value = 0;
        progressBar.max = totalCount;
        progressContainer.style.display = 'block';
        
        statusEl.textContent = `Downloading 0 of ${totalCount}...`;
        chrome.downloads.onChanged.addListener(handleDownloadChange);
        
        downloadList.forEach(item => {
            chrome.downloads.download({
                saveAs: false,
                url: item.url,
                filename: item.filename,
            }, (downloadId) => {
                if (chrome.runtime.lastError) {
                    console.error(`Download failed: ${chrome.runtime.lastError.message}`);
                    updateProgress(totalCount, true);
                } else if (downloadId) {
                    downloadIds.add(downloadId);
                }
            });
        });
    }

    function handleDownloadChange(delta) {
        if (!downloadIds.has(delta.id)) return;
        if (delta.state && (delta.state.current === 'complete' || delta.state.current === 'interrupted')) {
            updateProgress(progressBar.max);
            downloadIds.delete(delta.id);
        }
    }
    
    function updateProgress(total, isError = false) {
        if(!isError) completedCount++;
        progressBar.value = completedCount;
        statusEl.textContent = `Downloading ${completedCount} of ${total}...`;
        if (completedCount >= total) {
            resetUiToReadyState('✅ Download complete!');
        }
    }
    
    function setUiToInProgressState() {
        downloadBtn.style.display = 'none';
        abortBtn.style.display = 'block';
        folderNameInput.disabled = true;
    }
    
    function resetUiToReadyState(message) {
        statusEl.textContent = message;
        downloadBtn.style.display = 'block';
        abortBtn.style.display = 'none';
        progressContainer.style.display = 'none';
        downloadBtn.disabled = lotsDataCache.length === 0;
        folderNameInput.disabled = false;
        cleanupListener();
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
            resetUiToReadyState('Not a Seller.CTBids Dashboard page.');
            downloadBtn.disabled = true;
            return;
        }
        try {
            statusEl.textContent = 'Loading auction data...';
            const results = await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
            const pageData = results[0].result;
            if (pageData && pageData.lotsData) {
                folderNameInput.value = pageData.auctionName || '';
                lotsDataCache = pageData.lotsData;
                resetUiToReadyState(`Ready. Found ${lotsDataCache.length} lots.`);
                ctControls.style.display = 'block';
            } else {
                throw new Error("No data received from page.");
            }
        } catch (error) {
            console.error('Initialization failed:', error);
            resetUiToReadyState(`ERROR: ${error.message}`);

        }
    }

    initializePopup();
});