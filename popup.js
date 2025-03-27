
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
  
  // Set up export button
  document.getElementById('export-btn').addEventListener('click', exportBrands);
  
  // Set up import button
  document.getElementById('import-btn').addEventListener('click', function() {
    document.getElementById('import-modal').style.display = 'block';
  });
  
  // Close modal when clicking on X
  document.querySelector('.close').addEventListener('click', function() {
    document.getElementById('import-modal').style.display = 'none';
  });
  
  // Close modal when clicking outside of it
  window.addEventListener('click', function(event) {
    const modal = document.getElementById('import-modal');
    if (event.target == modal) {
      modal.style.display = 'none';
    }
  });
  
  // Save imported brands
  document.getElementById('save-import').addEventListener('click', importBrands);
});

// Load brands from storage and display them
function loadBrands() {
  chrome.storage.sync.get({ excludedBrands: [], disabledBrands: [] }, function(data) {
    const brandsContainer = document.getElementById('brands-container');
    brandsContainer.innerHTML = '';
    
    // Update the brand count
    const activeCount = data.excludedBrands.length - data.disabledBrands.length;
    document.getElementById('brand-count').textContent = `Excluding ${activeCount} of ${data.excludedBrands.length} brands`;
    
    if (data.excludedBrands.length === 0) {
      brandsContainer.innerHTML = '<p>No brands added yet.</p>';
      return;
    }
    
    data.excludedBrands.forEach(function(brand) {
      const brandElement = document.createElement('div');
      brandElement.className = 'brand-item';
      
      const brandName = document.createElement('span');
      brandName.className = 'brand-name';
      brandName.textContent = brand;
      
      const brandControls = document.createElement('div');
      brandControls.className = 'brand-controls';
      
      // Create toggle switch
      const toggleLabel = document.createElement('label');
      toggleLabel.className = 'toggle-switch';
      
      const toggleInput = document.createElement('input');
      toggleInput.type = 'checkbox';
      toggleInput.checked = !data.disabledBrands.includes(brand);
      toggleInput.addEventListener('change', function() {
        toggleBrand(brand, toggleInput.checked);
      });
      
      const slider = document.createElement('span');
      slider.className = 'slider';
      
      toggleLabel.appendChild(toggleInput);
      toggleLabel.appendChild(slider);
      
      // Create remove button
      const removeButton = document.createElement('span');
      removeButton.className = 'remove-btn';
      removeButton.textContent = '✕';
      removeButton.addEventListener('click', function() {
        removeBrand(brand);
      });
      
      brandControls.appendChild(toggleLabel);
      brandControls.appendChild(removeButton);
      
      brandElement.appendChild(brandName);
      brandElement.appendChild(brandControls);
      brandsContainer.appendChild(brandElement);
    });
  });
}

// Add a new brand to excluded list
function addBrand(brand) {
  chrome.storage.sync.get({ excludedBrands: [], disabledBrands: [] }, function(data) {
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
  chrome.storage.sync.get({ excludedBrands: [], disabledBrands: [] }, function(data) {
    const updatedBrands = data.excludedBrands.filter(item => item !== brand);
    const updatedDisabledBrands = data.disabledBrands.filter(item => item !== brand);
    
    chrome.storage.sync.set({ 
      excludedBrands: updatedBrands,
      disabledBrands: updatedDisabledBrands
    }, function() {
      loadBrands(); // Refresh the list
      notifyContentScript();
    });
  });
}

// Toggle a brand on/off
function toggleBrand(brand, isEnabled) {
  chrome.storage.sync.get({ disabledBrands: [] }, function(data) {
    let updatedDisabledBrands;
    
    if (isEnabled) {
      // Remove from disabled list if enabled
      updatedDisabledBrands = data.disabledBrands.filter(item => item !== brand);
    } else {
      // Add to disabled list if disabled
      if (!data.disabledBrands.includes(brand)) {
        updatedDisabledBrands = [...data.disabledBrands, brand];
      } else {
        updatedDisabledBrands = data.disabledBrands;
      }
    }
    
    chrome.storage.sync.set({ disabledBrands: updatedDisabledBrands }, function() {
      loadBrands(); // Refresh the count
      notifyContentScript();
    });
  });
}

// Export brands list as text
function exportBrands() {
  chrome.storage.sync.get({ excludedBrands: [] }, function(data) {
    const brandsText = data.excludedBrands.join('\n');
    
    // Copy to clipboard
    navigator.clipboard.writeText(brandsText).then(function() {
      alert('Brands list copied to clipboard!');
    }).catch(function(err) {
      console.error('Could not copy text: ', err);
      
      // Fallback method - create a temporary textarea
      const textarea = document.createElement('textarea');
      textarea.value = brandsText;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      alert('Brands list copied to clipboard!');
    });
  });
}

// Import brands from text
function importBrands() {
  const importText = document.getElementById('import-brands').value;
  if (!importText.trim()) {
    alert('Please enter some brands to import.');
    return;
  }
  
  const brandsToImport = importText.split('\n')
    .map(brand => brand.trim())
    .filter(brand => brand.length > 0);
  
  chrome.storage.sync.get({ excludedBrands: [] }, function(data) {
    let newBrands = [];
    let duplicates = 0;
    
    // Filter out duplicates
    brandsToImport.forEach(brand => {
      if (!data.excludedBrands.includes(brand)) {
        newBrands.push(brand);
      } else {
        duplicates++;
      }
    });
    
    // Add new brands to the list
    const updatedBrands = [...data.excludedBrands, ...newBrands];
    
    chrome.storage.sync.set({ excludedBrands: updatedBrands }, function() {
      document.getElementById('import-modal').style.display = 'none';
      document.getElementById('import-brands').value = '';
      
      let message = `Imported ${newBrands.length} brands.`;
      if (duplicates > 0) {
        message += ` (${duplicates} duplicates skipped)`;
      }
      
      alert(message);
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
