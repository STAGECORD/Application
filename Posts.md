# Project Card Design Specifications

## Overview
The project card displays collaborative music projects with team members, royalty splits, uploads, finals, and approval status.

---

## Project Header

### Project Name
- **Text**: "ETERNATY" (example)
- **Position**: Left: 145px, Top: 182px
- **Size**: 232px x 26px
- **Font**: Outfit
- **Font Weight**: 700 (Bold)
- **Font Size**: 14px
- **Line Height**: 18px
- **Text Transform**: Uppercase
- **Color**: #FFFFFF

### Description Text
- **Text**: "Show collaboration in progress on artist pages"
- **Position**: Left: 145px, Top: 402px
- **Size**: 439px x 26px
- **Font**: Outfit
- **Font Weight**: 400 (Regular)
- **Font Size**: 14px
- **Line Height**: 18px
- **Text Transform**: Uppercase
- **Color**: #FFFFFF

---

## Track Bar (Progress Bar)

### Container
- **Position**: Left: 143px, Top: 211px
- **Size**: 181px x 1249px
- **Background**: #000000
- **Border**: 1px solid #797979
- **Border Radius**: 22px
- **Transform**: rotate(-90deg)
- **Note**: The bar is rotated 90 degrees to display horizontally

---

## Collaborators Section

### Layout
Multiple collaborator cards displayed horizontally starting at Top: 232px

### Collaborator Card Structure

**Card 1: Artist**
- **Position**: Left: 156px
- **Role Label**: "ARTIST"
- **Profile Image**: 82px x 82px circular
- **Name**: "Jeremy Freedom"
- **Name Font Weight**: 700

**Card 2: Artist 2**
- **Position**: Left: 257px
- **Name**: "Malik Johnson"

**Card 3: Topliner**
- **Position**: Left: 358px
- **Role Label**: "TOPLINER"
- **Name**: "Maya Thompson"

**Card 4: Producer**
- **Position**: Left: 459px
- **Role Label**: "Producer, mix & mastering"
- **Name**: "Winston Sinchair"

**Card 5: Add Person (Empty slot)**
- **Position**: Left: 578px
- **Role Label**: "SELECT FUNCTION"
- **Display**: Black circle with white border
- **Icon**: "+" (Plus symbol)
- **Font Size**: 64px
- **Text**: "Add person"

### Collaborator Card Specs
- **Profile Image**: 82px x 82px
- **Border Radius**: 549px (circular)
- **Image Position**: Centered, Top: 259px (relative to card)
- **Role Label Font**: Outfit, 700, 12px, Uppercase
- **Name Font**: Outfit, 700, 12px, Uppercase
- **Text Align**: Center
- **Width**: 119px
- **Spacing**: ~101px between cards

---

## Royalties Section

### Header
- **Text**: "ROYALTIES"
- **Position**: Left: 957px, Top: 182px
- **Font Weight**: 700
- **Font Size**: 14px

### Royalty Type Buttons (8 buttons total)

All buttons share these specs:
- **Button Size**: 27.22px x 91px
- **Background**: #000000
- **Border**: 1px solid #797979
- **Border Radius**: 8px
- **Transform**: rotate(-90deg)
- **Text Font**: Outfit, 400, 12px
- **Text Align**: Center
- **Text Color**: #FFFFFF

**Button Layout - Column 1** (Left: 957px)
1. **Mechanical** - Top: 224.61px
2. **Performance** - Top: 266.8px
3. **Covers** - Top: 308.98px
4. **Sample** - Top: 351.17px

**Button Layout - Column 2** (Left: 1056px)
5. **Synch** - Top: 224.61px
6. **Print Music** - Top: 266.8px
7. **Tutorials** - Top: 308.98px
8. **Commercial** - Top: 351.17px

---

## Uploads Section

### Header
- **Text**: "UPLOADS"
- **Position**: Left: 739px, Top: 183px
- **Font Weight**: 700
- **Font Size**: 14px

### Upload Buttons (4 buttons)
1. **WAVE** - Top: 225.61px
2. **Sheet Music** - Top: 267.8px
3. **Notes** - Top: 309.98px
4. **Lyrics** - Top: 352.17px

**Button Specs**:
- **Position**: Left: 739px
- **Size**: 27.22px x 84px
- **Background**: #000000
- **Border**: 1px solid #797979
- **Border Radius**: 8px
- **Transform**: rotate(-90deg)

---

## Finals Section

### Header
- **Text**: "FINALS"
- **Position**: Left: 848px, Top: 183px
- **Font Weight**: 700
- **Font Size**: 14px

### Final Buttons (4 buttons)
1. **WAVE** - Top: 225.61px
2. **Sheet Music** - Top: 267.8px
3. **MP3** - Top: 309.98px
4. **Lyrics** - Top: 352.17px

**Button Specs**:
- **Position**: Left: 848px
- **Size**: 27.22px x 84px
- **Background**: #000000
- **Border**: 1px solid #797979
- **Border Radius**: 8px
- **Transform**: rotate(-90deg)

---

## Approvals Section

### Header
- **Text**: "APPROVALS FOR RELEASE"
- **Position**: Left: 1172px, Top: 183px
- **Font Weight**: 700
- **Font Size**: 14px

### Approval List
Starting at Left: 1195px, Top: 230px

**Names**:
1. Jeremy Freedom - Top: 230px
2. Malik Johnson - Top: 257px
3. Maya Thompson - Top: 284px
4. Winston Sinchair - Top: 311px

**Name Specs**:
- **Font**: Outfit, 400, 12px
- **Color**: #FFFFFF
- **Width**: 116px

### Approval Icons
- **Position**: Left: 1168px
- **Size**: 22px x 22px
- **Spacing**: 27px vertical between icons

**Icon Types**:
- **Accepted**: Green checkmark (#4CAF50)
- **Denied**: Red X (#F44336)
- **Pending**: Orange person icon (#FFCC80)

---

## Color Palette

- **Background**: #000000 (Black)
- **Text**: #FFFFFF (White)
- **Borders**: #797979 (Gray)
- **Approved**: #4CAF50 (Green)
- **Denied**: #F44336 (Red)
- **Pending**: #FFCC80 (Orange)

---

## Typography

- **Font Family**: Outfit
- **Header Text**: 14px, Font Weight 700, Uppercase
- **Body Text**: 12px, Font Weight 400
- **Names**: 12px, Font Weight 700, Uppercase
- **Plus Icon**: 64px, Font Weight 400

---

## Layout Dimensions

- **Card Width**: Approximately 1215px (from left: 145px to right edge ~1360px)
- **Card Height**: Approximately 220px (from top: 182px to bottom: 402px)
- **Button Spacing**: ~42px vertical between rotated buttons
- **Collaborator Spacing**: ~101px horizontal between profiles
