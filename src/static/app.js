/* ===== app.js — TrolMaster Product Portal ===== */
(function () {
  'use strict';

  // ─── Config (injected by build_app.py) ─────────────────────────────────────
  const CONFIG = window.__TM_CONFIG__ || {};
  const GVIZ_PRODUCT   = CONFIG.gviz_product   || '';
  const GVIZ_INVENTORY = CONFIG.gviz_inventory  || '';
  const FALLBACK_PRODUCTS  = window.__TM_PRODUCTS__  || [];
  const FALLBACK_INVENTORY = window.__TM_INVENTORY__ || [];
  const POPULAR_MODELS = CONFIG.popular_models || [];
  const ER_API_URL = 'https://open.er-api.com/v6/latest/USD';
  const ER_CACHE_KEY = 'tm_exchange_rates';
  const ER_CACHE_TS  = 'tm_exchange_rates_ts';
  const ER_CACHE_HOURS = 24;

  // ─── Product Translations (injected by build_app.py) ────────────────────────
  const PRODUCT_TRANSLATIONS = window.__TM_PRODUCT_TRANSLATIONS__ || {};

  // ─── State ─────────────────────────────────────────────────────────────────
  let currentLang = localStorage.getItem('tm_lang') || 'en';
  let currentCurrency = localStorage.getItem('tm_currency') || 'USD';
  let exchangeRates = { USD: 1, HKD: 7.8, THB: 35.5 };
  let i18n = {};
  let productData   = [];
  let inventoryData = {};
  let dataLoaded = false;
  let oeItems = [];  // Order Estimation items

  // Map language → default currency
  const LANG_CURRENCY = { en: 'USD', 'zh-Hant': 'HKD', th: 'THB' };
  const CURRENCY_SYMBOL = { USD: '$', HKD: 'HK$', THB: '฿' };

  // ─── i18n ──────────────────────────────────────────────────────────────────
  const I18N_BUNDLE = window.__TM_I18N__ || {};

  function t(key) {
    return (i18n[key] !== undefined ? i18n[key] : key);
  }

  function applyLang(lang) {
    currentLang = lang;
    i18n = I18N_BUNDLE[lang] || I18N_BUNDLE['en'] || {};
    localStorage.setItem('tm_lang', lang);

    document.querySelectorAll('[data-i18n]').forEach(el => {
      const key = el.getAttribute('data-i18n');
      el.textContent = t(key);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
    });

    // Language dropdown options
    document.querySelectorAll('.lang-opt').forEach(opt => {
      opt.classList.toggle('active', opt.dataset.lang === lang);
    });

    // Update lang button text
    const langBtn = document.getElementById('langBtn');
    if (langBtn) {
      const label = lang === 'en' ? 'EN' : lang === 'zh-Hant' ? '中文' : 'ไทย';
      langBtn.querySelector('span').textContent = label;
    }
  }

  function switchLang(lang) {
    applyLang(lang);
    if (LANG_CURRENCY[lang]) {
      switchCurrency(LANG_CURRENCY[lang]);
    }
    if (dataLoaded) {
      renderResults();
      rerenderOETable();
    }
  }

  // ─── Currency ──────────────────────────────────────────────────────────────
  function switchCurrency(currency) {
    currentCurrency = currency;
    localStorage.setItem('tm_currency', currency);
    if (dataLoaded) {
      renderResults();
      rerenderOETable();
    }
  }

  function formatPrice(usdValue) {
    if (usdValue === null || usdValue === undefined || usdValue === '') return '—';
    const num = parseFloat(String(usdValue).replace(/[^0-9.]/g, ''));
    if (isNaN(num)) return '—';
    const rate = exchangeRates[currentCurrency] || 1;
    const converted = num * rate;
    const symbol = CURRENCY_SYMBOL[currentCurrency] || currentCurrency;
    return symbol + converted.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  async function fetchExchangeRates() {
    try {
      const ts = localStorage.getItem(ER_CACHE_TS);
      const cached = localStorage.getItem(ER_CACHE_KEY);
      if (ts && cached) {
        const age = (Date.now() - parseInt(ts, 10)) / 3600000;
        if (age < ER_CACHE_HOURS) {
          exchangeRates = JSON.parse(cached);
          setRateStatus('cached');
          return;
        }
      }
      const resp = await fetch(ER_API_URL, { signal: AbortSignal.timeout(5000) });
      const data = await resp.json();
      if (data && data.rates) {
        exchangeRates = { USD: 1, HKD: data.rates.HKD || 7.8, THB: data.rates.THB || 35.5 };
        localStorage.setItem(ER_CACHE_KEY, JSON.stringify(exchangeRates));
        localStorage.setItem(ER_CACHE_TS, Date.now().toString());
        setRateStatus('live');
      }
    } catch (e) {
      setRateStatus('fallback');
    }
  }

  function setRateStatus(type) {
    const els = document.querySelectorAll('#stockStatus, #stockStatusBottom');
    els.forEach(el => {
      if (!el) return;
      if (type === 'live') {
        el.className = 'stock-status ok';
        el.innerHTML = '✓ ' + t('rate_updated');
      } else if (type === 'fallback') {
        el.className = 'stock-status fallback';
        el.innerHTML = '⚠ ' + t('rate_fallback');
      } else if (type === 'loading') {
        el.className = 'stock-status loading';
        el.innerHTML = '⏳ Loading stock...';
      }
    });
  }

  // ─── Data Loading ──────────────────────────────────────────────────────────
  function parseGvizResponse(text) {
    const jsonStr = text.replace(/^\/\*[\s\S]*?\*\/\s*/, '')
                        .replace(/^google\.visualization\.Query\.setResponse\(/, '')
                        .replace(/\);?\s*$/, '');
    return JSON.parse(jsonStr);
  }

  async function loadProductData() {
    setRateStatus('loading');
    try {
      if (GVIZ_PRODUCT) {
        const resp = await fetch(GVIZ_PRODUCT + '&nocache=' + Date.now(), {
          signal: AbortSignal.timeout(8000)
        });
        const text = await resp.text();
        const gviz = parseGvizResponse(text);
        productData = gvizRowsToObjects(gviz, 'product');
      } else {
        productData = FALLBACK_PRODUCTS;
      }
    } catch (e) {
      console.warn('Product fetch failed, using fallback:', e);
      productData = FALLBACK_PRODUCTS;
    }

    try {
      if (GVIZ_INVENTORY) {
        const resp = await fetch(GVIZ_INVENTORY + '&nocache=' + Date.now(), {
          signal: AbortSignal.timeout(8000)
        });
        const text = await resp.text();
        const gviz = parseGvizResponse(text);
        const rows = gvizRowsToObjects(gviz, 'inventory');
        inventoryData = {};
        rows.forEach(row => {
          if (row.model) inventoryData[String(row.model).trim().toUpperCase()] = row;
        });
        console.log('[TM] Inventory loaded from gviz:', Object.keys(inventoryData).length, 'items');
      } else {
        // Use fallback inventory data
        inventoryData = {};
        FALLBACK_INVENTORY.forEach(row => {
          if (row.model) inventoryData[String(row.model).trim().toUpperCase()] = row;
        });
      }
    } catch (e) {
      console.warn('Inventory fetch failed, using fallback:', e);
      // Fallback to embedded inventory data
      inventoryData = {};
      FALLBACK_INVENTORY.forEach(row => {
        if (row.model) inventoryData[String(row.model).trim().toUpperCase()] = row;
      });
      console.log('[TM] Inventory loaded from fallback:', Object.keys(inventoryData).length, 'items');
    }

    dataLoaded = true;
    setRateStatus('live');
    renderPopularTags();
  }

  function gvizRowsToObjects(gviz, type) {
    const cols = CONFIG.columns || {};
    const prodCols  = CONFIG.product_columns  || {};
    const invCols  = CONFIG.inventory_columns || {};
    const colMap = type === 'product' ? prodCols : invCols;

    const rows = (gviz.table && gviz.table.rows) ? gviz.table.rows : [];
    // Note: gviz API's table.rows does NOT include header rows (those are in table.cols),
    // so we do NOT skip the first row.

    let currentCategory = '';

    return rows.map(row => {
      const cells = row.c || [];
      const getValue = (idx) => {
        if (idx === undefined || idx === null || idx >= cells.length) return '';
        const cell = cells[idx];
        if (!cell) return '';
        return cell.v !== null && cell.v !== undefined ? String(cell.v) : '';
      };

      if (type === 'product') {
        const model = getValue(colMap.model).trim();
        const shortDesc = getValue(colMap.short_desc).trim();
        const msrp = getValue(colMap.msrp).trim();

        // Detect category rows: model has value, but short_desc and msrp are empty
        if (model && !shortDesc && !msrp) {
          currentCategory = model;
          return null;  // Skip category row
        }

        return {
          model:            model,
          short_desc:       shortDesc,
          msrp:             msrp,
          wholesale_plus5:  getValue(colMap.wholesale_plus5),
          wholesale:        getValue(colMap.wholesale),
          compatibility:    getValue(colMap.compatibility),
          dimensions_mm:    getValue(colMap.dimensions_mm),
          dimensions_inch:  getValue(colMap.dimensions_inch),
          weight_kg:        getValue(colMap.weight_kg),
          weight_lb:        getValue(colMap.weight_lb),
          qty_per_case:     getValue(colMap.qty_per_case),
          case_dimensions_mm: getValue(colMap.case_dimensions_mm),
          case_dimensions_inch: getValue(colMap.case_dimensions_inch),
          case_weight_kg:   getValue(colMap.case_weight_kg),
          case_weight_lb:   getValue(colMap.case_weight_lb),
          upc_sku:          getValue(colMap.upc_sku),
          image_link:       getValue(colMap.image_link),
          full_description: getValue(colMap.full_description),
          features:         getValue(colMap.features),
          package_content:  getValue(colMap.package_content),
          specifications:   getValue(colMap.specifications),
          materials_link:   getValue(colMap.materials_link),
          category:         currentCategory,
        };
      } else {
        return {
          model:          getValue(colMap.model),
          description:    getValue(colMap.description),
          stock_can_sale: getValue(colMap.stock_can_sale),
          stock_level:    getValue(colMap.stock_level),
        };
      }
    }).filter(row => row !== null && row.model && row.model.trim() !== '');
  }

  // ─── Sidebar Navigation ────────────────────────────────────────────────────
  window.openMenu = function () {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('overlay').classList.add('show');
  };

  window.closeMenu = function () {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('overlay').classList.remove('show');
  };

  window.navTo = function (page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.sb-item').forEach(i => i.classList.remove('active'));

    const pageEl = document.getElementById('page-' + page);
    if (pageEl) pageEl.classList.add('active');

    const sbItem = document.querySelector('.sb-item[data-page="' + page + '"]');
    if (sbItem) sbItem.classList.add('active');

    closeMenu();
  };

  // ─── Popular Tags ──────────────────────────────────────────────────────────
  function renderPopularTags() {
    const tagsEl = document.getElementById('tags');
    if (!tagsEl) return;
    tagsEl.innerHTML = POPULAR_MODELS.map(m => {
      const safe = escHtml(m);
      return '<span class="tag" onclick="document.getElementById(\'q\').value=\'' + safe + '\';doSearch()">' + safe + '</span>';
    }).join('');
  }

  // ─── Search ────────────────────────────────────────────────────────────────
  let lastQuery = '';

  // Build a word-boundary-aware regex from a search query.
  // e.g. "V-6" → /(?<![a-zA-Z0-9])v[\s\-_]*6(?![a-zA-Z0-9])/i
  //       → matches "V-6", "V 6" but NOT "CV6001"
  // e.g. "Hydro" → /(?<![a-zA-Z0-9])hydro/i  (loose mode, allows prefix match)
  //       → matches "Hydro-X", "hydroponic"
  function buildSearchRegex(query, strict) {
    const segments = query.match(/[a-zA-Z0-9]+/g);
    if (!segments || segments.length === 0) return null;
    const pattern = segments
      .map(seg => seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))  // escape regex chars
      .join('[\\s\\-_]*');  // allow optional separators between segments
    let fullPattern;
    if (strict) {
      // Strict: both word boundaries — match must be a standalone token
      // Used for model name matching to prevent "V-6" matching "CV6001"
      fullPattern = '(?<![a-zA-Z0-9])' + pattern + '(?![a-zA-Z0-9])';
    } else {
      // Loose: only left word boundary — allows prefix matches like 'Hydro' → 'hydroponic'
      fullPattern = '(?<![a-zA-Z0-9])' + pattern;
    }
    try {
      return new RegExp(fullPattern, 'i');
    } catch (e) {
      return null;
    }
  }

  // Test if a text field contains the query as a word-boundary-aware match.
  function fieldContainsQuery(text, regex) {
    if (!text || !regex) return false;
    return regex.test(text);
  }

  // Calculate relevance score for a product against a query.
  // Higher score = more relevant. 0 = no match (filtered out).
  function productRelevanceScore(p, q) {
    if (!p.model) return 0;
    const strictRegex = buildSearchRegex(q, true);
    const looseRegex  = buildSearchRegex(q, false);
    if (!strictRegex && !looseRegex) return 0;

    // Also build a normalized version for exact model comparison
    const qNorm = q.replace(/[-_\s]/g, '').toLowerCase();
    const modelNorm = (p.model || '').replace(/[-_\s]/g, '').toLowerCase();
    let score = 0;

    // 1) Model name match (highest priority, use strict boundary)
    if (modelNorm === qNorm) {
      score += 2000;  // exact model match
    } else if (modelNorm.startsWith(qNorm)) {
      score += 1000;  // model starts with query (e.g. "hydro" → "hydro-x pro")
    } else if (strictRegex && strictRegex.test(p.model)) {
      score += 500;   // model contains query (strict word boundary)
    }

    // 2) Short description match (high priority, use loose boundary)
    if (looseRegex && p.short_desc) {
      if (p.short_desc.toLowerCase().startsWith(q.toLowerCase())) {
        score += 300;  // short_desc starts with query — very relevant
      } else if (looseRegex.test(p.short_desc)) {
        score += 200;  // short_desc contains query
      }
    }

    // 3) Full description match (medium priority, use loose boundary)
    if (looseRegex && p.full_description && looseRegex.test(p.full_description)) {
      score += 50;
    }

    // 4) Other fields (low priority, use loose boundary)
    const lowFields = [p.features, p.specifications, p.compatibility, p.package_content];
    for (const field of lowFields) {
      if (looseRegex && field && looseRegex.test(field)) {
        score += 20;
        break;  // only count once even if multiple low-priority fields match
      }
    }

    return score;
  }

  window.doSearch = function () {
    const q = (document.getElementById('q').value || '').trim();
    lastQuery = q;
    if (!q) {
      document.getElementById('res').innerHTML = '';
      return;
    }
    if (!dataLoaded) return;

    // Score all products and keep those with score > 0
    const scored = productData
      .map(p => ({ product: p, score: productRelevanceScore(p, q) }))
      .filter(item => item.score > 0);

    // Sort by relevance score (descending), then by model name for tie-breaking
    scored.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (a.product.model || '').localeCompare(b.product.model || '');
    });

    const results = scored.map(item => item.product);
    renderResults(results);
  };

  function renderResults(results) {
    const area = document.getElementById('res');
    if (!area) return;

    if (!results || results.length === 0) {
      area.innerHTML = '<div class="noresult">' + t('no_results').replace('{q}', escHtml(lastQuery)) + '</div>';
      return;
    }

    // Group by category and insert category headers
    let html = '';
    let lastCategory = '__NONE__';

    results.forEach((p, i) => {
      const cat = p.category || '';
      if (cat !== lastCategory) {
        html += buildCategoryHeader(cat);
        lastCategory = cat;
      }
      html += buildProductCard(p, i);
    });

    area.innerHTML = html;
  }

  function buildCategoryHeader(category) {
    // First group (no category) gets "Controllers" label
    const label = category || t('cat_controllers');
    return `<div class="category-header"><span class="cat-icon">◆</span> ${escHtml(label)}</div>`;
  }

  function getStockInfo(model) {
    const key = (model || '').trim().toUpperCase();
    const inv = inventoryData[key];
    if (!inv) return { level: '', qty: '', badgeClass: 'unknown', badgeKey: 'unknown' };

    // stock_can_sale and stock_level are numeric values from the sheet
    const canSale = parseFloat(String(inv.stock_can_sale || '0').replace(/[^0-9.\-]/g, '')) || 0;
    const stockLevel = parseFloat(String(inv.stock_level || '0').replace(/[^0-9.\-]/g, '')) || 0;

    // Determine stock status based on can_sale quantity
    let badgeClass = 'in-stock';
    let badgeKey   = 'in_stock';
    if (canSale <= 0) {
      badgeClass = 'no-stock'; badgeKey = 'out_of_stock';
    } else if (canSale <= 5) {
      badgeClass = 'low-stock'; badgeKey = 'low_stock';
    }

    return { level: stockLevel, qty: canSale, badgeClass, badgeKey };
  }

  // Max characters for description before truncation
  const DESC_MAX_CHARS = 80;

  function buildProductCard(p, idx) {
    // Get translated product info if available
    // Rule: "冇就收埋，有就要顯示" — only override with non-empty translation, fallback to English
    let product = p;
    if (currentLang !== 'en' && p.model) {
      const model = p.model.trim();
      const langTranslations = PRODUCT_TRANSLATIONS[currentLang];
      if (langTranslations && langTranslations[model]) {
        const trans = langTranslations[model];
        product = Object.assign({}, p);
        // Only override if translation is non-empty; otherwise keep original English
        if (trans.short_desc && trans.short_desc.trim()) product.short_desc = trans.short_desc;
        if (trans.full_description && trans.full_description.trim()) product.full_description = trans.full_description;
        if (trans.features && trans.features.trim()) product.features = trans.features;
        if (trans.package_content && trans.package_content.trim()) product.package_content = trans.package_content;
        if (trans.specifications && trans.specifications.trim()) product.specifications = trans.specifications;
      }
    }
    
    const stock = getStockInfo(product.model);
    const stockBadge = stock.badgeKey && stock.badgeKey !== 'unknown'
      ? '<span class="oe-stock-badge ' + stock.badgeClass + '">' + t(stock.badgeKey) + (stock.qty ? ' (' + stock.qty + ')' : '') + '</span>'
      : '';

    const imgRow = product.image_link
      ? '<div class="irow"><div class="ilabel" data-i18n="col_image">' + t('col_image') + '</div><div class="ivalue"><a href="' + escHtml(product.image_link) + '" target="_blank" rel="noopener">' + t('view_image') + '</a></div></div>'
      : '';

    const matRow = product.materials_link
      ? '<div class="irow"><div class="ilabel" data-i18n="col_materials">' + t('col_materials') + '</div><div class="ivalue"><a href="' + escHtml(product.materials_link) + '" target="_blank" rel="noopener">' + t('view_materials') + '</a></div></div>'
      : '';

    const compatRow = product.compatibility
      ? '<div class="irow"><div class="ilabel" data-i18n="col_compatibility">' + t('col_compatibility') + '</div><div class="ivalue">' + escHtml(product.compatibility) + '</div></div>'
      : '';

    // Description for Product Information section (below image, with truncation)
    const fullDesc = product.full_description || product.short_desc || '';
    const needsTruncation = fullDesc.length > DESC_MAX_CHARS;
    const shortDesc = needsTruncation ? fullDesc.substring(0, DESC_MAX_CHARS) + '...' : fullDesc;

    // Title uses short description only (not full description)
    const titleDesc = product.short_desc || product.model;

    return `
<div class="card" id="card-${idx}">
  <div class="c-head">
    <div class="c-title-area">
      <h2 class="c-desc-title">${escHtml(titleDesc)}</h2>
      <div class="c-model-chip">${t('col_model')}: ${escHtml(p.model)}</div>
    </div>
    ${stockBadge}
  </div>
  <div class="c-body">
    <!-- Price Section (moved to top as this is the primary info users want) -->
    <table class="ptable">
      <thead>
        <tr>
          <th data-i18n="col_msrp">${t('col_msrp')}</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>${formatPrice(product.msrp)}</td>
        </tr>
      </tbody>
    </table>
    <div class="price-note">* ${t('prices_in')} ${CURRENCY_SYMBOL[currentCurrency] || currentCurrency}</div>

    <!-- Product Information Section -->
    <div class="product-info-section">
      <div class="pi-title">${t('product_information')}</div>
      <div class="pi-content" id="pi-content-${idx}">
        <div class="pi-short">${escHtml(shortDesc)}</div>
        ${needsTruncation ? '<div class="pi-full" style="display:none">' + escHtml(fullDesc) + '</div>' : ''}
      </div>
      ${needsTruncation ? '<button class="pi-toggle" onclick="toggleProductInfo(' + idx + ')" data-expanded="false">' + t('more') + '</button>' : ''}

      ${imgRow}
      ${matRow}
      ${compatRow}
    </div>

    <div class="stock">
      <div class="stock-title" data-i18n="col_stock">${t('col_stock')}</div>
      <div class="igrid">
        <div class="icard">
          <div class="l" data-i18n="col_stock_level">${t('col_stock_level')}</div>
          <div class="v">${stock.badgeKey !== 'unknown' ? t(stock.badgeKey) : '—'}</div>
        </div>
        <div class="icard">
          <div class="l" data-i18n="col_stock">${t('col_stock')}</div>
          <div class="v">${stock.qty || '—'}</div>
        </div>
      </div>
    </div>
  </div>
</div>`;
  }

  // ─── Description Toggle ────────────────────────────────────────────────────
  window.toggleProductInfo = function (idx) {
    const content = document.getElementById('pi-content-' + idx);
    const btn = content ? content.nextElementSibling : null;
    if (!content || !btn) return;

    const shortEl = content.querySelector('.pi-short');
    const fullEl = content.querySelector('.pi-full');
    const isExpanded = btn.getAttribute('data-expanded') === 'true';

    if (isExpanded) {
      shortEl.style.display = '';
      if (fullEl) fullEl.style.display = 'none';
      btn.textContent = t('more');
      btn.setAttribute('data-expanded', 'false');
    } else {
      shortEl.style.display = 'none';
      if (fullEl) fullEl.style.display = '';
      btn.textContent = t('less');
      btn.setAttribute('data-expanded', 'true');
    }
  };

  // ─── Order Estimation ──────────────────────────────────────────────────────
  window.addOEItem = function () {
    oeItems.push({ model: '', qty: 1 });
    rerenderOETable();
  };

  window.removeOEItem = function (idx) {
    oeItems.splice(idx, 1);
    rerenderOETable();
  };

  window.updateOEItem = function (idx, field, value) {
    if (!oeItems[idx]) return;
    oeItems[idx][field] = value;
    if (field === 'model') {
      // Find product info
      const found = productData.find(p => p.model.toUpperCase() === value.trim().toUpperCase());
      if (found) {
        oeItems[idx]._product = found;
      } else {
        delete oeItems[idx]._product;
      }
    }
    rerenderOETable();
  };

  window.recalcOE = function () {
    rerenderOESummary();
  };

  function getOEPriceType() {
    const checked = document.querySelector('input[name="priceType"]:checked');
    return checked ? checked.value : 'msrp';
  }

  function rerenderOETable() {
    const tbody = document.getElementById('oeItemsBody');
    const summary = document.getElementById('oeSummary');
    if (!tbody) return;

    if (oeItems.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="oe-dd-empty" data-i18n="oe_empty">' + t('oe_empty_msg') + '</td></tr>';
      summary.style.display = 'none';
      return;
    }

    const priceType = getOEPriceType();
    let totalItems = 0, totalQty = 0, subtotal = 0;

    tbody.innerHTML = oeItems.map((item, idx) => {
      const p = item._product;
      const priceField = priceType === 'msrp' ? 'msrp' : priceType === 'ws5' ? 'wholesale_plus5' : 'wholesale';
      const unitPrice = p ? parseFloat(String(p[priceField] || '0').replace(/[^0-9.]/g, '')) : 0;
      const qty = parseInt(item.qty) || 0;
      const lineTotal = unitPrice * qty;
      if (p) { totalItems++; totalQty += qty; subtotal += lineTotal; }

      const stock = p ? getStockInfo(p.model) : null;
      const stockBadge = stock
        ? '<span class="oe-stock-badge ' + stock.badgeClass + '">' + t(stock.badgeKey) + '</span>'
        : '';

      return `<tr>
        <td class="num-col">${idx + 1}</td>
        <td class="model-col">
          <div class="oe-search-wrap">
            <input type="text" class="oe-search-input" value="${escHtml(item.model)}"
                   placeholder="Model..." oninput="searchOEProduct(${idx}, this.value)"
                   onfocus="searchOEProduct(${idx}, this.value)">
            <div class="oe-dropdown" id="oedd-${idx}"></div>
          </div>
        </td>
        <td class="desc-col">${escHtml(p ? (p.full_description || p.short_desc || '') : '')}</td>
        <td class="qty-col"><input type="number" value="${qty}" min="0" onchange="updateOEItem(${idx},'qty',this.value)"></td>
        <td class="price-col">${p ? formatPrice(p[priceField]) : '—'}</td>
        <td class="total-col">${p ? formatPrice(lineTotal) : '—'}</td>
        <td class="action-col"><button class="oe-del-btn" onclick="removeOEItem(${idx})">✕</button></td>
      </tr>`;
    }).join('');

    // Update summary
    if (totalItems > 0) {
      summary.style.display = 'block';
      const vat = subtotal * 0.07;
      const shipping = parseFloat(document.getElementById('oeShipInput').value) || 0;
      const grandTotal = subtotal + vat + shipping;

      document.getElementById('oeSumItemsVal').textContent = totalItems;
      document.getElementById('oeSumQtyVal').textContent = totalQty;
      document.getElementById('oeSumSubtotalVal').textContent = formatPrice(subtotal);
      document.getElementById('oeSumVatVal').textContent = formatPrice(vat);
      document.getElementById('oeSumGrandVal').textContent = formatPrice(grandTotal);
    } else {
      summary.style.display = 'none';
    }
  }

  function rerenderOESummary() {
    rerenderOETable();
  }

  window.searchOEProduct = function (idx, val) {
    const dd = document.getElementById('oedd-' + idx);
    if (!dd) return;

    if (!val.trim()) { dd.classList.remove('show'); return; }

    const q = val.toLowerCase();
    const matches = productData
      .map(p => ({ product: p, score: productRelevanceScore(p, val) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score || (a.product.model || '').localeCompare(b.product.model || ''))
      .slice(0, 10)
      .map(item => item.product);

    if (matches.length === 0) {
      dd.innerHTML = '<div class="oe-dd-empty">No matches</div>';
    } else {
      dd.innerHTML = matches.map(p => {
        const priceType = getOEPriceType();
        const priceField = priceType === 'msrp' ? 'msrp' : priceType === 'ws5' ? 'wholesale_plus5' : 'wholesale';
        return `<div class="oe-dd-item" onclick="selectOEProduct(${idx},'${escHtml(p.model)}')">
          <div class="dd-model">${escHtml(p.model)}</div>
          <div class="dd-desc">${escHtml(p.short_desc || '')}</div>
          <div class="dd-price">${formatPrice(p[priceField])}</div>
        </div>`;
      }).join('');
    }
    dd.classList.add('show');
  };

  window.selectOEProduct = function (idx, model) {
    updateOEItem(idx, 'model', model);
    const dd = document.getElementById('oedd-' + idx);
    if (dd) dd.classList.remove('show');
  };

  // ─── Escape HTML ───────────────────────────────────────────────────────────
  function escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ─── Init ──────────────────────────────────────────────────────────────────
  function init() {
    applyLang(currentLang);

    // Language dropdown
    const langBtn = document.getElementById('langBtn');
    const langDD  = document.getElementById('langDD');
    if (langBtn) {
      langBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        langDD.classList.toggle('show');
      });
    }
    document.querySelectorAll('.lang-opt').forEach(opt => {
      opt.addEventListener('click', () => switchLang(opt.dataset.lang));
    });
    document.addEventListener('click', () => {
      if (langDD) langDD.classList.remove('show');
    });

    // Search
    const searchBtn = document.getElementById('searchBtn');
    const qInput    = document.getElementById('q');
    if (searchBtn) searchBtn.addEventListener('click', doSearch);
    if (qInput) {
      qInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') doSearch();
      });
    }

    // Price type change in OE
    document.querySelectorAll('input[name="priceType"]').forEach(radio => {
      radio.addEventListener('change', () => { if (oeItems.length > 0) rerenderOETable(); });
    });

    // Default page
    navTo('product-search');

    // Load data
    loadProductData();
    fetchExchangeRates();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
