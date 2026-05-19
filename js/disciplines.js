(function () {
    const DISCIPLINES = [
        { slug: 'vocalist', label: 'Vocalist' },
        { slug: 'songwriter', label: 'Songwriter' },
        { slug: 'composer', label: 'Composer' },
        { slug: 'producer', label: 'Producer' },
        { slug: 'dj-beatmaker', label: 'DJ / Beatmaker' },
        { slug: 'guitarist', label: 'Guitarist' },
        { slug: 'bassist', label: 'Bassist' },
        { slug: 'drummer', label: 'Drummer' },
        { slug: 'pianist', label: 'Pianist / Keyboardist' },
        { slug: 'multi-instrumentalist', label: 'Multi-instrumentalist' },
        { slug: 'dancer', label: 'Dancer' },
        { slug: 'choreographer', label: 'Choreographer' },
        { slug: 'comedian', label: 'Comedian' },
        { slug: 'podcaster', label: 'Podcaster' },
        { slug: 'visual-artist', label: 'Visual artist' },
        { slug: 'filmmaker', label: 'Filmmaker / Videographer' },
        { slug: 'photographer', label: 'Photographer' }
    ];

    const labelBySlug = new Map(DISCIPLINES.map((d) => [d.slug, d.label]));

    function labelFor(slug) {
        return labelBySlug.get(slug) || slug;
    }

    function isValidSlug(slug) {
        return labelBySlug.has(slug);
    }

    function sanitize(slugs) {
        if (!Array.isArray(slugs)) return [];
        const seen = new Set();
        const out = [];
        for (const s of slugs) {
            if (typeof s !== 'string') continue;
            if (!isValidSlug(s)) continue;
            if (seen.has(s)) continue;
            seen.add(s);
            out.push(s);
        }
        return out;
    }

    window.STAGECORD = window.STAGECORD || {};
    window.STAGECORD.DISCIPLINES = DISCIPLINES;
    window.STAGECORD.labelForDiscipline = labelFor;
    window.STAGECORD.sanitizeDisciplines = sanitize;
})();
