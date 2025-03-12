import {
//   App,
  Editor,
  MarkdownView,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
} from "obsidian";
import * as https from "https";
import * as fs from "fs";
import * as path from "path";

interface DiscogsMetadataExtractorSettings {
	artworkFolder: string;
	metadataTemplate: string;
	apiKey: string;
	apiSecret: string;
}

const DEFAULT_SETTINGS: DiscogsMetadataExtractorSettings = {
  artworkFolder: "music/artwork",
  metadataTemplate:
		"---\n" +
		"artist: {{artist}}\n" +
		"title: {{title}}\n" +
		"release_date: {{release_date}}\n" +
		"label: {{label}}\n" +
		"genres: {{genres}}\n" +
		"catalog_number: {{catalog_number}}\n" +
		"discogs_url: {{discogs_url}}\n" +
		"country: {{country}}\n" +
		"format: {{format}}\n" +
		"---\n\n" +
		"{{artwork_path}}\n" +
		"## Tracklist\n" +
		"{{tracklist}}\n",
  apiKey: "",
  apiSecret: "",
};

export default class DiscogsMetadataExtractor extends Plugin {
  settings: DiscogsMetadataExtractorSettings;
  settingsTab: DiscogsMetadataExtractorSettingTab;

  async onload() {
    await this.loadSettings();

    this.addCommand({
      id: "extract-discogs-metadata-from-clipboard",
      name: "Extract Discogs Metadata from Clipboard",
      editorCallback: (editor: Editor, view: MarkdownView) => {
        this.extractMetadataFromClipboard(editor);
      },
    });

    this.addCommand({
      id: "open-discogs-url-modal",
      name: "Enter Discogs URL",
      callback: () => {
        new UrlInputModal(this).open();
      },
    });

    this.addCommand({
      id: "open-discogs-search-modal",
      name: "Search Discogs",
      callback: () => {
        new DiscogsSearchModal(this).open();
      },
    });

    // Add settings tab
    this.settingsTab = new DiscogsMetadataExtractorSettingTab(this);
    this.addSettingTab(this.settingsTab);
  }

  onunload() {
    // Nothing specific to clean up, placeholder.
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  async extractMetadataFromClipboard(editor: Editor) {
    try {
      const clipboard = await navigator.clipboard.readText();

      if (!clipboard.includes("discogs.com/")) {
        new Notice("No Discogs URL found in clipboard");
        return;
      }

      await this.extractMetadataFromUrl(clipboard);
    } catch (error) {
      console.error("Error extracting metadata:", error);
      new Notice(`Error: ${error.message}`);
    }
  }

  async fetchDiscogsMetadata(releaseId: string) {
    return new Promise((resolve, reject) => {
      const options = {
        headers: {
          "User-Agent": "ObsidianDiscogsMetadataExtractor/1.0",
        },
      };

      https
        .get(
          `https://api.discogs.com/releases/${releaseId}`,
          options,
          (response) => {
            let data = "";

            response.on("data", (chunk) => {
              data += chunk;
            });

            response.on("end", () => {
              console.log("Received response from Discogs API");
              if (response.statusCode === 200) {
                const metadata = JSON.parse(data);
                console.log("Fetched metadata:", metadata);

                const tracklist = metadata.tracklist || "No tracklist available";

                metadata.discogs_url = metadata.uri; // Add the Discogs release URL
                resolve({ ...metadata, tracklist });
              } else {
                reject(
                  new Error(
                    `API request failed with status ${response.statusCode}`,
                  ),
                );
              }
            });
          },
        )
        .on("error", (error) => {
          reject(error);
        });
    });
  }

  async downloadArtwork(imageUrl: string, title: string) {
    return new Promise(async (resolve, reject) => {
      // Ensure artwork directory exists
      const vaultPath = this.app.vault.adapter.basePath;
      const artworkFolderPath = path.join(
        vaultPath,
        this.settings.artworkFolder,
      );

      if (!fs.existsSync(artworkFolderPath)) {
        fs.mkdirSync(artworkFolderPath, { recursive: true });
      }

      // Sanitize filename
      const sanitizedTitle = title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
      const fileName = `${sanitizedTitle}_cover.jpg`;
      const filePath = path.join(artworkFolderPath, fileName);
      const relativePath = `${this.settings.artworkFolder}/${fileName}`;

      // Download image file
      const file = fs.createWriteStream(filePath);

      https
        .get(imageUrl, (response) => {
          response.pipe(file);

          file.on("finish", () => {
            file.close();
            resolve(relativePath);
          });
        })
        .on("error", (error) => {
          fs.unlink(filePath, () => { }); // Delete file if error
          reject(error);
        });
    });
  }

  /**
   * Formats the metadata for a Discogs release into a specified template.
   *
   * @param metadata - The metadata object fetched from the Discogs API.
   * @param artworkPath - The path to the artwork image.
   * @returns A formatted string containing the release information.
   */
  formatMetadata(metadata: any, artworkPath: string) {
    let template = this.settings.metadataTemplate;

    // Extract artist names and join them with " & "
    const artist = metadata.artists.map((a) => a.name).join(" & ");

    // Join genres into a single string
    const genres = metadata.genres.join(", ");

    // Get the country or default to "Unknown country"
    const country = metadata.country || "Unknown country";

    // Join format names into a single string or default to "Unknown format"
    const format = metadata.formats.map(f => f.name).join(", ") || "Unknown format";

    // Determine the release date, prioritizing formatted values
    let releaseDate = "";
    if (metadata.released && metadata.released !== "0000-00-00") {
      releaseDate = metadata.released;
    } else if (metadata.released_formatted) {
      releaseDate = metadata.released_formatted;
    } else {
      releaseDate = "Unknown release date";
    }

    // Extract label and catalog number, defaulting to empty strings if not available
    const label = metadata.labels ? metadata.labels[0].name : "";
    const catalogNumber = metadata.labels ? metadata.labels[0].catno : "";
    const discogsUrl = metadata.discogs_url;

    // Initialize tracklist with a default message
    let tracklist = "No tracklist available";
    if (Array.isArray(metadata.tracklist) && metadata.tracklist.length > 0) {
      // Format each track, including duration if available
      tracklist = metadata.tracklist.map(track => {
        const duration = track.duration ? ` (${track.duration})` : ""; // Include duration if it exists
        return `- ${track.position}: ${track.title}${duration}`; // Append duration if available
      }).join("\n");
    }

    // Replace placeholders in the template with actual metadata values
    template = template
      .replace("{{artist}}", artist)
      .replace("{{title}}", metadata.title)
      .replace("{{release_date}}", releaseDate)
      .replace("{{label}}", label)
      .replace("{{genres}}", genres)
      .replace("{{catalog_number}}", catalogNumber)
      .replace("{{discogs_url}}", discogsUrl)
      .replace("{{artwork_path}}", `![[${artworkPath}|500x500]]`)
      .replace("{{tracklist}}", tracklist)
      .replace("{{country}}", country)
      .replace("{{format}}", format);

    return template; // Return the formatted template
  }

  async extractMetadataFromUrl(url: string) {
    const releaseIdMatch = url.match(/release\/(\d+)/);
    if (!releaseIdMatch) {
      new Notice("Invalid Discogs URL format");
      return;
    }

    const releaseId = releaseIdMatch[1];
    const metadata = await this.fetchDiscogsMetadata(releaseId);

    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (activeView) {
      const editor = activeView.editor;
      const artworkPath = await this.downloadArtwork(
        metadata.images[0].uri,
        metadata.title,
      );
      const formattedMetadata = this.formatMetadata(metadata, artworkPath);
      editor.setValue(formattedMetadata);
      new Notice("Discogs metadata extracted successfully!");
    } else {
      new Notice("No active editor found.");
    }
  }

  // TODO: currently broken.
  async createOrUpdateNote(metadata: any, artworkPath: string) {
    const title = `${metadata.artists[0].name} – ${metadata.title}`;
    const content = this.formatMetadata(metadata, artworkPath);

    const file = this.app.vault.getAbstractFileByPath(`${title}.md`);

    if (file) {
      // If the file exists, update it
      await this.app.vault.modify(file, content);
    } else {
      // If the file does not exist, create it
      await this.app.vault.create(`${title}.md`, content);
    }

    // Rename the file
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (activeView) {
      const currentFile = activeView.file;
      if (currentFile && currentFile.name !== title) {
        await this.app.vault.rename(currentFile, `${title}.md`); // Rename the file
      }
    }
  }

  private restoreDefaults() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS);
    this.saveSettings();

    // Refresh the settings UI
    if (this.settingsTab) {
      this.settingsTab.display();
    }
  }
}

class DiscogsMetadataExtractorSettingTab extends PluginSettingTab {
  plugin: DiscogsMetadataExtractor;

  constructor(plugin: DiscogsMetadataExtractor) {
    super(plugin.app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    containerEl.createEl("h2", { text: "Discogs Metadata Extractor Settings" });

    new Setting(containerEl)
      .setName("Artwork Folder")
      .setDesc("Folder to save album artwork")
      .addText((text) =>
        text
          .setPlaceholder("artwork")
          .setValue(this.plugin.settings.artworkFolder)
          .onChange(async (value) => {
            this.plugin.settings.artworkFolder = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Metadata Template")
      .setDesc("Template for metadata (use {{placeholders}})")
      .addTextArea((text) =>
        text
          .setPlaceholder("Enter template")
          .setValue(this.plugin.settings.metadataTemplate)
          .onChange(async (value) => {
            this.plugin.settings.metadataTemplate = value;
            await this.plugin.saveSettings();
          }),
      )
      .addExtraButton((cb) => {
        cb.setIcon("reset")
          .setTooltip("Reset to default")
          .onClick(async () => {
            this.plugin.restoreDefaults();
          });
      })
      .addButton((button) => {
        button
          .setButtonText('Restore Defaults')
          .setCta()
          .onClick(() => {
            this.plugin.restoreDefaults();
            new Notice('Settings restored to defaults.');
          });
      });

    new Setting(containerEl)
      .setName("Discogs API Key")
      .setDesc("Enter your Discogs API key.")
      .addText((text) =>
        text
          .setPlaceholder("API Key")
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (value) => {
            this.plugin.settings.apiKey = value;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Discogs API Secret")
      .setDesc("Enter your Discogs API secret.")
      .addText((text) =>
        text
          .setPlaceholder("API Secret")
          .setValue(this.plugin.settings.apiSecret)
          .onChange(async (value) => {
            this.plugin.settings.apiSecret = value;
            await this.plugin.saveSettings();
          }),
      );
  }
}

class UrlInputModal extends Modal {
  private plugin: DiscogsMetadataExtractor;

  constructor(plugin: DiscogsMetadataExtractor) {
    super(plugin.app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: "Enter Discogs URL" });

    const input = contentEl.createEl("input", {
      type: "text",
      placeholder: "Paste your Discogs URL here",
    });

    const submitButton = contentEl.createEl("button", { text: "Submit" });
    submitButton.onclick = async () => {
      const url = input.value.trim();
      if (url.includes("discogs.com/")) {
        await this.plugin.extractMetadataFromUrl(url);
        this.close();
      } else {
        new Notice("Please enter a valid Discogs URL.");
      }
    };

    contentEl.appendChild(submitButton);
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

class DiscogsSearchModal extends Modal {
  private plugin: DiscogsMetadataExtractor;
  private input: HTMLInputElement;
  private resultsContainer: HTMLElement;

  constructor(plugin: DiscogsMetadataExtractor) {
    super(plugin.app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: "Search Discogs" });

    this.input = contentEl.createEl("input", {
      type: "text",
      placeholder: "Enter artist or album name",
    });

    // Add an event listener for the Enter key
    this.input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        this.searchDiscogs(); // Call the search function
      }
    });

    const searchButton = contentEl.createEl("button", { text: "Search" });
    searchButton.onclick = () => this.searchDiscogs();

    this.resultsContainer = contentEl.createEl("div");
  }

  async searchDiscogs() {
    const query = this.input.value.trim();
    if (!query) {
      new Notice("Please enter a search term.");
      return;
    }

    try {
      const results = await this.fetchSearchResults(query);
      this.displayResults(results);
    } catch (error) {
      new Notice(`Error fetching results: ${error.message}`);
    }
  }

  async fetchSearchResults(query: string) {
    const { apiKey, apiSecret } = this.plugin.settings; // Get credentials from settings
    const response = await fetch(`https://api.discogs.com/database/search?q=${encodeURIComponent(query)}&type=release&key=${apiKey}&secret=${apiSecret}`);

    if (!response.ok) {
      throw new Error(`Error fetching search results: ${response.statusText}`);
    }

    const data = await response.json();
    return data.results;
  }

  displayResults(results: any[]) {
    this.resultsContainer.empty();
    results.forEach((result) => {
      const resultEl = this.resultsContainer.createEl("div", { cls: "discogs-result" });

      const titleEl = resultEl.createEl("h3", { text: result.title });

      // Safely access artist and format, providing fallback values
      const artist = Array.isArray(result.artist) ? result.artist.join(", ") : "Unknown Artist";
      const year = result.year || "N/A";
      const format = Array.isArray(result.format) ? result.format.join(", ") : "N/A";

      // Create a subtitle element for additional metadata
      const subtitleEl = resultEl.createEl("p", { text: `Artist: ${artist} | Year: ${year} | Format: ${format}` });

      // Add a click event to select the release
      resultEl.addEventListener("click", () => this.selectRelease(result));

      // Append the title and subtitle to the result element
      resultEl.appendChild(titleEl);
      resultEl.appendChild(subtitleEl);
    });
  }

  selectRelease(release: any) {
    this.plugin.extractMetadataFromUrl(release.uri); // Use the URI to fetch metadata
    this.close();
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}
