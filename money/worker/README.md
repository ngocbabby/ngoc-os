# AI bill scanner setup

The frontend is hosted on GitHub Pages. AI photo analysis needs a separate backend to protect the Gemini API key. Do not embed keys in public HTML/JS or commit them to GitHub. Create a Cloudflare Worker on the Free plan and store credentials in encrypted environment secrets. Configure usage limits and turn off billing in your Google AI Studio project.

This repository intentionally does not include real credentials. OCR mode continues to work without cloud AI.
