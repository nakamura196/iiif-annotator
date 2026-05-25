# Contributing to IIIF Annotator

First off, thank you for considering contributing! 🎉

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates. When you create a bug report, please include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Provide specific examples to demonstrate the steps**
- **Describe the behavior you observed and what behavior you expected**
- **Include screenshots if possible**
- **Include your environment details** (OS, Node.js version, browser, etc.)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

- **Use a clear and descriptive title**
- **Provide a detailed description of the suggested enhancement**
- **Provide specific examples to demonstrate the enhancement**
- **Describe the current behavior and explain the expected behavior**
- **Explain why this enhancement would be useful**

### Pull Requests

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

#### Pull Request Guidelines

- Follow the existing code style and design-system conventions (`@nakamura196/react-ui` tokens)
- Update the README if you change user-facing behavior
- Make sure your code lints (`npm run lint`)
- Make sure types pass (`npm run typecheck`)
- Make sure the build passes (`npm run build`)
- Write a clear PR description explaining your changes

## Development Setup

1. Fork and clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env.local` and fill in your Firebase configuration
4. Start the development server:
   ```bash
   npm run dev   # http://localhost:3111
   ```

## Code Style

- Use TypeScript for type safety
- Follow the existing code formatting
- Use design-system tokens (`var(--ds-*)`) and `buttonClass` instead of hard-coded colors
- Use meaningful variable and function names
- Keep components small and focused

## Commit Messages

- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests liberally after the first line

## Translation Guidelines

When adding or updating translations:

1. Update all language files in `src/messages/` (`en.json`, `ja.json`)
2. Keep the same key structure across all languages
3. Test your translations in the application
4. Ensure special characters are properly encoded

## Questions?

Feel free to open an issue with your question.

Thank you for contributing! 🙏
