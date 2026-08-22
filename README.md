# NexusTalent — Campus Talent Exchange OS

## Product
NexusTalent is a real-world, production-ready Campus Talent Exchange Operating System. It connects Employers, Institutions, and Students in a transparent, verified ecosystem for campus hiring and recruitment.

## Architecture
**Frontend**: React (Vite, TypeScript, Tailwind CSS)
**Backend API**: Express (Node.js server)
**Database**: Firebase Firestore
**Authentication**: Firebase Authentication
**AI Integration**: Google Gemini API (Server-Side)

## Local development
To run this project locally:

1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up your `.env` file (see Environment Variables).
4. Run the development server:
   ```bash
   npm run dev
   ```

## Environment variables
Create a `.env` file at the root of the project with the following variables:
```
# Gemini API Key (Server-Side Only - NEVER expose to the browser)
GEMINI_API_KEY=your_gemini_api_key

# Firebase Client Configuration (Public)
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

## Firebase setup
This project uses Firebase Authentication and Firestore.
Ensure you have created a Firebase project and enabled Authentication (Email/Password) and Firestore Database. Obtain your config object from the Firebase Console and place the values in your `.env` file.

## Firestore rules
Firestore Security Rules (`firestore.rules`) enforce strict Role-Based Access Control (RBAC).
- `users`: Can only be read/written by the authenticated owner, or read by a `super_admin`.
- `employers`, `institutions`, `students`: Collections are protected based on verification status and role.
- Students control their own private data and visibility.

## Gemini setup
The Gemini API is integrated securely via the Express backend (`server.ts`). The `GEMINI_API_KEY` is loaded from the environment and used by the `@google/genai` SDK on the server, ensuring the key is never leaked to the client.

## Demo mode
By default, the application runs in production mode, pulling only real data from Firestore. There are no mock arrays or fake seeded accounts in the application context. If a user has not registered, the system displays empty states.

## Production deployment
To build the application for production:
```bash
npm run build
```
This generates an optimized static frontend in the `dist` folder and compiles the Express backend into `dist/server.cjs`. You can then deploy the container to Google Cloud Run or any standard Node.js hosting environment using:
```bash
npm run start
```

## Health check
The server provides a health check endpoint:
```
GET /api/health
```
Which returns:
```json
{"status":"ok"}
```

## Security
- **RBAC**: Handled natively by Firebase Auth Custom Claims / Firestore user documents, strictly validated via Firestore Rules.
- **Consent**: Students explicitly control the visibility of their profiles to employers.
- **Audit**: All actions communicate through the central context, protected by Firestore rules. Any unauthorized attempts are caught and handled.

## Testing
To verify code quality and build integrity:
```bash
npm run lint
npm run build
```
