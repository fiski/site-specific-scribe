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
        // Target specifically the item-card elements for Tradera
        catalogItems = document.querySelectorAll('.item-card');
        
        // If no item-cards found, try the item-card-new selector as fallback
        if (catalogItems.length === 0) {
          catalogItems = document.querySelectorAll('.item-card-new');
        }
        
        console.log(`Found ${catalogItems.length} Tradera items`);
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
          const titleLink = item.querySelector('a.text-truncate-one-line, a.item-card-title');
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
            parentItemCard.style.display = 'none'; // Use style.display none instead of remove
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
      console.log(`Setting filtered count to ${filteredItemsCount} for ${currentSite}`);
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
    
    // If not already an item-card or item-card-new, find the closest one
    if (!current.classList.contains('item-card') && !current.classList.contains('item-card-new')) {
      current = current.closest('.item-card, .item-card-new');
      if (!current) return null;
    }
    
    // Find the parent container for .item-card
    // This could be col-* or a direct parent with specific classes
    const parent = current.closest('.col, .col-md-6, .col-lg-4, .result-item, .item-row');
    
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
      // For Tradera show all hidden items
      const items = document.querySelectorAll('.item-card[style*="display: none"], .item-card-new[style*="display: none"]');
      items.forEach(item => {
        item.style.display = '';
      });
      
      // Also check for parent containers that might be hidden
      const parentContainers = document.querySelectorAll('.col[style*="display: none"], .col-md-6[style*="display: none"], .col-lg-4[style*="display: none"], .result-item[style*="display: none"], .item-row[style*="display: none"]');
      parentContainers.forEach(container => {
        container.style.display = '';
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

// Improved function to send chrome runtime messages with retry logic
function sendMessageWithRetry(message, maxRetries = 2) {
  let attempts = 0;
  
  function trySendMessage() {
    attempts++;
    
    // Check if runtime is available
    if (!chrome.runtime) {
      console.warn('Chrome runtime not available');
      return;
    }
    
    try {
      chrome.runtime.sendMessage(message, function(response) {
        if (chrome.runtime.lastError) {
          const errorMsg = chrome.runtime.lastError.message;
          console.warn('Message send error:', errorMsg);
          
          // Only retry if the error is about connection and we have retries left
          if (attempts <= maxRetries && 
              (errorMsg.includes('Receiving end does not exist') || 
               errorMsg.includes('connection') || 
               errorMsg.includes('disconnected'))) {
            console.log(`Retrying message send (attempt ${attempts}/${maxRetries})`);
            setTimeout(trySendMessage, 500 * attempts); // Increasing delay
          }
        }
      });
    } catch (err) {
      console.error('Error in sendMessage:', err);
      // If it's an unexpected error, still try to retry
      if (attempts <= maxRetries) {
        setTimeout(trySendMessage, 500 * attempts);
      }
    }
  }
  
  trySendMessage();
}

// Function to delay execution to ensure page is loaded
function ensurePageLoaded(callback, maxAttempts = 15, interval = 500) {
  let attempts = 0;
  
  function checkAndExecute() {
    attempts++;
    
    if (document.body) {
      // Check if main content is loaded
      let contentLoaded = false;
      
      if (currentSite === 'tradera') {
        contentLoaded = document.querySelector('.item-card') !== null || 
                         document.querySelector('.item-card-new') !== null;
      } else if (currentSite === 'vinted') {
        contentLoaded = document.querySelector('[data-testid="item-box-wrapper"]') !== null;
      }
      
      // If content is loaded or we've reached max attempts
      if (contentLoaded || attempts >= maxAttempts) {
        console.log(`Content loaded after ${attempts} attempts`);
        callback();
      } else {
        if (attempts === maxAttempts - 1) {
          console.log('Almost reached max attempts, forcing callback...');
        }
        setTimeout(checkAndExecute, interval);
      }
    } else {
      // Body not available yet, keep waiting
      if (attempts < maxAttempts) {
        setTimeout(checkAndExecute, interval);
      } else {
        console.log('Reached max attempts without body, forcing callback...');
        callback();
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
    
    // Reset counter when URL changes
    filteredItemsCount = 0;
    
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
      // Log current statistics for debugging
      console.log(`Sending stats: ${filteredItemsCount} items filtered on ${currentSite}`);
      
      // Respond with current statistics
      sendResponse({ 
        stats: { 
          filteredCount: filteredItemsCount,
          site: currentSite
        } 
      });
    }
    
    // Return true to indicate we want to respond asynchronously
    return true;
  } catch (error) {
    console.error('Error in message listener:', error);
    // Send error response
    sendResponse({ error: error.message });
    return true;
  }
});

// Add event listener for when the extension is unloaded or reloaded
window.addEventListener('beforeunload', function() {
  // Clean up the observer to prevent memory leaks
  if (observer) {
    observer.disconnect();
  }
});
