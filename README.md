# BookLeaf Author Support & Communication Portal

A full-stack web application for managing author support requests, book information, and communication between authors and administrators. The application includes AI-assisted ticket classification, priority recommendations, and response suggestions.

## Features

### Author Portal
- Secure login and logout.
- View books and royalty information.
- Create book-specific or general support tickets.
- View ticket status and priority.
- Communicate with administrators through ticket replies.

### Admin Portal
- View and filter support tickets.
- Update ticket status, category, and priority.
- Assign tickets to the current administrator or unassign them.
- Send replies to authors.
- Add internal notes.
- Generate AI-assisted ticket classification and response suggestions.

### AI Assistance
The AI module suggests one of six ticket categories:
- Royalty
- Distribution
- Printing
- ISBN
- Account
- General

It also recommends a priority: Critical, High, Medium, or Low.

AI response suggestions use the BookLeaf knowledge base. If the AI provider is unavailable or a request fails, the application uses fallback logic to provide a classification and response suggestion.

## Technology Stack

- **Frontend:** Next.js, React, TypeScript
- **Backend:** Next.js API Routes
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Authentication:** JWT-based session cookies
- **Validation:** Zod
- **AI Integration:** OpenAI API

## Prerequisites

Install Node.js, npm, and PostgreSQL before running the project.

## Installation

### 1. Clone the repository

```bash
git clone <YOUR_PRIVATE_REPOSITORY_URL>
cd bookleaf-support-portal
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/DATABASE_NAME"
JWT_SECRET="YOUR_LONG_RANDOM_SECRET_AT_LEAST_32_CHARACTERS"
OPENAI_API_KEY="YOUR_OPENAI_API_KEY"
OPENAI_MODEL="gpt-4o-mini"
```

Replace the example values with your own configuration. Never commit `.env` or expose API keys in client-side code.

### 4. Configure the database

Ensure PostgreSQL is running and `DATABASE_URL` points to your database.

Apply existing migrations:

```bash
npx prisma migrate deploy
```

Generate the Prisma client:

```bash
npx prisma generate
```

### 5. Import sample data

The provided `bookleaf_sample_data.json` contains 10 authors and 18 books.

Review `prisma/seed.ts` before running the seed command, because it may update existing sample-user passwords.

```bash
npx prisma db seed
```

Run this command only against the intended database.

### 6. Start the development server

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

## API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/auth/login` | Authenticate a user |
| GET | `/api/auth/me` | Retrieve the current session user |
| POST | `/api/auth/logout` | Log out |
| GET | `/api/author/books` | Retrieve author books |
| GET | `/api/author/tickets` | Retrieve the author's tickets |
| POST | `/api/author/tickets` | Create a support ticket |
| GET | `/api/admin/tickets` | Retrieve and filter admin tickets |
| PATCH | `/api/admin/tickets/[id]` | Update ticket information |
| GET | `/api/tickets/[id]/replies` | Retrieve ticket replies |
| POST | `/api/tickets/[id]/replies` | Add a reply or permitted internal note |
| POST | `/api/admin/tickets/[id]/ai-suggest` | Generate AI suggestions |

Authenticated endpoints must enforce role-based access control and ticket ownership. Internal notes must remain hidden from authors.

## AI Model and Fallback Strategy

The application uses `gpt-4o-mini` as the default configurable OpenAI model for ticket classification and response suggestions.

The API key is read from a server-side environment variable. If an AI request fails or returns an invalid result, local fallback logic is used. Administrators can review and edit suggestions before sending a response.

## Validation and Production Build

Run TypeScript validation:

```bash
npx tsc --noEmit
```

Create a production build:

```bash
npm run build
```

Start the production server:

```bash
npm run start
```

## Sample Accounts

For the seeded sample database:

- **Admin:** `admin@bookleaf.com`
- **Author:** `priya.sharma@email.com`

Use the corresponding passwords configured by the seed script. These are demo accounts; change the credentials before any public deployment.

## Security Considerations

- Keep secrets in environment variables.
- Never commit `.env` or production credentials.
- Use HTTPS in production.
- Validate request payloads.
- Enforce authentication, authorization, and ticket ownership.
- Prevent authors from accessing internal notes.
- Protect production database credentials.

## Project Status

Developed as a full-stack technical assignment for the BookLeaf Author Support & Communication Portal. Verify all features and security settings in the target deployment environment before production use.