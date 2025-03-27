
document.addEventListener('DOMContentLoaded', function() {
  // Load saved brands when popup opens
  loadBrands();
  
  // Set up the form submit event
  document.getElementById('add-brand-form').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const brandInput = document.getElementById('new-brand');
    const brandName = brandInput.value.trim();
    
    if (brandName) {
      addBrand(brandName);
      brandInput.value = '';
    }
  });
});

// Load brands from storage and display them
function loadBrands() {
  chrome.storage.sync.get({ excludedBrands: [] }, function(data) {
    const brandsContainer = document.getElementById('brands-container');
    brandsContainer.innerHTML = '';
    
    if (data.excludedBrands.length === 0) {
      brandsContainer.innerHTML = '<p>No brands added yet.</p>';
      return;
    }
    
    data.excludedBrands.forEach(function(brand) {
      const brandElement = document.createElement('div');
      brandElement.className = 'brand-item';
      
      const brandName = document.createElement('span');
      brandName.textContent = brand;
      
      const removeButton = document.createElement('span');
      removeButton.className = 'remove-btn';
      removeButton.textContent = '✕';
      removeButton.addEventListener('click', function() {
        removeBrand(brand);
      });
      
      brandElement.appendChild(brandName);
      brandElement.appendChild(removeButton);
      brandsContainer.appendChild(brandElement);
    });
  });
}

// Add a new brand to excluded list
function addBrand(brand) {
  chrome.storage.sync.get({ excludedBrands: [] }, function(data) {
    // Check if brand already exists
    if (!data.excludedBrands.includes(brand)) {
      const updatedBrands = [...data.excludedBrands, brand];
      
      chrome.storage.sync.set({ excludedBrands: updatedBrands }, function() {
        loadBrands(); // Refresh the list
        notifyContentScript();
      });
    } else {
      alert('This brand is already in your exclude list.');
    }
  });
}

// Remove a brand from excluded list
function removeBrand(brand) {
  chrome.storage.sync.get({ excludedBrands: [] }, function(data) {
    const updatedBrands = data.excludedBrands.filter(item => item !== brand);
    
    chrome.storage.sync.set({ excludedBrands: updatedBrands }, function() {
      loadBrands(); // Refresh the list
      notifyContentScript();
    });
  });
}

// Notify content script that brands have been updated
function notifyContentScript() {
  chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, { action: 'brandsUpdated' });
    }
  });
}
