// STAGECORD PRO — Label Stage roster (/manager/)
// STAFF + ARTISTS data, roster card render, contract modal with royalty +
// rights breakdown, reassign flow, create A&R/Manager/PR profile modal,
// unassigned-artists warning banner. Exposes data to other pages via
// window.__SC_LABEL_ARTISTS / window.__SC_LABEL_STAFF.

// ============================================================
// Label Stage roster — data, rendering, contract & reassign modal
// ============================================================
// Renders the staff card grid on /manager/ from a STAFF list.
// Each staff member has a list of assigned artists (ARTISTS data).
// Click a staff card → expanded panel shows their artist names.
// Click an artist → contract modal with dates, agreement, status,
// plus a "Reassign to another staff member" action that lets the
// label admin move the artist between staff. Reassignments persist
// to localStorage so they survive page reloads.
(function() {
    // Pages that need access to STAFF/ARTISTS data (like /manager/economy/)
    // bail out of rendering but still get the data via window exposure below.
    const HAS_ROSTER_PAGE = !!document.querySelector('[data-stage-roster]');

    const STAFF = [
        { id: 's1',  role: 'PR',      first: 'Jonas',     last: 'Mikkelsen',   avatar: 'placeholder-male-1.png',   reportsTo: 's10' },
        { id: 's2',  role: 'A&R',     first: 'Ella',      last: 'Lund',        avatar: 'placeholder-female-1.png', reportsTo: 's4',  genres: ['R&B / Soul', 'Pop'] },
        { id: 's3',  role: 'A&R',     first: 'Oskar',     last: 'Vestergaard', avatar: 'placeholder-male-2.png',   reportsTo: 's4',  genres: ['Singer-songwriter', 'Folk'] },
        { id: 's4',  role: 'A&R',     first: 'Mille',     last: 'Schou',       avatar: 'placeholder-female-2.png',                   genres: ['Lo-fi Hip Hop', 'Indie', 'Hip Hop'] },
        { id: 's5',  role: 'Manager', first: 'Asta',      last: 'Jørgensen',   avatar: 'placeholder-female-3.png', reportsTo: 's7'  },
        { id: 's6',  role: 'Manager', first: 'Marie',     last: 'Bjerg',       avatar: 'placeholder-female-4.png' },
        { id: 's7',  role: 'Manager', first: 'Victoria',  last: 'Larsen',      avatar: 'placeholder-female-5.png' },
        { id: 's8',  role: 'A&R',     first: 'Mason',     last: 'Blake',       avatar: 'placeholder-male-3.png',                     genres: ['Indie Pop', 'Singer-songwriter'] },
        { id: 's9',  role: 'A&R',     first: 'Lysandra',  last: 'Eryx',        avatar: 'placeholder-female-6.png', reportsTo: 's28', genres: ['Electronic', 'Indie'] },
        { id: 's10', role: 'PR',      first: 'Hudson',    last: 'Parker',      avatar: 'placeholder-male-4.png'   },
        { id: 's11', role: 'Manager', first: 'Thorne',    last: 'Evadne',      avatar: 'placeholder-female-1.png', reportsTo: 's17' },
        { id: 's12', role: 'Manager', first: 'Liora',     last: 'Jensen',      avatar: 'placeholder-female-2.png' },
        { id: 's13', role: 'A&R',     first: 'Tobias',    last: 'Nikolaisen',  avatar: 'placeholder-male-5.png',   reportsTo: 's28', genres: ['Singer-songwriter', 'Acoustic'] },
        { id: 's14', role: 'A&R',     first: 'Vibeke',    last: 'Clement',     avatar: 'placeholder-female-3.png',                   genres: ['Pop', 'Electronic'] },
        { id: 's15', role: 'A&R',     first: 'Sebastian', last: 'Kragh',       avatar: 'placeholder-male-6.png',   reportsTo: 's14', genres: ['Synth-pop', 'Indie'] },
        { id: 's16', role: 'PR',      first: 'Caroline',  last: 'Holst',       avatar: 'placeholder-female-4.png', reportsTo: 's10' },
        { id: 's17', role: 'Manager', first: 'Felix',     last: 'Munk',        avatar: 'placeholder-male-7.png'   },
        { id: 's18', role: 'A&R',     first: 'Tilde',     last: 'Pedersen',    avatar: 'placeholder-female-5.png', reportsTo: 's14', genres: ['Electronic', 'Folk'] },
        { id: 's19', role: 'Manager', first: 'Magnus',    last: 'Hjort',       avatar: 'placeholder-male-1.png',   reportsTo: 's17' },
        { id: 's20', role: 'A&R',     first: 'Astrid',    last: 'Lange',       avatar: 'placeholder-female-6.png',                   genres: ['Indie Folk', 'Hip Hop'] },
        { id: 's21', role: 'PR',      first: 'Emil',      last: 'Strøm',       avatar: 'placeholder-male-2.png'   },
        { id: 's22', role: 'Manager', first: 'Sofie',     last: 'Bahn',        avatar: 'placeholder-female-1.png', reportsTo: 's7'  },
        { id: 's23', role: 'A&R',     first: 'Viktor',    last: 'Steffensen',  avatar: 'placeholder-male-3.png',                     genres: ['Pop', 'Hip Hop'] },
        { id: 's24', role: 'PR',      first: 'Naja',      last: 'Holm',        avatar: 'placeholder-female-2.png', reportsTo: 's21' },
        { id: 's25', role: 'Manager', first: 'Otto',      last: 'Berg',        avatar: 'placeholder-male-4.png'   },
        { id: 's26', role: 'A&R',     first: 'Linnea',    last: 'Roost',       avatar: 'placeholder-female-3.png', reportsTo: 's28', genres: ['Indie Pop', 'Folk'] },
        { id: 's27', role: 'Manager', first: 'Konrad',    last: 'Vinge',       avatar: 'placeholder-male-5.png'   },
        { id: 's28', role: 'A&R',     first: 'Filippa',   last: 'Sand',        avatar: 'placeholder-female-4.png',                   genres: ['Pop', 'R&B / Soul', 'Hip Hop'] }
    ];

    // Each artist has a single primary staff assignment. Contract dates use
    // ISO strings so we can compute "days until expiration" cleanly.
    const ARTISTS = [
        // Jonas Mikkelsen — PR (8)
        { id: 'a1',  name: 'Anchi Humifuku',  genre: 'Electronic',           agreement: '1 Album & 6 singles',   length: '2 Years', signed: '2024-09-12', expires: '2026-09-12', staffId: 's1' },
        { id: 'a2',  name: 'Mio Thrillsmith', genre: 'Indie Pop',            agreement: '1 EP & 4 singles',      length: '1 Year',  signed: '2025-11-01', expires: '2026-11-01', staffId: 's1' },
        { id: 'a3',  name: 'Vega Lars',       genre: 'Folk Pop',             agreement: '2 Albums',              length: '3 Years', signed: '2024-04-20', expires: '2027-04-20', staffId: 's1' },
        { id: 'a4',  name: 'SOLØKS',          genre: 'Synth-pop',            agreement: '1 Album',               length: '2 Years', signed: '2025-01-15', expires: '2027-01-15', staffId: 's1' },
        { id: 'a5',  name: 'Ronja Vinter',    genre: 'Indie Folk',           agreement: '1 Album & 3 singles',   length: '2 Years', signed: '2024-08-08', expires: '2026-08-08', staffId: 's1' },
        { id: 'a6',  name: 'ELEKTRO',         genre: 'Electronic',           agreement: '2 Albums or 20 singles',length: '3 Years', signed: '2023-12-01', expires: '2026-12-01', staffId: 's1' },
        { id: 'a7',  name: 'Frej Bonne',      genre: 'Hip Hop',              agreement: '1 Album',               length: '1 Year',  signed: '2025-06-15', expires: '2026-06-15', staffId: 's1' },
        { id: 'a8',  name: 'Sigrid Stein',    genre: 'Pop',                  agreement: '1 EP & 2 singles',      length: '1 Year',  signed: '2025-09-01', expires: '2026-09-01', staffId: 's1' },

        // Ella Lund — A&R (2)
        { id: 'a9',  name: 'Maya Thompson',   genre: 'R&B',                  agreement: '1 Album & 6 singles',   length: '2 Years', signed: '2025-03-10', expires: '2027-03-10', staffId: 's2' },
        { id: 'a10', name: 'Tara Park',       genre: 'Alt-pop',              agreement: '2 Albums',              length: '3 Years', signed: '2024-06-22', expires: '2027-06-22', staffId: 's2' },

        // Oskar Vestergaard — A&R (3)
        { id: 'a11', name: 'Sara Lindholm',   genre: 'Singer-songwriter',    agreement: '1 Album',               length: '2 Years', signed: '2025-02-14', expires: '2027-02-14', staffId: 's3' },
        { id: 'a12', name: 'Cecil Drømmer',   genre: 'Dream-pop',            agreement: '1 EP & 4 singles',      length: '1 Year',  signed: '2025-10-05', expires: '2026-10-05', staffId: 's3' },
        { id: 'a13', name: 'Lava Pop',        genre: 'Dance-pop',            agreement: '2 Albums or 25 singles',length: '3 Years', signed: '2024-01-30', expires: '2027-01-30', staffId: 's3' },

        // Mille Schou — A&R (4)
        { id: 'a14', name: 'Kuno',            genre: 'Lo-fi Hip Hop',        agreement: '1 Album',               length: '2 Years', signed: '2024-11-11', expires: '2026-11-11', staffId: 's4' },
        { id: 'a15', name: 'Frej Hansen',     genre: 'Indie Rock',           agreement: '2 Albums',              length: '3 Years', signed: '2024-07-04', expires: '2027-07-04', staffId: 's4' },
        { id: 'a16', name: 'PAPIR',           genre: 'Post-rock',            agreement: '1 Album & 4 singles',   length: '2 Years', signed: '2025-04-18', expires: '2027-04-18', staffId: 's4' },
        { id: 'a17', name: 'Boa Mike',        genre: 'Hip Hop',              agreement: '1 EP & 6 singles',      length: '1 Year',  signed: '2025-08-25', expires: '2026-08-25', staffId: 's4' },

        // Asta Jørgensen — Manager (1)
        { id: 'a18', name: 'Aria Summers',    genre: 'Pop',                  agreement: '2 Albums or 30 singles',length: '3 Years', signed: '2024-05-15', expires: '2027-05-15', staffId: 's5' },

        // Marie Bjerg — Manager (2)
        { id: 'a19', name: 'Lola Young',      genre: 'Soul',                 agreement: '2 Albums',              length: '3 Years', signed: '2024-02-28', expires: '2027-02-28', staffId: 's6' },
        { id: 'a20', name: 'Camilla Step',    genre: 'R&B / Soul',           agreement: '1 Album & 6 singles',   length: '2 Years', signed: '2025-01-08', expires: '2027-01-08', staffId: 's6' },

        // Victoria Larsen — Manager (3)
        { id: 'a21', name: 'URO',             genre: "R'n'B / Soul",         agreement: '2 Albums or 30 singles',length: '2 Years', signed: '2025-02-01', expires: '2027-02-01', staffId: 's7' },
        { id: 'a22', name: 'KRYD',            genre: 'Pop / Soul',           agreement: '1 Album & 6 singles',   length: '1 Year',  signed: '2025-06-01', expires: '2026-06-01', staffId: 's7' },
        { id: 'a23', name: 'NIKO BLONDE',     genre: 'Hip Hop',              agreement: '1 Album',               length: '2 Years', signed: '2024-08-01', expires: '2026-08-01', staffId: 's7' },

        // Mason Blake — A&R (4)
        { id: 'a24', name: 'Jeremy Freedom',  genre: 'Indie Pop',            agreement: '2 Albums',              length: '3 Years', signed: '2024-03-15', expires: '2027-03-15', staffId: 's8' },
        { id: 'a25', name: 'Jokesmith Johnson',genre: 'Stand-up Comedy',     agreement: '2 Specials',            length: '2 Years', signed: '2024-10-10', expires: '2026-10-10', staffId: 's8' },
        { id: 'a26', name: 'Liva Mai',        genre: 'Pop',                  agreement: '1 EP & 6 singles',      length: '2 Years', signed: '2025-05-05', expires: '2027-05-05', staffId: 's8' },
        { id: 'a27', name: 'Frederik Holm',   genre: 'Singer-songwriter',    agreement: '1 Album',               length: '1 Year',  signed: '2025-09-30', expires: '2026-09-30', staffId: 's8' },

        // Lysandra Eryx — A&R (3)
        { id: 'a28', name: 'NORDISK',         genre: 'Electronic',           agreement: '1 Album & 6 singles',   length: '2 Years', signed: '2024-12-12', expires: '2026-12-12', staffId: 's9' },
        { id: 'a29', name: 'Vil Lund',        genre: 'Indie',                agreement: '1 EP',                  length: '1 Year',  signed: '2025-07-01', expires: '2026-07-01', staffId: 's9' },
        { id: 'a30', name: 'SVAN',            genre: 'Folk',                 agreement: '1 Album',               length: '2 Years', signed: '2024-09-22', expires: '2026-09-22', staffId: 's9' },

        // Hudson Parker — PR (7)
        { id: 'a31', name: 'Kebu',            genre: 'Synth',                agreement: '2 Albums',              length: '3 Years', signed: '2024-01-15', expires: '2027-01-15', staffId: 's10' },
        { id: 'a32', name: 'Anders Vlog',     genre: 'YouTube Music',        agreement: '1 EP & 4 singles',      length: '1 Year',  signed: '2025-11-10', expires: '2026-11-10', staffId: 's10' },
        { id: 'a33', name: 'Sif Marin',       genre: 'Dance',                agreement: '1 Album',               length: '2 Years', signed: '2024-06-30', expires: '2026-06-30', staffId: 's10' },
        { id: 'a34', name: 'RØD',             genre: 'Punk',                 agreement: '2 Albums',              length: '3 Years', signed: '2023-11-05', expires: '2026-11-05', staffId: 's10' },
        { id: 'a35', name: 'Mira Volt',       genre: 'Pop-rock',             agreement: '1 EP & 6 singles',      length: '2 Years', signed: '2024-12-01', expires: '2026-12-01', staffId: 's10' },
        { id: 'a36', name: 'Bjørn Stille',    genre: 'Folk',                 agreement: '1 Album',               length: '1 Year',  signed: '2025-08-12', expires: '2026-08-12', staffId: 's10' },
        { id: 'a37', name: 'Niko Drift',      genre: 'Hip Hop',              agreement: '2 Albums or 20 singles',length: '2 Years', signed: '2024-10-20', expires: '2026-10-20', staffId: 's10' },

        // Thorne Evadne — Manager (1)
        { id: 'a38', name: 'Asta Marrow',     genre: 'Pop',                  agreement: '1 Album',               length: '2 Years', signed: '2025-04-01', expires: '2027-04-01', staffId: 's11' },

        // Liora Jensen — Manager (2)
        { id: 'a39', name: 'Boy Karlsson',    genre: 'Indie Folk',           agreement: '1 Album & 4 singles',   length: '2 Years', signed: '2024-07-15', expires: '2026-07-15', staffId: 's12' },
        { id: 'a40', name: 'Linnea Holm',     genre: 'Pop',                  agreement: '1 EP',                  length: '1 Year',  signed: '2025-10-22', expires: '2026-10-22', staffId: 's12' },

        // Tobias Nikolaisen — A&R (2)
        { id: 'a41', name: 'Mads Vinter',     genre: 'Singer-songwriter',    agreement: '2 Albums',              length: '3 Years', signed: '2024-02-10', expires: '2027-02-10', staffId: 's13' },
        { id: 'a42', name: 'Pelle Holst',     genre: 'Acoustic',             agreement: '1 EP & 4 singles',      length: '1 Year',  signed: '2025-12-01', expires: '2026-12-01', staffId: 's13' },

        // Vibeke Clement — A&R (3)
        { id: 'a43', name: 'JADE',            genre: 'Pop',                  agreement: '1 Album',               length: '2 Years', signed: '2025-01-20', expires: '2027-01-20', staffId: 's14' },
        { id: 'a44', name: 'Tone Ring',       genre: 'Singer-songwriter',    agreement: '1 EP',                  length: '1 Year',  signed: '2025-09-05', expires: '2026-09-05', staffId: 's14' },
        { id: 'a45', name: 'Iris Korn',       genre: 'Electronic Pop',       agreement: '1 Album & 6 singles',   length: '2 Years', signed: '2024-11-25', expires: '2026-11-25', staffId: 's14' },

        // Sebastian Kragh — A&R (2)
        { id: 'a46', name: 'LUMEN',           genre: 'Synth-pop',            agreement: '1 Album',               length: '2 Years', signed: '2024-10-08', expires: '2026-10-08', staffId: 's15' },
        { id: 'a47', name: 'Vesta Lind',      genre: 'Indie',                agreement: '1 EP & 4 singles',      length: '1 Year',  signed: '2025-12-15', expires: '2026-12-15', staffId: 's15' },

        // Caroline Holst — PR (4)
        { id: 'a48', name: 'TYRA',            genre: 'Pop',                  agreement: '2 Albums',              length: '3 Years', signed: '2024-04-02', expires: '2027-04-02', staffId: 's16' },
        { id: 'a49', name: 'KAJSA',           genre: 'Hip Hop',              agreement: '1 Album & 4 singles',   length: '2 Years', signed: '2025-03-22', expires: '2027-03-22', staffId: 's16' },
        { id: 'a50', name: 'Alba Storm',      genre: 'R&B',                  agreement: '1 EP & 6 singles',      length: '2 Years', signed: '2024-07-30', expires: '2026-07-30', staffId: 's16' },
        { id: 'a51', name: 'Maro Steen',      genre: 'Folk',                 agreement: '1 Album',               length: '1 Year',  signed: '2025-08-12', expires: '2026-08-12', staffId: 's16' },

        // Felix Munk — Manager (1)
        { id: 'a52', name: 'IDA SPELL',       genre: 'Singer-songwriter',    agreement: '2 Albums or 25 singles',length: '3 Years', signed: '2023-09-15', expires: '2026-09-15', staffId: 's17' },

        // Tilde Pedersen — A&R (3)
        { id: 'a53', name: 'TAUR',            genre: 'Electronic',           agreement: '1 Album & 6 singles',   length: '2 Years', signed: '2024-12-20', expires: '2026-12-20', staffId: 's18' },
        { id: 'a54', name: 'Oyan',            genre: 'Indie Pop',            agreement: '2 Albums',              length: '3 Years', signed: '2024-05-18', expires: '2027-05-18', staffId: 's18' },
        { id: 'a55', name: 'Merle Vinter',    genre: 'Folk',                 agreement: '1 EP',                  length: '1 Year',  signed: '2025-11-08', expires: '2026-11-08', staffId: 's18' },

        // Magnus Hjort — Manager (2)
        { id: 'a56', name: 'NORD',            genre: 'Post-rock',            agreement: '2 Albums',              length: '3 Years', signed: '2024-02-04', expires: '2027-02-04', staffId: 's19' },
        { id: 'a57', name: 'Kasper Holm',     genre: 'Pop',                  agreement: '1 Album & 4 singles',   length: '2 Years', signed: '2025-06-24', expires: '2027-06-24', staffId: 's19' },

        // Astrid Lange — A&R (2)
        { id: 'a58', name: 'Sverre Lind',     genre: 'Indie Folk',           agreement: '1 Album',               length: '2 Years', signed: '2025-04-10', expires: '2027-04-10', staffId: 's20' },
        { id: 'a59', name: 'TOR',             genre: 'Hip Hop',              agreement: '2 Albums or 30 singles',length: '3 Years', signed: '2023-11-28', expires: '2026-11-28', staffId: 's20' },

        // Emil Strøm — PR (5)
        { id: 'a60', name: 'Signe Bech',      genre: 'Pop',                  agreement: '1 EP & 4 singles',      length: '1 Year',  signed: '2025-10-12', expires: '2026-10-12', staffId: 's21' },
        { id: 'a61', name: 'KAI VOLT',        genre: 'Synth',                agreement: '1 Album',               length: '2 Years', signed: '2024-08-20', expires: '2026-08-20', staffId: 's21' },
        { id: 'a62', name: 'HOLDR',           genre: 'Lo-fi Hip Hop',        agreement: '2 Albums',              length: '3 Years', signed: '2024-01-12', expires: '2027-01-12', staffId: 's21' },
        { id: 'a63', name: 'Agnes Berg',      genre: 'Singer-songwriter',    agreement: '1 Album & 6 singles',   length: '2 Years', signed: '2025-02-22', expires: '2027-02-22', staffId: 's21' },
        { id: 'a64', name: 'FENN',            genre: 'Electronic',           agreement: '1 EP',                  length: '1 Year',  signed: '2025-09-18', expires: '2026-09-18', staffId: 's21' },

        // Sofie Bahn — Manager (1)
        { id: 'a65', name: 'Niko Root',       genre: 'R&B',                  agreement: '2 Albums',              length: '3 Years', signed: '2024-06-08', expires: '2027-06-08', staffId: 's22' },

        // Viktor Steffensen — A&R (2)
        { id: 'a66', name: 'LO',              genre: 'Pop',                  agreement: '1 Album & 4 singles',   length: '2 Years', signed: '2025-05-30', expires: '2027-05-30', staffId: 's23' },
        { id: 'a67', name: 'REM',             genre: 'Hip Hop',              agreement: '1 EP',                  length: '1 Year',  signed: '2025-12-02', expires: '2026-12-02', staffId: 's23' },

        // Naja Holm — PR (3)
        { id: 'a68', name: 'OBSIDIAN',        genre: 'Alt-rock',             agreement: '2 Albums',              length: '3 Years', signed: '2023-10-15', expires: '2026-10-15', staffId: 's24' },
        { id: 'a69', name: 'Oak Man',         genre: 'Folk',                 agreement: '1 Album',               length: '2 Years', signed: '2024-12-01', expires: '2026-12-01', staffId: 's24' },
        { id: 'a70', name: 'Iris Voss',       genre: 'Pop',                  agreement: '1 EP & 6 singles',      length: '2 Years', signed: '2025-07-14', expires: '2027-07-14', staffId: 's24' },

        // Otto Berg — Manager (1)
        { id: 'a71', name: 'KRONOS',          genre: 'Synth-wave',           agreement: '2 Albums or 20 singles',length: '3 Years', signed: '2024-03-25', expires: '2027-03-25', staffId: 's25' },

        // Linnea Roost — A&R (2)
        { id: 'a72', name: 'BIRK',            genre: 'Indie Pop',            agreement: '1 Album',               length: '2 Years', signed: '2024-11-05', expires: '2026-11-05', staffId: 's26' },
        { id: 'a73', name: 'ASKE',            genre: 'Folk',                 agreement: '1 EP & 4 singles',      length: '1 Year',  signed: '2025-10-28', expires: '2026-10-28', staffId: 's26' },

        // Konrad Vinge — Manager (2)
        { id: 'a74', name: 'Sara Rain',       genre: 'Singer-songwriter',    agreement: '1 Album & 4 singles',   length: '2 Years', signed: '2024-09-02', expires: '2026-09-02', staffId: 's27' },
        { id: 'a75', name: 'Jade Wave',       genre: 'Dance-pop',            agreement: '2 Albums',              length: '3 Years', signed: '2024-05-22', expires: '2027-05-22', staffId: 's27' },

        // Filippa Sand — A&R (3)
        { id: 'a76', name: 'Eva Storm',       genre: 'Pop',                  agreement: '1 Album',               length: '2 Years', signed: '2025-01-10', expires: '2027-01-10', staffId: 's28' },
        { id: 'a77', name: 'NIRA',            genre: 'R&B',                  agreement: '1 EP & 4 singles',      length: '1 Year',  signed: '2025-11-20', expires: '2026-11-20', staffId: 's28' },
        { id: 'a78', name: 'FALK',            genre: 'Hip Hop',              agreement: '2 Albums or 25 singles',length: '3 Years', signed: '2024-08-15', expires: '2027-08-15', staffId: 's28' },

        // Unassigned — recently signed or orphaned by terminated staff.
        // These trigger the warning banner above the filter row.
        { id: 'a79', name: 'Marlon Vex',      genre: 'Indie Pop',            agreement: '1 Album',               length: '2 Years', signed: '2026-04-22', expires: '2028-04-22', staffId: null },
        { id: 'a80', name: 'PYRE',            genre: 'Electronic',           agreement: '1 EP & 4 singles',      length: '1 Year',  signed: '2026-04-15', expires: '2027-04-15', staffId: null },
        { id: 'a81', name: 'Halle Solberg',   genre: 'Singer-songwriter',    agreement: '1 Album',               length: '2 Years', signed: '2026-03-08', expires: '2028-03-08', staffId: null }
    ];

    // Expose to other pages (e.g. economy) since label-stage is the source
    // of truth for the roster + artist data. Read-only intent.
    window.__SC_LABEL_ARTISTS = ARTISTS;
    window.__SC_LABEL_STAFF = STAFF;

    // Pages without the roster element only need the data (above) — bail
    // before initializing render functions, modals, click handlers etc.
    if (!HAS_ROSTER_PAGE) return;

    // Standard label-deal templates. Each artist is assigned to one of these
    // (deterministically, via id hash) so the modal can show royalty splits +
    // rights ownership consistent with their contract type.
    const CONTRACT_TEMPLATES = {
        traditional: {
            label: 'Traditional label deal',
            hint: 'Traditional record deal — label owns the masters and takes the bulk of streaming/sales royalties.',
            royalties: {
                'Streams':         { Artist: 20, Label: 70, Producer: 5, Songwriter: 5 },
                'Sales':           { Artist: 18, Label: 72, Producer: 5, Songwriter: 5 },
                'Sync licensing':  { Artist: 50, Label: 50 },
                'Brand deals':     { Artist: 80, Label: 20 },
                'Concerts / Live': { Artist: 90, Manager: 10 },
                'Print music':     { Songwriter: 100 },
                'Covers':          { Artist: 70, Label: 30 }
            },
            rights: {
                'Master recordings':   'Label · reverts to artist after 7 years',
                'Publishing':          'Co-owned · Artist + Publisher',
                'Sync licensing':      'Label-controlled · joint approval required',
                'Merchandise':         'Artist',
                'Touring & live':      'Artist',
                'Brand & sponsorship': 'Joint approval'
            }
        },
        '50-50': {
            label: '50/50 partnership',
            hint: 'Modern deal — label and artist split 50/50. More flexibility for the artist than traditional.',
            royalties: {
                'Streams':         { Artist: 50, Label: 45, Producer: 3, Songwriter: 2 },
                'Sales':           { Artist: 50, Label: 45, Producer: 3, Songwriter: 2 },
                'Sync licensing':  { Artist: 50, Label: 50 },
                'Brand deals':     { Artist: 70, Label: 30 },
                'Concerts / Live': { Artist: 90, Manager: 10 },
                'Print music':     { Songwriter: 100 },
                'Covers':          { Artist: 60, Label: 40 }
            },
            rights: {
                'Master recordings':   'Joint (50/50)',
                'Publishing':          'Artist + Publisher',
                'Sync licensing':      'Joint approval required',
                'Merchandise':         'Artist',
                'Touring & live':      'Artist',
                'Brand & sponsorship': 'Joint approval'
            }
        },
        '360': {
            label: '360 deal',
            hint: 'Label takes a cut of ALL revenue sources, including touring, merch, and brand. Often with a large advance.',
            royalties: {
                'Streams':         { Artist: 20, Label: 70, Producer: 5, Songwriter: 5 },
                'Sales':           { Artist: 18, Label: 72, Producer: 5, Songwriter: 5 },
                'Sync licensing':  { Artist: 40, Label: 60 },
                'Brand deals':     { Artist: 60, Label: 40 },
                'Concerts / Live': { Artist: 75, Label: 15, Manager: 10 },
                'Print music':     { Songwriter: 80, Label: 20 },
                'Covers':          { Artist: 50, Label: 50 }
            },
            rights: {
                'Master recordings':   'Label (perpetual)',
                'Publishing':          'Label-administered',
                'Sync licensing':      'Label-controlled',
                'Merchandise':         'Joint · Artist 60% / Label 40%',
                'Touring & live':      'Joint approval',
                'Brand & sponsorship': 'Label-controlled'
            }
        },
        'artist-owned': {
            label: 'Artist-owned (license deal)',
            hint: 'Artist owns their own masters and licenses to the label. Label takes a smaller share, but the artist has full control.',
            royalties: {
                'Streams':         { Artist: 70, Label: 20, Producer: 5, Songwriter: 5 },
                'Sales':           { Artist: 70, Label: 20, Producer: 5, Songwriter: 5 },
                'Sync licensing':  { Artist: 80, Label: 20 },
                'Brand deals':     { Artist: 100 },
                'Concerts / Live': { Artist: 90, Manager: 10 },
                'Print music':     { Songwriter: 100 },
                'Covers':          { Artist: 100 }
            },
            rights: {
                'Master recordings':   'Artist (perpetual)',
                'Publishing':          'Artist',
                'Sync licensing':      'Artist-approved · label may distribute',
                'Merchandise':         'Artist',
                'Touring & live':      'Artist',
                'Brand & sponsorship': 'Artist'
            }
        }
    };

    const TEMPLATE_KEYS = ['traditional', '50-50', '360', 'artist-owned'];
    const ROLE_CLS = {
        Artist: 'artist', Label: 'label', Producer: 'producer',
        Songwriter: 'songwriter', Manager: 'manager', Publisher: 'publisher'
    };

    function templateFor(artist) {
        let h = 0;
        for (let i = 0; i < artist.id.length; i++) h = (h * 31 + artist.id.charCodeAt(i)) >>> 0;
        return CONTRACT_TEMPLATES[TEMPLATE_KEYS[h % TEMPLATE_KEYS.length]];
    }

    function renderRoyalties(template) {
        const rows = Object.keys(template.royalties).map(function(source) {
            const split = template.royalties[source];
            const segments = Object.keys(split).map(function(role) {
                const pct = split[role];
                const cls = ROLE_CLS[role] || 'label';
                const label = pct >= 12 ? role + ' ' + pct + '%' : pct + '%';
                return '<div class="royalty-segment royalty-segment--' + cls + '" style="width:' + pct + '%;" title="' + SC.escapeAttr(role + ' ' + pct + '%') + '">' + SC.escapeHtml(label) + '</div>';
            }).join('');
            return '<div class="royalty-row">' +
                       '<div class="royalty-row__source">' + SC.escapeHtml(source) + '</div>' +
                       '<div class="royalty-row__bar">' + segments + '</div>' +
                   '</div>';
        }).join('');

        // Build legend from all roles seen across rows
        const seenRoles = {};
        Object.keys(template.royalties).forEach(function(source) {
            Object.keys(template.royalties[source]).forEach(function(role) { seenRoles[role] = true; });
        });
        const legend = Object.keys(seenRoles).map(function(role) {
            const cls = ROLE_CLS[role] || 'label';
            return '<span class="royalty-legend__item"><span class="royalty-legend__swatch royalty-segment--' + cls + '"></span>' + SC.escapeHtml(role) + '</span>';
        }).join('');

        return rows + '<div class="royalty-legend">' + legend + '</div>';
    }

    function renderRights(template) {
        return Object.keys(template.rights).map(function(right) {
            return '<div class="rights-grid__label">' + SC.escapeHtml(right) + '</div>' +
                   '<div class="rights-grid__value">' + SC.escapeHtml(template.rights[right]) + '</div>';
        }).join('');
    }

    const STORAGE_KEY = 'stagecord:label-assignments';

    function loadAssignments() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            return raw ? JSON.parse(raw) : {};
        } catch (e) { return {}; }
    }
    function saveAssignments(map) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(map)); } catch (e) { /* ignore */ }
    }

    // Returns the effective staffId for an artist, applying any localStorage override.
    function effectiveStaffId(artist, overrides) {
        return overrides[artist.id] || artist.staffId;
    }

    function getArtistsForStaff(staffId, overrides) {
        return ARTISTS.filter(function(a) { return effectiveStaffId(a, overrides) === staffId; });
    }

    function avatarUrl(filename) {
        const path = window.location.pathname.indexOf('/manager/') !== -1 ? '../' : '';
        return path + 'assets/images/artists/' + filename;
    }

    function buildStaffCard(staff, overrides) {
        const artists = getArtistsForStaff(staff.id, overrides);
        const role = SC.escapeHtml(staff.role);
        const first = SC.escapeHtml(staff.first);
        const last = SC.escapeHtml(staff.last);
        const helpText = staff.first + ' ' + staff.last + ' — ' + staff.role + '. ' + artists.length + ' artist' + (artists.length === 1 ? '' : 'er') + ' assigned.';

        const expandedItems = artists.length
            ? artists.map(function(a) {
                return '<button type="button" class="stage-roster__artist-name" data-artist-id="' + SC.escapeAttr(a.id) + '" data-help="' + SC.escapeAttr(a.name + ' — ' + a.genre + '. ' + a.agreement + ', ' + a.length + '. Click to view contract details and reassign options.') + '">' + SC.escapeHtml(a.name) + '</button>';
              }).join('')
            : '<div class="stage-roster__empty">No artists assigned</div>';

        return ''
            + '<div class="stage-roster__card" role="button" tabindex="0" data-staff-id="' + SC.escapeAttr(staff.id) + '" data-help="' + SC.escapeAttr(helpText) + '">'
            +   '<span class="stage-roster__role">' + role + '</span>'
            +   '<span class="stage-roster__avatar" style="background-image: url(\'' + avatarUrl(staff.avatar) + '\');"></span>'
            +   '<span class="stage-roster__name">'
            +     '<span class="stage-roster__name-first auto-name">' + first + '</span>'
            +     '<span class="stage-roster__name-last">' + last + '</span>'
            +   '</span>'
            +   '<span class="stage-roster__count">' + artists.length + ' artist' + (artists.length === 1 ? '' : '') + '</span>'
            +   '<div class="stage-roster__expanded">' + expandedItems + '</div>'
            + '</div>';
    }

    function render() {
        const container = document.querySelector('[data-stage-roster]');
        if (!container) return;
        const overrides = loadAssignments();
        // Preserve which card is active across re-renders
        const previouslyActiveStaffId = container.querySelector('.stage-roster__card.is-active');
        const activeId = previouslyActiveStaffId ? previouslyActiveStaffId.getAttribute('data-staff-id') : null;
        container.innerHTML = STAFF.map(function(s) { return buildStaffCard(s, overrides); }).join('');
        if (activeId) {
            const restore = container.querySelector('[data-staff-id="' + activeId + '"]');
            if (restore) restore.classList.add('is-active');
        }
        if (typeof formatAllNames === 'function') formatAllNames(container);
        refreshWarningBanner();
    }

    // ---------------------------------------------------------
    // Contract / reassign modal
    // ---------------------------------------------------------
    let modal = null;
    let currentArtistId = null;

    function findArtist(id) { return ARTISTS.find(function(a) { return a.id === id; }); }
    function findStaff(id) { return STAFF.find(function(s) { return s.id === id; }); }

    // Set acting-as state in localStorage and navigate to the artist profile.
    // The /artist/ page reads this state and shows a banner indicating the
    // viewer is acting on behalf of the artist (with limitations).
    function actAsArtist(artistId) {
        const artist = findArtist(artistId);
        if (!artist) return;
        const overrides = loadAssignments();
        const ownerId = effectiveStaffId(artist, overrides);
        const owner = findStaff(ownerId);
        if (!owner) return;
        window.SC.actAs.set({
            actorId: owner.id,
            actorRole: owner.role,
            actorName: owner.first + ' ' + owner.last,
            actorAvatar: owner.avatar,
            subjectId: artist.id,
            subjectName: artist.name,
            startedAt: new Date().toISOString()
        });
        window.location.href = localAsset('artist/index.html');
    }

    function fmtDate(iso) {
        const d = new Date(iso);
        return d.toLocaleDateString('da-DK', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }
    function daysUntil(iso) {
        const d = new Date(iso);
        return Math.ceil((d.getTime() - Date.now()) / 86400000);
    }
    function statusOf(artist) {
        const days = daysUntil(artist.expires);
        if (days < 0) return { label: 'Expired', cls: 'bad' };
        if (days < 90) return { label: 'Expiring soon (' + days + ' days)', cls: 'warn' };
        return { label: 'Active', cls: 'good' };
    }

    function ensureModal() {
        if (modal) return modal;
        const wrap = document.createElement('div');
        wrap.innerHTML =
            '<div class="release-modal-overlay" id="contractModal" data-contract-modal aria-hidden="true" role="dialog" aria-modal="true">' +
                '<div class="release-modal release-modal--contract">' +
                    '<header class="release-modal__header">' +
                        '<h2 class="release-modal__title" data-contract-title>Contract</h2>' +
                        '<button type="button" class="release-modal__close" data-contract-close aria-label="Close">&times;</button>' +
                    '</header>' +
                    '<div class="release-modal__body contract-modal__body" data-contract-body></div>' +
                    '<footer class="release-modal__actions" data-contract-actions></footer>' +
                '</div>' +
            '</div>';
        document.body.appendChild(wrap.firstChild);
        // Ensure the pitch-modals.css (which carries .release-modal-overlay) is loaded
        if (!document.querySelector('link[href*="pitch-modals.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = localAsset('css/pitch-modals.css');
            document.head.appendChild(link);
        }
        modal = document.getElementById('contractModal');
        return modal;
    }

    function closeModal() {
        if (!modal) return;
        modal.classList.remove('open');
        modal.setAttribute('aria-hidden', 'true');
        currentArtistId = null;
    }

    function showContractStep(artistId) {
        ensureModal();
        currentArtistId = artistId;
        const artist = findArtist(artistId);
        if (!artist) return;
        const overrides = loadAssignments();
        const effectiveId = effectiveStaffId(artist, overrides);
        const staff = findStaff(effectiveId);
        const status = statusOf(artist);

        const template = templateFor(artist);

        modal.querySelector('[data-contract-title]').textContent = 'Contract — ' + artist.name;
        modal.querySelector('[data-contract-body]').innerHTML =
            '<div class="contract-modal__header-block">' +
                '<div class="contract-modal__avatar" style="background-color:#3a3a3a;"></div>' +
                '<div class="contract-modal__title-block">' +
                    '<div class="contract-modal__artist-name auto-name">' + SC.escapeHtml(artist.name) + '</div>' +
                    '<div class="contract-modal__artist-meta">' + SC.escapeHtml(artist.genre) + '<span class="contract-section__type-pill">' + SC.escapeHtml(template.label) + '</span></div>' +
                '</div>' +
            '</div>' +
            '<div class="contract-modal__field-grid">' +
                '<div>' +
                    '<div class="contract-modal__field-label">Signed</div>' +
                    '<div class="contract-modal__field-value">' + fmtDate(artist.signed) + '</div>' +
                '</div>' +
                '<div>' +
                    '<div class="contract-modal__field-label">Expires</div>' +
                    '<div class="contract-modal__field-value">' + fmtDate(artist.expires) + '</div>' +
                '</div>' +
                '<div>' +
                    '<div class="contract-modal__field-label">Contract length</div>' +
                    '<div class="contract-modal__field-value">' + SC.escapeHtml(artist.length) + '</div>' +
                '</div>' +
                '<div>' +
                    '<div class="contract-modal__field-label">Status</div>' +
                    '<div class="contract-modal__field-value contract-modal__field-value--' + status.cls + '">' + status.label + '</div>' +
                '</div>' +
                '<div style="grid-column: span 2;">' +
                    '<div class="contract-modal__field-label">Agreement</div>' +
                    '<div class="contract-modal__field-value">' + SC.escapeHtml(artist.agreement) + '</div>' +
                '</div>' +
            '</div>' +
            '<div class="contract-modal__assigned-row">' +
                '<span class="contract-modal__assigned-label">Currently assigned to</span>' +
                '<span class="contract-modal__assigned-name auto-name">' + (staff ? SC.escapeHtml(staff.first + ' ' + staff.last) : 'Unassigned') + (staff ? ' <span style="font-weight:400;color:rgba(255,255,255,0.6);">· ' + SC.escapeHtml(staff.role) + '</span>' : '') + '</span>' +
            '</div>' +
            '<section class="contract-section">' +
                '<h3 class="contract-section__title">Royalties — split per revenue source</h3>' +
                '<p class="contract-section__hint">' + SC.escapeHtml(template.hint) + '</p>' +
                renderRoyalties(template) +
            '</section>' +
            '<section class="contract-section">' +
                '<h3 class="contract-section__title">Rights — ownership and control</h3>' +
                '<div class="rights-grid">' + renderRights(template) + '</div>' +
            '</section>';
        modal.querySelector('[data-contract-actions]').innerHTML =
            '<button type="button" class="release-modal__btn" data-contract-close>Close</button>' +
            '<button type="button" class="release-modal__btn" data-contract-go-profile>Go to artist profile →</button>' +
            '<button type="button" class="release-modal__btn release-modal__btn--primary" data-contract-reassign>Reassign to another staff →</button>';
        modal.classList.add('open');
        modal.setAttribute('aria-hidden', 'false');
    }

    function showReassignStep(artistId) {
        const artist = findArtist(artistId);
        if (!artist) return;
        const overrides = loadAssignments();
        const currentId = effectiveStaffId(artist, overrides);
        const staffOptions = STAFF.filter(function(s) { return s.id !== currentId; });

        modal.querySelector('[data-contract-title]').textContent = 'Reassign ' + artist.name;
        modal.querySelector('[data-contract-body]').innerHTML =
            '<p class="ar-page-intro" style="margin-bottom:14px;">Select a new staff member from the label team. The artist will be moved from their current ' + SC.escapeHtml(findStaff(currentId).role) + ' to the selected one. This action can always be undone.</p>' +
            '<div class="reassign-list">' +
                staffOptions.map(function(s) {
                    const staffArtists = getArtistsForStaff(s.id, overrides);
                    return '<button type="button" class="reassign-staff" data-reassign-target="' + SC.escapeAttr(s.id) + '">' +
                        '<span class="reassign-staff__avatar" style="background-image: url(\'' + avatarUrl(s.avatar) + '\');"></span>' +
                        '<div class="reassign-staff__main">' +
                            '<div class="reassign-staff__role">' + SC.escapeHtml(s.role) + '</div>' +
                            '<div class="reassign-staff__name auto-name">' + SC.escapeHtml(s.first + ' ' + s.last) + '</div>' +
                            '<div class="reassign-staff__count">' + staffArtists.length + ' current artist' + (staffArtists.length === 1 ? '' : 's') + '</div>' +
                        '</div>' +
                    '</button>';
                }).join('') +
            '</div>';
        modal.querySelector('[data-contract-actions]').innerHTML =
            '<button type="button" class="release-modal__btn" data-contract-back>← Back to contract</button>' +
            '<button type="button" class="release-modal__btn" data-contract-close>Cancel</button>';
        if (typeof formatAllNames === 'function') formatAllNames(modal);
    }

    function performReassign(artistId, newStaffId) {
        const artist = findArtist(artistId);
        const newStaff = findStaff(newStaffId);
        if (!artist || !newStaff) return;
        const overrides = loadAssignments();
        const oldStaffId = effectiveStaffId(artist, overrides);

        if (newStaffId === artist.staffId) {
            delete overrides[artist.id]; // back to original
        } else {
            overrides[artist.id] = newStaffId;
        }
        saveAssignments(overrides);

        const oldStaff = findStaff(oldStaffId);
        modal.querySelector('[data-contract-title]').textContent = 'Reassigned';
        modal.querySelector('[data-contract-body]').innerHTML =
            '<div class="reassign-confirm-banner">' +
                '<strong>' + SC.escapeHtml(artist.name) + '</strong> has been moved from <strong>' + SC.escapeHtml(oldStaff.first + ' ' + oldStaff.last) + ' (' + SC.escapeHtml(oldStaff.role) + ')</strong> til <strong>' + SC.escapeHtml(newStaff.first + ' ' + newStaff.last) + ' (' + SC.escapeHtml(newStaff.role) + ')</strong>.' +
            '</div>' +
            '<p class="ar-page-intro" style="margin:0;">Reassignment is saved and survives page reload. You can always move the artist again.</p>';
        modal.querySelector('[data-contract-actions]').innerHTML =
            '<button type="button" class="release-modal__btn release-modal__btn--primary" data-contract-close>Done</button>';
        if (typeof formatAllNames === 'function') formatAllNames(modal);
        render();
    }

    // ---------------------------------------------------------
    // Click delegation
    // ---------------------------------------------------------
    document.addEventListener('click', function(e) {
        // Click an artist name in the expanded panel → contract modal
        const artistBtn = e.target.closest('.stage-roster__artist-name');
        if (artistBtn) {
            if (typeof helpActive !== 'undefined' && helpActive) return;
            e.stopPropagation();
            e.preventDefault();
            showContractStep(artistBtn.getAttribute('data-artist-id'));
            return;
        }

        // Click a staff card → toggle is-active so the expanded panel shows
        const card = e.target.closest('.stage-roster__card');
        if (card) {
            if (typeof helpActive !== 'undefined' && helpActive) return;
            const grid = card.closest('[data-stage-roster]');
            if (!grid) return;
            const wasActive = card.classList.contains('is-active');
            grid.querySelectorAll('.stage-roster__card.is-active').forEach(function(c) {
                c.classList.remove('is-active');
                const panel = c.querySelector('.stage-roster__expanded');
                if (panel) panel.style.maxHeight = '';
            });
            if (!wasActive) {
                card.classList.add('is-active');
                fitExpandedPanel(card);
            }
            return;
        }

        // Modal actions
        if (modal) {
            if (e.target.closest('[data-contract-close]')) { closeModal(); return; }
            if (e.target.closest('[data-contract-go-profile]')) { actAsArtist(currentArtistId); return; }
            if (e.target.closest('[data-contract-reassign]')) { showReassignStep(currentArtistId); return; }
            if (e.target.closest('[data-contract-back]')) { showContractStep(currentArtistId); return; }
            const reassignTarget = e.target.closest('[data-reassign-target]');
            if (reassignTarget) {
                performReassign(currentArtistId, reassignTarget.getAttribute('data-reassign-target'));
                return;
            }
            if (e.target === modal) { closeModal(); return; }
        }

        // Create profile CTA on /manager/
        if (e.target.closest('.stage-filter-cta')) {
            if (typeof helpActive !== 'undefined' && helpActive) return;
            openCreateModal();
            return;
        }
        // Warning banner — open the unassigned-list modal
        if (e.target.closest('[data-unassigned-open]')) {
            if (typeof helpActive !== 'undefined' && helpActive) return;
            openUnassignedModal();
            return;
        }
        // Inside the unassigned-list modal
        if (unassignedModal && unassignedModal.classList.contains('open')) {
            if (e.target.closest('[data-unassigned-close]')) { closeUnassignedModal(); return; }
            const assignBtn = e.target.closest('[data-unassigned-assign]');
            if (assignBtn) {
                const aid = assignBtn.getAttribute('data-unassigned-assign');
                closeUnassignedModal();
                showContractStep(aid);
                showReassignStep(aid);
                return;
            }
            if (e.target === unassignedModal) { closeUnassignedModal(); return; }
        }
        // Create-profile modal interactions
        if (createModal && createModal.classList.contains('open')) {
            if (e.target.closest('[data-create-close]')) { closeCreateModal(); return; }
            if (e.target.closest('[data-create-submit]')) { submitCreate(); return; }
            const roleBtn = e.target.closest('[data-create-role]');
            if (roleBtn) {
                const role = roleBtn.getAttribute('data-create-role');
                const idx = createState.roles.indexOf(role);
                if (idx === -1) createState.roles.push(role);
                else createState.roles.splice(idx, 1);
                renderCreateForm();
                return;
            }
            const genreBtn = e.target.closest('[data-create-genre]');
            if (genreBtn) {
                const g = genreBtn.getAttribute('data-create-genre');
                const idx = createState.genres.indexOf(g);
                if (idx === -1) createState.genres.push(g);
                else createState.genres.splice(idx, 1);
                renderCreateForm();
                return;
            }
            const avatarBtn = e.target.closest('[data-create-avatar]');
            if (avatarBtn) {
                createState.avatar = avatarBtn.getAttribute('data-create-avatar');
                renderCreateForm();
                return;
            }
            if (e.target === createModal) { closeCreateModal(); return; }
        }
    });

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && modal && modal.classList.contains('open')) closeModal();
        if (e.key === 'Escape' && createModal && createModal.classList.contains('open')) closeCreateModal();
        if (e.key === 'Escape' && unassignedModal && unassignedModal.classList.contains('open')) closeUnassignedModal();
        if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.stage-roster__card')) {
            e.preventDefault();
            e.target.click();
        }
    });

    // Form input updates inside the create-profile modal
    document.addEventListener('change', function(e) {
        if (!createModal || !createModal.classList.contains('open')) return;
        if (e.target.matches('[data-create-email]')) {
            createState.email = e.target.value || null;
            const opt = e.target.options[e.target.selectedIndex];
            createState.emailType = opt ? opt.getAttribute('data-type') : null;
            // Re-render footer to enable/disable Submit
            const valid = canSubmit();
            const btn = createModal.querySelector('[data-create-submit]');
            if (btn) {
                btn.disabled = !valid;
                btn.style.opacity = valid ? '' : '0.5';
                btn.style.cursor = valid ? '' : 'not-allowed';
            }
            return;
        }
        const artistChk = e.target.matches('[data-create-artist]') ? e.target : null;
        if (artistChk) {
            const id = artistChk.getAttribute('data-create-artist');
            const idx = createState.artistIds.indexOf(id);
            if (artistChk.checked && idx === -1) createState.artistIds.push(id);
            else if (!artistChk.checked && idx !== -1) createState.artistIds.splice(idx, 1);
            return;
        }
    });
    document.addEventListener('input', function(e) {
        if (!createModal || !createModal.classList.contains('open')) return;
        if (e.target.matches('[data-create-firstname]')) {
            createState.firstName = e.target.value;
        } else if (e.target.matches('[data-create-lastname]')) {
            createState.lastName = e.target.value;
        } else { return; }
        const valid = canSubmit();
        const btn = createModal.querySelector('[data-create-submit]');
        if (btn) {
            btn.disabled = !valid;
            btn.style.opacity = valid ? '' : '0.5';
            btn.style.cursor = valid ? '' : 'not-allowed';
        }
    });

    // ---------------------------------------------------------
    // Create profile modal — wired to "+ Create A&R profile" CTA
    // ---------------------------------------------------------
    // Picks an email from the company's Resources pool, attaches profile
    // type(s), avatar, genre tags, and initial artists. On submit, marks
    // the resource as "pending invite" and adds a new staff entry.

    const GENRE_TAGS = ['Hip Hop','Pop','R&B / Soul','Folk','Indie Pop','Indie','Electronic','Synth-pop','Rock','Singer-songwriter','Dance-pop','Punk','Lo-fi Hip Hop','Post-rock','Jazz','Country'];
    const AVATAR_POOL = [
        'placeholder-male-1.png','placeholder-male-2.png','placeholder-male-3.png','placeholder-male-4.png','placeholder-male-5.png','placeholder-male-6.png','placeholder-male-7.png',
        'placeholder-female-1.png','placeholder-female-2.png','placeholder-female-3.png','placeholder-female-4.png','placeholder-female-5.png','placeholder-female-6.png'
    ];

    // Two hardcoded available emails from the resources pool. Users can
    // also "add new freelancer" inline, which extends this list ad-hoc.
    function getAvailableEmails() {
        const base = [
            { email: 'newhire1@sony.com', type: 'common' },
            { email: 'newhire2@sony.com', type: 'common' }
        ];
        try {
            const added = JSON.parse(localStorage.getItem('stagecord:resources-added') || '[]');
            added.forEach(function(r) {
                if (r.status === 'available') base.push({ email: r.email, type: r.type, name: r.name });
            });
        } catch (e) { /* ignore */ }
        return base;
    }

    function genTempPassword() {
        const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let p = '';
        for (let i = 0; i < 10; i++) p += charset.charAt(Math.floor(Math.random() * charset.length));
        return p.slice(0,4) + '-' + p.slice(4,7) + '-' + p.slice(7);
    }

    let createModal = null;
    const createState = {
        roles: [],            // array: 'A&R', 'Manager', 'PR'
        email: null,
        emailType: null,
        avatar: null,
        genres: [],
        artistIds: [],
        firstName: '',
        lastName: ''
    };

    function ensureCreateModal() {
        if (createModal) return createModal;
        if (!document.querySelector('link[href*="pitch-modals.css"]')) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = localAsset('css/pitch-modals.css');
            document.head.appendChild(link);
        }
        const wrap = document.createElement('div');
        wrap.innerHTML =
            '<div class="release-modal-overlay" id="createProfileModal" data-create-modal aria-hidden="true" role="dialog" aria-modal="true">' +
                '<div class="release-modal release-modal--contract">' +
                    '<header class="release-modal__header">' +
                        '<h2 class="release-modal__title">Create new profile</h2>' +
                        '<button type="button" class="release-modal__close" data-create-close aria-label="Close">&times;</button>' +
                    '</header>' +
                    '<div class="release-modal__body" data-create-body></div>' +
                    '<footer class="release-modal__actions" data-create-actions></footer>' +
                '</div>' +
            '</div>';
        document.body.appendChild(wrap.firstChild);
        createModal = document.getElementById('createProfileModal');
        return createModal;
    }

    function openCreateModal() {
        ensureCreateModal();
        // Reset state
        createState.roles = [];
        createState.email = null;
        createState.emailType = null;
        createState.avatar = null;
        createState.genres = [];
        createState.artistIds = [];
        createState.firstName = '';
        createState.lastName = '';
        renderCreateForm();
        createModal.classList.add('open');
        createModal.setAttribute('aria-hidden', 'false');
    }

    function closeCreateModal() {
        if (!createModal) return;
        createModal.classList.remove('open');
        createModal.setAttribute('aria-hidden', 'true');
    }

    function unassignedArtists() {
        const overrides = loadAssignments();
        return ARTISTS.filter(function(a) {
            const sid = effectiveStaffId(a, overrides);
            return !STAFF.find(function(s) { return s.id === sid; });
        });
    }

    function renderCreateForm() {
        const body = createModal.querySelector('[data-create-body]');
        const actions = createModal.querySelector('[data-create-actions]');
        const availEmails = getAvailableEmails();
        const showGenres = createState.roles.indexOf('A&R') !== -1;

        // Artists list — show ALL artists for picker (so user can also pull
        // someone over from another staff). Each option shows current owner.
        const overrides = loadAssignments();
        const artistOpts = ARTISTS.map(function(a) {
            const ownerId = effectiveStaffId(a, overrides);
            const owner = STAFF.find(function(s) { return s.id === ownerId; });
            const ownerLabel = owner ? owner.first + ' ' + owner.last : 'Unassigned';
            const checked = createState.artistIds.indexOf(a.id) !== -1;
            return '<label class="create-profile-multiselect__option">' +
                '<input type="checkbox" data-create-artist="' + SC.escapeAttr(a.id) + '"' + (checked ? ' checked' : '') + '/>' +
                '<span class="create-profile-multiselect__name auto-name">' + SC.escapeHtml(a.name) + '</span>' +
                '<span class="create-profile-multiselect__meta">' + SC.escapeHtml(a.genre) + ' · ' + SC.escapeHtml(ownerLabel) + '</span>' +
            '</label>';
        }).join('');

        body.innerHTML =
            '<form class="create-profile-form" autocomplete="off">' +
                // Profile type
                '<div class="create-profile-section">' +
                    '<label class="create-profile-section__label">Profile type<span class="create-profile-section__required">*</span></label>' +
                    '<div class="create-profile-section__hint">Select one or more roles. A person can have hybrid roles (e.g. A&R + PR).</div>' +
                    '<div class="chip-row">' +
                        ['A&R','Manager','PR'].map(function(role) {
                            const active = createState.roles.indexOf(role) !== -1;
                            return '<button type="button" class="chip' + (active ? ' is-active' : '') + '" data-create-role="' + SC.escapeAttr(role) + '">' + SC.escapeHtml(role) + '</button>';
                        }).join('') +
                    '</div>' +
                '</div>' +

                // Email picker
                '<div class="create-profile-section">' +
                    '<label class="create-profile-section__label" for="createEmail">Email from resources<span class="create-profile-section__required">*</span></label>' +
                    '<div class="create-profile-section__hint">Pick an <em>available</em> email from your resources pool. <a href="../resources/index.html" style="color:#4A90E2;">Add new emails →</a></div>' +
                    '<select class="stage-filter__control" id="createEmail" data-create-email>' +
                        '<option value="">— Select email —</option>' +
                        availEmails.map(function(r) {
                            const sel = createState.email === r.email ? ' selected' : '';
                            const typeLabel = r.type === 'common' ? 'Common' : 'Freelance';
                            return '<option value="' + SC.escapeAttr(r.email) + '" data-type="' + r.type + '"' + sel + '>' + SC.escapeHtml(r.email) + ' · ' + typeLabel + (r.name ? ' · ' + SC.escapeHtml(r.name) : '') + '</option>';
                        }).join('') +
                    '</select>' +
                '</div>' +

                // Name
                '<div class="create-profile-section">' +
                    '<label class="create-profile-section__label">Full name<span class="create-profile-section__required">*</span></label>' +
                    '<div style="display:flex;gap:8px;">' +
                        '<input type="text" class="stage-filter__control" data-create-firstname placeholder="First name" value="' + SC.escapeAttr(createState.firstName) + '" style="flex:1;"/>' +
                        '<input type="text" class="stage-filter__control" data-create-lastname placeholder="Last name" value="' + SC.escapeAttr(createState.lastName) + '" style="flex:1;"/>' +
                    '</div>' +
                '</div>' +

                // Profile picture
                '<div class="create-profile-section">' +
                    '<label class="create-profile-section__label">Profile picture</label>' +
                    '<div class="avatar-picker">' +
                        AVATAR_POOL.map(function(filename) {
                            const sel = createState.avatar === filename ? ' is-selected' : '';
                            return '<button type="button" class="avatar-picker__option' + sel + '" data-create-avatar="' + SC.escapeAttr(filename) + '" style="background-image: url(\'../assets/images/artists/' + filename + '\');" aria-label="Avatar"></button>';
                        }).join('') +
                    '</div>' +
                '</div>' +

                // Genre tags — only relevant if A&R is one of the roles
                (showGenres
                ? '<div class="create-profile-section">' +
                    '<label class="create-profile-section__label">Genre focus</label>' +
                    '<div class="create-profile-section__hint">Select the genres this A&R has the most experience with. Used to auto-suggest when a new artist is signed.</div>' +
                    '<div class="chip-row">' +
                        GENRE_TAGS.map(function(g) {
                            const active = createState.genres.indexOf(g) !== -1;
                            return '<button type="button" class="chip' + (active ? ' is-active' : '') + '" data-create-genre="' + SC.escapeAttr(g) + '">' + SC.escapeHtml(g) + '</button>';
                        }).join('') +
                    '</div>' +
                  '</div>'
                : '') +

                // Initial artists
                '<div class="create-profile-section">' +
                    '<label class="create-profile-section__label">Initial artists <span style="color:rgba(255,255,255,0.4);font-weight:400;">(optional)</span></label>' +
                    '<div class="create-profile-section__hint">Add artists at creation. If an artist already has another A&R/Manager/PR, they will be moved here.</div>' +
                    '<div class="create-profile-multiselect">' + artistOpts + '</div>' +
                '</div>' +
            '</form>';

        // Footer actions
        const valid = canSubmit();
        actions.innerHTML =
            '<button type="button" class="release-modal__btn" data-create-close>Cancel</button>' +
            '<button type="button" class="release-modal__btn release-modal__btn--primary" data-create-submit' + (valid ? '' : ' disabled style="opacity:0.5;cursor:not-allowed;"') + '>Create profile</button>';
    }

    function canSubmit() {
        return createState.roles.length > 0
            && createState.email
            && createState.firstName.trim()
            && createState.lastName.trim();
    }

    function showCreateSuccess(staff, tempPassword, sentArtists, oldOwners) {
        const body = createModal.querySelector('[data-create-body]');
        const actions = createModal.querySelector('[data-create-actions]');
        const movedNote = sentArtists.length
            ? '<p style="margin:14px 0 0;color:rgba(255,255,255,0.85);">' +
                '<strong>' + sentArtists.length + ' artist' + (sentArtists.length === 1 ? '' : 'er') + '</strong> assigned:</p>' +
                '<ul style="margin:6px 0 0;padding-left:20px;color:rgba(255,255,255,0.75);font-size:12px;">' +
                    sentArtists.map(function(a, i) {
                        const fromLabel = oldOwners[i] ? ' (moved from ' + SC.escapeHtml(oldOwners[i]) + ')' : '';
                        return '<li>' + SC.escapeHtml(a.name) + fromLabel + '</li>';
                    }).join('') +
                '</ul>'
            : '';
        body.innerHTML =
            '<div class="reassign-confirm-banner" style="margin-bottom:18px;">' +
                '✅ Profile <strong>' + SC.escapeHtml(staff.first + ' ' + staff.last) + '</strong> (<strong>' + SC.escapeHtml(staff.role) + '</strong>) has been created.' +
            '</div>' +
            '<div class="create-profile-summary">' +
                '<strong>Invitation email sent to:</strong><br>' +
                SC.escapeHtml(createState.email) + '<br><br>' +
                '<strong>Username:</strong> ' + SC.escapeHtml(createState.email) + '<br>' +
                '<strong>Temporary password:</strong> <code>' + tempPassword + '</code><br>' +
                '<br>' +
                'The profile is <strong>Pending invitation</strong> until the person logs in, changes their password, and completes their info. You can track status under <a href="../resources/index.html" style="color:#4A90E2;">Resources</a>.' +
                movedNote +
            '</div>';
        actions.innerHTML = '<button type="button" class="release-modal__btn release-modal__btn--primary" data-create-close>Done</button>';
    }

    function submitCreate() {
        if (!canSubmit()) return;
        const overrides = loadAssignments();
        const newStaffId = 's-new-' + Date.now();
        const role = createState.roles.join(' / ');
        const newStaff = {
            id: newStaffId,
            role: role,
            first: createState.firstName.trim(),
            last: createState.lastName.trim(),
            avatar: createState.avatar || 'placeholder-male-1.png',
            email: createState.email,
            genres: createState.genres,
            createdAt: new Date().toISOString().slice(0, 10),
            status: 'pending'
        };
        // Persist new staff
        try {
            const list = JSON.parse(localStorage.getItem('stagecord:created-staff') || '[]');
            list.push(newStaff);
            localStorage.setItem('stagecord:created-staff', JSON.stringify(list));
        } catch (e) { /* ignore */ }
        STAFF.push(newStaff);

        // Mark resource as pending in localStorage so /resources/ can show it
        try {
            const pendingList = JSON.parse(localStorage.getItem('stagecord:resources-pending') || '[]');
            pendingList.push({
                email: createState.email,
                profileType: role,
                profileName: newStaff.first + ' ' + newStaff.last,
                profileId: newStaffId,
                createdAt: newStaff.createdAt
            });
            localStorage.setItem('stagecord:resources-pending', JSON.stringify(pendingList));
        } catch (e) { /* ignore */ }

        // Reassign artists to new staff
        const sentArtists = [];
        const oldOwners = [];
        createState.artistIds.forEach(function(aid) {
            const artist = ARTISTS.find(function(a) { return a.id === aid; });
            if (!artist) return;
            const oldOwnerId = effectiveStaffId(artist, overrides);
            const oldOwner = STAFF.find(function(s) { return s.id === oldOwnerId; });
            overrides[aid] = newStaffId;
            sentArtists.push(artist);
            oldOwners.push(oldOwner ? oldOwner.first + ' ' + oldOwner.last + ', ' + oldOwner.role : null);
        });
        saveAssignments(overrides);

        const tempPassword = genTempPassword();
        showCreateSuccess(newStaff, tempPassword, sentArtists, oldOwners);
        render();
    }

    // Hydrate any previously-created staff from localStorage
    try {
        const created = JSON.parse(localStorage.getItem('stagecord:created-staff') || '[]');
        created.forEach(function(s) {
            if (!STAFF.find(function(x) { return x.id === s.id; })) STAFF.push(s);
        });
    } catch (e) { /* ignore */ }

    // ---------------------------------------------------------
    // Unassigned-artists warning banner
    // ---------------------------------------------------------
    function ensureWarningBanner() {
        let banner = document.querySelector('[data-unassigned-warning]');
        if (banner) return banner;
        const filtersRow = document.querySelector('[data-stage-roster]').closest('.content-wrapper').querySelector('.stage-filters');
        if (!filtersRow) return null;
        banner = document.createElement('div');
        banner.className = 'stage-warning-banner is-hidden';
        banner.setAttribute('data-unassigned-warning', '');
        banner.setAttribute('data-help', 'Warning: These artists are not assigned to an A&R, Manager, or PR. Click "Assign now" to distribute them to relevant staff.');
        banner.innerHTML =
            '<span class="stage-warning-banner__icon" aria-hidden="true">!</span>' +
            '<div class="stage-warning-banner__main" data-unassigned-text></div>' +
            '<button type="button" class="stage-warning-banner__cta" data-unassigned-open>Assign now →</button>';
        filtersRow.parentNode.insertBefore(banner, filtersRow);
        return banner;
    }

    function refreshWarningBanner() {
        const banner = ensureWarningBanner();
        if (!banner) return;
        const unassigned = unassignedArtists();
        if (unassigned.length === 0) {
            banner.classList.add('is-hidden');
            return;
        }
        banner.classList.remove('is-hidden');
        const text = banner.querySelector('[data-unassigned-text]');
        text.innerHTML = '<strong>' + unassigned.length + ' artist' + (unassigned.length === 1 ? '' : 'er') + '</strong> ' + (unassigned.length === 1 ? 'er' : 'er') + ' ikke tildelt en A&amp;R, Manager eller PR. Tildel dem nu så de kan få den rigtige opbakning.';
    }

    // Modal shown when clicking the warning banner — list unassigned with
    // an "Assign" action that hops into the existing reassign flow.
    let unassignedModal = null;

    function ensureUnassignedModal() {
        if (unassignedModal) return unassignedModal;
        const wrap = document.createElement('div');
        wrap.innerHTML =
            '<div class="release-modal-overlay" id="unassignedModal" data-unassigned-modal aria-hidden="true" role="dialog" aria-modal="true">' +
                '<div class="release-modal release-modal--contract">' +
                    '<header class="release-modal__header">' +
                        '<h2 class="release-modal__title">Unassigned artists</h2>' +
                        '<button type="button" class="release-modal__close" data-unassigned-close aria-label="Close">&times;</button>' +
                    '</header>' +
                    '<div class="release-modal__body" data-unassigned-body></div>' +
                    '<footer class="release-modal__actions">' +
                        '<button type="button" class="release-modal__btn" data-unassigned-close>Close</button>' +
                    '</footer>' +
                '</div>' +
            '</div>';
        document.body.appendChild(wrap.firstChild);
        unassignedModal = document.getElementById('unassignedModal');
        return unassignedModal;
    }

    function openUnassignedModal() {
        ensureUnassignedModal();
        const list = unassignedArtists();
        const body = unassignedModal.querySelector('[data-unassigned-body]');
        if (!list.length) {
            body.innerHTML = '<p style="color:rgba(255,255,255,0.65);">All artists are assigned — none are unassigned.</p>';
        } else {
            body.innerHTML =
                '<p class="ar-page-intro" style="margin:0 0 16px;">' + list.length + ' artists are not assigned to an A&amp;R, Manager, or PR. Click <strong>Assign</strong> to pick a staff member from the roster.</p>' +
                '<div class="unassigned-list">' +
                    list.map(function(a) {
                        const recent = '';
                        return '<div class="unassigned-row">' +
                            '<div class="unassigned-row__main">' +
                                '<div class="unassigned-row__name auto-name">' + SC.escapeHtml(a.name) + '</div>' +
                                '<div class="unassigned-row__meta">' + SC.escapeHtml(a.genre) + ' · ' + SC.escapeHtml(a.agreement) + ' · Signed ' + fmtDate(a.signed) + '</div>' +
                            '</div>' +
                            '<span class="unassigned-row__signed">No A&amp;R / Manager / PR</span>' +
                            '<button type="button" class="unassigned-row__assign-btn" data-unassigned-assign="' + SC.escapeAttr(a.id) + '">Assign →</button>' +
                        '</div>';
                    }).join('') +
                '</div>';
            if (typeof formatAllNames === 'function') formatAllNames(unassignedModal);
        }
        unassignedModal.classList.add('open');
        unassignedModal.setAttribute('aria-hidden', 'false');
    }
    function closeUnassignedModal() {
        if (!unassignedModal) return;
        unassignedModal.classList.remove('open');
        unassignedModal.setAttribute('aria-hidden', 'true');
    }

    function fitExpandedPanel(card) {
        const panel = card.querySelector('.stage-roster__expanded');
        if (!panel) return;
        // Cap the panel at a generous height — the page has bottom padding
        // so the card can be scrolled to the top to make room below.
        panel.style.maxHeight = '380px';

        // After layout settles, scroll so the card's top sits just below the
        // fixed topbar (~88px). That leaves the entire viewport below the
        // card available for the expanded panel — even bottom-row cards
        // like Filippa Sand can show all their artists without clipping.
        requestAnimationFrame(function() {
            const cardRect = card.getBoundingClientRect();
            const targetTop = 88; // topbar height + small margin
            const scrollDelta = cardRect.top - targetTop;
            if (Math.abs(scrollDelta) > 4) {
                window.scrollBy({ top: scrollDelta, behavior: 'smooth' });
            }
        });
    }

    window.addEventListener('resize', function() {
        const active = document.querySelector('.stage-roster__card.is-active');
        if (active) fitExpandedPanel(active);
    });

    document.addEventListener('DOMContentLoaded', render);
    if (document.readyState !== 'loading') render();
})();
