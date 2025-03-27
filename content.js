
// Configuration for the observer
const observerConfig = {
  childList: true,
  subtree: true
};

// Store the observer instance
let observer;

// Counter for filtered items
let filteredItemsCount = 0;

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
  chrome.storage.sync.get({ excludedBrands: [], disabledBrands: [] }, function(data) {
    const excludedBrands = data.excludedBrands;
    const disabledBrands = data.disabledBrands;
    
    // Create a set of active excluded brands (those not in disabledBrands)
    const activeExcludedBrands = excludedBrands.filter(brand => !disabledBrands.includes(brand));
    
    // If no brands to exclude, no need to filter
    if (activeExcludedBrands.length === 0) {
      // Reset counter when no active brands
      filteredItemsCount = 0;
      updateFilterStats();
      return;
    }
    
    console.log('Filtering brands:', activeExcludedBrands);
    
    // Get all catalog items on the page
    const catalogItems = document.querySelectorAll('[data-testid^="grid-item"]');
    
    // Reset the counter before counting again
    let currentFilteredCount = 0;
    
    catalogItems.forEach(item => {
      // Find the brand element within the item
      const brandElement = item.querySelector('.new-item-box__description p[data-testid$="--description-title"]');
      
      if (brandElement) {
        const brandText = brandElement.textContent.trim();
        
        // Check if this item's brand is in our active excluded list
        let shouldHide = false;
        for (const brand of activeExcludedBrands) {
          if (brandText.toLowerCase().includes(brand.toLowerCase())) {
            shouldHide = true;
            break;
          }
        }
        
        if (shouldHide) {
          // Hide the item
          item.style.display = 'none';
          currentFilteredCount++;
        } else {
          // Show the item (in case it was hidden before)
          item.style.display = '';
        }
      }
    });
    
    // Update the filtered items count
    filteredItemsCount = currentFilteredCount;
    updateFilterStats();
  });
}

// Function to update filter statistics
function updateFilterStats() {
  // Send the stats to the popup if it's open
  chrome.runtime.sendMessage({ 
    action: 'updateFilterStats', 
    stats: { filteredCount: filteredItemsCount } 
  });
  
  console.log('Filtered items count:', filteredItemsCount);
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
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'brandsUpdated') {
    console.log('Brands updated, re-filtering products...');
    filterProducts();
  }
  else if (message.action === 'requestStats') {
    // Respond with current statistics
    sendResponse({ 
      stats: { filteredCount: filteredItemsCount } 
    });
  }
  
  // Return true to indicate we'll respond asynchronously
  return true;
});
