/* ===== shell.js — TrolMaster Portal SHELL (shared across all pages) ===== */
(function () {
  'use strict';

  // ─── Config (injected by build_app.py) ─────────────────────────────────
  const CONFIG = window.__TM_CONFIG__ || {};
  const GVIZ_PRODUCT   = CONFIG.gviz_product   || '';
  const GVIZ_INVENTORY = CONFIG.gviz_inventory  || '';
  const FALLBACK_PRODUCTS = window.__TM_PRODUCTS__  || [];
  const FALLBACK_INVENTORY = window.__TM_INVENTORY__ || [];
  const POPULAR_MODELS = CONFIG.popular_models || [];
  const ER_API_URL = 'https://open.er-api.com/v6/latest/USD';
  const ER_CACHE_KEY = 'tm_exchange_rates';
  const ER_CACHE_TS  = 'tm_exchange_rates_ts';
  const ER_CACHE_HOURS = 24;

  // ─── Product Translations (injected by build_app.py) ─────────────────────
  const PRODUCT_TRANSLATIONS = window.__TM_PRODUCT_TRANSLATIONS__ || {};

  // ─── Shared State ────────────────────────────────────────────────────────
  let currentLang    = localStorage.getItem('tm_lang') || 'en';
  let currentCurrency = localStorage.getItem('tm_currency') || 'USD';
  let exchangeRates   = { USD: 1, HKD: 7.8, THB: 35.5 };
  let i18n           = {};
  let productData     = [];
  let inventoryData   = {};
  let dataLoaded     = false;

  // Map language → default currency
  const LANG_CURRENCY  = { en: 'USD', 'zh-Hant': 'HKD', th: 'THB' };
  const CURRENCY_SYMBOL = { USD: '$', HKD: 'HK$', THB: '฿' };

  // ─── i18n ─────────────────────────────────────────────────────────────────
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
    // Notify pages that language/currency changed
    notifyPageLangChange();
  }

  // ─── Currency ───────────────────────────────────────────────────────────
  function switchCurrency(currency) {
    currentCurrency = currency;
    localStorage.setItem('tm_currency', currency);
    // Notify pages that currency changed
    if (typeof window.onPageLangChange === 'function') window.onPageLangChange();
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
          return;
        }
      }
      const resp = await fetch(ER_API_URL, { signal: AbortSignal.timeout(5000) });
      const data = await resp.json();
      if (data && data.rates) {
        exchangeRates = { USD: 1, HKD: data.rates.HKD || 7.8, THB: data.rates.THB || 35.5 };
        localStorage.setItem(ER_CACHE_KEY, JSON.stringify(exchangeRates));
        localStorage.setItem(ER_CACHE_TS, Date.now().toString());
      }
    } catch (e) {
      // Use fallback rates
    }
  }

  // ─── Data Loading ────────────────────────────────────────────────────────
  function parseGvizResponse(text) {
    const jsonStr = text.replace(/^\/\*[\s\S]*?\*\/\s*/, '')
                         .replace(/^google\.visualization\.Query\.setResponse\(/, '')
                         .replace(/\);?\s*$/, '');
    return JSON.parse(jsonStr);
  }

  async function loadProductData() {
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
      console.warn('[Shell] Product fetch failed, using fallback:', e);
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
      } else {
        inventoryData = {};
        FALLBACK_INVENTORY.forEach(row => {
          if (row.model) inventoryData[String(row.model).trim().toUpperCase()] = row;
        });
      }
    } catch (e) {
      console.warn('[Shell] Inventory fetch failed, using fallback:', e);
      inventoryData = {};
      FALLBACK_INVENTORY.forEach(row => {
        if (row.model) inventoryData[String(row.model).trim().toUpperCase()] = row;
      });
    }

    dataLoaded = true;
    onDataReady();
  }

  /**
   * gvizRowsToObjects — shared between shell and pages.
   * Defined here so it's available globally.
   */
  function gvizRowsToObjects(gviz, type) {
    const prodCols = CONFIG.product_columns || {};
    const invCols  = CONFIG.inventory_columns || {};
    const colMap   = type === 'product' ? prodCols : invCols;

    const rows = (gviz.table && gviz.table.rows) ? gviz.table.rows : [];

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
        const model      = getValue(colMap.model).trim();
        const shortDesc  = getValue(colMap.short_desc).trim();
        const msrp       = getValue(colMap.msrp).trim();

        if (model && !shortDesc && !msrp) {
          currentCategory = model;
          return null;
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
          image_link:        getValue(colMap.image_link),
          full_description:  getValue(colMap.full_description),
          features:         getValue(colMap.features),
          package_content:   getValue(colMap.package_content),
          specifications:    getValue(colMap.specifications),
          materials_link:    getValue(colMap.materials_link),
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

  // ─── Sidebar Navigation ─────────────────────────────────────────────────
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

  // Pages register their onDataReady/onLangChange handlers here (supports multiple pages)
  let _pageDataReadyCallbacks = [];
  let _pageLangChangeCallbacks = [];
  window.registerPageDataReady = function (fn) { _pageDataReadyCallbacks.push(fn); };
  window.registerPageLangChange = function (fn) { _pageLangChangeCallbacks.push(fn); };

  function onDataReady() {
    // Legacy single-handler support
    if (typeof window.onPageDataReady === 'function') {
      window.onPageDataReady();
    }
    // Multi-page callback support
    _pageDataReadyCallbacks.forEach(fn => {
      try { fn(); } catch(e) { console.warn('[Shell] PageDataReady callback error:', e); }
    });
  }

  function notifyPageLangChange() {
    // Legacy single-handler support
    if (typeof window.onPageLangChange === 'function') {
      window.onPageLangChange();
    }
    // Multi-page callback support
    _pageLangChangeCallbacks.forEach(fn => {
      try { fn(); } catch(e) { console.warn('[Shell] PageLangChange callback error:', e); }
    });
  }

  // ─── Escape HTML ────────────────────────────────────────────────────────
  function escHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ─── Expose shared state & functions to window (for page modules) ───────
  // Use getters so pages always see the latest values
  Object.defineProperty(window, 'TM_CurrentLang',     { get: () => currentLang,     configurable: true });
  Object.defineProperty(window, 'TM_CurrentCurrency',  { get: () => currentCurrency, configurable: true });
  Object.defineProperty(window, 'TM_ProductData',      { get: () => productData,     configurable: true });
  Object.defineProperty(window, 'TM_InventoryData',    { get: () => inventoryData,   configurable: true });
  Object.defineProperty(window, 'TM_DataLoaded',       { get: () => dataLoaded,      configurable: true });
  Object.defineProperty(window, 'TM_PopularModels',    { get: () => POPULAR_MODELS,  configurable: true });
  Object.defineProperty(window, 'TM_ExchangeRates',    { get: () => exchangeRates,   configurable: true });

  window.t            = t;
  window.formatPrice  = formatPrice;
  window.escHtml      = escHtml;
  window.CURRENCY_SYMBOL = CURRENCY_SYMBOL;

  // ─── Sidebar dynamic generation ─────────────────────────────────────────
  function buildSidebar() {
    const sbNav = document.querySelector('.sb-nav');
    if (!sbNav || !CONFIG.pages) return;

    CONFIG.pages.forEach(p => {
      const btn = document.createElement('button');
      btn.className = 'sb-item' + (p.disabled ? ' disabled' : '');
      btn.setAttribute('data-page', p.id);
      btn.setAttribute('onclick', p.disabled ? '' : 'navTo(\'' + p.id + '\')');
      btn.innerHTML = '<span class="sb-icon">' + (p.icon || '📄') + '</span>'
                    + '<span data-i18n="' + (p.i18n_key || '') + '">' + (p.label || p.id) + '</span>'
                    + (p.disabled ? '<span class="coming-soon" data-i18n="coming_soon">Coming Soon</span>' : '');
      sbNav.appendChild(btn);
    });
  }

  // ─── Init ───────────────────────────────────────────────────────────────
  function initShell() {
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

    // Build sidebar from config
    buildSidebar();

    // Default page
    const defaultPage = (CONFIG.pages && CONFIG.pages.length > 0) ? CONFIG.pages[0].id : 'product-search';
    navTo(defaultPage);

    // Load data
    loadProductData();
    fetchExchangeRates();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initShell);
  } else {
    initShell();
  }

})();
