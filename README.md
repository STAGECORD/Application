# STAGECORD PRO

A web application for collaboration between artists, comedians, and podcasters.

## Project Overview

STAGECORD PRO provides a platform for creative professionals to connect, collaborate, and manage their projects together.

## Project Structure

```
STAGECORD PRO/
├── index.html              # Main HTML file
├── Bar.md                  # Left sidebar design specifications
├── README.md              # This file
│
├── assets/
│   └── images/            # Image assets
│       └── profile-placeholder.png (add your profile image here)
│
├── components/
│   └── sidebar.html       # Sidebar component (standalone)
│
├── css/
│   ├── sidebar.css        # Sidebar styling
│   └── main.css          # Main content styling
│
├── js/
│   └── app.js            # JavaScript functionality
│
└── design/               # Design assets from Figma
    ├── banners/
    ├── bars/
    ├── cards/
    ├── buttons/
    ├── icons/
    ├── backgrounds/
    └── logos/
```

## Features

### Left Sidebar Navigation
- Fixed 126px width sidebar
- Black background (#000000)
- Profile section with circular avatar (82x82px)
- Navigation menu with icons:
  - Projects
  - Overview
  - Collabs
  - Inbox
  - Sales
  - Videos
  - Option
  - Pictures
  - Calendar

### Design Specifications
- **Font**: Outfit (Google Fonts)
- **Colors**: Black (#000000) background, White (#FFFFFF) text
- **Typography**: 12px for navigation, 14px for profile name
- **Profile Image**: 82x82px circular
- **Icons**: 19-24px depending on button

## Getting Started

1. **Open the project**
   - Open `index.html` in your web browser

2. **Add your profile image**
   - Place your profile photo in `assets/images/`
   - Update the image path in `index.html`

3. **Customize**
   - Edit colors in `css/sidebar.css` and `css/main.css`
   - Modify navigation items in `index.html`
   - Add your content sections

## Design Files

All design specifications from Figma are documented in `Bar.md`. Export your Figma designs to the appropriate folders in `/design`.

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## Next Steps

1. Add content sections for each navigation item
2. Implement user authentication
3. Create project management features
4. Add collaboration tools
5. Build messaging system
6. Integrate booking functionality

## Technology Stack

- HTML5
- CSS3
- JavaScript (Vanilla)
- Google Fonts (Outfit)

## License

Copyright © 2026 STAGECORD PRO. All rights reserved.
