chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'convertToFormat') {
        convertImage(request.url, request.format)
            .then(dataUrl => sendResponse({ success: true, dataUrl }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Indicates that the response is sent asynchronously
    }
});

async function convertImage(imageUrl, format) {
    const response = await fetch(imageUrl);
    if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    const blob = await response.blob();
    const imageBitmap = await createImageBitmap(blob);

    const canvas = new OffscreenCanvas(imageBitmap.width, imageBitmap.height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(imageBitmap, 0, 0);

    const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
    const quality = format === 'jpeg' ? 0.9 : undefined; // Quality setting for JPEG

    const convertedBlob = await canvas.convertToBlob({ type: mimeType, quality });

    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(convertedBlob);
    });
}
