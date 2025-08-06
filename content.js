(() => {
    function sanitizeFilename(name) {
        if (!name) return 'untitled';
        return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\\/:*?"<>|#]/g, ' ').trim() || 'untitled';
    }

    const auctionNameElement = document.querySelector('span.mx-2');
    const auctionName = auctionNameElement ? auctionNameElement.innerText.trim() : 'Default-Auction';
    const lotsData = [];

    document.querySelectorAll('.row.row-cols-1 > .col').forEach(node => {
        const imgElement = node.querySelector('img.location-image');
        const titleElement = node.querySelector('.title.h5.text-bold');
        const statusElement = node.querySelector('.d-flex.align-items-center.justify-content-between.header > div > div');

        if (imgElement && titleElement) {
            const imageUrl = imgElement.src;
            const title = titleElement.innerText;
            const isPending = statusElement ? statusElement.innerText.trim() === 'Pending' : false;
            const thumbnailFilename = imageUrl.substring(imageUrl.lastIndexOf('/') + 1);
            
            // Extract the part of the filename before the underscore as the Lot ID
            const lotId = thumbnailFilename.split('_')[0];

            lotsData.push({
                thumbnailUrl: imageUrl,
                title: sanitizeFilename(title),
                isPending: isPending,
                lotId: lotId,
            });
        }
    });

    return { auctionName, lotsData: lotsData };
})();