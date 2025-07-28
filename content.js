(() => {
  function sanitizeFilename(name) {
    if (!name) return 'untitled';
    const sanitized = name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\\/:*?"<>|#]/g, ' ')
      .trim();
    return sanitized || 'untitled';
  }

  const auctionNameElement = document.querySelector('span.mx-2');
  const auctionName = auctionNameElement ? auctionNameElement.innerText.trim() : 'Default-Auction';

  const itemsToDownload = [];
  const itemNodes = document.querySelectorAll('.row.row-cols-1 > .col');

  itemNodes.forEach(node => {
    const imgElement = node.querySelector('img.location-image');
    const titleElement = node.querySelector('.title.h5.text-bold');
    
    // Find the status element for the current item
    const statusElement = node.querySelector('.d-flex.align-items-center.justify-content-between.header > div > div');

    if (imgElement && titleElement) {
      const imageUrl = imgElement.src;
      const title = titleElement.innerText;
      
      // Check if the item's status is "Pending"
      const isPending = statusElement ? statusElement.innerText.trim() === 'Pending' : false;

      const urlParts = new URL(imageUrl);
      const extension = urlParts.pathname.substring(urlParts.pathname.lastIndexOf('.'));
      const filename = sanitizeFilename(title) + extension;
      
      itemsToDownload.push({
        url: imageUrl,
        filename: filename,
        isPending: isPending, // Add the status to the item's data
      });
    }
  });

  return { auctionName, imageData: itemsToDownload };
})();