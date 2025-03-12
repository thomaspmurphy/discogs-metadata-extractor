# Discogs Metadata Extractor

This is a plugin for Obsidian (https://obsidian.md) that extracts metadata from Discogs links and imports it into your notes.

<img width="400" alt="Screenshot 2025-03-12 at 14 10 38" src="https://github.com/user-attachments/assets/c4afcb40-6c99-40e2-82b8-c0c823b68aad" />

<img width="400" alt="Screenshot 2025-03-12 at 14 11 19" src="https://github.com/user-attachments/assets/03fb3a6a-efbf-4740-b730-c2af63505208" />
<img width="500" alt="Screenshot 2025-03-12 at 14 14 06" src="https://github.com/user-attachments/assets/9af4b7ff-1e48-4da7-a5da-7d1ea92713f7" />
<img width="300" alt="Screenshot 2025-03-12 at 14 14 15" src="https://github.com/user-attachments/assets/883a4163-40f3-4292-853d-403596129641" />

## Features

- Extracts metadata from Discogs URLs found in the clipboard.
- Allows users to input a Discogs URL via a modal.
- Downloads and saves album artwork to a specified folder.
- Customizable metadata template for formatting the extracted information.
- Displays notifications for successful operations and errors.

## Installation

Since this plugin is not available in the Obsidian community plugin registry yet, you can install it manually by following these steps:

1. **Download the Plugin**:
   - Clone the repository or download the ZIP file from the GitHub repository.

   ```bash
   git clone <repository-url>
   ```

2. **Build the Plugin**:
   - Navigate to the plugin directory and install the dependencies.

   ```bash
   cd discogs-metadata-extractor
   npm install
   npm run build
   ```

3. **Copy the Plugin to Obsidian**:
   - Copy the entire `discogs-metadata-extractor` folder into your Obsidian plugins directory. The typical path is:

   ```
   <Your Vault>/.obsidian/plugins/
   ```

4. **Enable the Plugin**:
   - Open Obsidian, go to **Settings** > **Community Plugins** > **Installed Plugins**, and enable the **Discogs Metadata Extractor** plugin.

5. **Configure the Plugin**:
   - Set your Discogs API key and secret in the plugin settings to enable full functionality.

## Usage

- **Extract Metadata from Clipboard**: Copy a Discogs URL to your clipboard and use the command to extract metadata.
- **Enter Discogs URL**: Use the command to manually enter a Discogs URL.
- **Search Discogs**: Use the search command to find releases directly from Discogs.

## Contributing

If you would like to contribute to this project, feel free to submit a pull request or open an issue.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
