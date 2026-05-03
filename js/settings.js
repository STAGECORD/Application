// STAGECORD PRO — mode-aware settings page (/settings/)
// Renders different settings sections depending on the current Viewing-as mode.
// Artist + Fan redirect to their existing detailed pages; the company Stage
// roles, A&R, and Venue render inline here with role-appropriate fields.

// ============================================================
// Cross-page redirect — keep settings consistent with current mode.
// If you're on /artist/settings/ but not in artist mode, or on
// /fan/settings/ but not in fan mode, hop over to the unified
// /settings/ page so the title and content match your role.
// ============================================================
(function() {
    const path = window.location.pathname;
    let saved = '';
    try { saved = localStorage.getItem('stagecord:userMode') || ''; } catch (e) {}
    if (path.indexOf('/artist/settings/') !== -1 && saved && saved !== 'artist') {
        window.location.replace(localAsset('settings/index.html'));
        return;
    }
    if (path.indexOf('/fan/settings/') !== -1 && saved && saved !== 'fan') {
        window.location.replace(localAsset('settings/index.html'));
        return;
    }
})();

// ============================================================
// Mode-aware settings page (/settings/)
// ============================================================
// Renders different settings sections depending on the current
// Viewing-as mode. Artist/Fan have their own detailed legacy pages
// — this page handles the company Stage roles (Filming/Brand/Label),
// A&R, and Venue with role-appropriate fields.
(function() {
    if (window.location.pathname.indexOf('/settings/') === -1) return;
    if (window.location.pathname.indexOf('/artist/settings/') !== -1) return;
    if (window.location.pathname.indexOf('/fan/settings/') !== -1) return;

    const SETTINGS_BY_MODE = {
        artist: {
            redirect: '../artist/settings/index.html'
        },
        fan: {
            redirect: '../fan/settings/index.html'
        },
        venue: {
            title: 'Venue Settings',
            subtitle: 'Editing RUST',
            tabs: [
                {
                    id: 'venue', label: 'Venue info',
                    sections: [{
                        title: 'Public information',
                        fields: [
                            { type:'text', label:'Venue name', value:'RUST', help:'The name shown on tickets, listings, and the public venue page.' },
                            { type:'text', label:'Handle', prefix:'stagecord.com/', value:'rust', help:'Your unique URL on the platform. Change with care — old links break.' },
                            { type:'text', label:'Address', value:'Guldbergsgade 8, 2200 København N', help:'Public street address used by maps and ticket confirmations.' },
                            { type:'text', label:'Capacity (standing)', value:'700', help:'Maximum standing-room capacity for licensing and ticket-cap calculations.' },
                            { type:'text', label:'Capacity (seated)', value:'350', help:'Maximum seated capacity for events with a sit-down setup.' },
                            { type:'select', label:'Venue type', value:'Music venue', options:['Music venue','Club','Theatre','Festival site','Multi-purpose'], help:'Determines which artists can pitch to you and which event types your venue is listed under.' }
                        ]
                    },{
                        title: 'Booking preferences',
                        fields: [
                            { type:'select', label:'Pitch acceptance', value:'Open to pitches', options:['Open to pitches','Curated only','Closed'], help:'Open: any artist can pitch. Curated: pitches only by invitation. Closed: hide your venue from pitch search.' },
                            { type:'text', label:'Standard rental fee (DKK)', value:'18,000', help:'Default base rental quoted to artists who pitch. Can be negotiated per-event.' },
                            { type:'select', label:'Bar revenue split', value:'Venue keeps 100%', options:['Venue keeps 100%','70/30 venue','50/50','Negotiable'], help:'Default bar revenue split with touring artists. Can override per booking.' }
                        ]
                    }]
                },
                {
                    id: 'team', label: 'Team',
                    sections: [{
                        title: 'Venue team',
                        fields: [
                            { type:'text', label:'Booking manager', value:'Ida Strand', help:'Primary contact for incoming pitches and booking enquiries.' },
                            { type:'text', label:'Sound engineer', value:'Mikkel Riis', help:'Technical lead on show days. Also responsible for the venue tech rider.' },
                            { type:'text', label:'Bar manager', value:'Sigrid Hofstad', help:'Manages staffing and stocking for show nights.' }
                        ]
                    }]
                },
                {
                    id: 'notifications', label: 'Notifications',
                    sections: [{
                        title: 'Email alerts',
                        fields: [
                            { type:'checkbox', label:'New artist pitch received', checked:true, help:'Email the booking manager when a new artist pitches to play your venue.' },
                            { type:'checkbox', label:'Ticket sales milestones', checked:true, help:'Get notified when an upcoming show passes 25% / 50% / 75% / sold-out.' },
                            { type:'checkbox', label:'Day-of-show reminders', checked:true, help:'Reminder emails sent at 09:00 on show days with the schedule and tech rider.' }
                        ]
                    }]
                },
                {
                    id: 'privacy', label: 'Privacy',
                    sections: [{
                        title: 'Visibility',
                        fields: [
                            { type:'checkbox', label:'Show capacity publicly', checked:true, help:'When enabled, the venue page lists capacity. When disabled, only artists who get a quote see it.' },
                            { type:'checkbox', label:'Show past show history', checked:true, help:'Show a list of artists who have played the venue. Useful for credibility.' },
                            { type:'checkbox', label:'Allow direct messages from fans', checked:false, help:'When disabled, fans must follow the venue first to send messages.' }
                        ]
                    }]
                },
                {
                    id: 'billing', label: 'Billing & payouts',
                    sections: [{
                        title: 'Payout details',
                        fields: [
                            { type:'text', label:'Bank account (IBAN)', value:'DK•• •••• •••• 8492', help:'Where ticket revenue is paid out after each show. Showing only last 4 digits for security.' },
                            { type:'select', label:'Payout schedule', value:'Weekly', options:['Daily','Weekly','Bi-weekly','Monthly'], help:'How often payouts are batched and sent. Faster schedules carry a small processing fee.' }
                        ]
                    }]
                }
            ]
        },
        educator: {
            title: 'Educator Settings',
            subtitle: 'Editing Lasse Søndergård · Sound production teacher',
            tabs: [
                {
                    id: 'profile', label: 'Profile',
                    sections: [{
                        title: 'Public profile',
                        fields: [
                            { type:'text', label:'Display name', value:'Lasse Søndergård', help:'The name shown on your public educator profile and in search results.' },
                            { type:'text', label:'Tagline', value:'Sound production · 12 years', help:'A short subtitle shown under your name on the profile cover.' },
                            { type:'textarea', label:'About / Bio', value:'I have been producing professionally since 2014, with credits on records by Anchi Humifuku, Jeremy Freedom, and a handful of indie acts. For the last five years I have also been teaching one-on-one — both in my home studio in Vesterbro and online over Logic Pro X screen-share.', help:'The longer bio shown in the About section of your public profile.' }
                        ]
                    },{
                        title: 'Specialties',
                        fields: [
                            { type:'tags', label:'Primary specialty', tags:['Sound production'], help:'Your main teaching area, highlighted on your profile. Pick one.' },
                            { type:'tags', label:'Secondary skills', tags:['Logic Pro X','Mixing','Mastering','Beat-making','Vocal recording','Songwriting'], help:'Other skills you teach. Used by the matching algorithm to suggest you to relevant students.' }
                        ]
                    }]
                },
                {
                    id: 'pricing', label: 'Pricing & formats',
                    sections: [{
                        title: 'Lesson formats',
                        fields: [
                            { type:'text', label:'1:1 · 60 min (DKK)', value:'650', help:'Standard one-hour one-on-one lesson, delivered online or in-person.' },
                            { type:'text', label:'1:1 · 90 min (DKK)', value:'920', help:'Extended one-on-one for deep-dive on a specific track or topic.' },
                            { type:'text', label:'10-lesson package (DKK)', value:'5,520', help:'Discounted package — equivalent to 8.5 individual lessons. Encourages commitment from students.' },
                            { type:'text', label:'Group cohort · 4 students (DKK)', value:'2,800', help:'Per-student price for an 8-week structured group program.' },
                            { type:'checkbox', label:'Offer free 15-min intro call', checked:true, help:'New students can book a free 15-minute call to gauge fit before committing to paid lessons.' }
                        ]
                    }]
                },
                {
                    id: 'availability', label: 'Availability',
                    sections: [{
                        title: 'When you teach',
                        fields: [
                            { type:'select', label:'Default lesson hours', value:'Weekdays 14:00–20:00', options:['Weekdays 09:00–17:00','Weekdays 14:00–20:00','Evenings only','Weekends only','Custom'], help:'Your default availability window. Set custom slots day-by-day in the calendar editor.' },
                            { type:'select', label:'Lesson location', value:'Both', options:['Online only','In-person only','Both'], help:'Whether you offer online lessons (screen-share), in-person, or both. Students filter by this.' },
                            { type:'text', label:'In-person address', value:'Vesterbro studio · Copenhagen', help:'Visible to students after they book — not shown publicly. Leave blank if online-only.' }
                        ]
                    },{
                        title: 'Booking rules',
                        fields: [
                            { type:'checkbox', label:'Bookable by anyone', checked:true, help:'When enabled, anyone can request a lesson. Disable to limit booking to students you have invited or to existing students only.' },
                            { type:'select', label:'Minimum advance notice', value:'24 hours', options:['Same day','12 hours','24 hours','48 hours','1 week'], help:'Earliest a new lesson can be booked. Gives you time to prepare.' },
                            { type:'select', label:'Cancellation policy', value:'24 hours · free', options:['Anytime · free','24 hours · free','48 hours · free','No refunds'], help:'When students can cancel without losing their booking fee.' }
                        ]
                    }]
                },
                {
                    id: 'students', label: 'Student tools',
                    sections: [{
                        title: 'Practice plan',
                        fields: [
                            { type:'checkbox', label:'Auto-assign starter videos to new students', checked:true, help:'When a new student signs up, automatically assign your "fundamentals" videos so they have something to start practicing immediately.' },
                            { type:'checkbox', label:'Send weekly practice reminders', checked:true, help:'Email students a weekly reminder of which videos they have not watched yet.' }
                        ]
                    }]
                },
                {
                    id: 'notifications', label: 'Notifications',
                    sections: [{
                        title: 'Email alerts',
                        fields: [
                            { type:'checkbox', label:'New booking request', checked:true, help:'Email when a student requests a new lesson — you have 24 hours to accept or decline.' },
                            { type:'checkbox', label:'Lesson starts in 1 hour', checked:true, help:'Reminder before each scheduled lesson with the student\'s topic and any prep notes.' },
                            { type:'checkbox', label:'New review received', checked:true, help:'Email when a student leaves a review on your profile.' },
                            { type:'checkbox', label:'Student finishes assigned video', checked:false, help:'Optional notification when a student watches a video you assigned. Off by default to avoid noise.' }
                        ]
                    }]
                },
                {
                    id: 'account', label: 'Account',
                    sections: [{
                        title: 'Login',
                        fields: [
                            { type:'text', label:'Email', value:'lasse@soendergaard.dk', help:'Your login email. Also where booking confirmations and notifications are sent.' },
                            { type:'button', label:'Change password', help:'Send a password reset link to your email.' },
                            { type:'checkbox', label:'Two-factor authentication', checked:true, help:'Adds a second factor at login for security.' }
                        ]
                    },{
                        title: 'Linked artist profile',
                        fields: [
                            { type:'checkbox', label:'Link to my artist profile', checked:false, help:'When enabled, your educator profile shows a link to your artist page. Useful if you also release music — students can hear what you produce.' }
                        ]
                    }]
                }
            ]
        },
        ar: {
            title: 'A&R Settings',
            subtitle: 'Editing Victoria Larsen · A&R at Tomorrow Records',
            tabs: [
                {
                    id: 'profile', label: 'Personal profile',
                    sections: [{
                        title: 'Your details',
                        fields: [
                            { type:'text', label:'Full name', value:'Victoria Larsen', help:'Your name as shown to your assigned artists, your label, and on signed contracts.' },
                            { type:'text', label:'Job title', value:'Senior A&R · Manager', help:'How your role is presented internally. Hybrid roles can include both (e.g. A&R · Manager).' },
                            { type:'textarea', label:'Bio', value:'Senior A&R focused on R&B / Soul and Hip Hop. Joined Tomorrow Records in 2022. Previously at Universal DK.', help:'Short bio shown on your internal Tomorrow Records profile and to artists assigned to you.' }
                        ]
                    },{
                        title: 'Genre focus',
                        fields: [
                            { type:'tags', label:'Specialty genres', tags:['R&B / Soul','Hip Hop','Pop','Indie'], help:'Genres you have most experience with. Used to auto-suggest you when a new artist signs in a matching genre.' }
                        ]
                    }]
                },
                {
                    id: 'permissions', label: 'Acting-as permissions',
                    sections: [{
                        title: 'What you can do on behalf of your artists',
                        fields: [
                            { type:'checkbox', label:'Approve fan content (covers, tutorials, dance videos)', checked:true, help:'When approved by you, content is published to the artist page. Action is logged to the artist owner with your name.' },
                            { type:'checkbox', label:'Reply to fan messages', checked:true, help:'Reply directly on the artist’s behalf. Each message gets an internal "Sent by A&R Victoria" label only the artist owner sees.' },
                            { type:'checkbox', label:'Sign contracts under 50,000 DKK', checked:true, help:'Authorise small contracts (sync licenses, single-track placements) without artist countersignature. Larger amounts always require the artist.' },
                            { type:'checkbox', label:'Edit profile bio and photos', checked:false, help:'Most artists prefer to control their own profile. Off by default — toggle on for artists who delegate this.' }
                        ]
                    }]
                },
                {
                    id: 'notifications', label: 'Notifications',
                    sections: [{
                        title: 'Updates about your roster',
                        fields: [
                            { type:'checkbox', label:'New pitch sent by my artists', checked:true, help:'Email when one of your artists pitches a song to a radio host or sync target.' },
                            { type:'checkbox', label:'Contract expiring within 90 days', checked:true, help:'Heads-up when a contract for one of your artists is about to expire — gives you time to renegotiate.' },
                            { type:'checkbox', label:'New artist assigned to me', checked:true, help:'When the label assigns a new artist to your roster, you get notified with a quick summary.' },
                            { type:'checkbox', label:'Daily roster digest', checked:false, help:'A 09:00 summary of what happened across all your artists yesterday. Off by default — turn on for active periods.' }
                        ]
                    }]
                },
                {
                    id: 'account', label: 'Account',
                    sections: [{
                        title: 'Login',
                        fields: [
                            { type:'text', label:'Email', value:'victoria.larsen@sony.com', help:'Your work email used to log in. Managed by your label admin — contact them to change.', readonly:true },
                            { type:'button', label:'Change password', help:'Send a password reset link to your work email. The link expires in 30 minutes.' },
                            { type:'checkbox', label:'Two-factor authentication (TOTP)', checked:true, help:'Adds a second factor at login using an authenticator app. Recommended for accounts that can act on artist behalf.' }
                        ]
                    }]
                }
            ]
        },
        licensor: {
            title: 'Filming Stage Settings',
            subtitle: 'Editing Nordisk Film company profile',
            tabs: [
                {
                    id: 'company', label: 'Company',
                    sections: [{
                        title: 'Public information',
                        fields: [
                            { type:'text', label:'Company name', value:'Nordisk Film', help:'The legal company name shown on contracts and pitch invitations.' },
                            { type:'text', label:'Display handle', prefix:'stagecord.com/company/', value:'nordiskfilm', help:'Public URL of your company profile.' },
                            { type:'textarea', label:'About', value:'Founded 1906 — the world’s second-oldest continuously operating film production company. Headquartered in Copenhagen.', help:'Short description visible to artists and composers when you invite them to pitch.' },
                            { type:'text', label:'Headquarters country', value:'Denmark', help:'Used for default contract jurisdiction and tax/withholding calculations on payouts.' },
                            { type:'text', label:'VAT number', value:'DK•••••432', help:'Required for invoicing. Shown only to billing admins.' }
                        ]
                    },{
                        title: 'Default project settings',
                        fields: [
                            { type:'select', label:'Default contract template', value:'Sync licensing — film/TV', options:['Sync licensing — film/TV','Original score commission','Master use license','Custom'], help:'Used as the starting point when creating a new project. Can be overridden per project.' },
                            { type:'select', label:'Default pitch visibility', value:'Open to all composers', options:['Open to all composers','Invitation only','Closed'], help:'Whether new projects are open for pitches by default. Per-project override available.' },
                            { type:'text', label:'Default sync budget cap', value:'1,000,000 USD', help:'Default upper budget shown on Composer Search filters. Per-project budgets can exceed.' }
                        ]
                    }]
                },
                {
                    id: 'team', label: 'Team & permissions',
                    sections: [{
                        title: 'Administrators',
                        fields: [
                            { type:'list', label:'Super-admins', items:['Alexandra Rivers (Project Director)','Karl Felterlight'], help:'Super-admins can create/remove other admins, manage company billing, and override regional permission scoping.' },
                            { type:'list', label:'Regional admins — Denmark', items:['Mette Henriksen (Jutland)','Lars Bergström (Sjælland)'], help:'Regional admins can only create and manage profiles within their region. Configured by super-admins.' }
                        ]
                    },{
                        title: 'Defaults for new staff profiles',
                        fields: [
                            { type:'checkbox', label:'Require 2FA on all admin accounts', checked:true, help:'Force two-factor authentication for everyone with admin access. Strongly recommended for company accounts.' },
                            { type:'checkbox', label:'Probationary period for new hires', checked:true, help:'New profiles cannot sign contracts above 25,000 USD during their first 90 days.' }
                        ]
                    }]
                },
                {
                    id: 'resources', label: 'Resources & email domain',
                    sections: [{
                        title: 'Email domain',
                        fields: [
                            { type:'text', label:'Company email domain', value:'@nordiskfilm.com', help:'Used for "Common" resources. Emails on this domain are auto-trusted; freelancers (Non-common) need explicit approval.' },
                            { type:'checkbox', label:'Auto-create resource on first login', checked:false, help:'When someone logs in with an email on the company domain that is not yet a resource, automatically provision them. Off recommended for security.' }
                        ]
                    },{
                        title: 'Resource pool',
                        fields: [
                            { type:'link', label:'Open Resources page', href:'../resources/index.html', help:'Manage all email accounts (active, pending, available, inactive) for your company. Available emails are used when creating new staff profiles.' }
                        ]
                    }]
                },
                {
                    id: 'billing', label: 'Billing & payouts',
                    sections: [{
                        title: 'Payment method',
                        fields: [
                            { type:'text', label:'Card on file', value:'Visa ending •• 4567', help:'Used to pay for premium platform features and any pass-through fees. Statement emailed monthly.' },
                            { type:'text', label:'Billing email', value:'finance@nordiskfilm.com', help:'Where invoices and statements are emailed. Should be a shared mailbox if multiple finance people.' }
                        ]
                    },{
                        title: 'Outgoing payouts',
                        fields: [
                            { type:'text', label:'Default payout currency', value:'USD', help:'Currency used by default when paying composers/artists. Can be overridden per contract.' },
                            { type:'select', label:'Withholding tax handling', value:'Automatic by jurisdiction', options:['Automatic by jurisdiction','Manual','Always 15%','Never withhold'], help:'How withholding is applied on cross-border payouts. Automatic uses the recipient country’s rate.' }
                        ]
                    }]
                },
                {
                    id: 'notifications', label: 'Notifications',
                    sections: [{
                        title: 'Project updates',
                        fields: [
                            { type:'checkbox', label:'New pitch on an open project', checked:true, help:'Email the project director when a composer submits a new pitch to one of your projects.' },
                            { type:'checkbox', label:'Contract signed by a composer', checked:true, help:'Notify the project director when a composer countersigns a contract.' },
                            { type:'checkbox', label:'Project deadline approaching (within 14 days)', checked:true, help:'Heads-up before any project hits its scheduled delivery date.' }
                        ]
                    }]
                },
                {
                    id: 'privacy', label: 'Privacy',
                    sections: [{
                        title: 'Public visibility',
                        fields: [
                            { type:'checkbox', label:'Show company on the public Stages directory', checked:true, help:'When enabled, your company appears in artist-side search and the public "Brands & Studios" directory.' },
                            { type:'checkbox', label:'Show team headcount publicly', checked:false, help:'When disabled, the team size is hidden from non-employees.' }
                        ]
                    }]
                }
            ]
        },
        sponsor: {
            title: 'Brand Stage Settings',
            subtitle: 'Editing Coca-Cola DK company profile',
            tabs: [
                {
                    id: 'company', label: 'Company & brand',
                    sections: [{
                        title: 'Brand identity',
                        fields: [
                            { type:'text', label:'Brand name', value:'Coca-Cola DK', help:'The brand name shown on sync licensing requests and event sponsorships.' },
                            { type:'text', label:'Display handle', prefix:'stagecord.com/brand/', value:'cocacola-dk', help:'Public URL of your brand profile.' },
                            { type:'textarea', label:'About', value:'The Danish division of The Coca-Cola Company. Active sponsor of music festivals, sports, and brand activations across Scandinavia.', help:'Short description visible to artists and venues when you reach out for partnerships.' },
                            { type:'text', label:'Primary brand color', value:'#FE001A', help:'Used in the sponsor showcase on artist event pages where you sponsor a concert.' }
                        ]
                    },{
                        title: 'Default campaign settings',
                        fields: [
                            { type:'select', label:'Default usage type', value:'Synch licensing — campaign', options:['Synch licensing — campaign','Live event sponsorship','Influencer activation','Multi-format'], help:'Default starting point when creating a new project. Per-project override available.' },
                            { type:'text', label:'Default sync budget cap', value:'500,000 USD', help:'Default upper budget when filtering songs for licensing.' }
                        ]
                    }]
                },
                {
                    id: 'team', label: 'Team & permissions',
                    sections: [{
                        title: 'Administrators',
                        fields: [
                            { type:'list', label:'Super-admins', items:['Karl Felterlight (CMO)','Sara Lindholm'], help:'Super-admins can create/remove other admins, manage company billing, and override regional permission scoping.' },
                            { type:'list', label:'Campaign managers', items:['Anders Borup (TV/Digital)','Camilla Step (Live events)'], help:'Campaign managers can create projects and approve sync licenses up to their authority limit.' }
                        ]
                    }]
                },
                {
                    id: 'resources', label: 'Resources & email domain',
                    sections: [{
                        title: 'Email domain',
                        fields: [
                            { type:'text', label:'Company email domain', value:'@cocacola-dk.com', help:'Used for "Common" resources. Emails on this domain are auto-trusted.' }
                        ]
                    },{
                        title: 'Resource pool',
                        fields: [
                            { type:'link', label:'Open Resources page', href:'../resources/index.html', help:'Manage all email accounts (active, pending, available, inactive) for your brand company.' }
                        ]
                    }]
                },
                {
                    id: 'billing', label: 'Billing',
                    sections: [{
                        title: 'Payment method',
                        fields: [
                            { type:'text', label:'Card on file', value:'Mastercard ending •• 8821', help:'Used to pay for sync licenses and platform fees. Statement emailed monthly.' },
                            { type:'text', label:'Billing email', value:'invoices@cocacola-dk.com', help:'Where invoices and statements are emailed.' }
                        ]
                    }]
                },
                {
                    id: 'notifications', label: 'Notifications',
                    sections: [{
                        title: 'Campaign updates',
                        fields: [
                            { type:'checkbox', label:'Sync license accepted', checked:true, help:'Email when a song-rights holder accepts a sync license you negotiated.' },
                            { type:'checkbox', label:'Live artist accepted booking', checked:true, help:'Email when an artist accepts a booking for one of your sponsored events.' },
                            { type:'checkbox', label:'Project budget threshold reached (75%)', checked:true, help:'Heads-up when a project has spent 75% of its budget — gives you time to evaluate.' }
                        ]
                    }]
                },
                {
                    id: 'privacy', label: 'Privacy',
                    sections: [{
                        title: 'Public visibility',
                        fields: [
                            { type:'checkbox', label:'Show brand on the public Stages directory', checked:true, help:'When enabled, your brand appears in artist-side search and public sponsor directories.' },
                            { type:'checkbox', label:'Allow artists to pitch to your campaigns', checked:true, help:'When enabled, artists can proactively pitch songs to your projects. Disabled means you only invite specific artists.' }
                        ]
                    }]
                }
            ]
        },
        manager: {
            title: 'Label Stage Settings',
            subtitle: 'Editing Tomorrow Records company profile',
            tabs: [
                {
                    id: 'company', label: 'Label info',
                    sections: [{
                        title: 'Label profile',
                        fields: [
                            { type:'text', label:'Label name', value:'Tomorrow Records', help:'The legal label name shown on contracts and royalty statements.' },
                            { type:'text', label:'Display handle', prefix:'stagecord.com/label/', value:'tomorrow-records', help:'Public URL of your label profile.' },
                            { type:'textarea', label:'About', value:'Independent Copenhagen-based label, founded 2018. Focus on Pop, R&B/Soul, and Indie — with a strong development pipeline for emerging artists.', help:'Short description visible to artists when they consider signing.' },
                            { type:'text', label:'Headquarters country', value:'Denmark', help:'Used for default contract jurisdiction and tax handling.' }
                        ]
                    },{
                        title: 'Roster overview',
                        fields: [
                            { type:'metric', label:'Active artists', value:'81', help:'Total artists currently signed across all your A&R/Manager profiles.' },
                            { type:'metric', label:'Active staff', value:'28', help:'Total A&R, Manager, and PR profiles active under the label.' },
                            { type:'link', label:'Open A&R / Manager / PR roster', href:'../manager/index.html', help:'View and manage your full team and their assigned artists.' }
                        ]
                    }]
                },
                {
                    id: 'contracts', label: 'Contract templates',
                    sections: [{
                        title: 'Default templates',
                        fields: [
                            { type:'select', label:'Default contract type for new signings', value:'50/50 partnership', options:['Traditional record deal','50/50 partnership','360 deal','Artist-owned (license deal)'], help:'Sets the default royalty splits and rights ownership when a new artist signs to your label. Per-artist override always available.' },
                            { type:'select', label:'Standard contract length', value:'2 Years', options:['1 Year','2 Years','3 Years','5 Years'], help:'Default contract duration. Most label deals are 2-3 years with renewal options.' },
                            { type:'select', label:'Standard agreement scope', value:'2 Albums or 30 singles', options:['1 Album','2 Albums','1 Album & 6 singles','2 Albums or 30 singles','3 Albums'], help:'Default deliverable commitment from the artist over the contract length.' }
                        ]
                    },{
                        title: 'Approval thresholds',
                        fields: [
                            { type:'text', label:'Auto-approve sync licenses below (USD)', value:'10,000', help:'Sync license requests below this amount are auto-approved by the artist’s assigned A&R. Above requires the artist’s countersignature.' },
                            { type:'checkbox', label:'Junior staff need senior approval for signings', checked:true, help:'When enabled, A&Rs in their probationary period or with "Junior" title can’t finalize signings without their senior’s sign-off.' }
                        ]
                    }]
                },
                {
                    id: 'team', label: 'Team & permissions',
                    sections: [{
                        title: 'Administrators',
                        fields: [
                            { type:'list', label:'Super-admins', items:['Harvey Davis (Label President)','Victoria Larsen'], help:'Super-admins can create/remove other admins, set permissions, and manage label billing.' },
                            { type:'list', label:'Regional admins — Denmark', items:['Mille Schou (Copenhagen + Sjælland)','Felix Munk (Jutland + Funen)'], help:'Regional admins manage roster within their region. Configured by super-admins.' }
                        ]
                    },{
                        title: 'Defaults for new staff profiles',
                        fields: [
                            { type:'checkbox', label:'Require 2FA on all admin accounts', checked:true, help:'Force two-factor authentication for everyone with admin access.' },
                            { type:'checkbox', label:'Probationary period for new hires (90 days)', checked:true, help:'New A&R/Manager profiles cannot sign artists above $50K advance during the probationary period.' },
                            { type:'checkbox', label:'Show hierarchy on roster cards (label-internal only)', checked:true, help:'Display senior/junior reporting lines on staff cards. Hidden from artists and the public.' }
                        ]
                    }]
                },
                {
                    id: 'resources', label: 'Resources & email domain',
                    sections: [{
                        title: 'Email domain',
                        fields: [
                            { type:'text', label:'Label email domain', value:'@sony.com', help:'Used for "Common" resources. Emails on this domain are auto-trusted; freelancers (Non-common) require explicit approval.' },
                            { type:'checkbox', label:'Auto-create resource on first login', checked:false, help:'Off recommended for security — keeps explicit control over who joins the label.' }
                        ]
                    },{
                        title: 'Resource pool',
                        fields: [
                            { type:'link', label:'Open Resources page', href:'../resources/index.html', help:'Manage all email accounts for your label staff.' }
                        ]
                    }]
                },
                {
                    id: 'billing', label: 'Billing & payouts',
                    sections: [{
                        title: 'Label-side payouts',
                        fields: [
                            { type:'text', label:'Bank account (IBAN)', value:'DK•• •••• •••• 1923', help:'Where the label receives its share of royalties from streaming, sales, sync, and brand deals.' },
                            { type:'select', label:'Payout schedule', value:'Monthly', options:['Weekly','Bi-weekly','Monthly','Quarterly'], help:'How often the label’s share is batched and disbursed. Monthly is industry standard.' }
                        ]
                    },{
                        title: 'Artist-side payouts',
                        fields: [
                            { type:'select', label:'Default payout schedule for artists', value:'Monthly', options:['Weekly','Bi-weekly','Monthly','Quarterly'], help:'Default schedule for artist royalty disbursements. Per-artist override available in their contract.' },
                            { type:'select', label:'Withholding tax handling', value:'Automatic by jurisdiction', options:['Automatic by jurisdiction','Manual','Always 15%','Never withhold'], help:'How withholding tax is applied on artist payouts. Automatic uses the recipient country’s rate.' }
                        ]
                    }]
                },
                {
                    id: 'notifications', label: 'Notifications',
                    sections: [{
                        title: 'Roster updates',
                        fields: [
                            { type:'checkbox', label:'New artist signed by my A&R team', checked:true, help:'Email super-admins when an A&R finalizes signing a new artist.' },
                            { type:'checkbox', label:'Contract expiring within 90 days', checked:true, help:'Heads-up on contracts about to expire — gives time for renewal negotiations.' },
                            { type:'checkbox', label:'A&R/Manager profile created', checked:true, help:'Email when a new internal profile is created (used for audit trail).' },
                            { type:'checkbox', label:'Unassigned artist warning (after 7 days)', checked:true, help:'When a newly-signed artist hasn’t been assigned to an A&R within 7 days.' }
                        ]
                    }]
                },
                {
                    id: 'privacy', label: 'Privacy',
                    sections: [{
                        title: 'Public visibility',
                        fields: [
                            { type:'checkbox', label:'Show label on the public Stages directory', checked:true, help:'When enabled, the label appears in public directories. Artists can browse "labels accepting submissions".' },
                            { type:'checkbox', label:'Show roster size publicly', checked:true, help:'Display total active-artists count on the public label page. Off shows only label name + bio.' },
                            { type:'checkbox', label:'Allow self-pitches from unsigned artists', checked:true, help:'When enabled, unsigned artists can pitch directly to your label. Disabled means you only sign from invitations.' }
                        ]
                    }]
                }
            ]
        }
    };

    function getCurrentMode() {
        try { return localStorage.getItem('stagecord:userMode') || 'artist'; } catch (e) { return 'artist'; }
    }

    function buildField(f) {
        const help = f.help ? ' data-help="' + SC.escapeAttr(f.help) + '"' : '';
        switch (f.type) {
            case 'text':
                if (f.prefix) {
                    return '<div class="form-field"' + help + '>' +
                        '<label class="form-field__label">' + SC.escapeHtml(f.label) + '</label>' +
                        '<div class="settings-input-prefix">' +
                            '<span class="settings-input-prefix__label">' + SC.escapeHtml(f.prefix) + '</span>' +
                            '<input type="text" value="' + SC.escapeAttr(f.value || '') + '"' + (f.readonly ? ' readonly' : '') + '>' +
                        '</div>' +
                    '</div>';
                }
                return '<div class="form-field"' + help + '>' +
                    '<label class="form-field__label">' + SC.escapeHtml(f.label) + '</label>' +
                    '<input type="text" value="' + SC.escapeAttr(f.value || '') + '"' + (f.readonly ? ' readonly' : '') + '>' +
                '</div>';
            case 'textarea':
                return '<div class="form-field"' + help + '>' +
                    '<label class="form-field__label">' + SC.escapeHtml(f.label) + '</label>' +
                    '<textarea rows="4">' + SC.escapeHtml(f.value || '') + '</textarea>' +
                '</div>';
            case 'select':
                const options = (f.options || []).map(function(o) {
                    return '<option' + (o === f.value ? ' selected' : '') + '>' + SC.escapeHtml(o) + '</option>';
                }).join('');
                return '<div class="form-field"' + help + '>' +
                    '<label class="form-field__label">' + SC.escapeHtml(f.label) + '</label>' +
                    '<select>' + options + '</select>' +
                '</div>';
            case 'checkbox':
                return '<label class="settings-toggle"' + help + '>' +
                    '<input type="checkbox"' + (f.checked ? ' checked' : '') + '>' +
                    '<span>' + SC.escapeHtml(f.label) + '</span>' +
                '</label>';
            case 'tags':
                return '<div class="form-field"' + help + '>' +
                    '<label class="form-field__label">' + SC.escapeHtml(f.label) + '</label>' +
                    '<div class="chip-row">' +
                        (f.tags || []).map(function(t) {
                            return '<span class="chip is-active">' + SC.escapeHtml(t) + '</span>';
                        }).join('') +
                        '<button type="button" class="chip">+ Add genre</button>' +
                    '</div>' +
                '</div>';
            case 'list':
                return '<div class="form-field"' + help + '>' +
                    '<label class="form-field__label">' + SC.escapeHtml(f.label) + '</label>' +
                    '<ul class="settings-list">' +
                        (f.items || []).map(function(i) { return '<li>' + SC.escapeHtml(i) + '</li>'; }).join('') +
                    '</ul>' +
                    '<button type="button" class="release-modal__btn" style="margin-top:8px;">+ Add</button>' +
                '</div>';
            case 'metric':
                return '<div class="form-field"' + help + '>' +
                    '<label class="form-field__label">' + SC.escapeHtml(f.label) + '</label>' +
                    '<div class="settings-metric">' + SC.escapeHtml(f.value) + '</div>' +
                '</div>';
            case 'link':
                return '<div class="form-field"' + help + '>' +
                    '<a href="' + SC.escapeAttr(f.href) + '" class="release-modal__btn release-modal__btn--primary" style="display:inline-flex;text-decoration:none;align-items:center;">' + SC.escapeHtml(f.label) + ' →</a>' +
                '</div>';
            case 'button':
                return '<div class="form-field"' + help + '>' +
                    '<button type="button" class="release-modal__btn">' + SC.escapeHtml(f.label) + '</button>' +
                '</div>';
            default:
                return '';
        }
    }

    function buildPanel(tab) {
        return '<section class="settings-panel" data-panel="' + SC.escapeAttr(tab.id) + '" role="tabpanel">' +
            tab.sections.map(function(sec) {
                return '<div class="settings-section">' +
                    '<h2 class="settings-section__title">' + SC.escapeHtml(sec.title) + '</h2>' +
                    sec.fields.map(buildField).join('') +
                '</div>';
            }).join('') +
        '</section>';
    }

    function render() {
        const mode = getCurrentMode();
        const config = SETTINGS_BY_MODE[mode];
        if (!config) return;
        if (config.redirect) {
            window.location.replace(config.redirect);
            return;
        }
        document.querySelector('[data-settings-title]').textContent = config.title;
        document.querySelector('[data-settings-subtitle]').textContent = config.subtitle;
        const tabsRoot = document.querySelector('[data-settings-tabs]');
        const panelsRoot = document.querySelector('[data-settings-panels]');
        tabsRoot.innerHTML = config.tabs.map(function(t, i) {
            return '<button type="button" class="settings-tab' + (i === 0 ? ' active' : '') + '" data-settings-tab="' + SC.escapeAttr(t.id) + '" role="tab"' + (i === 0 ? ' aria-selected="true"' : '') + '>' + SC.escapeHtml(t.label) + '</button>';
        }).join('');
        panelsRoot.innerHTML = config.tabs.map(function(t, i) {
            const html = buildPanel(t);
            return i === 0
                ? html.replace('class="settings-panel"', 'class="settings-panel active"')
                : html;
        }).join('');
    }

    document.addEventListener('click', function(e) {
        const tab = e.target.closest('[data-settings-tab]');
        if (!tab) return;
        if (typeof helpActive !== 'undefined' && helpActive) return;
        const id = tab.getAttribute('data-settings-tab');
        document.querySelectorAll('[data-settings-tab]').forEach(function(t) {
            t.classList.toggle('active', t === tab);
            t.setAttribute('aria-selected', t === tab ? 'true' : 'false');
        });
        document.querySelectorAll('[data-panel]').forEach(function(p) {
            p.classList.toggle('active', p.getAttribute('data-panel') === id);
        });
    });

    document.addEventListener('DOMContentLoaded', render);
    if (document.readyState !== 'loading') render();
})();
