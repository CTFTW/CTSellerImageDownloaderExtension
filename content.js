(() => {
  /**
   * Sanitizes a string for use as a valid filename.
   */
  function sanitizeFilename(name) {
    if (!name) return 'untitled';
    const sanitized = name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritical marks
      .replace(/[\\/:*?"<>|#]/g, ' ')  // Replace invalid characters
      .trim();
    return sanitized || 'untitled';
  }

  // Find the auction name from the specified span element
  const auctionNameElement = document.querySelector('span.mx-2');
  // Use innerText to safely get the visible text and trim any extra whitespace
  const auctionName = auctionNameElement ? auctionNameElement.innerText.trim() : 'Default-Auction';

  const itemsToDownload = [];
  const itemNodes = document.querySelectorAll('.row.row-cols-1 > .col');

  itemNodes.forEach(node => {
    const imgElement = node.querySelector('img.location-image');
    const titleElement = node.querySelector('.title.h5.text-bold');

    if (imgElement && titleElement) {
      const imageUrl = imgElement.src;
      const title = titleElement.innerText;
      
      const urlParts = new URL(imageUrl);
      const extension = urlParts.pathname.substring(urlParts.pathname.lastIndexOf('.'));
      
      const filename = sanitizeFilename(title) + extension;
      
      itemsToDownload.push({
        url: imageUrl,
        filename: filename,
      });
    }
  });

  // Return a single object containing both the auction name and the image data
  return { auctionName, imageData: itemsToDownload };
})();