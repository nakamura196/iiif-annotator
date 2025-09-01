# IIIF Annotation Editor with Firebase

A powerful web-based annotation editor for IIIF (International Image Interoperability Framework) manifests with real-time collaboration support through Firebase integration.

## Features

- 🖼️ **IIIF Support**: Full support for IIIF Presentation API v2 and v3 manifests
- ✏️ **Rich Annotation Tools**: Create rectangular and polygon annotations on high-resolution images
- 🔥 **Real-time Collaboration**: Firebase integration for instant synchronization across multiple users
- 🔍 **OCR Integration**: Built-in OCR support for Japanese historical documents using NDL Koten OCR
- 🌐 **Internationalization**: Multi-language support (English and Japanese)
- 🎨 **Modern UI**: Clean, responsive interface built with Next.js and Tailwind CSS
- 🔐 **Authentication**: Secure user authentication with Firebase Auth (Google and Email/Password)
- 📤 **Export Options**: Export annotations in multiple formats (IIIF Annotation, CSV, JSON)

## Tech Stack

- **Framework**: Next.js 15 with App Router
- **Language**: TypeScript
- **UI**: React 19, Tailwind CSS
- **Image Viewer**: OpenSeadragon with Annotorious
- **Backend**: Firebase (Firestore, Authentication)
- **OCR**: NDL Koten OCR Web
- **IIIF**: @iiif/parser, @iiif/presentation-3

## Prerequisites

- Node.js 18+ 
- npm or yarn
- Firebase project with Firestore and Authentication enabled
- (Optional) IIIF manifest URL for testing

## Installation

1. Clone the repository:
```bash
git clone https://github.com/nakamura196/next-fb-anno.git
cd next-fb-anno
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env.local` file in the root directory with your Firebase configuration:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Usage

### Loading a IIIF Manifest

1. Navigate to the editor page
2. Add a manifest URL as a query parameter:
   ```
   http://localhost:3000/editor?manifest=YOUR_MANIFEST_URL
   ```

### Creating Annotations

1. **Authentication**: Sign in using Google or Email/Password
2. **Select Tool**: Choose between rectangle or polygon tool from the toolbar
3. **Draw**: Click and drag (rectangle) or click multiple points (polygon) to create an annotation
4. **Add Text**: Enter annotation text in the form that appears
5. **Save**: Annotations are automatically saved to Firebase

### OCR Feature

1. Click the OCR button (scan icon) in the toolbar
2. The current canvas image will be processed
3. Review the extracted text
4. Apply as annotations to automatically create text annotations

### Exporting Annotations

1. Click the export button in the toolbar
2. Choose your preferred format:
   - IIIF Annotation format
   - CSV (for spreadsheet applications)
   - JSON (raw data)

## Project Structure

```
src/
├── app/                    # Next.js app router pages
├── components/            
│   ├── annotation/        # Annotation-related components
│   ├── auth/             # Authentication components
│   ├── ManifestViewer.tsx # IIIF manifest viewer
│   ├── OCRProcessor.tsx   # OCR processing component
│   └── editor.tsx         # Main editor component
├── lib/
│   ├── firebase.ts        # Firebase configuration
│   └── utils/            # Utility functions
└── types/                # TypeScript type definitions
```

## Development

### Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run typecheck` - Run TypeScript type checking

### Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## Known Issues

- OCR feature requires CORS-enabled images or proxy setup
- Large manifests with many canvases may experience performance issues
- WebGL is required for OpenSeadragon

## License

MIT License - see [LICENSE](LICENSE) file for details

## Acknowledgments

- [IIIF Consortium](https://iiif.io/) for the IIIF specifications
- [NDL Lab](https://lab.ndl.go.jp/) for the Koten OCR model
- [Annotorious](https://annotorious.github.io/) for the annotation framework
- [OpenSeadragon](https://openseadragon.github.io/) for the deep zoom viewer

## Support

For issues, questions, or suggestions, please [open an issue](https://github.com/nakamura196/next-fb-anno/issues) on GitHub.

## Demo

A live demo is available at: [Coming Soon]

---

Built with ❤️ for the Digital Humanities community