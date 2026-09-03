# Supabase Database Migration Backend API

Backend server for the Supabase Database Migration Tool. Handles connections to source and target Supabase databases and orchestrates the migration process.

## Features

✨ **Database Operations**
- Connect to source and target Supabase databases
- Retrieve database metadata (tables, records, functions, triggers, etc.)
- Generate migration summaries
- Orchestrate data migration

🔧 **API Endpoints**
- Health check endpoint
- Source database connection
- Target database connection
- Migration summary generation
- Migration start/progress/report endpoints

🚀 **Scalable Architecture**
- Express.js server
- In-memory migration tracking
- Async migration processing
- Error handling and logging

## Installation

### Prerequisites
- Node.js 18+
- npm

### Setup

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env
   ```

## Development

### Start Development Server

```bash
npm run dev
```

Server starts at `http://localhost:3000`

### Start Production Server

```bash
npm start
```

## API Endpoints

### Health Check
```
GET /health
```
Returns server status.

### Connect to Source Database
```
POST /api/migration/source/connect
Content-Type: application/json

{
  "baseUrl": "https://your-project.supabase.co",
  "anonKey": "your-anon-key"
}
```

**Response:**
```json
{
  "tables": 24,
  "publicTables": 15,
  "privateTables": 5,
  "authTables": 4,
  "totalRecords": 5847,
  "functions": 12,
  "triggers": 18,
  "views": 8,
  "indexes": 32,
  "policies": 20
}
```

### Connect to Target Database
```
POST /api/migration/target/connect
Content-Type: application/json

{
  "baseUrl": "https://your-target-project.supabase.co",
  "anonKey": "your-target-anon-key"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Connected to target database"
}
```

### Get Migration Summary
```
POST /api/migration/summary
Content-Type: application/json

{
  "source": {
    "baseUrl": "https://source.supabase.co",
    "anonKey": "source-key"
  },
  "target": {
    "baseUrl": "https://target.supabase.co",
    "anonKey": "target-key"
  }
}
```

**Response:**
```json
{
  "source": {
    "baseUrl": "https://source.supabase.co",
    "tables": 24,
    "records": 5847,
    "functions": 12,
    "triggers": 18,
    "views": 8,
    "indexes": 32,
    "policies": 20
  },
  "target": {
    "baseUrl": "https://target.supabase.co"
  },
  "details": { ... }
}
```

### Start Migration
```
POST /api/migration/start
Content-Type: application/json

{
  "sourceCredentials": {
    "baseUrl": "https://source.supabase.co",
    "anonKey": "source-key"
  },
  "targetCredentials": {
    "baseUrl": "https://target.supabase.co",
    "anonKey": "target-key"
  }
}
```

**Response:**
```json
{
  "migrationId": "migration_1234567890_abc123"
}
```

### Get Migration Progress
```
GET /api/migration/{migrationId}/progress
```

**Response:**
```json
{
  "migrationId": "migration_1234567890_abc123",
  "status": "migrating",
  "progress": 60,
  "currentStep": "Migrating records...",
  "details": {
    "tablesProcessed": 24,
    "totalTables": 24,
    "recordsMigrated": 3500,
    "totalRecords": 5847,
    "functionsMigrated": 8,
    "totalFunctions": 12,
    "triggersMigrated": 12,
    "totalTriggers": 18,
    "viewsMigrated": 5,
    "totalViews": 8,
    "policiesMigrated": 15,
    "totalPolicies": 20
  },
  "errors": []
}
```

### Get Migration Report
```
GET /api/migration/{migrationId}/report
```

**Response:**
```json
{
  "migrationId": "migration_1234567890_abc123",
  "startTime": "2024-08-31T10:30:00.000Z",
  "endTime": "2024-08-31T10:35:15.000Z",
  "duration": "5 minutes 15 seconds",
  "status": "success",
  "summary": {
    "tablesMigrated": 24,
    "totalTables": 24,
    "recordsMigrated": 5847,
    "totalRecords": 5847,
    "functionsMigrated": 12,
    "totalFunctions": 12,
    "triggersMigrated": 18,
    "totalTriggers": 18,
    "viewsMigrated": 8,
    "totalViews": 8,
    "policiesMigrated": 20,
    "totalPolicies": 20
  },
  "failedObjects": []
}
```

## Testing the API

### Using cURL

1. **Test Health:**
   ```bash
   curl http://localhost:3000/health
   ```

2. **Test Source Connection:**
   ```bash
   curl -X POST http://localhost:3000/api/migration/source/connect \
     -H "Content-Type: application/json" \
     -d '{
       "baseUrl": "https://your-project.supabase.co",
       "anonKey": "your-anon-key"
     }'
   ```

3. **Start Migration:**
   ```bash
   curl -X POST http://localhost:3000/api/migration/start \
     -H "Content-Type: application/json" \
     -d '{
       "sourceCredentials": {
         "baseUrl": "https://source.supabase.co",
         "anonKey": "source-key"
       },
       "targetCredentials": {
         "baseUrl": "https://target.supabase.co",
         "anonKey": "target-key"
       }
     }'
   ```

### Using Postman

1. Import the collection provided in `postman-collection.json`
2. Update the collection variables with your Supabase credentials
3. Run the requests in order

### Using the Frontend

1. Start the backend: `npm run dev`
2. Update frontend `.env.local`: `VITE_API_URL=http://localhost:3000/api`
3. Start the frontend: `cd ../frontend && npm run dev`
4. Test through the UI

## Environment Variables

```
PORT=3000                          # Server port
NODE_ENV=development               # Environment
CORS_ORIGIN=http://localhost:5173  # Frontend URL for CORS
```

## Error Handling

The API returns appropriate HTTP status codes:
- `200` - Success
- `400` - Bad request (missing required fields)
- `401` - Unauthorized (invalid credentials)
- `404` - Not found (migration ID doesn't exist)
- `500` - Server error

All errors include a message and optional details:
```json
{
  "error": "Error message",
  "details": "Additional error information"
}
```

## Deployment

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Environment for Production

```
PORT=3000
NODE_ENV=production
CORS_ORIGIN=https://your-frontend-domain.com
```

## Architecture

```
backend/
├── server.js           # Main API server
├── package.json        # Dependencies
├── .env               # Environment variables
└── README.md          # This file
```

## Flow

1. Frontend sends credentials to `/api/migration/source/connect`
2. Backend connects to source database using Supabase client
3. Frontend sends target credentials to `/api/migration/target/connect`
4. Backend verifies target database access
5. Frontend requests migration summary
6. Backend retrieves database metadata
7. Frontend calls `/api/migration/start` to begin migration
8. Backend starts async migration process
9. Frontend polls `/api/migration/:id/progress` for real-time updates
10. When complete, frontend fetches `/api/migration/:id/report`

## Future Enhancements

- [ ] Implement actual data migration logic
- [ ] Add database connection pooling
- [ ] Implement migration retry logic
- [ ] Add PostgreSQL direct connection support
- [ ] Database persistence for migrations
- [ ] Webhook notifications
- [ ] Migration scheduling
- [ ] Rollback capabilities

## Troubleshooting

### "Port 3000 already in use"
```bash
# Use a different port
PORT=3001 npm run dev
```

### "Connection refused"
- Ensure Supabase credentials are correct
- Check your Supabase project settings
- Verify network connectivity

### "CORS error"
- Update `CORS_ORIGIN` in `.env`
- Ensure frontend URL matches

## License

MIT

## Support

For issues or questions, contact the development team.

---

**Version:** 1.0.0  
**Last Updated:** August 2024
