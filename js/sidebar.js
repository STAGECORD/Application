// STAGECORD PRO — sidebar navigation
// Each page leaves <aside data-sidebar></aside> empty; this module fills it
// with mode-aware nav items based on current Viewing-as profile.

// ============================================================
// Sidebar — single source of truth, injected into <aside data-sidebar>
// ============================================================
// Each page leaves an empty <aside class="sidebar" data-sidebar></aside>
// placeholder; this module fills it with the full nav. Hrefs are
// depth-aware via localAsset(); active state is derived from pathname.
// Runs synchronously at script load (app.js sits at end of <body>) so
// later DOM queries against profile/nav elements still work.
(function() {
    const NAV_ITEMS = [
        { slug: 'projects',     label: 'Projects',     href: 'projects/index.html',          hideModes: 'fan venue licensor sponsor manager ar educator',
          help: 'Projects: Administrer alle dine musik- og kreative projekter. Opret nye projekter, tilføj samarbejdspartnere, og følg status fra idé til release.',
          icon: '<svg class="nav-icon" width="19" height="19" viewBox="0 0 16 16" fill="none"><path d="M2 3.75C2 2.784 2.784 2 3.75 2h8.5c.966 0 1.75.784 1.75 1.75v8.5A1.75 1.75 0 0112.25 14h-8.5A1.75 1.75 0 012 12.25v-8.5z" fill="currentColor"/></svg>' },
        { slug: 'discover',     label: 'Discover',     href: '#discover-stub',                modes: 'licensor sponsor manager ar educator',
          help: 'Discover: Find ny musik, kunstnere og komponister kurateret til din Stage. Anbefalinger baseret på dine projekter og tidligere deals.',
          icon: '<svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M14.5 9.5l-5 1-1 5 5-1 1-5z" fill="currentColor"/></svg>' },
        { slug: 'overview',     label: 'Overview',     href: 'overview/index.html',
          help: 'Overview: Få et samlet overblik over din aktivitet — streaming-tal, aktive projekter og nye beskeder på ét dashboard.',
          icon: '<svg class="nav-icon" width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M12 3v18M3 12h18" stroke="currentColor" stroke-width="2"/></svg>' },
        { slug: 'explore',      label: 'Explore',      href: 'explore/index.html',           hideModes: 'licensor sponsor manager ar educator',
          help: 'Explore: Dit personlige feed med opslag fra venner og fra de artister og venues du følger. Kun offentlige opslag — friends-only opslag fra venner du ikke er ven med, vises ikke.',
          icon: '<svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2"/><path d="M14.5 9.5l-5 1-1 5 5-1 1-5z" fill="currentColor"/></svg>' },
        { slug: 'catalog',      label: 'Projects',     href: 'licensor/index.html',           modes: 'licensor',
          help: 'Projects: Dine film/serie-projekter. Klik et projekt for at se team, pitches, songs approved og budget.',
          icon: '<svg class="nav-icon" width="19" height="19" viewBox="0 0 16 16" fill="none"><path d="M2 3.75C2 2.784 2.784 2 3.75 2h8.5c.966 0 1.75.784 1.75 1.75v8.5A1.75 1.75 0 0112.25 14h-8.5A1.75 1.75 0 012 12.25v-8.5z" fill="currentColor"/></svg>' },
        { slug: 'sponsorships', label: 'Projects',     href: 'sponsor/index.html',            modes: 'sponsor',
          help: 'Projects: Dine brand-kampagner og events. Klik et projekt for at se setlist, performance-data, sponsor-deals og songs approved.',
          icon: '<svg class="nav-icon" width="19" height="19" viewBox="0 0 16 16" fill="none"><path d="M2 3.75C2 2.784 2.784 2 3.75 2h8.5c.966 0 1.75.784 1.75 1.75v8.5A1.75 1.75 0 0112.25 14h-8.5A1.75 1.75 0 012 12.25v-8.5z" fill="currentColor"/></svg>' },
        { slug: 'roster',       label: 'Roster',       href: 'manager/index.html',            modes: 'manager',
          help: 'Roster: Dit label-team — A&R, managers, PR. Hver person har et antal artister tilknyttet — klik for at se deres roster.',
          icon: '<svg class="nav-icon" width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="7" r="3" stroke="currentColor" stroke-width="1.8"/><path d="M5 21c0-3.3 3.1-6 7-6s7 2.7 7 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M3 13h2M19 13h2M12 2v2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>' },
        { slug: 'ar-roster',    label: 'My Roster',    href: 'ar/index.html',                 modes: 'ar',
          help: 'My Roster: De artister du som A&R er blevet tildelt af labelet. Klik en artist for at åbne deres profil — du kan agere på vegne af artisten med en "udført af A&R"-indikator synlig kun for ejeren.',
          icon: '<svg class="nav-icon" width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="7" r="3" stroke="currentColor" stroke-width="1.8"/><path d="M5 21c0-3.3 3.1-6 7-6s7 2.7 7 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>' },
        { slug: 'composers',    label: 'Composers',    href: '#composers-stub',               modes: 'licensor',
          help: 'Composers: Søg blandt komponister du kan booke til at skrive original musik til dine projekter. Filter på genre, budget, tempo, tidligere arbejde.',
          icon: '<svg class="nav-icon" width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M9 17V5l11-2v12" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="6" cy="18" r="3" stroke="currentColor" stroke-width="1.8"/><circle cx="17" cy="15" r="3" stroke="currentColor" stroke-width="1.8"/></svg>' },
        { slug: 'songs',        label: 'Songs',        href: '#songs-stub',                   modes: 'licensor sponsor',
          help: 'Songs: Søg eksisterende sange til synch-licensing. Filter på title, artist, genre, tempo, year og lyric-keywords.',
          icon: '<svg class="nav-icon" width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M3 5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5z" stroke="currentColor" stroke-width="1.8"/><path d="M16 3v5h5" stroke="currentColor" stroke-width="1.8"/><circle cx="9" cy="14" r="2.5" stroke="currentColor" stroke-width="1.8"/><path d="M11 14v-4l5-1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>' },
        { slug: 'stage-artists',label: 'Artists',      href: '#stage-artists-stub',           modes: 'sponsor manager ar',
          help: 'Artists: Søg artister du kan booke til live-events, kampagner eller signe til labelet.',
          icon: '<svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="2"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' },
        { slug: 'label-pitch',  label: 'Pitch',        href: '#label-pitch-stub',             modes: 'manager ar',
          help: 'Pitch: Indkomne pitches fra artister der ønsker at signe til labelet, samt udgående pitches fra dine artister til radio og kuratorer.',
          icon: '<svg class="nav-icon" width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M3 12l5-5v3h13v4H8v3l-5-5z" fill="currentColor"/></svg>' },
        { slug: 'resources',    label: 'Resources',    href: 'resources/index.html',          modes: 'licensor sponsor manager',
          help: 'Resources: Pool of email accounts the company has provisioned. Used to create internal profiles (A&R/Manager/PR) or invite freelancers. Visible only to company administrators.',
          icon: '<svg class="nav-icon" width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5v-11z" stroke="currentColor" stroke-width="1.6"/><path d="M8 9h8M8 12h8M8 15h5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>' },
        { slug: 'economy',      label: 'Economy',      href: 'manager/economy/index.html',    modes: 'manager',
          help: 'Economy: Label-wide financial overview — total revenue, label vs artist cuts, top earning artists, pending payouts. Aggregated across your entire roster.',
          icon: '<svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>' },
        { slug: 'edu-profile',  label: 'My profile',   href: 'educator/index.html',           modes: 'educator',
          help: 'My profile: Your public educator page — bio, specialties, pricing, availability, demo videos. This is what students see when they find you.',
          icon: '<svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="2"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' },
        { slug: 'edu-bookings', label: 'Bookings',     href: 'educator/bookings/index.html',  modes: 'educator',
          help: 'Bookings: Upcoming lessons, pending booking requests from students, and past lesson history.',
          icon: '<svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" stroke-width="1.8"/><path d="M3 9h18M8 3v4M16 3v4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>' },
        { slug: 'edu-students', label: 'Students',     href: 'educator/students/index.html',  modes: 'educator',
          help: 'Students: Active students you teach, with their focus areas, recent practice, and progress through your assigned video material.',
          icon: '<svg class="nav-icon" width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="8" r="3.2" stroke="currentColor" stroke-width="1.8"/><circle cx="17" cy="9" r="2.6" stroke="currentColor" stroke-width="1.8"/><path d="M3 19c0-3 2.7-5 6-5s6 2 6 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M14 16.5c1-1 2.4-1.5 3.8-1.5 1.6 0 3 0.7 3.7 1.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>' },
        { slug: 'edu-materials',label: 'Materials',    href: 'educator/materials/index.html', modes: 'educator',
          help: 'Materials: Your video library — exercises, technique demos, lesson recordings. Assign videos to students so they can build their practice plan.',
          icon: '<svg class="nav-icon" width="22" height="16" viewBox="0 0 51 36" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M30 0H9C6.61 0 4.32 0.95 2.64 2.64C0.95 4.32 0 6.61 0 9V27C0 29.39 0.95 31.68 2.64 33.36C4.32 35.05 6.61 36 9 36H30C32.39 36 34.68 35.05 36.36 33.36C38.05 31.68 39 29.39 39 27V9C39 6.61 38.05 4.32 36.36 2.64C34.68 0.95 32.39 0 30 0ZM6 9C6 8.20 6.32 7.44 6.88 6.88C7.44 6.32 8.20 6 9 6H30C30.80 6 31.56 6.32 32.12 6.88C32.68 7.44 33 8.20 33 9V27C33 27.80 32.68 28.56 32.12 29.12C31.56 29.68 30.80 30 30 30H9C8.20 30 7.44 29.68 6.88 29.12C6.32 28.56 6 27.80 6 27V9Z" fill="currentColor"/><path d="M46 4l-10 7v14l10 7V4z" fill="currentColor"/></svg>' },
        { slug: 'inbox',        label: 'Inbox',        href: 'inbox/index.html',              modes: 'artist licensor sponsor manager venue ar educator',
          help: 'Inbox: Beskeder, kontrakt-forhandlinger og samtaler med samarbejdspartnere.',
          icon: '<svg class="nav-icon" width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v8A2.5 2.5 0 0 1 17.5 17H10l-4 3.5V17H6.5A2.5 2.5 0 0 1 4 14.5v-8z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>' },
        { slug: 'streaming',    label: 'Streaming',    href: 'streaming/index.html',          modes: 'fan',
          help: 'Streaming: Live koncerter, on-demand video og audio sessions fra hele platformen.',
          icon: '<svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M5 4.5l11 7.5L5 19.5z" fill="currentColor"/><circle cx="20" cy="5" r="1.5" fill="currentColor"/></svg>' },
        { slug: 'concerts',     label: 'Concerts',     href: 'concerts/index.html',           modes: 'fan',
          help: 'Concerts: Mine billetter — kommende koncerter, online concert passes og tidligere shows jeg har været til.',
          icon: '<svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 8a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2a2 2 0 0 0 0-4V8z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M10 6v12" stroke="currentColor" stroke-width="2" stroke-dasharray="2 2"/></svg>' },
        { slug: 'collabs',      label: 'Collabs',      href: 'collabs/index.html',            hideModes: 'fan licensor sponsor manager ar educator',
          help: 'Collabs: Se og håndter samarbejder med andre artister, producere og skrivere. Godkend anmodninger og forhandl vilkår direkte.',
          icon: '<svg class="nav-icon" width="21" height="21" viewBox="0 0 21 21" fill="none"><path d="M3.9375 13.7813V13.125H2.625V13.7813C2.625 14.9996 3.10898 16.168 3.97048 17.0295C4.83197 17.891 6.00041 18.375 7.21875 18.375H9.1875V17.0625H7.21875C6.34851 17.0625 5.51391 16.7168 4.89856 16.1014C4.2832 15.4861 3.9375 14.6515 3.9375 13.7813ZM15.75 7.21875V7.875H17.0625V7.21875C17.0625 6.00041 16.5785 4.83197 15.717 3.97048C14.8555 3.10898 13.6871 2.625 12.4688 2.625H10.5V3.9375H12.4688C12.8996 3.9375 13.3263 4.02237 13.7244 4.18727C14.1225 4.35217 14.4843 4.59386 14.7889 4.89856C15.0936 5.20325 15.3353 5.56497 15.5002 5.96307C15.6651 6.36117 15.75 6.78785 15.75 7.21875ZM7.21875 7.21875H3.28125C2.75911 7.21875 2.25835 7.42617 1.88913 7.79538C1.51992 8.1646 1.3125 8.66536 1.3125 9.1875V10.5H2.625V9.1875C2.625 9.01345 2.69414 8.84653 2.81721 8.72346C2.94028 8.60039 3.1072 8.53125 3.28125 8.53125H7.21875C7.3928 8.53125 7.55972 8.60039 7.68279 8.72346C7.80586 8.84653 7.875 9.01345 7.875 9.1875V10.5H9.1875V9.1875C9.1875 8.66536 8.98008 8.1646 8.61087 7.79538C8.24165 7.42617 7.74089 7.21875 7.21875 7.21875ZM5.25 6.5625C5.76918 6.5625 6.27669 6.40855 6.70837 6.12011C7.14005 5.83167 7.4765 5.4217 7.67518 4.94205C7.87386 4.46239 7.92585 3.93459 7.82456 3.42539C7.72328 2.91619 7.47327 2.44846 7.10616 2.08135C6.73904 1.71423 6.27131 1.46423 5.76211 1.36294C5.25291 1.26165 4.72511 1.31364 4.24546 1.51232C3.7658 1.711 3.35583 2.04745 3.06739 2.47913C2.77895 2.91081 2.625 3.41833 2.625 3.9375C2.625 4.63369 2.90156 5.30137 3.39384 5.79366C3.88613 6.28594 4.55381 6.5625 5.25 6.5625ZM5.25 2.625C5.50959 2.625 5.76335 2.70198 5.97919 2.8462C6.19503 2.99042 6.36325 3.1954 6.46259 3.43523C6.56193 3.67506 6.58792 3.93896 6.53728 4.19356C6.48664 4.44816 6.36163 4.68202 6.17808 4.86558C5.99452 5.04914 5.76066 5.17414 5.50606 5.22478C5.25146 5.27543 4.98756 5.24943 4.74773 5.15009C4.5079 5.05075 4.30292 4.88253 4.1587 4.66669C4.01448 4.45085 3.9375 4.19709 3.9375 3.9375C3.9375 3.5894 4.07578 3.25556 4.32192 3.00942C4.56806 2.76328 4.9019 2.625 5.25 2.625ZM17.7188 16.4063H13.7812C13.2591 16.4063 12.7583 16.6137 12.3891 16.9829C12.0199 17.3521 11.8125 17.8529 11.8125 18.375V19.6875H13.125V18.375C13.125 18.201 13.1941 18.034 13.3172 17.911C13.4403 17.7879 13.6072 17.7188 13.7812 17.7188H17.7188C17.8928 17.7188 18.0597 17.7879 18.1828 17.911C18.3059 18.034 18.375 18.201 18.375 18.375V19.6875H19.6875V18.375C19.6875 17.8529 19.4801 17.3521 19.1109 16.9829C18.7417 16.6137 18.2409 16.4063 17.7188 16.4063ZM13.125 13.125C13.125 13.6442 13.279 14.1517 13.5674 14.5834C13.8558 15.0151 14.2658 15.3515 14.7455 15.5502C15.2251 15.7489 15.7529 15.8008 16.2621 15.6996C16.7713 15.5983 17.239 15.3483 17.6062 14.9812C17.9733 14.614 18.2233 14.1463 18.3246 13.6371C18.4258 13.1279 18.3739 12.6001 18.1752 12.1205C17.9765 11.6408 17.6401 11.2308 17.2084 10.9424C16.7767 10.654 16.2692 10.5 15.75 10.5C15.0538 10.5 14.3861 10.7766 13.8938 11.2688C13.4016 11.7611 13.125 12.4288 13.125 13.125ZM17.0625 13.125C17.0625 13.3846 16.9855 13.6383 16.8413 13.8542C16.6971 14.07 16.4921 14.2383 16.2523 14.3376C16.0124 14.4369 15.7485 14.4629 15.4939 14.4123C15.2393 14.3616 15.0055 14.2366 14.8219 14.0531C14.6384 13.8695 14.5134 13.6357 14.4627 13.3811C14.4121 13.1265 14.4381 12.8626 14.5374 12.6227C14.6367 12.3829 14.805 12.1779 15.0208 12.0337C15.2367 11.8895 15.4904 11.8125 15.75 11.8125C16.0981 11.8125 16.4319 11.9508 16.6781 12.1969C16.9242 12.4431 17.0625 12.7769 17.0625 13.125Z" fill="currentColor"/></svg>' },
        { slug: 'entourage',    label: 'Entourage',    href: 'entourage/index.html',          modes: 'fan',
          help: 'Entourage: Mine grupper af venner som jeg går til koncerter med — opret entourage, godkend gruppe-billetkøb og se delt historik.',
          icon: '<svg class="nav-icon" width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="8" r="3.2" stroke="currentColor" stroke-width="1.8"/><circle cx="17" cy="9" r="2.6" stroke="currentColor" stroke-width="1.8"/><path d="M3 19c0-3 2.7-5 6-5s6 2 6 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M14 16.5c1-1 2.4-1.5 3.8-1.5 1.6 0 3 0.7 3.7 1.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>' },
        { slug: 'artist',       label: 'Artist Page',  href: 'artist/index.html',             hideModes: 'fan venue licensor sponsor manager ar educator',
          help: 'Artist Page: Din offentlige artistside med cover, stats, koncertbilletter og merchandise.',
          icon: '<svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" stroke-width="2"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' },
        { slug: 'venue',        label: 'Venue Page',   href: 'venue/index.html',              hideModes: 'fan licensor sponsor manager ar educator',
          help: 'Venue Page: Den offentlige side for spillestedet med program, kalender og info.',
          icon: '<svg class="nav-icon" width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>' },
        { slug: 'pitch',        label: 'Pitch',        href: 'pitch/index.html',              modes: 'artist venue',
          help: 'Pitch: Send eller modtag pitches mellem artister og venues.',
          icon: '<svg class="nav-icon" width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M3 12l5-5v3h13v4H8v3l-5-5z" fill="currentColor"/></svg>' },
        { slug: 'features',     label: 'Features',     href: 'index.html',                    hideModes: 'fan venue licensor sponsor manager ar educator',
          help: 'Features: Udforsk alle platformens funktioner og hvad de kan.',
          icon: '<svg class="nav-icon" width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" fill="currentColor"/></svg>' },
        { slug: 'sales',        label: 'Sales',        href: 'sales/index.html',              hideModes: 'fan',
          help: 'Sales: Overblik over dine indtægter — royalties, merchandise-salg og koncertbilletter. Eksporter rapporter og følg udbetalinger.',
          icon: '<svg class="nav-icon" width="20" height="15" viewBox="0 0 20 15" fill="none"><path d="M19.3359 13.1524H0.195312C0.0878906 13.1524 0 13.2403 0 13.3478V14.7149C0 14.8224 0.0878906 14.9103 0.195312 14.9103H19.3359C19.4434 14.9103 19.5312 14.8224 19.5312 14.7149V13.3478C19.5312 13.2403 19.4434 13.1524 19.3359 13.1524ZM1.31104 10.0958L2.28027 11.0602C2.35596 11.1358 2.48047 11.1358 2.55615 11.0602L8.28613 5.34971L10.6689 7.7252C10.8157 7.87065 11.014 7.95225 11.2207 7.95225C11.4274 7.95225 11.6257 7.87065 11.7725 7.7252L18.2227 1.29941C18.2983 1.22373 18.2983 1.09922 18.2227 1.02354L17.2534 0.0567384C17.2167 0.0203902 17.1671 0 17.1155 0C17.0638 0 17.0142 0.0203902 16.9775 0.0567384L11.2231 5.79404L8.83789 3.41855C8.69109 3.2731 8.49279 3.1915 8.28613 3.1915C8.07948 3.1915 7.88118 3.2731 7.73437 3.41855L1.31104 9.81992C1.29277 9.83795 1.27827 9.85943 1.26838 9.88311C1.25848 9.90679 1.25338 9.9322 1.25338 9.95786C1.25338 9.98353 1.25848 10.0089 1.26838 10.0326C1.27827 10.0563 1.29277 10.0778 1.31104 10.0958Z" fill="currentColor"/></svg>' },
        { slug: 'videos',       label: 'Videos',       href: 'videos/index.html',
          help: 'Videos: Upload, organisér og del musikvideoer, BTS-klip og livestreams. Giv udvalgte samarbejdspartnere adgang til udkast før release.',
          icon: '<svg class="nav-icon" width="22" height="16" viewBox="0 0 51 36" fill="none"><path fill-rule="evenodd" clip-rule="evenodd" d="M30 0H9C6.61305 0 4.32387 0.948212 2.63604 2.63604C0.948212 4.32387 0 6.61305 0 9V27C0 29.3869 0.948212 31.6761 2.63604 33.364C4.32387 35.0518 6.61305 36 9 36H30C32.3869 36 34.6761 35.0518 36.364 33.364C38.0518 31.6761 39 29.3869 39 27V9C39 6.61305 38.0518 4.32387 36.364 2.63604C34.6761 0.948212 32.3869 0 30 0ZM6 9C6 8.20435 6.31607 7.44129 6.87868 6.87868C7.44129 6.31607 8.20435 6 9 6H30C30.7957 6 31.5587 6.31607 32.1213 6.87868C32.6839 7.44129 33 8.20435 33 9V27C33 27.7957 32.6839 28.5587 32.1213 29.1213C31.5587 29.6839 30.7957 30 30 30H9C8.20435 30 7.44129 29.6839 6.87868 29.1213C6.31607 28.5587 6 27.7957 6 27V9Z" fill="currentColor"/><path fill-rule="evenodd" clip-rule="evenodd" d="M46.3021 3.52801L35.8981 10.671C35.5006 10.9439 35.1747 11.3086 34.948 11.7342C34.7214 12.1599 34.6007 12.6338 34.5961 13.116L34.5001 22.761C34.4954 23.2528 34.6117 23.7383 34.8388 24.1746C35.0658 24.6109 35.3966 24.9846 35.8021 25.263L46.3021 32.472C46.7526 32.7813 47.2789 32.9616 47.8243 32.9936C48.3698 33.0257 48.9136 32.9081 49.3971 32.6537C49.8806 32.3993 50.2855 32.0176 50.568 31.55C50.8505 31.0823 50.9999 30.5464 51.0001 30V6.00001C50.9999 5.45364 50.8505 4.9177 50.568 4.45004C50.2855 3.98237 49.8806 3.60074 49.3971 3.34632C48.9136 3.0919 48.3698 2.97436 47.8243 3.00638C47.2789 3.0384 46.7526 3.21876 46.3021 3.52801ZM45.0001 24.3L40.5151 21.222L40.5811 14.733L45.0001 11.7V24.3Z" fill="currentColor"/></svg>' },
        { slug: 'photos',       label: 'Pictures',     href: 'photos/index.html',
          help: 'Pictures: Dit billedarkiv — presse-fotos, cover-art og koncertbilleder. Del samlinger direkte med presse, labels eller samarbejdspartnere.',
          icon: '<svg class="nav-icon" width="20" height="20" viewBox="0 0 19 19" fill="none"><path d="M9.5 2.375C8.56433 2.375 7.63783 2.55929 6.77338 2.91736C5.90894 3.27542 5.12348 3.80025 4.46186 4.46186C3.80025 5.12348 3.27542 5.90894 2.91736 6.77338C2.55929 7.63783 2.375 8.56433 2.375 9.5C2.375 10.4357 2.55929 11.3622 2.91736 12.2266C3.27542 13.0911 3.80025 13.8765 4.46186 14.5381C5.12348 15.1998 5.90894 15.7246 6.77338 16.0826C7.63783 16.4407 8.56433 16.625 9.5 16.625C11.3897 16.625 13.2019 15.8743 14.5381 14.5381C15.8743 13.2019 16.625 11.3897 16.625 9.5C16.625 7.61033 15.8743 5.79806 14.5381 4.46186C13.2019 3.12567 11.3897 2.375 9.5 2.375ZM9.5 1.1875C11.7046 1.1875 13.8189 2.06328 15.3778 3.62217C16.9367 5.18107 17.8125 7.29539 17.8125 9.5C17.8125 11.7046 16.9367 13.8189 15.3778 15.3778C13.8189 16.9367 11.7046 17.8125 9.5 17.8125C7.29539 17.8125 5.18107 16.9367 3.62217 15.3778C2.06328 13.8189 1.1875 11.7046 1.1875 9.5C1.1875 7.29539 2.06328 5.18107 3.62217 3.62217C5.18107 2.06328 7.29539 1.1875 9.5 1.1875Z" fill="currentColor"/><path d="M11.875 5.34375C12.6667 5.34375 13.0625 5.73958 13.0625 6.53125C13.0625 7.32292 12.6667 7.71875 11.875 7.71875C11.0834 7.71875 10.6875 7.32292 10.6875 6.53125C10.6875 5.73958 11.0834 5.34375 11.875 5.34375ZM3.9829 14.6704L3.14215 13.8296L6.58709 10.3859C6.88527 10.0876 7.27962 9.90474 7.69997 9.86995C8.12031 9.83516 8.53936 9.95065 8.88253 10.1959L11.4475 12.027C11.5572 12.1051 11.6901 12.1437 11.8245 12.1364C11.9589 12.129 12.0869 12.0762 12.1873 11.9866L16.8233 7.8375L17.6142 8.72338L12.9794 12.8713C12.6779 13.1412 12.2934 13.3003 11.8894 13.3226C11.4853 13.3448 11.0857 13.2288 10.7564 12.9936L8.1914 11.1613C8.07706 11.0801 7.93765 11.042 7.79789 11.0537C7.65813 11.0655 7.52704 11.1263 7.42784 11.2254L3.9829 14.6692V14.6704Z" fill="currentColor"/></svg>' },
        { slug: 'calendar',     label: 'Calender',     href: 'calendar/index.html',
          help: 'Calendar: Planlæg studiesessions, release-datoer, koncerter og møder. Del din kalender med dit team så alle er synkroniserede.',
          icon: '<svg class="nav-icon" width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M15.8334 3.33329H14.1667V2.49996C14.1667 2.27895 14.0789 2.06698 13.9226 1.9107C13.7663 1.75442 13.5544 1.66663 13.3334 1.66663C13.1123 1.66663 12.9004 1.75442 12.7441 1.9107C12.5878 2.06698 12.5 2.27895 12.5 2.49996V3.33329H7.50002V2.49996C7.50002 2.27895 7.41222 2.06698 7.25594 1.9107C7.09966 1.75442 6.8877 1.66663 6.66669 1.66663C6.44567 1.66663 6.23371 1.75442 6.07743 1.9107C5.92115 2.06698 5.83335 2.27895 5.83335 2.49996V3.33329H4.16669C3.50365 3.33329 2.86776 3.59668 2.39892 4.06553C1.93008 4.53437 1.66669 5.17025 1.66669 5.83329V15.8333C1.66669 16.4963 1.93008 17.1322 2.39892 17.6011C2.86776 18.0699 3.50365 18.3333 4.16669 18.3333H15.8334C16.4964 18.3333 17.1323 18.0699 17.6011 17.6011C18.07 17.1322 18.3334 16.4963 18.3334 15.8333V5.83329C18.3334 5.17025 18.07 4.53437 17.6011 4.06553C17.1323 3.59668 16.4964 3.33329 15.8334 3.33329ZM16.6667 15.8333C16.6667 16.0543 16.5789 16.2663 16.4226 16.4225C16.2663 16.5788 16.0544 16.6666 15.8334 16.6666H4.16669C3.94567 16.6666 3.73371 16.5788 3.57743 16.4225C3.42115 16.2663 3.33335 16.0543 3.33335 15.8333V9.99996H16.6667V15.8333ZM16.6667 8.33329H3.33335V5.83329C3.33335 5.61228 3.42115 5.40032 3.57743 5.24404C3.73371 5.08776 3.94567 4.99996 4.16669 4.99996H5.83335V5.83329C5.83335 6.05431 5.92115 6.26627 6.07743 6.42255C6.23371 6.57883 6.44567 6.66663 6.66669 6.66663C6.8877 6.66663 7.09966 6.57883 7.25594 6.42255C7.41222 6.26627 7.50002 6.05431 7.50002 5.83329V4.99996H12.5V5.83329C12.5 6.05431 12.5878 6.26627 12.7441 6.42255C12.9004 6.57883 13.1123 6.66663 13.3334 6.66663C13.5544 6.66663 13.7663 6.57883 13.9226 6.42255C14.0789 6.26627 14.1667 6.05431 14.1667 5.83329V4.99996H15.8334C16.0544 4.99996 16.2663 5.08776 16.4226 5.24404C16.5789 5.40032 16.6667 5.61228 16.6667 5.83329V8.33329Z" fill="currentColor"/></svg>' },
        { slug: 'settings',     label: 'Settings',     href: 'settings/index.html',
          help: 'Settings: Account preferences for your current profile type. The settings panel adapts to your role — artist profiles edit their public page; company profiles (Filming/Brand/Label Stage) manage company info, team permissions, and billing.',
          icon: '<svg class="nav-icon" width="24" height="24" viewBox="0 0 24 24" fill="none"><circle cx="5" cy="12" r="2" fill="currentColor"/><circle cx="12" cy="12" r="2" fill="currentColor"/><circle cx="19" cy="12" r="2" fill="currentColor"/></svg>' }
    ];

    // Maps a window.location.pathname to the active nav slug. Order matters:
    // /artist/settings/ must match settings before /artist/ matches artist.
    const ACTIVE_RULES = [
        { test: /\/settings\//,                slug: 'settings' },
        { test: /\/(artist|fan)\/settings\//,  slug: 'settings' },
        { test: /\/projects\//,                slug: 'projects' },
        { test: /\/overview\//,                slug: 'overview' },
        { test: /\/explore\//,                 slug: 'explore' },
        { test: /\/licensor\//,                slug: 'catalog' },
        { test: /\/sponsor\//,                 slug: 'sponsorships' },
        { test: /\/manager\//,                 slug: 'roster' },
        { test: /\/ar\//,                      slug: 'ar-roster' },
        { test: /\/educator\/bookings\//,      slug: 'edu-bookings' },
        { test: /\/educator\/students\//,      slug: 'edu-students' },
        { test: /\/educator\/materials\//,     slug: 'edu-materials' },
        { test: /\/educator\//,                slug: 'edu-profile' },
        { test: /\/manager\/economy\//,        slug: 'economy' },
        { test: /\/resources\//,               slug: 'resources' },
        { test: /\/streaming\//,               slug: 'streaming' },
        { test: /\/concerts\//,                slug: 'concerts' },
        { test: /\/collabs\//,                 slug: 'collabs' },
        { test: /\/inbox\//,                   slug: 'inbox' },
        { test: /\/entourage\//,               slug: 'entourage' },
        { test: /\/artist\//,                  slug: 'artist' },
        { test: /\/venue\//,                   slug: 'venue' },
        { test: /\/pitch\//,                   slug: 'pitch' },
        { test: /\/sales\//,                   slug: 'sales' },
        { test: /\/videos\//,                  slug: 'videos' },
        { test: /\/photos\//,                  slug: 'photos' },
        { test: /\/calendar\//,                slug: 'calendar' }
        // /notifications/, /fan/, root index.html, /fan/martin/ — no active state
    ];

    function activeSlug(placeholder) {
        // Explicit override on the placeholder wins
        const override = placeholder && placeholder.getAttribute('data-active');
        if (override) return override;

        const path = window.location.pathname;
        for (let i = 0; i < ACTIVE_RULES.length; i++) {
            if (ACTIVE_RULES[i].test.test(path)) return ACTIVE_RULES[i].slug;
        }
        return null;
    }

    function buildSidebarHTML(placeholder) {
        const active = activeSlug(placeholder);
        const profileHref = localAsset('fan/index.html');
        const items = NAV_ITEMS.map(function(item) {
            const liAttrs = ['class="nav-item' + (item.slug === active ? ' active' : '') + '"'];
            if (item.modes)     liAttrs.push('data-modes="' + item.modes + '"');
            if (item.hideModes) liAttrs.push('data-hide-modes="' + item.hideModes + '"');
            const helpAttr = item.help ? ' data-help="' + item.help.replace(/"/g, '&quot;') + '"' : '';
            return '<li ' + liAttrs.join(' ') + '>' +
                       '<a href="' + localAsset(item.href) + '" class="nav-link"' + helpAttr + '>' +
                           item.icon +
                           '<span class="nav-text">' + item.label + '</span>' +
                       '</a>' +
                   '</li>';
        }).join('');

        return ''
            + '<div class="sidebar-profile">'
            +   '<div class="profile-image profile-image--placeholder" aria-label="Profile picture" data-help="Upload dit profilbillede. Klik for at vælge et billede fra din enhed — det vises overalt hvor du optræder på platformen.">'
            +     '<svg class="profile-camera" viewBox="0 0 24 24" fill="none" aria-hidden="true">'
            +       '<path d="M9 3L7.5 5H4a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3.5L15 3H9z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/>'
            +       '<circle cx="12" cy="13" r="4" stroke="currentColor" stroke-width="1.8"/>'
            +     '</svg>'
            +   '</div>'
            +   '<a href="' + profileHref + '" class="profile-name auto-name">Julie Andersen</a>'
            + '</div>'
            + '<button type="button" class="sidebar-create" id="newPostBtn" data-help="Create: Opret et nyt opslag, billede eller live-video.">'
            +   '<span class="sidebar-create__icon"><svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg></span>'
            +   '<span class="sidebar-create__label">Create</span>'
            + '</button>'
            + '<nav class="sidebar-nav"><ul class="nav-list">' + items + '</ul></nav>';
    }

    function injectSidebar() {
        const sidebar = document.querySelector('aside.sidebar[data-sidebar]');
        if (!sidebar) return;          // page does not use the placeholder (login/signup/start)
        if (sidebar.children.length) return; // already populated
        sidebar.innerHTML = buildSidebarHTML(sidebar);
    }

    // Run immediately — app.js is loaded at end of <body>, so DOM is parsed.
    injectSidebar();
})();
