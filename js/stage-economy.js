// STAGECORD PRO — Label Economy page (/manager/economy/)
// Aggregates per-artist revenue across the full label roster, breaks it down
// by source, and lists top earners + recent payouts. Reads STAFF/ARTISTS
// data exposed by stage-label.js via window.__SC_LABEL_*.

// ============================================================
// Label Economy page — aggregated revenue overview
// ============================================================
// Generates plausible per-artist revenue data deterministically (so
// the same artist always shows the same numbers), splits by source
// (Streams / Sales / Covers / Brands / Concerts / Sync), applies a
// rough label-share heuristic, and renders KPIs + breakdown tables.
(function() {
    if (window.location.pathname.indexOf('/manager/economy/') === -1) return;

    const SOURCES = [
        { id: 'streams',  label: 'Streams' },
        { id: 'sales',    label: 'Sales' },
        { id: 'sync',     label: 'Sync licensing' },
        { id: 'brands',   label: 'Brand deals' },
        { id: 'concerts', label: 'Concerts / Live' },
        { id: 'covers',   label: 'Cover royalties' }
    ];

    const PERIOD_MULTIPLIERS = {
        '30d': 0.08,
        '90d': 0.25,
        'ytd': 1.0,
        'all': 4.5
    };

    let currentPeriod = 'ytd';

    // Hash-based pseudo-random so each artist gets stable revenue numbers.
    function hash(str) {
        let h = 2166136261 >>> 0;
        for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = Math.imul(h, 16777619) >>> 0;
        }
        return h;
    }

    // The ARTISTS array is defined in the label-stage IIFE later in the file.
    // For the economy page (which only runs on /manager/economy/), we redefine
    // a minimal set here to avoid ordering issues. In a real app this comes
    // from a shared data layer.
    function getArtists() {
        // The label-stage module hydrates STAFF/ARTISTS into closure scope only.
        // For demo we recreate the artist names + assignment from a small subset
        // — economy is illustrative, not the source of truth.
        return [
            'a1','a2','a3','a4','a5','a6','a7','a8','a9','a10','a11','a12','a13','a14',
            'a15','a16','a17','a18','a19','a20','a21','a22','a23','a24','a25','a26','a27',
            'a28','a29','a30','a31','a32','a33','a34','a35','a36','a37','a38','a39','a40',
            'a41','a42','a43','a44','a45','a46','a47','a48','a49','a50','a51','a52','a53',
            'a54','a55','a56','a57','a58','a59','a60','a61','a62','a63','a64','a65','a66',
            'a67','a68','a69','a70','a71','a72','a73','a74','a75','a76','a77','a78','a79','a80','a81'
        ];
    }

    // The label-stage module exposes ARTISTS via window for cross-page access.
    function readArtistsFromLabelStage() {
        return (window.__SC_LABEL_ARTISTS || []).slice();
    }

    function generateRevenue(artistId) {
        const seed = hash(artistId);
        let s = seed || 1;
        function rnd() {
            s = (s * 1664525 + 1013904223) >>> 0;
            return s / 4294967296;
        }
        // Each artist has a "scale" — some are much bigger earners than others.
        const scale = 0.4 + Math.pow(rnd(), 2.4) * 4.0;  // skewed: most small, few huge
        return {
            streams:  Math.floor((rnd() * 40000  + 8000)  * scale),
            sales:    Math.floor((rnd() * 18000  + 3000)  * scale),
            sync:     Math.floor((rnd() * 30000  + 0)     * scale * (rnd() > 0.55 ? 1 : 0)),
            brands:   Math.floor((rnd() * 60000  + 0)     * scale * (rnd() > 0.65 ? 1 : 0)),
            concerts: Math.floor((rnd() * 80000  + 0)     * scale * (rnd() > 0.40 ? 1 : 0)),
            covers:   Math.floor((rnd() * 8000   + 500)   * scale)
        };
    }

    // Rough label-share per source. Real splits depend on contract template
    // (traditional vs 50-50 vs 360 vs artist-owned). We use mid-range heuristics
    // here since the per-artist contract template isn't accessible from this
    // context without refactoring.
    const LABEL_SHARE = {
        streams:  0.55,  // label takes ~55% on average
        sales:    0.55,
        sync:     0.45,  // joint approval, often 50-50
        brands:   0.25,  // mostly artist
        concerts: 0.10,  // mostly artist + manager
        covers:   0.30
    };

    function fmtUSD(amount) {
        if (amount >= 1000000) return (amount / 1000000).toFixed(2) + 'M USD';
        if (amount >= 1000)    return (amount / 1000).toFixed(0) + 'K USD';
        return amount + ' USD';
    }
    function fmtUSDFull(amount) {
        return amount.toLocaleString('en-US', { maximumFractionDigits: 0 }) + ' USD';
    }

    function buildKPIs(totals) {
        const labelShare = totals.totalLabel;
        const artistShare = totals.totalArtist;
        const totalRevenue = labelShare + artistShare;
        const pendingPayouts = Math.floor(artistShare * 0.18);

        return [
            {
                label: 'Total revenue',
                value: fmtUSDFull(totalRevenue),
                delta: '+12.4% vs prior period',
                deltaClass: 'up',
                accent: true
            },
            {
                label: "Label's share",
                value: fmtUSDFull(labelShare),
                delta: ((labelShare / totalRevenue) * 100).toFixed(1) + '% of total revenue',
                deltaClass: ''
            },
            {
                label: "Artists' share",
                value: fmtUSDFull(artistShare),
                delta: 'Distributed across ' + totals.artistCount + ' artists',
                deltaClass: ''
            },
            {
                label: 'Pending payouts',
                value: fmtUSDFull(pendingPayouts),
                delta: 'Next disbursement: 1st of next month',
                deltaClass: ''
            }
        ].map(function(k) {
            return '<div class="economy-kpi' + (k.accent ? ' economy-kpi--accent' : '') + '" data-help="' + SC.escapeAttr(k.label + '. ' + k.delta) + '">' +
                '<div class="economy-kpi__label">' + SC.escapeHtml(k.label) + '</div>' +
                '<div class="economy-kpi__value">' + SC.escapeHtml(k.value) + '</div>' +
                '<div class="economy-kpi__delta' + (k.deltaClass ? ' economy-kpi__delta--' + k.deltaClass : '') + '">' + SC.escapeHtml(k.delta) + '</div>' +
            '</div>';
        }).join('');
    }

    function buildSources(sourceTotals, totalLabel) {
        return SOURCES.map(function(src) {
            const amount = sourceTotals[src.id] || 0;
            const pct = totalLabel > 0 ? (amount / totalLabel * 100) : 0;
            return '<div class="revenue-source revenue-source--' + src.id + '">' +
                '<div class="revenue-source__row">' +
                    '<span class="revenue-source__name">' + SC.escapeHtml(src.label) + '</span>' +
                    '<span class="revenue-source__amount">' + fmtUSDFull(amount) + '<span class="revenue-source__amount-meta">' + pct.toFixed(1) + '%</span></span>' +
                '</div>' +
                '<div class="revenue-source__bar"><div class="revenue-source__bar-fill" style="width:' + pct.toFixed(1) + '%;"></div></div>' +
            '</div>';
        }).join('');
    }

    function buildTopArtists(rows) {
        return rows.slice(0, 10).map(function(r, i) {
            return '<div class="top-artist-row" data-help="' + SC.escapeAttr(r.name + ' contributed ' + fmtUSDFull(r.labelShare) + ' to the label this period (' + fmtUSDFull(r.total) + ' total revenue, label took ' + ((r.labelShare / r.total) * 100).toFixed(0) + '%).') + '">' +
                '<span class="top-artist-row__rank">#' + (i + 1) + '</span>' +
                '<div>' +
                    '<div class="top-artist-row__name auto-name">' + SC.escapeHtml(r.name) + '</div>' +
                    '<div class="top-artist-row__meta">' + SC.escapeHtml(r.genre) + ' · total ' + fmtUSDFull(r.total) + '</div>' +
                '</div>' +
                '<span class="top-artist-row__amount">' + fmtUSDFull(r.labelShare) + '</span>' +
            '</div>';
        }).join('');
    }

    function buildPayouts(rows) {
        // Generate 10 fake recent payouts mixing top artists + random sources
        const payouts = [];
        const sourcesArr = ['Streams', 'Sales', 'Sync licensing', 'Brand deal', 'Concert revenue', 'Cover royalty'];
        for (let i = 0; i < 10; i++) {
            const r = rows[i % rows.length];
            const src = sourcesArr[i % sourcesArr.length];
            const amount = Math.floor((r.labelShare / 12) * (0.4 + (i % 3) * 0.3));
            const status = i < 3 ? 'pending' : 'paid';
            const daysAgo = i < 3 ? 0 : i * 4;
            const date = new Date(Date.now() - daysAgo * 86400000);
            payouts.push({
                date: date.toLocaleDateString('en-US', { day: '2-digit', month: 'short' }),
                artist: r.name,
                source: src,
                amount: amount,
                status: status
            });
        }
        return payouts.map(function(p) {
            return '<div class="payout-row" data-help="' + SC.escapeAttr(p.artist + ' · ' + p.source + ' · ' + fmtUSDFull(p.amount) + ' · ' + (p.status === 'paid' ? 'Paid' : 'Scheduled but not yet disbursed')) + '">' +
                '<span class="payout-row__date">' + p.date + '</span>' +
                '<div class="payout-row__main">' +
                    '<div class="payout-row__artist auto-name">' + SC.escapeHtml(p.artist) + '</div>' +
                    '<div class="payout-row__source">' + SC.escapeHtml(p.source) + '</div>' +
                '</div>' +
                '<span class="payout-row__amount">' + fmtUSDFull(p.amount) + '</span>' +
                '<span class="payout-row__status payout-row__status--' + p.status + '">' + (p.status === 'paid' ? 'Paid' : 'Pending') + '</span>' +
            '</div>';
        }).join('');
    }

    function compute(artists) {
        const mul = PERIOD_MULTIPLIERS[currentPeriod] || 1.0;
        const sourceTotals = { streams:0, sales:0, sync:0, brands:0, concerts:0, covers:0 };
        let totalLabel = 0, totalArtist = 0;
        const rows = artists.map(function(a) {
            const rev = generateRevenue(a.id);
            let labelShare = 0;
            let total = 0;
            Object.keys(rev).forEach(function(src) {
                const scaled = Math.floor(rev[src] * mul);
                rev[src] = scaled;
                const ls = Math.floor(scaled * LABEL_SHARE[src]);
                sourceTotals[src] += ls;
                labelShare += ls;
                total += scaled;
            });
            totalLabel += labelShare;
            totalArtist += (total - labelShare);
            return { id: a.id, name: a.name, genre: a.genre, rev: rev, labelShare: labelShare, total: total };
        });
        rows.sort(function(a, b) { return b.labelShare - a.labelShare; });
        return {
            rows: rows,
            sourceTotals: sourceTotals,
            totalLabel: totalLabel,
            totalArtist: totalArtist,
            artistCount: artists.length
        };
    }

    function render() {
        const artists = readArtistsFromLabelStage();
        if (!artists.length) {
            // Fallback if label-stage hasn't exposed yet — try after a tick
            setTimeout(render, 50);
            return;
        }
        const data = compute(artists);
        document.querySelectorAll('[data-economy-roster-count]').forEach(function(el) { el.textContent = data.artistCount; });
        document.querySelector('[data-economy-kpis]').innerHTML = buildKPIs(data);
        document.querySelector('[data-economy-sources]').innerHTML = buildSources(data.sourceTotals, data.totalLabel);
        document.querySelector('[data-economy-top-artists]').innerHTML = buildTopArtists(data.rows);
        document.querySelector('[data-economy-payouts]').innerHTML = buildPayouts(data.rows);
        if (typeof formatAllNames === 'function') formatAllNames(document);
    }

    document.addEventListener('click', function(e) {
        const pill = e.target.closest('[data-economy-period]');
        if (!pill) return;
        currentPeriod = pill.getAttribute('data-economy-period');
        document.querySelectorAll('[data-economy-period]').forEach(function(p) {
            p.classList.toggle('is-active', p === pill);
        });
        render();
    });

    document.addEventListener('DOMContentLoaded', render);
    if (document.readyState !== 'loading') render();
})();
