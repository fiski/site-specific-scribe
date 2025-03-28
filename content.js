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
    try {
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
      
      // Create an array of items to hide rather than hiding immediately
      const itemsToHide = [];
      
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
            if (!element || !element.textContent) continue;
            
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
            itemsToHide.push(item);
            currentFilteredCount++;
          } else {
            // Show the item (in case it was hidden before)
            item.style.display = '';
          }
        }
      });
      
      // Now process all items to hide at once
      itemsToHide.forEach(item => {
        if (currentSite === 'tradera') {
          // Find and remove the parent container for Tradera
          const parentItemCard = findTraderaItemCard(item);
          if (parentItemCard) {
            parentItemCard.remove();
          } else {
            item.style.display = 'none';
          }
        } else {
          // For Vinted, just hide the item
          item.style.display = 'none';
        }
      });
      
      // Update the filtered items count
      filteredItemsCount = currentFilteredCount;
      updateFilterStats();
    } catch (error) {
      console.error('Error in filterProducts:', error);
    }
  });
}

// Function to find the Tradera item-card and its parent
function findTraderaItemCard(element) {
  try {
    // Start with the provided element
    let current = element;
    
    // If not already an item-card-new, find the closest one
    if (!current.classList.contains('item-card-new')) {
      current = current.closest('.item-card-new');
      if (!current) return null;
    }
    
    // Find the parent container (usually a col-* or result-item)
    const parent = current.closest('.col, .col-md-6, .col-lg-4, .result-item, .slick-slide');
    return parent || current; // Return parent if found, otherwise the item-card itself
  } catch (error) {
    console.error('Error in findTraderaItemCard:', error);
    return null;
  }
}

// Function to show all previously hidden items
function showAllItems() {
  try {
    if (currentSite === 'vinted') {
      const items = document.querySelectorAll('[data-testid^="grid-item"]');
      items.forEach(item => {
        item.style.display = '';
      });
    } else if (currentSite === 'tradera') {
      // For Tradera we would need to refresh the page to restore removed elements
      // But we can at least show any hidden items that weren't removed
      const items = document.querySelectorAll('.item-card-new[style*="display: none"]');
      items.forEach(item => {
        item.style.display = '';
      });
    }
  } catch (error) {
    console.error('Error in showAllItems:', error);
  }
}

// Function to update filter statistics
function updateFilterStats() {
  try {
    // Send the stats to the popup if it's open
    sendMessageWithRetry({ 
      action: 'updateFilterStats', 
      stats: { 
        filteredCount: filteredItemsCount,
        site: currentSite
      } 
    });
    
    console.log(`[${currentSite}] Filtered items count:`, filteredItemsCount);
  } catch (error) {
    console.error('Error in updateFilterStats:', error);
  }
}

// Function to send chrome runtime messages with retry logic
function sendMessageWithRetry(message, maxRetries = 2) {
  let attempts = 0;
  
  function trySendMessage() {
    attempts++;
    chrome.runtime.sendMessage(message, function(response) {
      if (chrome.runtime.lastError) {
        console.warn('Message send error:', chrome.runtime.lastError.message);
        
        // If we have retries left, try again after a delay
        if (attempts <= maxRetries) {
          setTimeout(trySendMessage, 500 * attempts); // Increasing delay
        }
      }
    });
  }
  
  trySendMessage();
}

// Function to delay execution to ensure page is loaded
function ensurePageLoaded(callback, maxAttempts = 10, interval = 500) {
  let attempts = 0;
  
  function checkAndExecute() {
    attempts++;
    
    if (document.body) {
      // Check if main content is loaded
      const contentLoaded = document.querySelector('.js-container-main') !== null || // Tradera
                           document.querySelector('[data-testid="item-box-wrapper"]') !== null; // Vinted
      
      // If content is loaded or we've reached max attempts
      if (contentLoaded || attempts >= maxAttempts) {
        callback();
      } else {
        setTimeout(checkAndExecute, interval);
      }
    } else {
      // Body not available yet, keep waiting
      if (attempts < maxAttempts) {
        setTimeout(checkAndExecute, interval);
      }
    }
  }
  
  checkAndExecute();
}

// Initialize when the page is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    ensurePageLoaded(startObserving);
  });
} else {
  ensurePageLoaded(startObserving);
}

// Listen for URL changes (Both sites are SPAs)
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;
    console.log('URL changed, filtering products...');
    
    // Wait a bit for the page to load content
    setTimeout(() => {
      ensurePageLoaded(filterProducts);
    }, 1000);
  }
}).observe(document, {subtree: true, childList: true});

// Add a message listener to handle immediate filtering when brands are updated
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  try {
    if (message.action === 'brandsUpdated') {
      console.log('Brands updated, re-filtering products...');
      filterProducts();
      // Send success response
      sendResponse({ success: true });
    }
    else if (message.action === 'siteSettingsUpdated') {
      console.log('Site settings updated, re-filtering products...');
      filterProducts();
      // Send success response
      sendResponse({ success: true });
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
  } catch (error) {
    console.error('Error in message listener:', error);
    // Send error response
    sendResponse({ error: error.message });
  }
  
  // Return true to indicate we'll respond asynchronously
  return true;
});
