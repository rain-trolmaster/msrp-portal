/* ===== product-search/page.js — Product Search Page ===== */
(function () {
  'use strict';

  // ─── State ────────────────────────────────────────────────
  var lastQuery = '';

  // ─── Search ───────────────────────────────────────────────
  function buildSearchRegex(query, strict) {
    var segments = query.match(/[a-zA-Z0-9]+/g);
    if (!segments || segments.length === 0) return null;
    var pattern = segments
      .map(function(seg) { return seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); })
      .join('[\\s\\-_]*');
    var fullPattern;
    if (strict) {
      fullPattern = '(?<![a-zA-Z0-9])' + pattern + '(?![a-zA-Z0-9])';
    } else {
      fullPattern = '(?<![a-zA-Z0-9])' + pattern;
    }
    try {
      return new RegExp(fullPattern, 'i');
    } catch (e) {
      return null;
    }
  }

  function productRelevanceScore(p, q) {
    if (!p.model) return 0;
    var strictRegex = buildSearchRegex(q, true);
    var looseRegex  = buildSearchRegex(q, false);
    if (!strictRegex && !looseRegex) return 0;

    var qNorm = q.replace(/[-_\s]/g, '').toLowerCase();
    var modelNorm = (p.model || '').replace(/[-_\s]/g, '').toLowerCase();
    var score = 0;

    if (modelNorm === qNorm) {
      score += 2000;
    } else if (modelNorm.startsWith(qNorm)) {
      score += 1000;
    } else if (strictRegex && strictRegex.test(p.model)) {
      score += 500;
    }

    if (looseRegex && p.short_desc) {
      if (p.short_desc.toLowerCase().startsWith(q.toLowerCase())) {
        score += 300;
      } else if (looseRegex.test(p.short_desc)) {
        score += 200;
      }
    }

    if (looseRegex && p.full_description && looseRegex.test(p.full_description)) {
      score += 50;
    }

    var lowFields = [p.features, p.specifications, p.compatibility, p.package_content];
    for (var i = 0; i < lowFields.length; i++) {
      var field = lowFields[i];
      if (looseRegex && field && looseRegex.test(field)) {
        score += 20;
        break;
      }
    }

    return score;
  }

  window.doSearch = function () {
    var q = (document.getElementById('q').value || '').trim();
    lastQuery = q;
    if (!q) {
      document.getElementById('res').innerHTML = '';
      return;
    }
    if (!window.TM_DataLoaded) return;

    var scored = window.TM_ProductData
      .map(function(p) { return { product: p, score: productRelevanceScore(p, q) }; })
      .filter(function(item) { return item.score > 0; });

    scored.sort(function(a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return (a.product.model || '').localeCompare(b.product.model || '');
    });

    var results = scored.map(function(item) { return item.product; });
    renderResults(results);
  };

  function renderPopularTags() {
    var tagsEl = document.getElementById('tags');
    if (!tagsEl) return;
    var models = window.TM_PopularModels || [];
    tagsEl.innerHTML = models.map(function(m) {
      var safe = window.escHtml(m);
      return '<span class="tag" onclick="document.getElementById(\'q\').value=\'' + safe + '\';doSearch()">' + safe + '</span>';
    }).join('');
  }

  function renderResults(results) {
    var area = document.getElementById('res');
    if (!area) return;

    if (!results || results.length === 0) {
      area.innerHTML = '<div class="no-result">' + t('no_results').replace('{q}', escHtml(lastQuery)) + '</div>';
      return;
    }

    var html = '';
    var lastCategory = '__NONE__';

    results.forEach(function(p, idx) {
      var cat = p.category || '';
      if (cat !== lastCategory) {
        html += buildCategoryHeader(cat);
        lastCategory = cat;
      }
      html += buildProductCard(p, idx);
    });

    area.innerHTML = html;
  }

  function buildCategoryHeader(category) {
    var label = category || t('cat_controllers');
    return '<div class="category-header"><span class="cat-icon">◆</span> ' + escHtml(label) + '</div>';
  }

  // ─── Stock Info ─────────────────────────────────────────
  function getStockInfo(model) {
    var key = (model || '').trim().toUpperCase();
    var inv = window.TM_InventoryData ? window.TM_InventoryData[key] : null;
    if (!inv) return { level: '', qty: '', badgeClass: 'unknown', badgeKey: 'unknown' };

    var canSale     = parseFloat(String(inv.stock_can_sale || '0').replace(/[^0-9.\-]/g, '')) || 0;
    var stockLevel = parseFloat(String(inv.stock_level    || '0').replace(/[^0-9.\-]/g, '')) || 0;

    var badgeClass = 'in-stock';
    var badgeKey   = 'in_stock';
    if (canSale <= 0) {
      badgeClass = 'no-stock'; badgeKey = 'out_of_stock';
    } else if (canSale <= 5) {
      badgeClass = 'low-stock'; badgeKey = 'low_stock';
    }

    return { level: stockLevel, qty: canSale, badgeClass: badgeClass, badgeKey: badgeKey };
  }

  // ─── Product Card ───────────────────────────────────────
  var DESC_MAX_CHARS = 80;

  function buildProductCard(p, idx) {
    var product = p;
    if (window.TM_CurrentLang && window.TM_CurrentLang !== 'en' && p.model) {
      var model = p.model.trim();
      var langTranslations = (window.__TM_PRODUCT_TRANSLATIONS__ || {})[window.TM_CurrentLang];
      if (langTranslations && langTranslations[model]) {
        var trans = langTranslations[model];
        product = Object.assign({}, p);
        if (trans.short_desc       && trans.short_desc.trim())       product.short_desc       = trans.short_desc;
        if (trans.full_description  && trans.full_description.trim())  product.full_description  = trans.full_description;
        if (trans.features         && trans.features.trim())         product.features         = trans.features;
        if (trans.package_content  && trans.package_content.trim())  product.package_content  = trans.package_content;
        if (trans.specifications   && trans.specifications.trim())   product.specifications   = trans.specifications;
      }
    }

    var stock     = getStockInfo(product.model);
    var stockBadge = (stock.badgeKey && stock.badgeKey !== 'unknown')
      ? '<span class="oe-stock-badge ' + stock.badgeClass + '">' + t(stock.badgeKey) + (stock.qty ? ' (' + stock.qty + ')' : '') + '</span>'
      : '';

    var imgRow = product.image_link
      ? '<div class="irow"><div class="ilabel" data-i18n="col_image">' + t('col_image') + '</div><div class="ivalue"><a href="' + escHtml(product.image_link) + '" target="_blank" rel="noopener">' + t('view_image') + '</a></div></div>'
      : '';

    var matRow = product.materials_link
      ? '<div class="irow"><div class="ilabel" data-i18n="col_materials">' + t('col_materials') + '</div><div class="ivalue"><a href="' + escHtml(product.materials_link) + '" target="_blank" rel="noopener">' + t('view_materials') + '</a></div></div>'
      : '';

    var compatRow = product.compatibility
      ? '<div class="irow"><div class="ilabel" data-i18n="col_compatibility">' + t('col_compatibility') + '</div><div class="ivalue">' + escHtml(product.compatibility) + '</div></div>'
      : '';

    var fullDesc    = product.full_description || product.short_desc || '';
    var needsTruncation = fullDesc.length > DESC_MAX_CHARS;
    var shortDesc   = needsTruncation ? fullDesc.substring(0, DESC_MAX_CHARS) + '...' : fullDesc;
    var titleDesc   = product.short_desc || product.model;

    return '<div class="card" id="card-' + idx + '">' +
      '<div class="c-head">' +
        '<div class="c-title-area">' +
          '<h2 class="c-desc-title">' + escHtml(titleDesc) + '</h2>' +
          '<div class="c-model-chip">' + t('col_model') + ': ' + escHtml(p.model) + '</div>' +
        '</div>' +
        stockBadge +
      '</div>' +
      '<div class="c-body">' +
        '<!-- Price Section -->' +
        '<table class="ptable">' +
          '<thead><tr>' +
            '<th data-i18n="col_msrp">' + t('col_msrp') + '</th>' +
          '</tr></thead>' +
          '<tbody><tr>' +
            '<td>' + formatPrice(product.msrp) + '</td>' +
          '</tr></tbody>' +
        '</table>' +
        '<div class="price-note">* ' + t('prices_in') + ' ' + (window.CURRENCY_SYMBOL ? (window.CURRENCY_SYMBOL[window.TM_CurrentCurrency] || window.TM_CurrentCurrency) : window.TM_CurrentCurrency) + '</div>' +

        '<!-- Product Information Section -->' +
        '<div class="product-info-section">' +
          '<div class="pi-title">' + t('product_information') + '</div>' +
          '<div class="pi-content" id="pi-content-' + idx + '">' +
            '<div class="pi-short">' + escHtml(shortDesc) + '</div>' +
            (needsTruncation ? '<div class="pi-full" style="display:none">' + escHtml(fullDesc) + '</div>' : '') +
          '</div>' +
          (needsTruncation ? '<button class="pi-toggle" onclick="toggleProductInfo(' + idx + ')" data-expanded="false">' + t('more') + '</button>' : '') +
          imgRow +
          matRow +
          compatRow +
        '</div>' +

        '<div class="stock">' +
          '<div class="stock-title" data-i18n="col_stock">' + t('col_stock') + '</div>' +
          '<div class="igrid">' +
            '<div class="icard">' +
              '<div class="l" data-i18n="col_stock_level">' + t('col_stock_level') + '</div>' +
              '<div class="v">' + (stock.badgeKey !== 'unknown' ? t(stock.badgeKey) : '—') + '</div>' +
            '</div>' +
            '<div class="icard">' +
              '<div class="l" data-i18n="col_stock">' + t('col_stock') + '</div>' +
              '<div class="v">' + (stock.qty || '—') + '</div>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';
  }

  // ─── Description Toggle ──────────────────────────────────
  window.toggleProductInfo = function (idx) {
    var content = document.getElementById('pi-content-' + idx);
    var btn = content ? content.nextElementSibling : null;
    if (!content || !btn) return;

    var shortEl = content.querySelector('.pi-short');
    var fullEl  = content.querySelector('.pi-full');
    var isExpanded = btn.getAttribute('data-expanded') === 'true';

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

  // ─── Helpers (from shell.js via window) ─────────────────
  var formatPrice  = window.formatPrice  || function () { return '—'; };
  var t            = window.t            || function (k) { return k; };
  var escHtml      = window.escHtml      || function (s) { return s || ''; };

  // ─── Page Init ─────────────────────────────────────────
  function initProductSearchPage() {
    var searchBtn = document.getElementById('searchBtn');
    var qInput    = document.getElementById('q');
    if (searchBtn) searchBtn.addEventListener('click', window.doSearch);
    if (qInput) {
      qInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') window.doSearch();
      });
    }
    renderPopularTags();
  }

  // ─── Data Ready Hook ──────────────────────────────────
  window.registerPageDataReady(function () {
    renderPopularTags();
    initProductSearchPage();
  });

  // ─── Lang Change Hook ─────────────────────────────────
  window.registerPageLangChange(function () {
    // Re-render search results if data loaded and there's a query
    if (window.TM_DataLoaded && lastQuery) {
      window.doSearch();
    }
  });

})();
