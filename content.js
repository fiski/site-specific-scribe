
// Configuration for the observer
const observerConfig = {
  childList: true,
  subtree: true
};

// Store the observer instance
let observer;

// Counter for filtered items
let filteredItemsCount = 0;

// Determine which site we're on
const currentSite = window.location.hostname.includes('vinted.se') ? 'vinted' : 
                   window.location.hostname.includes('tradera.com') ? 'tradera' : null;

console.log('Brand Filter running on:', currentSite);

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
  chrome.storage.sync.get({ 
    excludedBrands: [], 
    disabledBrands: [],
    siteSettings: { vinted: true, tradera: true } // Default both sites to enabled
  }, function(data) {
    const excludedBrands = data.excludedBrands;
    const disabledBrands = data.disabledBrands;
    const siteSettings = data.siteSettings;
    
    // Check if filtering is enabled for the current site
    if (!currentSite || !siteSettings[currentSite]) {
      // Filtering is disabled for this site or we're on an unsupported site
      // Show all items in case they were previously hidden
      showAllItems();
      // Reset counter since we're not filtering
      filteredItemsCount = 0;
      updateFilterStats();
      return;
    }
    
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
    
    // Get all catalog items based on the current site
    let catalogItems = [];
    if (currentSite === 'vinted') {
      catalogItems = document.querySelectorAll('[data-testid^="grid-item"]');
    } else if (currentSite === 'tradera') {
      catalogItems = document.querySelectorAll('.item-card-new');
    }
    
    console.log(`Found ${catalogItems.length} items to check on ${currentSite}`);
    
    // Reset the counter before counting again
    let currentFilteredCount = 0;
    
    catalogItems.forEach(item => {
      // Find the brand element within the item based on the site
      let brandElements = [];
      
      if (currentSite === 'vinted') {
        const brandElement = item.querySelector('.new-item-box__description p[data-testid$="--description-title"]');
        if (brandElement) {
          brandElements.push(brandElement);
        }
      } else if (currentSite === 'tradera') {
        // For tradera, check both the brand button and the title link
        const brandButtons = item.querySelectorAll('.attribute-buttons-list_attribute__ssoUD');
        brandButtons.forEach(btn => brandElements.push(btn));
        
        // Also check in the title
        const titleLink = item.querySelector('a.text-truncate-one-line');
        if (titleLink) {
          brandElements.push(titleLink);
        }
      }
      
      // If we found brand elements, check against our list
      if (brandElements.length > 0) {
        let shouldHide = false;
        
        // Check each brand element against our excluded brands
        for (const element of brandElements) {
          const brandText = element.textContent.trim();
          
          for (const brand of activeExcludedBrands) {
            if (brandText.toLowerCase().includes(brand.toLowerCase())) {
              shouldHide = true;
              break;
            }
          }
          
          if (shouldHide) break;
        }
        
        if (shouldHide) {
          if (currentSite === 'tradera') {
            // For Tradera, find and remove the parent container completely
            const parentContainer = findParentContainer(item);
            if (parentContainer) {
              parentContainer.remove();
            } else {
              // Fallback to hiding if parent container not found
              item.style.display = 'none';
            }
          } else {
            // For Vinted and others, just hide the item
            item.style.display = 'none';
          }
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

// Function to find the parent container for Tradera items
function findParentContainer(item) {
  // Check if we're starting with .item-card-new
  let current = item;
  if (!current.classList.contains('item-card-new')) {
    // Find the item-card-new parent
    while (current && !current.classList.contains('item-card-new')) {
      current = current.parentElement;
    }
  }
  
  // Now find the top-level container
  // Moving up to find either an empty div or a specific container
  if (current) {
    // Go one level up to get to the parent container
    let parent = current.parentElement;
    
    // Check if this parent is a suitable container
    if (parent) {
      // Often the parent container is a div with no class or
      // it might be inside a grid container
      if (parent.className.trim() === '' || 
          parent.classList.contains('col') ||
          parent.classList.contains('col-md-6') ||
          parent.classList.contains('col-lg-4')) {
        return parent;
      }
    }
  }
  
  // If we couldn't find a parent container, return null
  return null;
}

// Function to show all previously hidden items
function showAllItems() {
  if (currentSite === 'vinted') {
    const items = document.querySelectorAll('[data-testid^="grid-item"]');
    items.forEach(item => {
      item.style.display = '';
    });
  } else if (currentSite === 'tradera') {
    // For Tradera we need to refresh the page since we're removing elements
    // However, this could be jarring for users, so let's just show hidden items
    const items = document.querySelectorAll('.item-card-new[style*="display: none"]');
    items.forEach(item => {
      item.style.display = '';
    });
  }
}

// Function to update filter statistics
function updateFilterStats() {
  // Send the stats to the popup if it's open
  chrome.runtime.sendMessage({ 
    action: 'updateFilterStats', 
    stats: { 
      filteredCount: filteredItemsCount,
      site: currentSite
    } 
  });
  
  console.log(`[${currentSite}] Filtered items count:`, filteredItemsCount);
}

// Initialize when the page is loaded
document.addEventListener('DOMContentLoaded', startObserving);

// Also filter on page load (in case DOMContentLoaded already fired)
startObserving();

// Listen for URL changes (Both sites are SPAs)
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
  else if (message.action === 'siteSettingsUpdated') {
    console.log('Site settings updated, re-filtering products...');
    filterProducts();
  }
  else if (message.action === 'requestStats') {
    // Respond with current statistics
    sendResponse({ 
      stats: { 
        filteredCount: filteredItemsCount,
        site: currentSite
      } 
    });
  }
  
  // Return true to indicate we'll respond asynchronously
  return true;
});
