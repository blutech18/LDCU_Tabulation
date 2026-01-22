# LDCU Tabulation System

A dynamic tabulation system supporting both **Scoring-based** and **Ranking-based** events.

## Features

- **Admin Panel**: Simplified dashboard with Events and Judges management
- **Events Page**: Unified interface with Tabular, Participants, and Criteria tabs
- **Judge Landing**: Animated welcome page with profile greeting
- **Dual Tabulation Modes**:
  - **Scoring**: Point-based scoring with criteria weights
  - **Ranking**: Drag-and-drop contestant ranking
- **Enhanced UI**:
  - **Image Overlays**: Beautiful gradient overlays for categories
  - **Circular Avatars**: Professional contestant cards with gender indicators
- **Media Support**: Image uploads for categories and contestants via Supabase Storage
- **Responsive Design**: Mobile-friendly grids and layouts for all management tabs

## Tech Stack

- React 19 + TypeScript
- Vite
- TailwindCSS
- Framer Motion
- Supabase

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your Supabase credentials
   ```

3. Run development server:
   ```bash
   npm run dev
   ```

4. Build for production:
   ```bash
   npm run build
   ```

## Database Setup

Run the SQL schema in your Supabase dashboard:
- Navigate to SQL Editor
- Paste contents of `src/sql/schema.sql`
- Execute

## Project Structure

```
src/
├── components/
│   ├── admin/      # Admin components (Sidebar, StatsCard)
│   ├── common/     # Shared components (Header)
│   └── judge/      # Judge components (ScoringTabular, RankingTabular)
├── layouts/        # Layout wrappers
├── pages/          # Route pages
├── lib/            # Utilities (Supabase client)
├── types/          # TypeScript interfaces
└── styles/         # Global CSS
```
