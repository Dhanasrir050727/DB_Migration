# Supabase Database Migration Tool - Frontend

A modern, professional React-based UI for migrating databases between Supabase projects. Built with TypeScript, Tailwind CSS, and a clean architectural design.

## Features

✨ **Modern UI/UX**
- Clean, professional SaaS dashboard design
- Step-by-step migration wizard with visual progress tracking
- Responsive design (mobile, tablet, desktop)
- Real-time migration progress monitoring
- Beautiful animations and transitions

🔒 **Security**
- Password-masked input fields for API keys
- Credentials not persisted in URLs or global state beyond session
- Show/hide toggle for sensitive keys
- HTTPS-ready architecture

📊 **Comprehensive Tracking**
- Real-time migration progress visualization
- Detailed statistics on tables, records, functions, triggers, views, indexes, and policies
- Error tracking and reporting
- Migration history and reports

🏗️ **Well-Architected**
- Service layer for API abstraction
- Mock implementations for development/testing
- Ready for backend integration
- State management with local storage persistence
- TypeScript for type safety

## Project Structure

```
frontend/
├── src/
│   ├── components/          # React components
│   │   ├── SourceDatabaseStep.tsx      # Source DB credential input
│   │   ├── TargetDatabaseStep.tsx      # Target DB credential input
│   │   ├── MigrationSummaryStep.tsx    # Review migration details
│   │   ├── MigrationProgressStep.tsx   # Live migration progress
│   │   ├── MigrationCompletedStep.tsx  # Results and report
│   │   ├── StepIndicator.tsx           # Step progress indicator
│   │   └── StatCard.tsx                # Statistics card component
│   ├── services/            # API and utility services
│   │   ├── api.ts           # API client and mock implementations
│   │   └── storage.ts       # Local storage management
│   ├── App.tsx              # Main application component
│   ├── main.tsx             # Entry point
│   ├── index.css            # Global styles and animations
│   └── App.css              # App-specific styles
├── index.html               # HTML template
├── package.json             # Dependencies and scripts
├── tsconfig.json            # TypeScript configuration
├── vite.config.ts          # Vite build configuration
├── tailwind.config.js      # Tailwind CSS configuration
└── README.md               # This file
```

## Installation

### Prerequisites
- Node.js 18+ and npm

### Setup

1. **Navigate to the frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment variables:**
   ```bash
   # Copy example env file
   cp .env.example .env.local
   
   # Edit .env.local with your backend API URL
   VITE_API_URL=http://localhost:3000/api
   ```

## Development

### Start Development Server

```bash
npm run dev
```

The application will open at `http://localhost:5173` with hot module replacement (HMR) enabled.

### Build for Production

```bash
npm run build
```

Output will be in the `dist/` directory, ready for deployment.

### Preview Production Build

```bash
npm run preview
```

## Usage

### Step 1: Source Database
1. Enter your source Supabase project's **Base URL** (e.g., `https://your-project.supabase.co`)
2. Enter the **Anon Key** from your Supabase settings
3. Click **Next** to validate connection and retrieve database information

### Step 2: Target Database
1. Enter your target Supabase project's **Base URL**
2. Enter the target project's **Anon Key**
3. Review the warning about backups
4. Click **Next** to validate and proceed

### Step 3: Review Summary
1. Review the migration summary including:
   - Number of tables, records, functions, triggers, views, indexes, and policies
   - Detailed breakdown table
2. Read the pre-migration checklist
3. Click **Send & Migrate** to start the migration

### Step 4: Monitor Progress
1. Watch the real-time migration progress
2. See live counts of migrated objects
3. Monitor errors (if any)
4. Migration completes automatically

### Step 5: Review Results
1. View the migration completion report
2. See success/failure status for each object type
3. Download or review the detailed report
4. Start a new migration or exit

## API Integration

The application is designed to work seamlessly with a backend migration API. The service layer abstracts API calls, making integration straightforward.

### Mock vs. Real API

Currently, the `services/api.ts` uses mock implementations. To integrate with a real backend:

1. **Uncomment the API calls** in each function (marked with `// Uncomment when backend is ready`)
2. **Update the API_BASE_URL** in the environment variables
3. **Ensure your backend implements** the following endpoints:

#### Expected Backend Endpoints

```
POST /api/migration/source/connect
  Request: { baseUrl: string, anonKey: string }
  Response: DatabaseInfo

POST /api/migration/target/connect
  Request: { baseUrl: string, anonKey: string }
  Response: { success: boolean }

POST /api/migration/summary
  Request: { source: SourceCredentials, target: TargetCredentials }
  Response: MigrationSummary

POST /api/migration/start
  Request: { sourceCredentials, targetCredentials }
  Response: { migrationId: string }

GET /api/migration/:migrationId/progress
  Response: MigrationProgress

GET /api/migration/:migrationId/report
  Response: MigrationReport
```

### Interface Definitions

All required TypeScript interfaces are defined in `services/api.ts` and can be used in your backend implementation.

## Technologies Used

- **React 18** - UI library
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling framework
- **Vite** - Build tool and dev server
- **Lucide React** - Icon library
- **Axios** - HTTP client

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## Environment Variables

### Development
```
VITE_API_URL=http://localhost:3000/api
VITE_ENV=development
```

### Production
```
VITE_API_URL=https://api.yourdomain.com/api
VITE_ENV=production
```

## Performance Optimizations

- Code splitting with dynamic imports
- Lazy loading components
- Optimized re-renders with React hooks
- CSS minification and purging unused styles
- Image and asset optimization

## State Management

The application uses React's `useState` and `useEffect` hooks combined with localStorage for session persistence. This keeps the architecture simple while allowing users to resume migrations if needed.

### Persisted State
- Current step
- Source and target credentials (without storing actual keys)
- Migration ID
- User preferences

## Security Considerations

✓ Credentials are not logged or persisted to disk
✓ API keys are masked in password fields
✓ Environment variables for sensitive configuration
✓ HTTPS-ready for production deployment
✓ No hardcoded secrets in the codebase

## Common Issues

### Port Already in Use
```bash
# Use a different port
npm run dev -- --port 5174
```

### Slow Build Times
```bash
# Clear cache
rm -rf node_modules/.vite
npm run build
```

### API Connection Errors
1. Verify `VITE_API_URL` in `.env.local`
2. Ensure backend server is running
3. Check CORS headers on your backend
4. Review browser console for detailed errors

## Deployment

### Vercel
```bash
npm run build
# Push to Git and connect Vercel repo
```

### Docker
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "preview"]
```

### Traditional Hosting
1. Run `npm run build`
2. Upload `dist/` folder to your hosting
3. Configure your web server to serve `index.html` for SPA routing

## Contributing

To extend or modify this tool:

1. Create new components in `src/components/`
2. Add service functions in `src/services/`
3. Follow the existing TypeScript and component patterns
4. Test with `npm run build` before committing

## License

MIT

## Support

For issues, questions, or feature requests, please contact the development team.

---

**Version:** 1.0.0  
**Last Updated:** August 2024
