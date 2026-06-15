# AI Research Paper Explainer

<img width="1876" height="950" alt="image" src="https://github.com/user-attachments/assets/0025a109-e7b7-4b3c-9fb1-1891d20f1c36" />

A portable local website for turning a research paper into:

- Summary
- Visual explanation
- Key concepts
- Implementation roadmap

## Run

Open a terminal in this folder and run:

```powershell
npm run dev
```

Then open:

```text
http://127.0.0.1:4176
```

The app has no install step. It uses the browser for analysis and a tiny Node server for local hosting.

## Supported Inputs

- PDF files, extracted in the browser with PDF.js from jsDelivr
- TXT files
- Markdown files
- Pasted paper text

PDF upload requires internet access the first time so the browser can load PDF.js from the CDN. Text and Markdown work without that PDF dependency.

## What It Does

- Detects paper title and sections
- Ranks high-signal sentences
- Extracts repeated technical concepts
- Builds a visual paper logic flow
- Creates a concept orbit
- Produces a practical implementation roadmap
- Exports the generated report as a standalone HTML file

## Files

- `index.html` - app shell
- `styles.css` - responsive UI and color system
- `app.js` - upload handling, PDF extraction, analysis, and rendering
- `server.mjs` - local static server
- `package.json` - start scripts

## Notes

This is a local explainer engine. It does not send uploaded papers to a cloud service. The analysis is deterministic and runs in the browser after the paper text is extracted.

