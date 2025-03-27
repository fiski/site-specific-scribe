
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
    
    // Get all catalog items on the page
    const catalogItems = document.querySelectorAll('.feed-grid__item');
    
    catalogItems.forEach(item => {
      // Find the brand element within the item
      const brandElement = item.querySelector('.web_ui__Cell__subtitle');
      
      if (brandElement) {
        const brandText = brandElement.textContent.trim();
        
        // Check if this item's brand is in our excluded list
        for (const brand of excludedBrands) {
          if (brandText.toLowerCase().includes(brand.toLowerCase())) {
            // Hide the item
            item.style.display = 'none';
            break;
          }
        }
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
    
    // Wait a bit for the page to load content
    setTimeout(filterProducts, 1000);
  }
}).observe(document, {subtree: true, childList: true});
