#!/usr/bin/env python3
import csv, json, base64, os

PRODUCT_CSV = '/Users/Rain.C/WorkBuddy/Claw/20260502150439/master-webkit.csv'
INVENTORY_CSV = '/Users/Rain.C/WorkBuddy/Claw/20260502150439/inventory2.csv'
LOGO_PATH = '/Users/Rain.C/Desktop/Primary TM logo - Vertical.png'
OUTPUT_HTML = '/Users/Rain.C/WorkBuddy/Claw/trolmaster-app.html'

INVENTORY_SHEET_ID = '1GVRc_dSaDGesEdh_7pnU4bzhm5lyBLvm-XCC4gQWr8w'
INVENTORY_GID = '817864539'

# Logo
logo_data_uri = ''
if os.path.exists(LOGO_PATH):
    with open(LOGO_PATH, 'rb') as f:
        logo_b64 = base64.b64encode(f.read()).decode('utf-8')
        logo_data_uri = 'data:image/png;base64,' + logo_b64
    print('Logo loaded: {} chars'.format(len(logo_b64)))
else:
    print('WARNING: Logo not found')

# Products
products = []
with open(PRODUCT_CSV, 'r', encoding='utf-8-sig') as f:
    reader = csv.reader(f)
    headers = None
    for row in reader:
        if len(row) > 1 and 'Short Description' in row[1]:
            headers = [h.strip() for h in row]
            break

    skip = {
        'Main Controller', 'Device Station', 'Sensor', 'Station', 'LED', 'Accessory',
        'Cable', 'Controller', 'Monitor', 'Power', 'Adapter', 'Module', 'Fan', 'Light',
        'Probe', 'Detector', 'Alarm', 'Button', 'Box', 'Plate', 'Compound', 'Water',
        'Climate', 'Curtain', 'Shade', 'Hose', 'Pipe', 'Pump', 'Valve', 'Relay',
        'Timer', 'Display', 'Antenna', 'Battery', 'Extender', 'Splitter', 'Coupler',
        'Daisy', 'Chain', 'Analog', 'Digital', 'Switch', 'Outlet', 'Plug', 'Socket',
        'Mount', 'Bracket', 'Filter', 'Regulator', 'Generator', 'Dehumidifier',
        'Humidifier', 'Air', 'Exhaust', 'Intake', 'Circulation', 'Oscillating',
        'Mixed', 'Flow', 'Signal', 'Repeater', 'Receiver', 'Transmitter',
        'WiFi', 'Ethernet', 'USB', 'RJ12', 'M12', 'M8',
        'Tent', 'Greenhouse', 'Hydro', 'Aqua',
        'Tent-X', 'Carbon-X', 'Smoke', 'Temp', 'Humid', 'CO2', 'EC', 'pH', 'Moisture',
        'Pressure', 'Wind', 'Rain', 'Solar', 'Camera', 'Speaker', 'Microphone',
        'ThinkGrow LED', 'Hydro-X', 'Aqua-X', 'Carbon-X', 'ThinkGrow',
        'Model', 'Series', 'Version', 'Edition',
        'Kit', 'Set', 'Bundle', 'Pack', 'Case', 'Carton', 'Pallet', 'Container',
        'Expander', 'Repeater',
    }

    dim_key = wt_key = compat_key = None
    for h in headers:
        if 'Dimension' in h and '(L*W*H)' in h and '/inch' not in h:
            dim_key = h
        elif 'G.W.' in h and 'kgs' in h and 'Pound' not in h:
            wt_key = h
        elif 'Compat' in h:
            compat_key = h

    for row in reader:
        if not row or not row[0].strip():
            continue
        model = row[0].strip()
        if model in skip or model.startswith('$'):
            continue
        if not row[1].strip():
            continue
        p = {
            'model': model,
            'desc': row[1].strip() if len(row) > 1 else '',
            'msrp': row[2].strip() if len(row) > 2 else '',
            'ws5': row[3].strip() if len(row) > 3 else '',
            'ws': row[4].strip() if len(row) > 4 else '',
            'compat': '', 'dim': '', 'weight': ''
        }
        for i, h in enumerate(headers):
            if i < len(row):
                v = row[i].strip()
            else:
                v = ''
            if h == compat_key:
                p['compat'] = v
            elif h == dim_key:
                p['dim'] = v
            elif h == wt_key:
                p['weight'] = v
        products.append(p)

print('Products: {}'.format(len(products)))

# Inventory fallback
inventory_fallback = {}
with open(INVENTORY_CSV, 'r', encoding='utf-8-sig') as f:
    reader = csv.reader(f)
    inv_headers = None
    for row in reader:
        if row and row[0].strip() == 'Model No.':
            inv_headers = [h.strip() for h in row]
            break
    if inv_headers:
        for row in reader:
            if not row or not row[0].strip():
                continue
            m = row[0].strip()
            rec = {}
            for i, h in enumerate(inv_headers):
                rec[h] = row[i].strip() if i < len(row) else ''
            inventory_fallback[m.upper()] = {
                'canSale': rec.get('Stock Can Sale', ''),
                'stockLevel': rec.get('Stock Level ', rec.get('Stock Level', ''))
            }

print('Inventory fallback: {} records'.format(len(inventory_fallback)))

product_js = json.dumps(products, ensure_ascii=False, indent=2)
inventory_fallback_js = json.dumps(inventory_fallback, ensure_ascii=False, indent=2)

# Read HTML template from separate file
html = '''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>TrolMaster Product Search</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,"Microsoft JhengHei","Noto Sans TC","Noto Sans Thai",sans-serif;background:#f5f5f5;color:#1a1a2e;min-height:100vh}
.header{background:#ffffff;border-bottom:1px solid #e2e8f0;padding:12px 20px;position:sticky;top:0;z-index:50}
.h-inner{max-width:900px;margin:0 auto;display:flex;align-items:center;justify-content:space-between}
.h-left{display:flex;align-items:center;gap:12px}
.menu-btn{background:none;border:none;color:#1a1a2e;font-size:20px;cursor:pointer;padding:4px 8px}
.logo-img{height:36px;width:auto;object-fit:contain}
.h-text h1{font-size:16px;font-weight:700;color:#1a1a2e;letter-spacing:.3px}
.h-text p{font-size:11px;color:#718096;margin-top:1px}
.lang-switcher{position:relative}
.lang-btn{background:#f7fafc;border:1px solid #e2e8f0;padding:6px 14px;border-radius:8px;font-size:12px;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:5px;color:#1a1a2e}
.lang-dd{display:none;position:absolute;top:calc(100% + 4px);right:0;background:#ffffff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;z-index:100;min-width:120px;box-shadow:0 4px 12px rgba(0,0,0,0.1)}
.lang-dd.show{display:block}
.lang-opt{padding:10px 16px;font-size:13px;color:#2d3748;cursor:pointer}
.lang-opt:hover{background:#f7fafc}
.lang-opt.active{background:#edf2f7;font-weight:600;color:#1a1a2e}
.hero{max-width:900px;margin:30px auto 0;padding:0 20px}
.hero-title{font-size:20px;font-weight:700;color:#0d1b3e;margin-bottom:4px}
.hero-sub{font-size:13px;color:#718096;margin-bottom:20px}
.s-wrap{display:flex;background:#fff;border:2px solid #e2e8f0;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.06)}
.s-wrap input{flex:1;padding:14px 18px;border:none;font-size:15px;outline:none;font-family:inherit;color:#1a1a2e}
.s-wrap input::placeholder{color:#a0aec0;font-size:14px}
.s-wrap button{padding:14px 30px;background:#0d1b3e;color:#fff;border:none;font-size:15px;font-weight:600;cursor:pointer;font-family:inherit;white-space:nowrap}
.s-wrap button:hover{background:#1a2b5e}
.tags{margin-top:14px;display:flex;flex-wrap:wrap;gap:8px}
.tag{padding:4px 12px;background:#fff;border:1px solid #e2e8f0;border-radius:16px;font-size:12px;cursor:pointer;color:#4a5568;font-family:inherit;transition:all .2s}
.tag:hover{background:#0d1b3e;color:#fff;border-color:#0d1b3e}
.res{max-width:900px;margin:24px auto;padding:0 20px 40px}
.card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.04);margin-bottom:12px}
.c-head{background:#0d1b3e;color:#fff;padding:14px 18px}
.c-head h2{font-size:15px;font-weight:600}
.c-badge{display:inline-block;background:rgba(255,255,255,0.15);color:#fff;padding:2px 8px;border-radius:6px;font-size:11px;margin-top:4px}
.c-body{padding:16px 18px}
.irow{display:flex;padding:8px 0;border-bottom:1px solid #f0f4f8;gap:10px}
.irow:last-child{border-bottom:none}
.ilabel{width:100px;flex-shrink:0;font-weight:600;color:#718096;font-size:12px}
.ivalue{font-size:13px;color:#2d3748}
.ptable{width:100%;border-collapse:collapse;margin:10px 0;border:1px solid #edf2f7;border-radius:8px;overflow:hidden}
.ptable th{background:#f7fafc;padding:8px 12px;text-align:left;font-size:11px;color:#718096;font-weight:600;border-bottom:1px solid #e2e8f0}
.ptable td{padding:8px 12px;font-size:13px;color:#2d3748;border-bottom:1px solid #f7fafc}
.ptable tr:last-child td{border-bottom:none}
.ptable td:last-child{text-align:right;font-weight:600;color:#0d1b3e}
.price-note{font-size:11px;color:#a0aec0;margin-top:4px}
.stock{margin-top:12px;padding:12px;background:#f7fafc;border:1px solid #edf2f7;border-radius:10px}
.stock-title{font-weight:600;color:#0d1b3e;margin-bottom:8px;font-size:13px}
.igrid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.icard{background:#fff;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px}
.icard .l{font-size:10px;color:#a0aec0;text-transform:uppercase;letter-spacing:.3px;margin-bottom:3px;font-weight:600}
.icard .v{font-size:20px;font-weight:700;color:#0d1b3e}
.stock-msg{margin-top:8px;font-size:12px;font-weight:600;text-align:center}
.noresult{text-align:center;padding:40px 20px;color:#a0aec0;font-size:14px}
.footer{text-align:center;padding:24px 20px;color:#a0aec0;font-size:11px;border-top:1px solid #e2e8f0;margin-top:16px}
.stock-status{font-size:11px;padding:3px 10px;border-radius:16px;display:inline-flex;align-items:center;gap:4px}
.stock-status.ok{color:#276749;background:#f0fff4}
.stock-status.err{color:#c53030;background:#fff5f5}
.stock-status.loading{color:#a0aec0;background:#f7fafc}
.stock-status.fallback{color:#c05621;background:#fffaf0}
.overlay{display:none;position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.4);z-index:90;opacity:0;transition:opacity .3s}
.overlay.show{display:block;opacity:1}
.sidebar{position:fixed;top:0;left:-280px;width:280px;height:100%;background:#0d1b3e;z-index:100;transition:left .3s ease;overflow-y:auto;box-shadow:2px 0 12px rgba(0,0,0,0.3)}
.sidebar.open{left:0}
.sb-header{padding:20px;border-bottom:1px solid rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:space-between}
.sb-header h2{color:#fff;font-size:15px;font-weight:600}
.sb-close{background:none;border:none;color:#a0aec0;font-size:24px;cursor:pointer;padding:0 4px;line-height:1}
.sb-close:hover{color:#fff}
.sb-nav{padding:8px 0}
.sb-item{display:flex;align-items:center;gap:12px;padding:12px 20px;color:#e2e8f0;font-size:14px;cursor:pointer;transition:background .2s;border:none;background:none;width:100%;text-align:left;font-family:inherit}
.sb-item:hover{background:rgba(255,255,255,0.08)}
.sb-item.active{background:rgba(255,255,255,0.12);color:#fff;font-weight:600;border-left:3px solid #e53e3e}
.sb-item .sb-icon{font-size:18px;width:24px;text-align:center;flex-shrink:0}
.sb-item.disabled{opacity:0.4;cursor:not-allowed;pointer-events:none}
.sb-item .coming-soon{font-size:10px;color:#a0aec0;margin-left:auto;background:rgba(255,255,255,0.1);padding:1px 6px;border-radius:4px;font-weight:400}
.sb-divider{height:1px;background:rgba(255,255,255,0.08);margin:4px 0}
.sb-footer{padding:16px 20px;border-top:1px solid rgba(255,255,255,0.08);margin-top:auto}
.sb-footer p{color:#718096;font-size:11px;line-height:1.5}
/* Page visibility */
.page{display:none}
.page.active{display:block}
/* Order Estimation styles */
.oe-wrap{max-width:960px;margin:24px auto;padding:0 20px 60px}
.oe-title{font-size:20px;font-weight:700;color:#0d1b3e;margin-bottom:4px}
.oe-sub{font-size:13px;color:#718096;margin-bottom:20px}
.oe-card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.04);margin-bottom:16px}
.oe-card-head{background:#0d1b3e;color:#fff;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px}
.oe-card-head h3{font-size:15px;font-weight:600}
.oe-price-type{display:flex;gap:6px}
.oe-price-type label{display:flex;align-items:center;gap:4px;font-size:12px;color:rgba(255,255,255,0.8);cursor:pointer;padding:4px 10px;border-radius:6px;border:1px solid rgba(255,255,255,0.2);transition:all .2s}
.oe-price-type label:hover{background:rgba(255,255,255,0.1)}
.oe-price-type input{accent-color:#e53e3e}
.oe-price-type input:checked+span{color:#fff;font-weight:600}
.oe-add-row{background:#f7fafc;border:none;border-top:1px solid #e2e8f0;width:100%;padding:12px 18px;font-size:13px;color:#0d1b3e;font-weight:600;cursor:pointer;display:flex;align-items:center;gap:6px;font-family:inherit;transition:background .2s}
.oe-add-row:hover{background:#edf2f7}
.oe-table-wrap{overflow-x:auto}
.oe-table{width:100%;border-collapse:collapse;min-width:600px}
.oe-table th{background:#f7fafc;padding:10px 12px;text-align:left;font-size:11px;color:#718096;font-weight:600;border-bottom:2px solid #e2e8f0;white-space:nowrap}
.oe-table td{padding:8px 10px;font-size:13px;color:#2d3748;border-bottom:1px solid #f0f4f8;vertical-align:middle}
.oe-table tr:hover{background:#fafbfc}
.oe-table .num-col{width:30px;text-align:center;color:#718096;font-size:11px}
.oe-table .model-col{width:140px}
.oe-table .desc-col{min-width:160px;color:#4a5568;font-size:12px}
.oe-table .qty-col{width:70px}
.oe-table .price-col{width:100px;text-align:right;font-weight:600;color:#0d1b3e}
.oe-table .total-col{width:110px;text-align:right;font-weight:700;color:#0d1b3e}
.oe-table .action-col{width:36px;text-align:center}
.oe-table input[type="number"]{width:100%;padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;font-size:13px;font-family:inherit;text-align:right;outline:none;transition:border-color .2s}
.oe-table input[type="number"]:focus{border-color:#0d1b3e}
.oe-table input[type="text"]{width:100%;padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;font-size:13px;font-family:inherit;outline:none;transition:border-color .2s}
.oe-table input[type="text"]:focus{border-color:#0d1b3e}
.oe-del-btn{background:none;border:none;color:#e53e3e;font-size:16px;cursor:pointer;padding:4px;border-radius:4px;opacity:0.5;transition:opacity .2s}
.oe-del-btn:hover{opacity:1;background:#fff5f5}
/* Product search dropdown */
.oe-search-wrap{position:relative}
.oe-search-input{width:100%;padding:6px 8px;border:1px solid #e2e8f0;border-radius:6px;font-size:13px;font-family:inherit;outline:none}
.oe-search-input:focus{border-color:#0d1b3e}
.oe-dropdown{position:absolute;top:100%;left:0;right:0;background:#fff;border:1px solid #e2e8f0;border-radius:8px;box-shadow:0 8px 24px rgba(0,0,0,0.12);max-height:240px;overflow-y:auto;z-index:200;display:none}
.oe-dropdown.show{display:block}
.oe-dd-item{padding:8px 12px;cursor:pointer;font-size:13px;border-bottom:1px solid #f7fafc;transition:background .15s}
.oe-dd-item:last-child{border-bottom:none}
.oe-dd-item:hover{background:#f0f4f8}
.oe-dd-item .dd-model{font-weight:600;color:#0d1b3e}
.oe-dd-item .dd-desc{font-size:11px;color:#718096;margin-top:1px}
.oe-dd-item .dd-price{font-size:11px;color:#4a5568;margin-top:1px}
.oe-dd-empty{padding:16px;text-align:center;color:#a0aec0;font-size:12px}
/* Stock indicator in OE */
.oe-stock-badge{font-size:10px;padding:2px 6px;border-radius:10px;font-weight:600}
.oe-stock-badge.in-stock{color:#276749;background:#f0fff4}
.oe-stock-badge.low-stock{color:#c05621;background:#fffaf0}
.oe-stock-badge.no-stock{color:#c53030;background:#fff5f5}
.oe-stock-badge.unknown{color:#a0aec0;background:#f7fafc}
/* Summary */
.oe-summary{background:#fff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.04)}
.oe-summary-head{background:#0d1b3e;color:#fff;padding:14px 18px}
.oe-summary-head h3{font-size:15px;font-weight:600}
.oe-summary-body{padding:16px 18px}
.oe-summary-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.oe-sum-item{background:#f7fafc;border:1px solid #edf2f7;border-radius:8px;padding:12px 16px}
.oe-sum-item .sum-label{font-size:11px;color:#718096;font-weight:600;text-transform:uppercase;letter-spacing:.3px;margin-bottom:4px}
.oe-sum-item .sum-value{font-size:20px;font-weight:700;color:#0d1b3e}
.oe-sum-item.sum-total{grid-column:1/-1;background:#0d1b3e;border-color:#0d1b3e}
.oe-sum-item.sum-total .sum-label{color:rgba(255,255,255,0.7)}
.oe-sum-item.sum-total .sum-value{color:#fff;font-size:24px}
.oe-sum-item.sum-ship .sum-value{font-size:16px}
.oe-empty{text-align:center;padding:60px 20px;color:#a0aec0}
.oe-empty .empty-icon{font-size:48px;margin-bottom:12px}
.oe-empty p{font-size:14px}
@media(max-width:600px){
  .logo-img{height:30px}
  .h-text h1{font-size:14px}
  .hero{margin-top:20px}
  .hero-title{font-size:18px}
  .s-wrap{flex-direction:column}
  .s-wrap button{border-radius:0}
  .irow{flex-direction:column;gap:2px}
  .ilabel{width:100%}
  .oe-summary-grid{grid-template-columns:1fr}
  .oe-card-head{flex-direction:column;align-items:flex-start}
}
</style>
</head>
<body>
<div class="overlay" id="overlay" onclick="closeMenu()"></div>
<div class="sidebar" id="sidebar">
  <div class="sb-header">
    <h2 id="sbTitle">TM Testing Tools</h2>
    <button class="sb-close" onclick="closeMenu()">&times;</button>
  </div>
  <div class="sb-nav">
    <button class="sb-item active" data-page="product-search" onclick="navTo('product-search')">
      <span class="sb-icon">&#128269;</span>
      <span id="sbItem1">Product Price and Stock</span>
    </button>
    <button class="sb-item disabled" data-page="tech-sheet">
      <span class="sb-icon">&#128196;</span>
      <span id="sbItem2">Tech sheet download</span>
      <span class="coming-soon" id="sbCs2">Coming Soon</span>
    </button>
    <button class="sb-item disabled" data-page="model-one">
      <span class="sb-icon">&#128290;</span>
      <span id="sbItem3">Model-One Calculator</span>
      <span class="coming-soon" id="sbCs3">Coming Soon</span>
    </button>
    <button class="sb-item" data-page="order-est" onclick="navTo('order-est')">
      <span class="sb-icon">&#128178;</span>
      <span id="sbItem4">Order Estimation</span>
    </button>
  </div>
  <div class="sb-footer">
    <p>&copy; 2026 Green Environmental Control</p>
    <p>TrolMaster Authorized Distributor</p>
  </div>
</div>

<!-- Page: Product Search -->
<div class="page active" id="page-product-search">
  <div class="hero">
    <div class="hero-title" id="heroTitle">TrolMaster Product Search</div>
    <div class="hero-sub" id="heroSub">Enter model number for pricing and stock</div>
    <div class="s-wrap">
      <input type="text" id="q" placeholder="Enter product model, e.g.: WCS-9, NFS-2, ECW-1" autocomplete="off">
      <button id="searchBtn">Search</button>
    </div>
    <div class="tags" id="tags"></div>
  </div>
  <div class="res" id="res"></div>
</div>

<!-- Page: Order Estimation -->
<div class="page" id="page-order-est">
  <div class="oe-wrap">
    <div class="oe-title" id="oeTitle">Order Estimation</div>
    <div class="oe-sub" id="oeSub">Add products and quantities to calculate your order total</div>

    <div class="oe-card" id="oeItemsCard">
      <div class="oe-card-head">
        <h3 id="oeItemsTitle">Product List</h3>
        <div class="oe-price-type" id="oePriceType">
          <label><input type="radio" name="priceType" value="msrp" checked><span id="oePT1">MSRP</span></label>
          <label><input type="radio" name="priceType" value="ws5"><span id="oePT2">Wholesaler +5%</span></label>
          <label><input type="radio" name="priceType" value="ws"><span id="oePT3">Wholesale</span></label>
        </div>
      </div>
      <div class="oe-table-wrap">
        <table class="oe-table">
          <thead>
            <tr>
              <th class="num-col">#</th>
              <th class="model-col" id="oeThModel">Model</th>
              <th class="desc-col" id="oeThDesc">Description</th>
              <th class="qty-col" id="oeThQty">Qty</th>
              <th class="price-col" id="oeThPrice">Unit Price</th>
              <th class="total-col" id="oeThSubtotal">Subtotal</th>
              <th class="action-col"></th>
            </tr>
          </thead>
          <tbody id="oeItemsBody">
          </tbody>
        </table>
      </div>
      <button class="oe-add-row" onclick="addOEItem()" id="oeAddBtn">+ Add Product</button>
    </div>

    <div class="oe-summary" id="oeSummary" style="display:none">
      <div class="oe-summary-head">
        <h3 id="oeSumTitle">Order Summary</h3>
      </div>
      <div class="oe-summary-body">
        <div class="oe-summary-grid">
          <div class="oe-sum-item">
            <div class="sum-label" id="oeSumItems">Items</div>
            <div class="sum-value" id="oeSumItemsVal">0</div>
          </div>
          <div class="oe-sum-item">
            <div class="sum-label" id="oeSumQty">Total Qty</div>
            <div class="sum-value" id="oeSumQtyVal">0</div>
          </div>
          <div class="oe-sum-item">
            <div class="sum-label" id="oeSumSubtotal">Subtotal</div>
            <div class="sum-value" id="oeSumSubtotalVal">$0.00</div>
          </div>
          <div class="oe-sum-item">
            <div class="sum-label" id="oeSumVat">VAT 7%</div>
            <div class="sum-value" id="oeSumVatVal">$0.00</div>
          </div>
          <div class="oe-sum-item sum-ship">
            <div class="sum-label" id="oeSumShip">Shipping Cost</div>
            <div class="sum-value"><input type="number" id="oeShipInput" value="0" min="0" step="1" style="width:120px;padding:6px 10px;border:1px solid rgba(255,255,255,0.2);border-radius:6px;font-size:16px;font-weight:700;font-family:inherit;background:rgba(255,255,255,0.1);color:#fff;text-align:right;outline:none" oninput="recalcOE()"></div>
          </div>
          <div class="oe-sum-item sum-total">
            <div class="sum-label" id="oeSumGrand">Grand Total</div>
            <div class="sum-value" id="oeSumGrandVal">$0.00</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<div class="footer">
  <span id="stockStatus" class="stock-status loading">&#9203; Loading stock...</span>
  &nbsp;&middot;&nbsp; &copy; 2026 TrolMaster Asia Co., Ltd.
</div>
<script>
const T = {
  "zh-Hant": {
    pageTitle: "TrolMaster \u7522\u54c1\u67e5\u8a62",
    heroTitle: "TrolMaster \u7522\u54c1\u67e5\u8a62",
    heroSub: "\u8f38\u5165\u7522\u54c1\u578b\u865f\u4ee5\u67e5\u8a62\u50f9\u683c\u8207\u5eab\u5b58\u72c0\u614b",
    langLabel: "\u7e41\u9ad4\u4e2d\u6587",
    placeholder: "\u8f38\u5165\u7522\u54c1\u578b\u865f\uff0c\u4f8b\u5982\uff1aWCS-9\u3001NFS-2\u3001ECW-1",
    searchBtn: "\u67e5\u8a62",
    notFound: "\u627e\u4e0d\u5230\u578b\u865f\u300c{q}\u300d\u7684\u7522\u54c1",
    badgeLabel: "\u578b\u865f",
    modelLabel: "\u7522\u54c1\u578b\u865f",
    msrpLabel: "\u5efa\u8b70\u96f6\u552e\u50f9 MSRP",
    ws5Label: "Wholesaler +5%",
    wsLabel: "\u6279\u767c\u50f9 Wholesale",
    priceNote: "* \u4ee5\u4e0a\u50f9\u683c\u4ee5 USD \u8a08\u7b97\uff0c\u5be6\u969b\u50f9\u683c\u8acb\u8207\u6211\u5011\u806f\u7d61",
    compatLabel: "\u76f8\u5bb9\u8a2d\u5099",
    dimLabel: "\u5305\u88dd\u5c3a\u5bf8",
    weightLabel: "\u91cd\u91cf",
    stockTitle: "\u5eab\u5b58\u72c0\u6cc1",
    canSaleLabel: "\u53ef\u552e\u5eab\u5b58",
    stockLevelLabel: "\u5eab\u5b58\u6c34\u5e73",
    stockOk: "\u53ef\u552e {n} \u4ef6",
    stockLow: "\u5eab\u5b58\u504f\u4f4e ({n} \u4ef6)",
    stockOut: "\u66ab\u7121\u5eab\u5b58",
    stockLoading: "\u23f3 \u6b63\u5728\u8b80\u53d6\u5eab\u5b58...",
    stockReady: "\u2705 \u5eab\u5b58\u5df2\u66f4\u65b0 (Live)",
    stockFallback: "\u26a0\ufe0f \u96e2\u7dda\u6a21\u5f0f",
    stockError: "\u274c \u7121\u6cd5\u8b80\u53d6\u5eab\u5b58",
    sbItem1: "\u7522\u54c1\u50f9\u683c\u8207\u5eab\u5b58\u67e5\u8a62",
    sbItem2: "\u6280\u8853\u8cc7\u6599\u4e0b\u8f09",
    sbItem3: "Model-One \u8a08\u7b97\u5668",
    sbItem4: "\u8a02\u55ae\u4f30\u7b97",
    sbTitle: "TM \u6e2c\u8a66\u5de5\u5177",
    comingSoon: "\u5373\u5c07\u63a8\u51fa",
    oeTitle: "\u8a02\u55ae\u4f30\u7b97",
    oeSub: "\u65b0\u589e\u7522\u54c1\u548c\u6578\u91cf\u4ee5\u8a08\u7b97\u60a8\u7684\u8a02\u55ae\u7e3d\u50f9",
    oeItemsTitle: "\u7522\u54c1\u6e05\u55ae",
    oePT1: "MSRP",
    oePT2: "Wholesaler +5%",
    oePT3: "\u6279\u767c\u50f9",
    oeThModel: "\u578b\u865f",
    oeThDesc: "\u7522\u54c1\u8aaa\u660e",
    oeThQty: "\u6578\u91cf",
    oeThPrice: "\u55ae\u50f9",
    oeThSubtotal: "\u5c0f\u8a08",
    oeAddBtn: "+ \u65b0\u589e\u7522\u54c1",
    oeSumTitle: "\u8a02\u55ae\u6458\u8981",
    oeSumItems: "\u7522\u54c1\u9805\u76ee",
    oeSumQty: "\u7e3d\u6578\u91cf",
    oeSumSubtotal: "\u5c0f\u8a08",
    oeSumVat: "\u7a0e\u6b3e 7%",
    oeSumShip: "\u904b\u8cbb",
    oeSumGrand: "\u7e3d\u8a08",
    oeSearchPH: "\u641c\u5c0b\u578b\u865f...",
    oeNoMatch: "\u627e\u4e0d\u5230\u5339\u914d\u7522\u54c1"
  },
  "en": {
    pageTitle: "TrolMaster Product Search",
    heroTitle: "TrolMaster Product Search",
    heroSub: "Enter model number for pricing and stock",
    langLabel: "English",
    placeholder: "Enter product model, e.g.: WCS-9, NFS-2, ECW-1",
    searchBtn: "Search",
    notFound: 'Product model "{q}" not found',
    badgeLabel: "Model",
    modelLabel: "Product Model",
    msrpLabel: "MSRP",
    ws5Label: "Wholesaler +5%",
    wsLabel: "Wholesale",
    priceNote: "* Prices in USD. Contact us for actual pricing.",
    compatLabel: "Compatible Devices",
    dimLabel: "Package Dimensions",
    weightLabel: "Weight",
    stockTitle: "Stock Status",
    canSaleLabel: "Available",
    stockLevelLabel: "Stock Level",
    stockOk: "{n} units available",
    stockLow: "Low stock ({n} units)",
    stockOut: "Out of stock",
    stockLoading: "\u23f3 Loading stock...",
    stockReady: "\u2705 Stock updated (Live)",
    stockFallback: "\u26a0\ufe0f Offline mode",
    stockError: "\u274c Stock unavailable",
    sbItem1: "Product Price and Stock",
    sbItem2: "Tech sheet download",
    sbItem3: "Model-One Calculator",
    sbItem4: "Order Estimation",
    sbTitle: "TM Testing Tools",
    comingSoon: "Coming Soon",
    oeTitle: "Order Estimation",
    oeSub: "Add products and quantities to calculate your order total",
    oeItemsTitle: "Product List",
    oePT1: "MSRP",
    oePT2: "Wholesaler +5%",
    oePT3: "Wholesale",
    oeThModel: "Model",
    oeThDesc: "Description",
    oeThQty: "Qty",
    oeThPrice: "Unit Price",
    oeThSubtotal: "Subtotal",
    oeAddBtn: "+ Add Product",
    oeSumTitle: "Order Summary",
    oeSumItems: "Items",
    oeSumQty: "Total Qty",
    oeSumSubtotal: "Subtotal",
    oeSumVat: "VAT 7%",
    oeSumShip: "Shipping Cost",
    oeSumGrand: "Grand Total",
    oeSearchPH: "Search model...",
    oeNoMatch: "No matching products"
  },
  "th": {
    pageTitle: "\u0e04\u0e49\u0e19\u0e2b\u0e32\u0e1c\u0e25\u0e34\u0e15\u0e20\u0e31\u0e13\u0e11\u0e4c TrolMaster",
    heroTitle: "\u0e04\u0e49\u0e19\u0e2b\u0e32\u0e1c\u0e25\u0e34\u0e15\u0e20\u0e31\u0e13\u0e11\u0e4c TrolMaster",
    heroSub: "\u0e01\u0e23\u0e2d\u0e01\u0e23\u0e38\u0e48\u0e19\u0e40\u0e1e\u0e37\u0e48\u0e2d\u0e14\u0e39\u0e23\u0e32\u0e04\u0e32\u0e41\u0e25\u0e30\u0e2a\u0e15\u0e47\u0e2d\u0e01",
    langLabel: "\u0e44\u0e17\u0e22",
    placeholder: "\u0e01\u0e23\u0e2d\u0e01\u0e23\u0e38\u0e48\u0e19\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32 \u0e40\u0e0a\u0e48\u0e19: WCS-9, NFS-2, ECW-1",
    searchBtn: "\u0e04\u0e49\u0e19\u0e2b\u0e32",
    notFound: '\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e23\u0e38\u0e48\u0e19\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32 "{q}"',
    badgeLabel: "\u0e23\u0e38\u0e48\u0e19",
    modelLabel: "\u0e23\u0e38\u0e48\u0e19\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32",
    msrpLabel: "\u0e23\u0e32\u0e04\u0e32\u0e1b\u0e25\u0e35\u0e41\u0e19\u0e30\u0e19\u0e33 MSRP",
    ws5Label: "Wholesaler +5%",
    wsLabel: "\u0e23\u0e32\u0e04\u0e32\u0e2a\u0e48\u0e07 Wholesale",
    priceNote: "* \u0e23\u0e32\u0e04\u0e32\u0e40\u0e1b\u0e47\u0e19\u0e2a\u0e01\u0e38\u0e25 USD \u0e01\u0e23\u0e38\u0e13\u0e32\u0e15\u0e34\u0e14\u0e15\u0e48\u0e2d\u0e40\u0e23\u0e32",
    compatLabel: "\u0e2d\u0e38\u0e1b\u0e01\u0e23\u0e13\u0e4c\u0e17\u0e35\u0e48\u0e40\u0e02\u0e49\u0e32\u0e01\u0e31\u0e19\u0e44\u0e14\u0e49",
    dimLabel: "\u0e02\u0e19\u0e32\u0e14\u0e1a\u0e23\u0e23\u0e08\u0e38\u0e20\u0e31\u0e13\u0e11\u0e4c",
    weightLabel: "\u0e19\u0e49\u0e33\u0e2b\u0e19\u0e31\u0e01",
    stockTitle: "\u0e2a\u0e16\u0e32\u0e19\u0e30\u0e2a\u0e15\u0e47\u0e2d\u0e01",
    canSaleLabel: "\u0e1e\u0e23\u0e49\u0e2d\u0e21\u0e02\u0e32\u0e22",
    stockLevelLabel: "\u0e23\u0e30\u0e14\u0e31\u0e1a\u0e2a\u0e15\u0e47\u0e2d\u0e01",
    stockOk: "\u0e21\u0e35\u0e2a\u0e15\u0e47\u0e2d\u0e01 {n} \u0e0a\u0e34\u0e49\u0e19",
    stockLow: "\u0e2a\u0e15\u0e47\u0e2d\u0e01\u0e15\u0e48\u0e33 ({n} \u0e0a\u0e34\u0e49\u0e19)",
    stockOut: "\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u0e2b\u0e21\u0e14",
    stockLoading: "\u23f3 \u0e01\u0e33\u0e25\u0e31\u0e07\u0e42\u0e2b\u0e25\u0e14\u0e2a\u0e15\u0e47\u0e2d\u0e01...",
    stockReady: "\u2705 \u0e2a\u0e15\u0e47\u0e2d\u0e01\u0e2d\u0e31\u0e1b\u0e40\u0e14\u0e15\u0e41\u0e25\u0e49\u0e27 (Live)",
    stockFallback: "\u26a0\ufe0f \u0e42\u0e2b\u0e21\u0e14\u0e2d\u0e2d\u0e1f\u0e44\u0e25\u0e19\u0e4c",
    stockError: "\u274c \u0e42\u0e2b\u0e25\u0e14\u0e2a\u0e15\u0e47\u0e2d\u0e01\u0e44\u0e21\u0e48\u0e44\u0e14\u0e49",
    sbItem1: "\u0e23\u0e32\u0e04\u0e32\u0e41\u0e25\u0e30\u0e2a\u0e15\u0e47\u0e2d\u0e01\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32",
    sbItem2: "\u0e14\u0e32\u0e27\u0e19\u0e4c\u0e42\u0e2b\u0e25\u0e14\u0e41\u0e1c\u0e48\u0e19\u0e1e\u0e31\u0e1a\u0e40\u0e17\u0e04\u0e19\u0e34\u0e04",
    sbItem3: "\u0e40\u0e04\u0e23\u0e37\u0e48\u0e2d\u0e07\u0e04\u0e33\u0e19\u0e27\u0e13 Model-One",
    sbItem4: "\u0e1b\u0e23\u0e30\u0e21\u0e32\u0e13\u0e01\u0e32\u0e23\u0e2a\u0e31\u0e48\u0e07\u0e0b\u0e37\u0e49\u0e2d",
    sbTitle: "TM \u0e40\u0e04\u0e23\u0e37\u0e48\u0e2d\u0e07\u0e21\u0e37\u0e2d\u0e17\u0e14\u0e2a\u0e2d\u0e1a",
    comingSoon: "\u0e40\u0e23\u0e47\u0e27\u0e46 \u0e19\u0e35\u0e49",
    oeTitle: "\u0e1b\u0e23\u0e30\u0e21\u0e32\u0e13\u0e01\u0e32\u0e23\u0e2a\u0e31\u0e48\u0e07\u0e0b\u0e37\u0e49\u0e2d",
    oeSub: "\u0e40\u0e1e\u0e34\u0e48\u0e21\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u0e41\u0e25\u0e30\u0e08\u0e33\u0e19\u0e27\u0e19\u0e40\u0e1e\u0e37\u0e48\u0e2d\u0e04\u0e33\u0e19\u0e27\u0e13\u0e22\u0e2d\u0e14\u0e23\u0e27\u0e21\u0e02\u0e2d\u0e07\u0e04\u0e38\u0e13",
    oeItemsTitle: "\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32",
    oePT1: "MSRP",
    oePT2: "Wholesaler +5%",
    oePT3: "\u0e23\u0e32\u0e04\u0e32\u0e2a\u0e48\u0e07",
    oeThModel: "\u0e23\u0e38\u0e48\u0e19",
    oeThDesc: "\u0e23\u0e32\u0e22\u0e25\u0e30\u0e40\u0e2d\u0e35\u0e22\u0e14",
    oeThQty: "\u0e08\u0e33\u0e19\u0e27\u0e19",
    oeThPrice: "\u0e23\u0e32\u0e04\u0e32\u0e15\u0e48\u0e2d\u0e2b\u0e19\u0e48\u0e27\u0e22",
    oeThSubtotal: "\u0e22\u0e2d\u0e14\u0e23\u0e27\u0e21",
    oeAddBtn: "+ \u0e40\u0e1e\u0e34\u0e48\u0e21\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32",
    oeSumTitle: "\u0e2a\u0e23\u0e38\u0e1b\u0e2a\u0e31\u0e48\u0e07\u0e0b\u0e37\u0e49\u0e2d",
    oeSumItems: "\u0e23\u0e32\u0e22\u0e01\u0e32\u0e23\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32",
    oeSumQty: "\u0e08\u0e33\u0e19\u0e27\u0e19\u0e23\u0e27\u0e21",
    oeSumSubtotal: "\u0e22\u0e2d\u0e14\u0e23\u0e27\u0e21",
    oeSumVat: "\u0e20\u0e32\u0e29\u0e35 7%",
    oeSumShip: "\u0e04\u0e48\u0e32\u0e02\u0e19\u0e2a\u0e48\u0e07",
    oeSumGrand: "\u0e22\u0e2d\u0e14\u0e23\u0e27\u0e21\u0e17\u0e31\u0e49\u0e07\u0e2b\u0e21\u0e14",
    oeSearchPH: "\u0e04\u0e49\u0e19\u0e2b\u0e32\u0e23\u0e38\u0e48\u0e19...",
    oeNoMatch: "\u0e44\u0e21\u0e48\u0e1e\u0e1a\u0e2a\u0e34\u0e19\u0e04\u0e49\u0e32\u0e17\u0e35\u0e48\u0e15\u0e23\u0e07"
  }
};

var curLang = "en";
var lastQuery = "";
var INVENTORY = {};
var stockSource = "none";
var currentPage = "product-search";
var oeItems = [];

function t(k) { return (T[curLang] && T[curLang][k]) || T["zh-Hant"][k] || k; }

function toggleLang() { document.getElementById("langDD").classList.toggle("show"); }

function openMenu() {
  document.getElementById("sidebar").classList.add("open");
  document.getElementById("overlay").classList.add("show");
  document.body.style.overflow = "hidden";
}

function closeMenu() {
  document.getElementById("sidebar").classList.remove("open");
  document.getElementById("overlay").classList.remove("show");
  document.body.style.overflow = "";
}

function navTo(page) {
  closeMenu();
  currentPage = page;
  document.querySelectorAll(".page").forEach(function(el) {
    el.classList.toggle("active", el.id === "page-" + page);
  });
  document.querySelectorAll(".sb-item").forEach(function(el) {
    el.classList.toggle("active", el.dataset.page === page);
  });
  if (page === "product-search") {
    document.getElementById("pageTitle").textContent = t("pageTitle");
    document.getElementById("q").focus();
  } else if (page === "order-est") {
    document.getElementById("pageTitle").textContent = t("oeTitle");
  }
}

document.addEventListener("click", function(e) {
  if (!e.target.closest(".lang-switcher")) document.getElementById("langDD").classList.remove("show");
  // Close OE dropdowns when clicking outside
  if (!e.target.closest(".oe-search-wrap")) {
    document.querySelectorAll(".oe-dropdown").forEach(function(dd) { dd.classList.remove("show"); });
  }
});

function updateStockStatus(state) {
  var el = document.getElementById("stockStatus");
  if (!el) return;
  el.className = "stock-status " + state;
  if (state === "loading") el.textContent = t("stockLoading");
  else if (state === "ok") el.textContent = t("stockReady");
  else if (state === "fallback") el.textContent = t("stockFallback");
  else el.textContent = t("stockError");
}

function setLang(lang) {
  curLang = lang;
  document.getElementById("langDD").classList.remove("show");
  document.querySelectorAll(".lang-opt").forEach(function(el) {
    el.classList.toggle("active", el.dataset.lang === lang);
  });
  document.getElementById("langLabel").textContent = t("langLabel");
  document.getElementById("pageTitle").textContent = currentPage === "order-est" ? t("oeTitle") : t("pageTitle");
  document.getElementById("heroTitle").textContent = t("heroTitle");
  document.getElementById("heroSub").textContent = t("heroSub");
  document.getElementById("searchBtn").textContent = t("searchBtn");
  document.getElementById("q").placeholder = t("placeholder");
  document.getElementById("sbItem1").textContent = t("sbItem1");
  document.getElementById("sbItem2").textContent = t("sbItem2");
  document.getElementById("sbItem3").textContent = t("sbItem3");
  document.getElementById("sbItem4").textContent = t("sbItem4");
  document.getElementById("sbTitle").textContent = t("sbTitle");
  document.getElementById("sbCs2").textContent = t("comingSoon");
  document.getElementById("sbCs3").textContent = t("comingSoon");
  // OE elements
  document.getElementById("oeTitle").textContent = t("oeTitle");
  document.getElementById("oeSub").textContent = t("oeSub");
  document.getElementById("oeItemsTitle").textContent = t("oeItemsTitle");
  document.getElementById("oePT1").textContent = t("oePT1");
  document.getElementById("oePT2").textContent = t("oePT2");
  document.getElementById("oePT3").textContent = t("oePT3");
  document.getElementById("oeThModel").textContent = t("oeThModel");
  document.getElementById("oeThDesc").textContent = t("oeThDesc");
  document.getElementById("oeThQty").textContent = t("oeThQty");
  document.getElementById("oeThPrice").textContent = t("oeThPrice");
  document.getElementById("oeThSubtotal").textContent = t("oeThSubtotal");
  document.getElementById("oeAddBtn").textContent = t("oeAddBtn");
  document.getElementById("oeSumTitle").textContent = t("oeSumTitle");
  document.getElementById("oeSumItems").textContent = t("oeSumItems");
  document.getElementById("oeSumQty").textContent = t("oeSumQty");
  document.getElementById("oeSumSubtotal").textContent = t("oeSumSubtotal");
  document.getElementById("oeSumVat").textContent = t("oeSumVat");
  document.getElementById("oeSumShip").textContent = t("oeSumShip");
  document.getElementById("oeSumGrand").textContent = t("oeSumGrand");
  if (stockSource === "live") updateStockStatus("ok");
  else if (stockSource === "fallback") updateStockStatus("fallback");
  else updateStockStatus("loading");
  if (lastQuery) go();
  renderOETable();
}

const COL_MODEL = 0;
const COL_CAN_SALE = 2;
const COL_STOCK_LEVEL = 3;

const INVENTORY_SHEET_ID = "__INVENTORY_SHEET_ID__";
const INVENTORY_GID = "__INVENTORY_GID__";
const INVENTORY_FALLBACK = __INVENTORY_FALLBACK__;

async function loadInventoryLive() {
  var url = "https://docs.google.com/spreadsheets/d/" + INVENTORY_SHEET_ID + "/gviz/tq?tqx=out:json&gid=" + INVENTORY_GID;
  try {
    var resp = await fetch(url);
    var text = await resp.text();
    var startIdx = text.indexOf("(");
    var endIdx = text.lastIndexOf(")");
    if (startIdx === -1 || endIdx === -1) throw new Error("Invalid response");
    var json = JSON.parse(text.substring(startIdx + 1, endIdx));
    var inv = {};
    if (json && json.table && json.table.rows) {
      for (var i = 0; i < json.table.rows.length; i++) {
        var row = json.table.rows[i];
        var cells = row.c;
        if (!cells || !cells[COL_MODEL] || !cells[COL_MODEL].v) continue;
        var model = String(cells[COL_MODEL].v).trim();
        if (!model) continue;
        if (model.toLowerCase().indexOf("model") !== -1 && cells[1] && cells[1].v && String(cells[1].v).indexOf("Description") !== -1) continue;
        var canSale = "";
        if (cells[COL_CAN_SALE] && cells[COL_CAN_SALE].v !== null && cells[COL_CAN_SALE].v !== "") {
          canSale = String(cells[COL_CAN_SALE].v).trim();
        }
        var stockLevel = "";
        if (cells[COL_STOCK_LEVEL] && cells[COL_STOCK_LEVEL].v !== null && cells[COL_STOCK_LEVEL].v !== "") {
          stockLevel = String(cells[COL_STOCK_LEVEL].v).trim();
        }
        inv[model.toUpperCase()] = { canSale: canSale, stockLevel: stockLevel };
      }
    }
    console.log("[LIVE] Inventory loaded:", Object.keys(inv).length, "records");
    return { data: inv, success: true };
  } catch (e) {
    console.warn("[LIVE] Failed:", e.message);
    return { data: null, success: false };
  }
}

async function loadInventory() {
  updateStockStatus("loading");
  var live = await loadInventoryLive();
  if (live.success && Object.keys(live.data).length > 0) {
    INVENTORY = live.data;
    stockSource = "live";
    updateStockStatus("ok");
    if (lastQuery) go();
    renderOETable();
    return;
  }
  console.log("[FALLBACK] Using static inventory");
  INVENTORY = INVENTORY_FALLBACK;
  stockSource = "fallback";
  updateStockStatus("fallback");
  if (lastQuery) go();
  renderOETable();
}

const PRODUCTS = __PRODUCTS__;
const POPULAR = ["WCS-9","NFS-2","ECW-1","ECS-7","GCS-1","HCS-2","WN-9","Model-V","V-6","V-10"];

function init() {
  var tEl = document.getElementById("tags");
  tEl.innerHTML = POPULAR.map(function(m) { return '<span class="tag" data-m="' + m + '">' + m + '</span>'; }).join("");
  tEl.addEventListener("click", function(e) { if (e.target.dataset.m) { q.value = e.target.dataset.m; go(); } });
  document.getElementById("searchBtn").onclick = go;
  document.getElementById("q").addEventListener("keydown", function(e) { if (e.key === "Enter") go(); });
  // Price type change triggers recalc
  document.querySelectorAll('input[name="priceType"]').forEach(function(r) {
    r.addEventListener("change", recalcOE);
  });
  updateStockStatus("loading");
  loadInventory();
  setLang(curLang);
  // Add first empty OE row
  addOEItem();
}

function go() {
  var v = q.value.trim().toUpperCase();
  lastQuery = v;
  if (!v) return;
  var vNorm = v.replace(/-/g, "").replace(/\s+/g, "");
  var r = document.getElementById("res");
  var hits = PRODUCTS.filter(function(p) {
    var modelNorm = p.model.toUpperCase().replace(/-/g, "").replace(/\s+/g, "");
    var descNorm = (p.desc || "").toUpperCase().replace(/-/g, "").replace(/\s+/g, "");
    return modelNorm === vNorm ||
      modelNorm.indexOf(vNorm) !== -1 ||
      descNorm.indexOf(vNorm) !== -1;
  });
  hits.sort(function(a, b) {
    var aModel = a.model.toUpperCase().replace(/-/g, "").replace(/\s+/g, "");
    var bModel = b.model.toUpperCase().replace(/-/g, "").replace(/\s+/g, "");
    var aExact = aModel === vNorm ? 0 : (aModel.indexOf(vNorm) !== -1 ? 1 : 2);
    var bExact = bModel === vNorm ? 0 : (bModel.indexOf(vNorm) !== -1 ? 1 : 2);
    return aExact - bExact;
  });
  if (!hits.length) {
    r.innerHTML = '<div class="noresult">\uD83D\uDD0D ' + t("notFound").replace("{q}", esc(v)) + "</div>";
    return;
  }
  r.innerHTML = hits.map(render).join("");
}

function esc(s) { var d = document.createElement("div"); d.textContent = s; return d.innerHTML; }

function render(p) {
  var inv = INVENTORY[p.model.toUpperCase()];
  var ph = '<table class="ptable"><thead><tr><th>' + t("msrpLabel") + '</th><th>USD</th></tr></thead><tbody>'
    + "<tr><td>" + t("msrpLabel") + "</td><td>$" + esc(p.msrp) + "</td></tr>"
    + "<tr><td>" + t("ws5Label") + "</td><td>$" + esc(p.ws5) + "</td></tr>"
    + "<tr><td>" + t("wsLabel") + "</td><td>$" + esc(p.ws) + "</td></tr></tbody></table>"
    + '<div class="price-note">' + t("priceNote") + '</div>';
  var ex = "";
  if (p.compat) ex += '<div class="irow"><div class="ilabel">' + t("compatLabel") + '</div><div class="ivalue">' + esc(p.compat) + '</div></div>';
  if (p.dim) ex += '<div class="irow"><div class="ilabel">' + t("dimLabel") + '</div><div class="ivalue">' + esc(p.dim.replace(/\\n/g, " ")) + '</div></div>';
  if (p.weight) ex += '<div class="irow"><div class="ilabel">' + t("weightLabel") + '</div><div class="ivalue">' + esc(p.weight) + ' kg</div></div>';
  var ih = "";
  if (inv) {
    var cs = parseInt(inv.canSale) || 0;
    var sl = parseInt(inv.stockLevel) || 0;
    var sc = "stock-ok", st;
    if (cs <= 0) { sc = "stock-out"; st = t("stockOut"); }
    else if (cs <= 5) { sc = "stock-low"; st = t("stockLow").replace("{n}", cs); }
    else { st = t("stockOk").replace("{n}", cs); }
    ih = '<div class="stock"><div class="stock-title">' + t("stockTitle") + '</div>'
      + '<div class="igrid">'
      + '<div class="icard"><div class="l">' + t("canSaleLabel") + '</div><div class="v ' + sc + '">' + esc(String(cs)) + '</div></div>'
      + '<div class="icard"><div class="l">' + t("stockLevelLabel") + '</div><div class="v">' + esc(String(sl)) + '</div></div>'
      + '</div>'
      + '<div class="stock-msg ' + sc + '">' + st + '</div></div>';
  } else {
    ih = '<div class="stock" style="border-color:#fed7d7;background:#fff5f5"><div style="color:#c53030;font-size:12px;font-weight:600">' + t("stockError") + '</div></div>';
  }
  return '<div class="card"><div class="c-head"><h2>' + esc(p.desc || p.model) + '</h2>'
    + '<div class="c-badge">' + t("badgeLabel") + ': ' + esc(p.model) + '</div></div>'
    + '<div class="c-body">'
    + '<div class="irow"><div class="ilabel">' + t("modelLabel") + '</div><div class="ivalue"><strong>' + esc(p.model) + '</strong></div></div>'
    + ex + ph + ih
    + "</div></div>";
}

// ============ ORDER ESTIMATION ============

function addOEItem() {
  oeItems.push({ model: "", qty: 0 });
  renderOETable();
}

function removeOEItem(idx) {
  oeItems.splice(idx, 1);
  if (oeItems.length === 0) addOEItem();
  renderOETable();
}

function getSelectedPriceType() {
  var checked = document.querySelector('input[name="priceType"]:checked');
  return checked ? checked.value : "msrp";
}

function getPriceForProduct(p, priceType) {
  if (!p) return 0;
  var raw = "";
  if (priceType === "msrp") raw = p.msrp;
  else if (priceType === "ws5") raw = p.ws5;
  else raw = p.ws;
  return parseFloat(raw.replace(/[^0-9.\-]/g, "")) || 0;
}

function findProduct(modelStr) {
  if (!modelStr) return null;
  var norm = modelStr.toUpperCase().replace(/-/g, "").replace(/\s+/g, "");
  for (var i = 0; i < PRODUCTS.length; i++) {
    var pNorm = PRODUCTS[i].model.toUpperCase().replace(/-/g, "").replace(/\s+/g, "");
    if (pNorm === norm) return PRODUCTS[i];
  }
  return null;
}

function searchProducts(query) {
  if (!query || query.length < 1) return [];
  var q = query.toUpperCase().replace(/-/g, "").replace(/\s+/g, "");
  var hits = [];
  for (var i = 0; i < PRODUCTS.length; i++) {
    var p = PRODUCTS[i];
    var mNorm = p.model.toUpperCase().replace(/-/g, "").replace(/\s+/g, "");
    var dNorm = (p.desc || "").toUpperCase().replace(/-/g, "").replace(/\s+/g, "");
    if (mNorm === q || mNorm.indexOf(q) !== -1 || dNorm.indexOf(q) !== -1) {
      hits.push(p);
      if (hits.length >= 15) break;
    }
  }
  hits.sort(function(a, b) {
    var aM = a.model.toUpperCase().replace(/-/g, "").replace(/\s+/g, "");
    var bM = b.model.toUpperCase().replace(/-/g, "").replace(/\s+/g, "");
    var aE = aM === q ? 0 : (aM.indexOf(q) !== -1 ? 1 : 2);
    var bE = bM === q ? 0 : (bM.indexOf(q) !== -1 ? 1 : 2);
    return aE - bE;
  });
  return hits;
}

function renderOETable() {
  var tbody = document.getElementById("oeItemsBody");
  var priceType = getSelectedPriceType();
  if (!oeItems.length) {
    tbody.innerHTML = "";
    document.getElementById("oeSummary").style.display = "none";
    return;
  }
  var html = "";
  for (var i = 0; i < oeItems.length; i++) {
    var item = oeItems[i];
    var product = findProduct(item.model);
    var unitPrice = getPriceForProduct(product, priceType);
    var subtotal = unitPrice * (item.qty || 0);
    // Stock badge
    var stockBadge = "";
    if (product) {
      var inv = INVENTORY[product.model.toUpperCase()];
      if (inv) {
        var cs = parseInt(inv.canSale) || 0;
        if (cs > 5) stockBadge = '<span class="oe-stock-badge in-stock">' + esc(String(cs)) + '</span>';
        else if (cs > 0) stockBadge = '<span class="oe-stock-badge low-stock">' + esc(String(cs)) + '</span>';
        else stockBadge = '<span class="oe-stock-badge no-stock">0</span>';
      } else {
        stockBadge = '<span class="oe-stock-badge unknown">-</span>';
      }
    }
    html += '<tr>'
      + '<td class="num-col">' + (i + 1) + '</td>'
      + '<td class="model-col"><div class="oe-search-wrap">'
      + '<input type="text" class="oe-search-input" value="' + esc(item.model) + '" placeholder="' + esc(t("oeSearchPH")) + '" data-idx="' + i + '" oninput="onOESearch(this,' + i + ')" onfocus="onOESearch(this,' + i + ')">'
      + '<div class="oe-dropdown" id="oe-dd-' + i + '"></div>'
      + '</div></td>'
      + '<td class="desc-col">' + (product ? esc(product.desc) : '') + ' ' + stockBadge + '</td>'
      + '<td class="qty-col"><input type="number" value="' + (item.qty || '') + '" min="0" step="1" data-idx="' + i + '" oninput="onOEQty(this,' + i + ')"></td>'
      + '<td class="price-col">$' + (unitPrice ? unitPrice.toFixed(2) : "0.00") + '</td>'
      + '<td class="total-col">$' + subtotal.toFixed(2) + '</td>'
      + '<td class="action-col"><button class="oe-del-btn" onclick="removeOEItem(' + i + ')">&times;</button></td>'
      + '</tr>';
  }
  tbody.innerHTML = html;
  recalcOE();
}

function onOESearch(input, idx) {
  var query = input.value.trim();
  var dd = document.getElementById("oe-dd-" + idx);
  if (!query) { dd.classList.remove("show"); return; }
  var hits = searchProducts(query);
  if (!hits.length) {
    dd.innerHTML = '<div class="oe-dd-empty">' + esc(t("oeNoMatch")) + '</div>';
    dd.classList.add("show");
    return;
  }
  var priceType = getSelectedPriceType();
  var html = hits.map(function(p) {
    var price = getPriceForProduct(p, priceType);
    return '<div class="oe-dd-item" data-idx="' + idx + '" data-model="' + esc(p.model) + '" onmousedown="selectOEProduct(this)">'
      + '<div class="dd-model">' + esc(p.model) + '</div>'
      + '<div class="dd-desc">' + esc(p.desc) + '</div>'
      + '<div class="dd-price">$' + price.toFixed(2) + '</div>'
      + '</div>';
  }).join("");
  dd.innerHTML = html;
  dd.classList.add("show");
}

function selectOEProduct(el) {
  var idx = parseInt(el.dataset.idx);
  var model = el.dataset.model;
  oeItems[idx].model = model;
  if (oeItems[idx].qty < 1) oeItems[idx].qty = 1;
  document.getElementById("oe-dd-" + idx).classList.remove("show");
  renderOETable();
}

function onOEQty(input, idx) {
  oeItems[idx].qty = parseInt(input.value) || 0;
  renderOETable();
}

function recalcOE() {
  var priceType = getSelectedPriceType();
  var totalItems = 0, totalQty = 0, subtotal = 0;
  for (var i = 0; i < oeItems.length; i++) {
    var item = oeItems[i];
    if (!item.model) continue;
    var product = findProduct(item.model);
    if (!product) continue;
    totalItems++;
    var qty = item.qty || 0;
    totalQty += qty;
    subtotal += getPriceForProduct(product, priceType) * qty;
  }
  var vat = subtotal * 0.07;
  var ship = parseFloat(document.getElementById("oeShipInput").value) || 0;
  var grand = subtotal + vat + ship;

  document.getElementById("oeSumItemsVal").textContent = totalItems;
  document.getElementById("oeSumQtyVal").textContent = totalQty;
  document.getElementById("oeSumSubtotalVal").textContent = "$" + subtotal.toFixed(2);
  document.getElementById("oeSumVatVal").textContent = "$" + vat.toFixed(2);
  document.getElementById("oeSumGrandVal").textContent = "$" + grand.toFixed(2);

  document.getElementById("oeSummary").style.display = totalItems > 0 ? "" : "none";
}

init();
</script>
</body>
</html>'''

html = html.replace('__LOGO_DATA_URI__', logo_data_uri)
html = html.replace('__PRODUCTS__', product_js)
html = html.replace('__INVENTORY_FALLBACK__', inventory_fallback_js)
html = html.replace('__INVENTORY_SHEET_ID__', INVENTORY_SHEET_ID)
html = html.replace('__INVENTORY_GID__', INVENTORY_GID)

# Fix surrogate characters from CSV data
html = html.encode('utf-8', errors='replace').decode('utf-8')

with open(OUTPUT_HTML, 'w', encoding='utf-8') as f:
    f.write(html)

print('\nDone! Written to ' + OUTPUT_HTML)
print('  Products: {} (embedded)'.format(len(products)))
print('  Inventory Live: Google Sheets ID {}, gid={}'.format(INVENTORY_SHEET_ID, INVENTORY_GID))
print('  Inventory Fallback: {} records (static)'.format(len(inventory_fallback)))
print('  Theme: White header + white body + blue accents')
print('  Logo: ' + ('Embedded' if logo_data_uri else 'NOT FOUND'))
print('  Features: Product Search + Order Estimation')
