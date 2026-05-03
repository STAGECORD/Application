// STAGECORD PRO — artist shop (tickets + merchandise)
// Wires the "Buy Tickets" and "Buy Merchandise" buttons in the artist
// hero to two modals: an upcoming-events ticketing flow and a merch
// shop with cart. Demo data only — no real payment processing.
(function() {
    if (window.location.pathname.indexOf('/artist/') === -1) return;
    if (window.location.pathname.indexOf('/artist/settings/') !== -1) return;

    // Ensure pitch-modals.css and stage.css are loaded — needed for the
    // .release-modal scaffold and the .chip / .avatar-picker styles used
    // in the Add Product form.
    function ensureCss(href) {
        if (document.querySelector('link[href*="' + href + '"]')) return;
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = localAsset('css/' + href);
        document.head.appendChild(link);
    }
    ensureCss('pitch-modals.css');
    ensureCss('stage.css');

    // -------------- Demo data --------------
    const TICKET_EVENTS = [
        { id:'e1', date:'2026-05-30', venue:'RUST',                  city:'Copenhagen',   time:'Doors 19:00 · Show 20:00', price:195, viewerPrice:79,  available:true,  soldOut:false },
        { id:'e2', date:'2026-06-12', venue:'Train',                 city:'Aarhus',       time:'Doors 19:30 · Show 20:30', price:220, viewerPrice:79,  available:true,  soldOut:false },
        { id:'e3', date:'2026-07-04', venue:'Apollo Theatre',        city:'London',       time:'Doors 19:00 · Show 20:00', price:450, viewerPrice:99,  available:true,  soldOut:false },
        { id:'e4', date:'2026-07-15', venue:'Comedy Cellar',         city:'Brooklyn NYC', time:'Show 21:30',               price:380, viewerPrice:79,  available:false, soldOut:true  },
        { id:'e5', date:'2026-08-02', venue:'Hammerstein Ballroom',  city:'New York',     time:'Doors 18:30 · Show 19:30', price:520, viewerPrice:119, available:true,  soldOut:false },
        { id:'e6', date:'2026-09-19', venue:'Vega',                  city:'Copenhagen',   time:'Doors 19:00 · Show 20:00', price:240, viewerPrice:79,  available:true,  soldOut:false }
    ];

    const SEED_MERCH = [
        { id:'m1', name:'Late Cellar Set · Tour T-Shirt', price:280, image:'jokesmith-johnson-cover.png',   sizes:['S','M','L','XL','XXL'] },
        { id:'m2', name:'JokesmithJohnson Hoodie',         price:580, image:'jokesmith-johnson-post-1.png', sizes:['S','M','L','XL'] },
        { id:'m3', name:'Tour Poster (Signed)',            price:195, image:'jokesmith-johnson-post-2.png', sizes:[] },
        { id:'m4', name:'Late Cellar Set · Vinyl',         price:320, image:'jokesmith-johnson-post-3.png', sizes:[] },
        { id:'m5', name:'Snapback Cap',                    price:220, image:'jokesmith-johnson-project-1.png', sizes:['One size'] },
        { id:'m6', name:'Tote Bag',                        price:150, image:'jokesmith-johnson-project-2.png', sizes:[] }
    ];

    // Pool of artist-cover/post images that can be used as product photos
    // when the artist creates a new product through the "+ Add product" flow.
    const PRODUCT_IMAGE_POOL = [
        'jokesmith-johnson-cover.png',
        'jokesmith-johnson-post-1.png',
        'jokesmith-johnson-post-2.png',
        'jokesmith-johnson-post-3.png',
        'jokesmith-johnson-project-1.png',
        'jokesmith-johnson-project-2.png',
        'jokesmith-johnson-project-3.png',
        'jeremy-freedom-cover.png',
        'lola-young-event.jpg',
        'kebu-event.jpg'
    ];

    const STORAGE_KEY = 'stagecord:merch-products';

    function loadMerch() {
        const stored = (function() {
            try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); }
            catch (e) { return []; }
        })();
        return SEED_MERCH.concat(stored);
    }

    function saveCustomMerch(item) {
        try {
            const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
            stored.push(item);
            localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
        } catch (e) { /* ignore */ }
    }

    const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    function fmtDay(iso)   { return String(parseInt(iso.split('-')[2], 10)); }
    function fmtMonth(iso) { return MONTH_NAMES[parseInt(iso.split('-')[1], 10) - 1]; }

    // -------------- Modal scaffold --------------
    let modal = null;
    let modalContext = null;  // 'tickets' or 'merch'
    const cart = [];          // each: { itemId, name, price, size, qty }

    function ensureModal() {
        if (modal) return modal;
        const wrap = document.createElement('div');
        wrap.innerHTML =
            '<div class="release-modal-overlay" id="artistShopModal" data-shop-modal aria-hidden="true" role="dialog" aria-modal="true">' +
                '<div class="release-modal shop-modal">' +
                    '<header class="release-modal__header">' +
                        '<h2 class="release-modal__title" data-shop-title>Shop</h2>' +
                        '<button type="button" class="release-modal__close" data-shop-close aria-label="Close">&times;</button>' +
                    '</header>' +
                    '<div class="release-modal__body" data-shop-body></div>' +
                    '<footer class="release-modal__actions" data-shop-actions></footer>' +
                '</div>' +
            '</div>';
        document.body.appendChild(wrap.firstChild);
        modal = document.getElementById('artistShopModal');
        return modal;
    }

    function openModal(kind) {
        ensureModal();
        modalContext = kind;
        cart.length = 0;
        if (kind === 'tickets') renderTickets();
        else renderMerch();
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
    }

    function closeModal() {
        if (!modal) return;
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
    }

    // -------------- Tickets render --------------
    function renderTickets() {
        const titleEl = modal.querySelector('[data-shop-title]');
        const bodyEl = modal.querySelector('[data-shop-body]');
        const actsEl = modal.querySelector('[data-shop-actions]');

        // Pull tour name from the existing CTA button label if available
        const ctaBtn = document.querySelector('.artist-cta--tickets span');
        const tourName = ctaBtn ? (ctaBtn.textContent || '').replace(/^Buy Tickets for\s*/i, '').trim() : 'upcoming shows';
        titleEl.textContent = 'Tickets · ' + tourName;

        bodyEl.innerHTML =
            '<p class="ar-page-intro" style="margin:0 0 14px;color:rgba(255,255,255,0.7);">Pick a date below to buy a physical ticket. If a show is sold out you can still grab an Online Concert Pass to watch live from anywhere.</p>' +
            '<div class="tickets-list">' +
                TICKET_EVENTS.map(function(e) {
                    const buyBtn = e.soldOut
                        ? '<button type="button" class="tickets-event__buy tickets-event__buy--sold" disabled>Sold out</button>'
                        : '<button type="button" class="tickets-event__buy" data-shop-buy-ticket="' + SC.escapeAttr(e.id) + '">Buy ' + e.price + ' DKK</button>';
                    const viewer = '<button type="button" class="tickets-event__viewer" data-shop-buy-viewer="' + SC.escapeAttr(e.id) + '">Online pass · ' + e.viewerPrice + ' DKK</button>';
                    return '<div class="tickets-event">' +
                        '<div class="tickets-event__date">' +
                            '<div class="tickets-event__day">' + fmtDay(e.date) + '</div>' +
                            '<div class="tickets-event__month">' + fmtMonth(e.date) + '</div>' +
                        '</div>' +
                        '<div class="tickets-event__main">' +
                            '<div class="tickets-event__venue">' + SC.escapeHtml(e.venue) + '</div>' +
                            '<div class="tickets-event__city">' + SC.escapeHtml(e.city) + '</div>' +
                            '<div class="tickets-event__time">' + SC.escapeHtml(e.time) + '</div>' +
                        '</div>' +
                        '<div class="tickets-event__cta">' +
                            buyBtn +
                            viewer +
                        '</div>' +
                    '</div>';
                }).join('') +
            '</div>';

        actsEl.innerHTML = '<button type="button" class="release-modal__btn" data-shop-close>Close</button>';
    }

    // -------------- Merch render --------------
    function renderMerch() {
        const titleEl = modal.querySelector('[data-shop-title]');
        const bodyEl = modal.querySelector('[data-shop-body]');
        const actsEl = modal.querySelector('[data-shop-actions]');

        // Determine artist name from page header for the title
        const nameEl = document.querySelector('.artist-cover__name');
        const artistName = nameEl ? (nameEl.textContent || '').trim() : 'Artist';
        titleEl.textContent = artistName + ' · Merchandise';

        const items = loadMerch().map(function(item) {
            // Reserve the same vertical space whether or not the product has
            // sizes — keeps every Add-to-cart button at the same Y position.
            const sizes = item.sizes.length
                ? '<div class="merch-item__sizes">' +
                    item.sizes.map(function(s) {
                        return '<button type="button" class="merch-item__size" data-shop-size="' + SC.escapeAttr(item.id) + '|' + SC.escapeAttr(s) + '">' + SC.escapeHtml(s) + '</button>';
                    }).join('') +
                  '</div>'
                : '<div class="merch-item__sizes-placeholder"></div>';
            return '<article class="merch-item" data-shop-item="' + SC.escapeAttr(item.id) + '">' +
                '<div class="merch-item__cover" style="background-image: url(\'../assets/images/artists/' + item.image + '\');"></div>' +
                '<div class="merch-item__body">' +
                    '<div class="merch-item__name">' + SC.escapeHtml(item.name) + '</div>' +
                    '<div class="merch-item__price">' + item.price + ' DKK</div>' +
                    sizes +
                    '<button type="button" class="merch-item__add" data-shop-add="' + SC.escapeAttr(item.id) + '">Add to cart</button>' +
                '</div>' +
            '</article>';
        }).join('');

        // The "+ Add product" tile sits at the end of the grid — same uniform
        // dimensions as a product card, dashed border to indicate creator action.
        const addTile =
            '<button type="button" class="merch-item merch-item--add" data-shop-add-product>' +
                '<span class="merch-item--add__plus">+</span>' +
                '<span class="merch-item--add__label">Add product</span>' +
            '</button>';

        bodyEl.innerHTML =
            '<p class="ar-page-intro" style="margin:0 0 14px;color:rgba(255,255,255,0.7);">Official merch — proceeds support the artist directly. Free shipping on orders over 500 DKK.</p>' +
            '<div class="merch-grid">' + items + addTile + '</div>' +
            '<div class="shop-cart is-empty" data-shop-cart></div>';
        actsEl.innerHTML = '<button type="button" class="release-modal__btn" data-shop-close>Close</button>';
        updateCart();
    }

    // -------------- Cart logic --------------
    function selectedSize(itemId) {
        const item = loadMerch().find(function(i) { return i.id === itemId; });
        if (!item || !item.sizes.length) return null;
        const card = modal.querySelector('[data-shop-item="' + itemId + '"]');
        if (!card) return null;
        const sel = card.querySelector('.merch-item__size.is-selected');
        return sel ? sel.textContent.trim() : null;
    }

    function addToCart(itemId) {
        const item = loadMerch().find(function(i) { return i.id === itemId; });
        if (!item) return;
        const size = selectedSize(itemId);
        if (item.sizes.length && !size) {
            // Highlight the size selector to prompt user
            const card = modal.querySelector('[data-shop-item="' + itemId + '"]');
            if (card) {
                const sizes = card.querySelector('.merch-item__sizes');
                if (sizes) {
                    sizes.style.outline = '2px solid #FF6A55';
                    setTimeout(function() { sizes.style.outline = ''; }, 1200);
                }
            }
            return;
        }
        cart.push({ itemId: item.id, name: item.name, price: item.price, size: size, qty: 1 });
        const btn = modal.querySelector('[data-shop-add="' + itemId + '"]');
        if (btn) {
            btn.classList.add('is-added');
            btn.textContent = 'Added ✓';
            setTimeout(function() {
                btn.classList.remove('is-added');
                btn.textContent = 'Add to cart';
            }, 1500);
        }
        updateCart();
    }

    function updateCart() {
        const cartEl = modal.querySelector('[data-shop-cart]');
        if (!cartEl) return;
        if (!cart.length) {
            cartEl.classList.add('is-empty');
            cartEl.innerHTML = '';
            return;
        }
        cartEl.classList.remove('is-empty');
        const total = cart.reduce(function(sum, x) { return sum + x.price * x.qty; }, 0);
        const itemCount = cart.reduce(function(sum, x) { return sum + x.qty; }, 0);
        cartEl.innerHTML =
            '<span class="shop-cart__summary"><strong>' + itemCount + ' item' + (itemCount === 1 ? '' : 's') + '</strong> in cart</span>' +
            '<span class="shop-cart__total">' + total + ' DKK</span>' +
            '<button type="button" class="shop-cart__checkout" data-shop-checkout>Checkout →</button>';
    }

    // -------------- Add product flow --------------
    let pendingProductImage = '';
    let pendingProductSizes = [];

    function showAddProductForm() {
        const titleEl = modal.querySelector('[data-shop-title]');
        const bodyEl = modal.querySelector('[data-shop-body]');
        const actsEl = modal.querySelector('[data-shop-actions]');
        pendingProductImage = PRODUCT_IMAGE_POOL[0];
        pendingProductSizes = [];
        titleEl.textContent = 'Add new product';
        bodyEl.innerHTML =
            '<p class="ar-page-intro" style="margin:0 0 18px;color:rgba(255,255,255,0.7);">Add a new item to your merchandise list. Fill in the details below — the product will appear in the shop immediately.</p>' +
            '<form class="resources-add-form" data-shop-add-form autocomplete="off">' +
                '<div class="resources-add-form__field">' +
                    '<label class="stage-filter__label">Product name</label>' +
                    '<input type="text" class="stage-filter__control" data-shop-input-name placeholder="e.g. Tour Mug · Late Cellar Set"/>' +
                '</div>' +
                '<div class="resources-add-form__field">' +
                    '<label class="stage-filter__label">Price (DKK)</label>' +
                    '<input type="number" class="stage-filter__control" data-shop-input-price placeholder="280" min="1" step="1"/>' +
                '</div>' +
                '<div class="resources-add-form__field">' +
                    '<label class="stage-filter__label">Product image</label>' +
                    '<div class="avatar-picker" data-shop-image-picker>' +
                        PRODUCT_IMAGE_POOL.map(function(img, i) {
                            const sel = i === 0 ? ' is-selected' : '';
                            return '<button type="button" class="avatar-picker__option' + sel + '" data-shop-pick-image="' + SC.escapeAttr(img) + '" style="background-image: url(\'../assets/images/artists/' + img + '\'); border-radius: 8px; aspect-ratio: 1/1; height: auto; width: 100%;" aria-label="Product image"></button>';
                        }).join('') +
                    '</div>' +
                '</div>' +
                '<div class="resources-add-form__field">' +
                    '<label class="stage-filter__label">Sizes (optional)</label>' +
                    '<div class="chip-row" data-shop-size-picker>' +
                        ['XS','S','M','L','XL','XXL','One size'].map(function(s) {
                            return '<button type="button" class="chip" data-shop-toggle-size="' + SC.escapeAttr(s) + '">' + SC.escapeHtml(s) + '</button>';
                        }).join('') +
                    '</div>' +
                    '<span style="font-size:11px;color:rgba(255,255,255,0.5);margin-top:4px;">Click sizes to include them. Leave all unchecked for items without sizes (e.g. posters, vinyl).</span>' +
                '</div>' +
            '</form>' +
            '<div class="reassign-confirm-banner" data-shop-add-error hidden style="background:rgba(255,106,85,0.1);border-color:rgba(255,106,85,0.4);"></div>';
        actsEl.innerHTML =
            '<button type="button" class="release-modal__btn" data-shop-add-cancel>Cancel</button>' +
            '<button type="button" class="release-modal__btn release-modal__btn--primary" data-shop-add-submit>Add to shop</button>';
    }

    function submitAddProduct() {
        const nameEl = modal.querySelector('[data-shop-input-name]');
        const priceEl = modal.querySelector('[data-shop-input-price]');
        const errEl = modal.querySelector('[data-shop-add-error]');
        const name = (nameEl.value || '').trim();
        const price = parseInt(priceEl.value, 10);
        if (!name) {
            errEl.hidden = false;
            errEl.innerHTML = '<strong style="color:#FF6A55;">Product name is required.</strong>';
            return;
        }
        if (!price || price < 1) {
            errEl.hidden = false;
            errEl.innerHTML = '<strong style="color:#FF6A55;">Enter a valid price (DKK).</strong>';
            return;
        }
        const newProduct = {
            id: 'm' + Date.now(),
            name: name,
            price: price,
            image: pendingProductImage,
            sizes: pendingProductSizes.slice()
        };
        saveCustomMerch(newProduct);
        // Re-render the merch grid to show the new product
        renderMerch();
    }

    function showCheckoutConfirm(items, totalPrice, isTicket) {
        const titleEl = modal.querySelector('[data-shop-title]');
        const bodyEl = modal.querySelector('[data-shop-body]');
        const actsEl = modal.querySelector('[data-shop-actions]');
        titleEl.textContent = 'Order confirmed';
        const itemsList = items.map(function(it) {
            const sizeStr = it.size ? ' · ' + it.size : '';
            return '<li>' + SC.escapeHtml(it.name) + sizeStr + ' — <strong>' + it.price + ' DKK</strong></li>';
        }).join('');
        bodyEl.innerHTML =
            '<div class="shop-confirm">' +
                '<strong>✓ Thanks for your order!</strong>' +
                '<p style="margin:8px 0 0;">Your ' + (isTicket ? 'ticket' : 'order') + ' has been confirmed. ' +
                (isTicket
                    ? 'Your ticket QR code has been emailed and added to your STAGECORD wallet — find it under <em>Concerts</em> in the sidebar.'
                    : 'A confirmation email is on its way and the items will ship within 3–5 business days.') +
                '</p>' +
                '<ul style="margin:14px 0 0;padding-left:20px;color:rgba(255,255,255,0.85);font-size:13px;line-height:1.6;">' +
                    itemsList +
                '</ul>' +
                '<p style="margin:14px 0 0;color:#43C47A;font-weight:700;">Total: ' + totalPrice + ' DKK</p>' +
            '</div>';
        actsEl.innerHTML = '<button type="button" class="release-modal__btn release-modal__btn--primary" data-shop-close>Done</button>';
    }

    // -------------- Click delegation --------------
    document.addEventListener('click', function(e) {
        if (typeof helpActive !== 'undefined' && helpActive) return;

        // Open modals from artist hero CTAs
        if (e.target.closest('.artist-cta--tickets')) { openModal('tickets'); return; }
        if (e.target.closest('.artist-cta--merch'))   { openModal('merch'); return; }

        if (!modal || !modal.classList.contains('open')) return;

        // Close
        if (e.target.closest('[data-shop-close]')) { closeModal(); return; }
        if (e.target === modal) { closeModal(); return; }

        // Tickets — buy a physical ticket
        const buyTicket = e.target.closest('[data-shop-buy-ticket]');
        if (buyTicket) {
            const id = buyTicket.getAttribute('data-shop-buy-ticket');
            const event = TICKET_EVENTS.find(function(x) { return x.id === id; });
            if (event) {
                showCheckoutConfirm([{ name: event.venue + ' · ' + event.city, price: event.price }], event.price, true);
            }
            return;
        }

        // Tickets — viewer-pass purchase
        const buyViewer = e.target.closest('[data-shop-buy-viewer]');
        if (buyViewer) {
            const id = buyViewer.getAttribute('data-shop-buy-viewer');
            const event = TICKET_EVENTS.find(function(x) { return x.id === id; });
            if (event) {
                showCheckoutConfirm([{ name: 'Online Concert Pass · ' + event.venue, price: event.viewerPrice }], event.viewerPrice, true);
            }
            return;
        }

        // Merch — size pick
        const sizeBtn = e.target.closest('[data-shop-size]');
        if (sizeBtn) {
            const card = sizeBtn.closest('.merch-item');
            if (card) {
                card.querySelectorAll('.merch-item__size').forEach(function(s) {
                    s.classList.toggle('is-selected', s === sizeBtn);
                });
            }
            return;
        }

        // Merch — add to cart
        const addBtn = e.target.closest('[data-shop-add]');
        if (addBtn) {
            addToCart(addBtn.getAttribute('data-shop-add'));
            return;
        }

        // Merch — checkout
        if (e.target.closest('[data-shop-checkout]')) {
            const total = cart.reduce(function(sum, x) { return sum + x.price * x.qty; }, 0);
            showCheckoutConfirm(cart.slice(), total, false);
            cart.length = 0;
            return;
        }

        // Add product — open form
        if (e.target.closest('[data-shop-add-product]')) {
            showAddProductForm();
            return;
        }
        // Add product — cancel back to merch grid
        if (e.target.closest('[data-shop-add-cancel]')) {
            renderMerch();
            return;
        }
        // Add product — submit
        if (e.target.closest('[data-shop-add-submit]')) {
            submitAddProduct();
            return;
        }
        // Add product — image pick
        const imagePick = e.target.closest('[data-shop-pick-image]');
        if (imagePick) {
            pendingProductImage = imagePick.getAttribute('data-shop-pick-image');
            modal.querySelectorAll('[data-shop-pick-image]').forEach(function(el) {
                el.classList.toggle('is-selected', el === imagePick);
            });
            return;
        }
        // Add product — size toggle
        const sizeToggle = e.target.closest('[data-shop-toggle-size]');
        if (sizeToggle) {
            const s = sizeToggle.getAttribute('data-shop-toggle-size');
            const idx = pendingProductSizes.indexOf(s);
            if (idx === -1) pendingProductSizes.push(s);
            else pendingProductSizes.splice(idx, 1);
            sizeToggle.classList.toggle('is-active', pendingProductSizes.indexOf(s) !== -1);
            return;
        }
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal && modal.classList.contains('open')) closeModal();
    });
})();
