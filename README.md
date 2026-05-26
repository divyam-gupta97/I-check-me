# ITrackMe

ITrackMe is a colorful agile dashboard for planning tasks by date, tracking work through `Backlog`, `Planned`, `In Progress`, `Blocked`, `Done`, and `Reviewed`, and saving daily and weekly summaries.

## What It Does

- Groups every task under an Epic.
- Lets tasks be planned by date.
- Treats `Done` and `Reviewed` as achieved states.
- Saves automatic daily summaries after a day has passed.
- Saves automatic weekly summaries after a week has passed.
- Exports summaries as Markdown.
- Opens summaries in the browser print flow for PDF export.
- Can run as a static GitHub Pages app.
- Can store shared data in this same GitHub repo at `data/itrackme-store.json`.

## Deploy To GitHub Pages

1. Create a GitHub repository named `ITrackMe` under `divyam-gupta97`.
2. Add these files to the repository.
3. In GitHub, open **Settings > Pages**.
4. Set **Source** to **GitHub Actions**.
5. Push to the `main` branch.
6. The app will be published at:

   `https://divyam-gupta97.github.io/ITrackMe/`

## Shared Data On GitHub

The app can read and write the shared data file with the GitHub API. Each user who needs to save changes should use a fine-grained personal access token with access to the `ITrackMe` repo and **Contents: Read and write** permission.

The token is stored only in that user's browser local storage. It is never written to the repo.

For a reviewer:

1. Add the reviewer as a collaborator on the `ITrackMe` repository.
2. Ask them to create a fine-grained GitHub token for this one repo.
3. Give the token **Contents: Read and write** access.
4. They paste that token into the app's GitHub Sync panel and press **Connect**.

## Reviewer Flow

1. Reviewer opens the app.
2. Reviewer connects with their GitHub token.
3. Reviewer moves a task to `Reviewed`.
4. The app saves that change back to `data/itrackme-store.json`.

## Local Use

Open `index.html` in a browser. Without GitHub sync, the app saves to local browser storage only.
