/* ===== order-est/page.js — Order Estimation Page ===== */
(function () {
  'use strict';

  var oeItems = [];
  var listEl = null;

  // ── Autocomplete state ──
  var activeDropdown = null;
  var activeInputIdx = -1;
  var searchTimer = null;

  var formatPrice  = window.formatPrice  || function () { return '\u2014'; };
  var t            = window.t            || function (k) { return k; };
  var escHtml      = window.escHtml      || function (s) { return s || ''; };

  function getOEPriceType() {
    // MSRP-only version: always return 'msrp'
    return 'msrp';
  }

  // ── Autocomplete: lightweight product search ──
  function searchOEProducts(query) {
    if (!query || !window.TM_ProductData) return [];
    var q = query.trim();
    var qNorm = q.replace(/[-_\s]/g, '').toLowerCase();
    var qLow = q.toLowerCase();
    var results = [];
    for (var i = 0; i < window.TM_ProductData.length; i++) {
      var p = window.TM_ProductData[i];
      if (!p.model) continue;
      var modelNorm = p.model.replace(/[-_\s]/g, '').toLowerCase();
      var score = 0;
      if (modelNorm === qNorm) score = 2000;
      else if (modelNorm.startsWith(qNorm)) score = 1000;
      else if (modelNorm.indexOf(qNorm) >= 0) score = 500;
      else if (q.length >= 2 && p.short_desc && p.short_desc.toLowerCase().indexOf(qLow) >= 0) score = 200;
      if (score > 0) results.push({ product: p, score: score });
    }
    results.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return (a.product.model || '').localeCompare(b.product.model || '');
    });
    return results.slice(0, 8).map(function (r) { return r.product; });
  }

  function showAutocomplete(inputEl, idx) {
    var query = (inputEl.value || '').trim();
    if (!query) {
      hideAutocomplete();
      return;
    }

    var results = searchOEProducts(query);

    // Find or create the wrapper
    var wrapEl = inputEl.closest('.oe-search-wrap');
    if (!wrapEl) {
      wrapEl = document.createElement('div');
      wrapEl.className = 'oe-search-wrap';
      inputEl.parentNode.insertBefore(wrapEl, inputEl);
      wrapEl.appendChild(inputEl);
    }

    // Find or create the dropdown
    var dropdown = wrapEl.querySelector('.oe-dropdown');
    if (!dropdown) {
      dropdown = document.createElement('div');
      dropdown.className = 'oe-dropdown';
      wrapEl.appendChild(dropdown);
    }

    // Render dropdown content
    var priceType = getOEPriceType();
    var priceField = priceType === 'msrp' ? 'msrp' : priceType === 'ws5' ? 'wholesale_plus5' : 'wholesale';

    if (results.length === 0) {
      dropdown.innerHTML = '<div class="oe-dd-empty">' + t('no_results').replace('{q}', escHtml(query)) + '</div>';
    } else {
      dropdown.innerHTML = results.map(function (p) {
        var price = p[priceField] ? formatPrice(p[priceField]) : '\u2014';
        return '<div class="oe-dd-item" data-model="' + escHtml(p.model) + '">' +
          '<div class="dd-model">' + escHtml(p.model) + '</div>' +
          '<div class="dd-desc">' + escHtml(p.short_desc || '') + '</div>' +
          '<div class="dd-price">' + price + '</div>' +
        '</div>';
      }).join('');
    }

    dropdown.classList.add('show');
    activeDropdown = dropdown;
    activeInputIdx = idx;

    // Bind click events on dropdown items (using event delegation on the dropdown)
    dropdown.onclick = function (ev) {
      var item = ev.target.closest ? ev.target.closest('.oe-dd-item') : null;
      if (!item) {
        // Fallback for older browsers
        item = ev.target;
        while (item && !item.classList.contains('oe-dd-item')) item = item.parentElement;
      }
      if (item) {
        var model = item.getAttribute('data-model');
        if (model) {
          inputEl.value = model;
          window.updateOEItem(idx, 'model', model);
          hideAutocomplete();
        }
      }
    };
  }

  function hideAutocomplete() {
    if (activeDropdown) {
      activeDropdown.classList.remove('show');
      activeDropdown.onclick = null;
      activeDropdown = null;
      activeInputIdx = -1;
    }
  }

  window.onOEPriceTypeChange = function () {
    if (oeItems.length > 0) rerenderOE();
  };

  window.addOEItem = function (model) {
    var newItem = { model: model || '', qty: 1 };
    // If model provided, try to find the product
    if (model && window.TM_ProductData) {
      var val = model.trim().toUpperCase();
      for (var i = 0; i < window.TM_ProductData.length; i++) {
        if (window.TM_ProductData[i].model.toUpperCase() === val) {
          newItem._product = window.TM_ProductData[i];
          break;
        }
      }
    }
    oeItems.push(newItem);
    rerenderOE();
    // Focus the new model input (if no model provided)
    if (!model) {
      setTimeout(function () {
        var inputs = document.querySelectorAll('.oe-model-input');
        if (inputs.length > 0) inputs[inputs.length - 1].focus();
      }, 50);
    }
  };

  window.addOEModelFromTag = function (model) {
    // Check if already in the list
    for (var i = 0; i < oeItems.length; i++) {
      if (oeItems[i].model.toUpperCase() === model.toUpperCase()) {
        // Increment qty instead of adding duplicate
        oeItems[i].qty = (parseInt(oeItems[i].qty) || 0) + 1;
        rerenderOE();
        return;
      }
    }
    // Find first empty row and fill it
    for (var j = 0; j < oeItems.length; j++) {
      if (!oeItems[j].model || oeItems[j].model.trim() === '') {
        oeItems[j].model = model;
        // Try to find the product
        if (window.TM_ProductData) {
          var val = model.trim().toUpperCase();
          for (var k = 0; k < window.TM_ProductData.length; k++) {
            if (window.TM_ProductData[k].model.toUpperCase() === val) {
              oeItems[j]._product = window.TM_ProductData[k];
              break;
            }
          }
        }
        rerenderOE();
        return;
      }
    }
    // No empty row, add new item
    window.addOEItem(model);
  };

  window.removeOEItem = function (idx) {
    oeItems.splice(idx, 1);
    rerenderOE();
  };

  window.updateOEItem = function (idx, field, value) {
    if (!oeItems[idx]) return;
    oeItems[idx][field] = value;
    if (field === 'model') {
      var found = null;
      if (window.TM_ProductData) {
        var val = value.trim().toUpperCase();
        for (var i = 0; i < window.TM_ProductData.length; i++) {
          if (window.TM_ProductData[i].model.toUpperCase() === val) {
            found = window.TM_ProductData[i];
            break;
          }
        }
      }
      if (found) {
        oeItems[idx]._product = found;
      } else {
        delete oeItems[idx]._product;
      }
    }
    rerenderOE();
  };

  function rerenderOE() {
    listEl = document.getElementById('oeList');
    var summaryEl = document.getElementById('oeSummary');
    if (!listEl) return;

    // Hide autocomplete before re-rendering
    hideAutocomplete();

    var priceType = getOEPriceType();
    var totalItems = 0;
    var totalQty = 0;
    var subtotal = 0;
    var html = '';

    // Table header
    html += '<div class="oe-list-header">' +
      '<span>#</span>' +
      '<span data-i18n="col_model">' + t('col_model') + '</span>' +
      '<span data-i18n="col_qty">' + t('col_qty') + '</span>' +
      '<span style="text-align:right" data-i18n="oe_unit_price">' + t('oe_unit_price') + '</span>' +
      '<span style="text-align:right" data-i18n="oe_line_total">' + t('oe_line_total') + '</span>' +
      '<span></span>' +
    '</div>';

    if (oeItems.length === 0) {
      // Still show header, no items
      listEl.innerHTML = html;
      if (summaryEl) summaryEl.style.display = 'none';
      return;
    }

    for (var i = 0; i < oeItems.length; i++) {
      var item = oeItems[i];
      var p = item._product;
      var priceField = priceType === 'msrp' ? 'msrp' : priceType === 'ws5' ? 'wholesale_plus5' : 'wholesale';
      var unitPrice = p ? parseFloat(String(p[priceField] || '0').replace(/[^0-9.]/g, '')) : 0;
      var qty = parseInt(item.qty) || 0;
      var lineTotal = unitPrice * qty;
      if (p) { totalItems++; totalQty += qty; subtotal += lineTotal; }

      html += '<div class="oe-item" data-idx="' + i + '">' +
        '<span class="oe-item-num">' + (i + 1) + '</span>' +
        '<div class="oe-search-wrap">' +
          '<input type="text" class="oe-model-input" value="' + escHtml(item.model) + '" data-idx="' + i + '" placeholder="Model #' + (i + 1) + '" autocomplete="off">' +
        '</div>' +
        '<input type="number" class="oe-qty-input" value="' + qty + '" min="0" data-idx="' + i + '">' +
        '<span class="oe-item-price">' + (p ? formatPrice(p[priceField]) : '<span class="oe-item-notfound">\u2014</span>') + '</span>' +
        '<span class="oe-item-total">' + (p ? formatPrice(lineTotal) : '<span class="oe-item-notfound">\u2014</span>') + '</span>' +
        '<button class="oe-del-btn" data-idx="' + i + '" title="Remove">\u2715</button>' +
      '</div>';
    }

    listEl.innerHTML = html;

    // Update summary
    if (summaryEl) {
      if (totalItems > 0) {
        summaryEl.style.display = 'flex';
        document.getElementById('oeSumItemsVal').textContent = totalItems;
        document.getElementById('oeSumQtyVal').textContent = totalQty;
        document.getElementById('oeSumSubtotalVal').textContent = formatPrice(subtotal);
      } else {
        summaryEl.style.display = 'none';
      }
    }
  }

  function renderQuickTags() {
    var tagsEl = document.getElementById('oeQuickTags');
    if (!tagsEl) return;
    var models = window.TM_PopularModels || [];
    tagsEl.innerHTML = models.map(function (m) {
      return '<span class="oe-qa-tag" data-model="' + escHtml(m) + '">' + escHtml(m) + '</span>';
    }).join('');
  }

  function initOrderEstPage() {
    listEl = document.getElementById('oeList');
    if (!listEl) return;

    // Pre-populate 3 empty rows
    oeItems = [
      { model: '', qty: 1 },
      { model: '', qty: 1 },
      { model: '', qty: 1 }
    ];
    rerenderOE();

    // Event delegation for list
    listEl.addEventListener('change', function (e) {
      var target = e.target;
      if (target.classList.contains('oe-model-input')) {
        var idx1 = parseInt(target.getAttribute('data-idx'));
        window.updateOEItem(idx1, 'model', target.value);
      } else if (target.classList.contains('oe-qty-input')) {
        var idx2 = parseInt(target.getAttribute('data-idx'));
        window.updateOEItem(idx2, 'qty', target.value);
      }
    });

    // Input events: qty real-time update + model autocomplete
    listEl.addEventListener('input', function (e) {
      var target = e.target;
      if (target.classList.contains('oe-qty-input')) {
        var idx = parseInt(target.getAttribute('data-idx'));
        window.updateOEItem(idx, 'qty', target.value);
      } else if (target.classList.contains('oe-model-input')) {
        var mIdx = parseInt(target.getAttribute('data-idx'));
        // Debounce autocomplete search
        clearTimeout(searchTimer);
        searchTimer = setTimeout(function () {
          showAutocomplete(target, mIdx);
        }, 200);
      }
    });

    // Focus on model input: show autocomplete if has value
    listEl.addEventListener('focusin', function (e) {
      if (e.target.classList.contains('oe-model-input')) {
        var val = (e.target.value || '').trim();
        if (val) {
          var fIdx = parseInt(e.target.getAttribute('data-idx'));
          clearTimeout(searchTimer);
          searchTimer = setTimeout(function () {
            showAutocomplete(e.target, fIdx);
          }, 150);
        }
      }
    });

    listEl.addEventListener('click', function (e) {
      if (e.target.classList.contains('oe-del-btn')) {
        var idx3 = parseInt(e.target.getAttribute('data-idx'));
        window.removeOEItem(idx3);
      }
    });

    // Close dropdown when clicking outside
    document.addEventListener('click', function (e) {
      if (activeDropdown) {
        var wrap = e.target.closest ? e.target.closest('.oe-search-wrap') : null;
        if (!wrap) {
          hideAutocomplete();
        }
      }
    });

    // ESC key to close dropdown
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && activeDropdown) {
        hideAutocomplete();
      }
    });

    // Quick-add tags delegation
    var tagsContainer = document.getElementById('oeQuickTags');
    if (tagsContainer) {
      tagsContainer.addEventListener('click', function (e) {
        if (e.target.classList.contains('oe-qa-tag')) {
          var model = e.target.getAttribute('data-model');
          if (model) window.addOEModelFromTag(model);
        }
      });
    }

    // Render quick tags
    renderQuickTags();
  }

  window.registerPageDataReady(function () {
    initOrderEstPage();
  });

  window.registerPageLangChange(function () {
    renderQuickTags();
    if (oeItems.length > 0) rerenderOE();
  });

})();
