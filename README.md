<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/b67305f5-5703-4b56-b34e-a97c8b8e5544

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies using the current lockfile:
   `bun install --frozen-lockfile`
   (`package-lock.json` is currently out of sync with the PDF dependencies.)
2. Gemini features are optional; the summaries support a fallback without a key.
3. Run the app:
   `npm run dev`

## Live student data

The student directory, projects, categories, skills, and attendance are loaded
from Firestore. Empty collections remain empty; loading the application does not
populate sample students or projects. Old `app_students`, `app_projects`, and
`app_categories` entries in browser localStorage are ignored, so clearing the
browser storage is not required to stop displaying those cached examples.

Firebase project settings come from `firebase-applet-config.json`. The database
ID can be overridden with `VITE_FIREBASE_DATABASE_ID` in `.env.local`; otherwise
the configured `firestoreDatabaseId` or the existing AI Studio database ID is used.
Use `(default)` only if the real data is in that database. Restart Vite after
changing `.env.local`. Google sign-in still requires an authorized domain and the
appropriate Firestore permissions. Existing demo documents already saved in
Firestore are not deleted automatically.

## Validation

```bash
node --import tsx src/utils/studentData.test.ts
npm run lint
npm run build
```

The regression tests cover profile identity, migrations, attendance updates and
deletions, approved hours, and category filters without contacting Firebase.
