
// Configuration for the observer
const observerConfig = {
  childList: true,
  subtree: true
};

// Store the observer instance
let observer;

// Function to start observing DOM changes
function startObserving() {
  // Select the node that will be observed for mutations
  const targetNode = document.body;

  // Create an observer instance linked to the callback function
  observer = new MutationObserver(filterProducts);

  // Start observing the target node for configured mutations
  observer.observe(targetNode, observerConfig);
  
  // Initial filtering
  filterProducts();
}

// Main function to filter out products
function filterProducts() {
  chrome.storage.sync.get({ excludedBrands: [] }, function(data) {
    const excludedBrands = data.excludedBrands;
    
    // If no brands to exclude, no need to filter
    if (excludedBrands.length === 0) return;
    
    console.log('Filtering brands:', excludedBrands);
    
    // Get all catalog items on the page
    const catalogItems = document.querySelectorAll('[data-testid^="grid-item"]');
    
    catalogItems.forEach(item => {
      // Find the brand element within the item using the updated selector
      const brandElement = item.querySelector('.new-item-box__description p[data-testid$="--description-title"]');
      
      if (brandElement) {
        const brandText = brandElement.textContent.trim();
        console.log('Found brand:', brandText);
        
        // Check if this item's brand is in our excluded list
        for (const brand of excludedBrands) {
          if (brandText.toLowerCase().includes(brand.toLowerCase())) {
            // Hide the item
            console.log('Hiding item with brand:', brandText);
            item.style.display = 'none';
            break;
          }
        }
      } else {
        console.log('Brand element not found in grid item');
      }
    });
  });
}

// Initialize when the page is loaded
document.addEventListener('DOMContentLoaded', startObserving);

// Also filter on page load (in case DOMContentLoaded already fired)
startObserving();

// Listen for URL changes (Vinted is a SPA)
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    console.log('URL changed, filtering products...');
    
    // Wait a bit for the page to load content
    setTimeout(filterProducts, 1000);
  }
}).observe(document, {subtree: true, childList: true});

// Add a message listener to handle immediate filtering when brands are updated
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === 'brandsUpdated') {
    console.log('Brands updated, re-filtering products...');
    filterProducts();
  }
});
