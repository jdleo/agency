## Usage

1. On first launch, enter your OpenRouter API key, get a key from https://openrouter.ai/settings/keys
2. Create a new app by clicking the "Create App" button
3. Add blocks to your app:
   - Static Text: For fixed content
   - User Input: For dynamic user-provided content
   - AI Output: For AI-generated responses
4. Configure AI outputs using prompt templates
   - Reference previous blocks using `@block1`, `@block2`, etc.
5. Save your app and run it anytime

## Tech Stack

- React 19
- Vite 6
- TailwindCSS 4
- IndexedDB for local storage
- OpenRouter API for AI model access

## Development

The project includes several development tools:

- ESLint for code linting
- PostCSS for CSS processing
- Vite PWA plugin for Progressive Web App support

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- OpenRouter for providing access to multiple AI models
- React team for the excellent framework
- Vite team for the blazing fast build tool
