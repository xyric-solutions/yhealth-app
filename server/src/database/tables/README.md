# Database Tables

This folder contains individual SQL files for each database table, similar to MongoDB collections.

## File Structure

| File | Table | Description |
|------|-------|-------------|
| `00-extensions.sql` | - | PostgreSQL extensions (uuid-ossp) |
| `01-enums.sql` | - | All enum types used across tables |
| `02-users.sql` | `users` | User accounts and authentication |
| `03-consent-records.sql` | `consent_records` | User consent tracking |
| `04-whatsapp-enrollments.sql` | `whatsapp_enrollments` | WhatsApp coaching signup |
| `05-user-preferences.sql` | `user_preferences` | Notification/display settings |
| `06-user-goals.sql` | `user_goals` | SMART health goals |
| `07-assessment-questions.sql` | `assessment_questions` | Question bank |
| `08-assessment-responses.sql` | `assessment_responses` | User assessment answers |
| `09-user-integrations.sql` | `user_integrations` | Connected health apps |
| `10-sync-logs.sql` | `sync_logs` | Integration sync history |
| `11-health-data-records.sql` | `health_data_records` | Synced health metrics |
| `12-user-plans.sql` | `user_plans` | AI-generated health plans |
| `13-activity-logs.sql` | `activity_logs` | Daily activity tracking |
| `14-notifications.sql` | `notifications` | Push notifications |
| `15-ai-coach-sessions.sql` | `ai_coach_sessions` | AI chat history |
| `16-diet-plans.sql` | `diet_plans` | Nutrition plans |
| `17-meal-logs.sql` | `meal_logs` | Meal tracking |
| `99-triggers.sql` | - | Auto-update timestamps |

## Usage

### Full Schema Setup
```bash
npm run db:setup
```

### Run Individual Table
```bash
psql -d yhealth -f src/database/tables/15-ai-coach-sessions.sql
```

### Adding New Tables
1. Create a new file with the next number (e.g., `18-new-table.sql`)
2. Add the trigger in `99-triggers.sql`
3. Update `schema.sql` to include the new file

## Naming Convention

- Files are numbered for execution order (foreign key dependencies)
- Table names use `snake_case`
- Index names: `idx_[table]_[columns]`
- Trigger names: `update_[table]_updated_at`
