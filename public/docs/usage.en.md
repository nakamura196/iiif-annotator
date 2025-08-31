# IIIF Annotator User Guide

## Overview

IIIF Annotator is a web application that allows you to add and edit annotations on IIIF (International Image Interoperability Framework) compliant manifest files.

## About Login

This application uses Firebase to save annotations. Login is required to use the features.

### How to Login
1. Click the "Login" button in the upper right corner
2. Login using one of the following methods:
   - **Google Account**: Click "Sign in with Google" button (recommended)
   - **Email Address**: Enter email and password
   - **New Registration**: Register from "Create a new account"

### Features After Login
- Annotations are automatically saved to Firebase cloud
- Accessible from multiple devices
- Collaborative work with other users is possible

### Logout
- Select "Logout" from the user icon in the upper right corner

## Main Features

### 1. Browse IIIF Collections
- Enter a IIIF collection URL to display the list of manifests in the collection
- Navigate hierarchical collection structures
- Visually confirm manifests with thumbnail images

### 2. Edit Manifests
- Navigate directly to the editing screen by specifying a IIIF manifest URL
- High-performance image viewer using OpenSeadragon
- Image manipulation including zoom, pan, and rotation

### 3. Annotation Features
- Create annotation regions by rectangular selection on images
- Edit annotation content with a rich text editor
- View and manage annotation lists

### 4. Export Features
- Export annotations in W3C Web Annotation format
- Export in TEI (Text Encoding Initiative) format

## How to Use

### Home Screen

The home screen displays two input forms:

#### Edit Manifest
1. Enter the IIIF manifest URL in the "Manifest URL" field
2. Optionally specify a "Page Number" (for multi-page manifests)
3. Click the "Go to Editor" button

#### Display Collection
1. Enter the IIIF collection URL in the "Collection URL" field
2. Click the "Display Collection" button

### Collection Screen

The following operations are available on the collection screen:

- **Select Manifest**: Click on a card to navigate to the editing screen
- **Sub-collections**: Click on folder icon cards to explore deeper hierarchies
- **Back Button**: Return to parent collection or home screen
- **View Toggle**: Switch between grid and list view (coming soon)

### Editor Screen

Main features of the editor screen:

#### Image Operations
- **Zoom**: Mouse wheel or +/- buttons
- **Pan**: Drag mouse to move image
- **Full Screen**: Maximize with fullscreen button
- **Home**: Return image to initial display

#### Creating Annotations
1. Click the polygon selection tool in the toolbar
2. Click on the image to add vertices
3. Create a polygon by clicking multiple points to enclose an area
4. **How to finish**:
   - Double-click to finish at the current position
   - Or click on the starting point (first point) to close the polygon
5. Enter text in the popup editor
6. Click save button to confirm annotation

**Tip**: Rectangle tool is also available, but polygon tool is recommended for more flexible selection.

#### Managing Annotations
- **List View**: Check annotation list in side panel
- **Edit**: Click annotation to edit content
- **Delete**: Select and delete annotations
- **Export**: Download created annotations

### Other Features

#### Open in Mirador
Click the "Open in Mirador" button on the editing screen to display the current manifest in Mirador (IIIF viewer). Mirador allows you to compare multiple images side by side and perform detailed image analysis.

#### Language Switching
You can switch between Japanese and English from the language selection menu (JP/EN) in the upper right corner. Settings are saved automatically.

#### Theme Toggle
Click the sun/moon icon in the upper right corner to switch between light mode and dark mode. Dark mode is recommended if you want to reduce eye strain.

## Supported Formats

### Input
- IIIF Presentation API v2.x
- IIIF Presentation API v3.0
- Automatically converts v2 to v3 for processing

### Output
- W3C Web Annotation
- TEI (Text Encoding Initiative)

## System Requirements

- Modern browser (Chrome, Firefox, Safari, Edge)
- JavaScript enabled
- Internet connection (for accessing IIIF resources)

## Troubleshooting

### Collection Not Displaying
- Verify the URL is correct
- Some servers may not be accessible due to CORS policy
- Check browser console for errors

### Images Not Displaying
- Verify the IIIF manifest URL is correct
- Check if image server is accessible
- Check network connection

### Annotations Not Saving
- Check if you are logged in
- Check internet connection
- Check if Firebase access is not blocked

## Contact

If you encounter any issues, please create an Issue on the [GitHub repository](https://github.com/nakamura196/next-fb-anno).