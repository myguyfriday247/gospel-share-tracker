# Gospel Share Tracker - Product Brief

**Version:** 1.0  
**Status:** ✅ Ready for Beta Launch  
**Date:** February 9, 2026

---

## Phases of Development

### Phase 1: Foundation (MVP)
- User authentication (signup, login, logout)
- Basic user profile management
- Core data model setup (people + gospel share entries tables)
- Row Level Security (RLS) policies
- Basic share entry creation

### Phase 2: Core Features
- Dashboard with personal analytics
- Share entry management (create, edit, delete)
- Reusable share form component
- Recent shares display
- Date range filtering

### Phase 3: Analytics & Visualization
- Personal analytics with charts (Recharts)
- Time-series visualization
- Share type breakdowns
- Data export (CSV)

### Phase 4: Admin Capabilities
- Admin dashboard with community metrics
- User management (people list, search, pagination)
- Role-based access control
- Admin/user toggle functionality

### Phase 5: Data Management
- CSV import functionality
- Bulk user import
- Advanced data export
- Entry records management

### Phase 6: Polish & Beta Prep
- Responsive UI refinements
- Mobile navigation (hamburger menu)
- Accessibility improvements
- Error handling & loading states
- Beta testing & bug fixes

---

## Overview

Gospel Share Tracker is a web application for tracking personal evangelism efforts. Users log gospel-sharing encounters, view analytics, and administrators manage the community data.

---

## User Roles

### Standard User
- Log gospel shares (invite, conversation, story, gospel presentation)
- Track number of people reached per encounter
- Record gospel responses
- View personal dashboard with analytics
- View and edit own profile
- Export personal data

### Administrator
- All standard user capabilities
- Access admin dashboard with community-wide analytics
- Manage all user profiles
- Export community data
- Import new users via CSV
- Toggle user admin roles
- View all user dashboards

---

## Core Features

### 1. Authentication & User Management

**Sign Up**
- Email and password registration
- Full name required (first and last)
- Unique display name validation
- Email confirmation required

**Log In**
- Email and password authentication
- Session persistence
- Secure logout

**Profile Management**
- View profile with share history
- Edit profile information
- Profile accessible at `/admin/people/{id}`

### 2. Share Entry System

**Data Collected**
- Entry date
- Share types (multiple selections allowed):
  - Church Invite
  - Spiritual Conversation
  - Story Share
  - Gospel Presentation
- Number of people reached
- Gospel response indicator
- Number of responses (if gospel response)
- Notes/description of encounter

**Entry Management**
- Create new entries
- Edit existing entries
- Delete entries with confirmation
- View entry details in modal

**Share Form**
- Reusable component across app
- Consistent validation
- Success/error feedback
- Automatic refresh on submit

### 3. Dashboard

**Personal Dashboard**
- Accessible at `/dashboard`
- Shows user's own data by default
- Date range filtering (all, this week, last week, this month, last month, this year)
- Summary cards:
  - Total Reached
  - Gospel Responses
  - Share type breakdowns (Invite, Conversation, Story, Gospel)
- Line chart: Reached + Responses over time
- Recent Shares list (last 3 entries)
- "See All Shares" link to profile

**Date Range Selector**
- Reusable dropdown component
- Predefined ranges with custom options
- Consistent across dashboard and admin views

**Recent Shares Card**
- Displays last 3 entries
- Shows date, share types, reached, response, notes
- Edit and delete actions per entry
- View all shares link

### 4. Analytics & Reporting

**Personal Analytics**
- Total people reached
- Total gospel responses
- Breakdown by share type
- Time-series chart

**Admin Dashboard**
- Community-wide metrics
- Total unique users
- Aggregate reached and responses
- Share type breakdowns
- User leaderboard table
- Pagination (10, 25, 50 rows)
- Sortable columns
- Date range filtering
- Time-series chart

**Charts**
- Recharts library implementation
- Responsive container
- Tooltip on hover
- Legend
- Custom date aggregation

### 5. Admin Portal

**People Management**
- Full user list at `/admin/people`
- Search by name
- Pagination
- Sortable columns (name, email, created date)
- Role display (admin/user)
- Promote/demote admin access
- View individual profile

**Export Functionality**
- CSV export for people table
- CSV export for entries table
- Client-side generation

**Import Functionality**
- CSV upload for new users
- Preview before import
- Bulk insert with validation

### 6. Entry Records

**Entry Record Component**
- Reusable card display
- Shows date, share types, stats, notes
- Edit and delete actions
- Responsive layout (stacks on mobile)
- Used in dashboard and profile views

**View Dialog**
- Full entry details in modal
- Edit and delete actions
- 80% width for readability
- Responsive share type layout

### 7. User Interface

**Responsive Header**
- Logo with navigation links
- "Add Share" button prominent
- My Dashboard link
- My Profile link
- Admin links (admin only)
- Log Out button
- Mobile hamburger menu (< 1024px)

**Navigation**
- My Dashboard - Personal analytics
- My Profile - Personal profile and history
- Admin Dashboard - Community analytics (admin)
- Admin Portal - User management (admin)

**Buttons**
- "Add Share" - Green (#5cbe80)
- "See All Shares" - Green (#5cbe80)
- Consistent hover states

**Tables**
- Pagination (10, 25, 50)
- Sortable columns
- Empty state handling
- Loading states

**Forms**
- Consistent validation
- Error messages
- Loading states
- Cancel actions

---

## Data Model

### People Table
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key, matches auth.users.id |
| email | text | User email |
| full_name | text | Display name |
| role | text | 'admin' or 'user' |
| created_at | timestamptz | Record creation |

### Gospel Share Entries Table
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| person_id | uuid | FK to people.id |
| entry_date | date | Date of share |
| number_reached | int | People reached |
| church_invite | bool | Invite type |
| spiritual_conversation | bool | Conversation type |
| story_share | bool | Story type |
| gospel_presentation | bool | Gospel type |
| gospel_response | bool | Response received |
| number_response | int | Number responding |
| notes | text | Description |
| created_at | timestamptz | Record creation |

---

## Technical Stack

**Frontend**
- Next.js 16
- React 19
- TypeScript
- Tailwind CSS
- shadcn/ui components
- Recharts for data visualization

**Backend**
- Supabase (PostgreSQL)
- Supabase Auth
- Row Level Security (RLS)

**Development**
- npm package management
- TypeScript strict mode
- ESLint

---

## User Flow

### New User Signup
1. Visit app → Redirect to login
2. Click "Create account"
3. Enter full name, email, password
4. Submit → Check name availability → Create account
5. Check email for confirmation
6. Confirm → Log in
7. Redirect to dashboard (empty state)
8. Add first share

### Standard User Daily Use
1. Log in
2. See dashboard with recent activity
3. Click "Add Share" to log encounter
4. View updated metrics
5. Click "My Profile" to see history
6. Log out

### Admin Daily Use
1. Log in
2. See admin dashboard with community metrics
3. Navigate to Admin Portal for user management
4. Export data as needed
5. Log out

---

## Security

**Authentication**
- Email/password required
- Session-based auth
- Secure logout

**Authorization**
- Role-based access control
- Admin checks on protected routes
- User can only edit own profile

**Data Protection**
- Supabase RLS policies
- No exposed credentials
- Secure session handling

---

## Non-Functional Requirements

### Performance
- Pagination on all tables
- Optimized database queries
- Responsive images

### Accessibility
- Semantic HTML
- ARIA labels
- Keyboard navigation
- Screen reader compatible

### Responsive Design
- Mobile-first approach
- Breakpoints: 1024px
- Hamburger menu on mobile
- Stacked layouts on small screens

---

## Future Considerations

*(Not included in v1.0)*

- Email notifications
- Password reset
- Two-factor authentication
- Data export formats (PDF)
- Advanced analytics
- User settings page
- Activity feed
- Social sharing

---

## Appendix: File Structure

```
gospel-share-tracker/
├── app/
│   ├── admin/
│   │   ├── export/page.tsx
│   │   ├── import/page.tsx
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── people/
│   │   │   ├── page.tsx
│   │   │   └── [id]/page.tsx
│   │   ├── portal/page.tsx
│   │   └── users/page.tsx
│   ├── dashboard/
│   │   ├── new/page.tsx
│   │   └── page.tsx
│   ├── login/page.tsx
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── EntryRecord.tsx
│   ├── Header.tsx
│   ├── forms/
│   │   ├── PersonEditForm.tsx
│   │   └── ShareForm.tsx
│   └── ui/
│       ├── DateRangeSelector.tsx
│       ├── Pagination.tsx
│       ├── SortableHeader.tsx
│       └── [shadcn components]
├── lib/
│   ├── date.ts
│   ├── supabaseClient.ts
│   ├── types.ts
│   └── utils.ts
└── migrations/
    └── [SQL migrations]
```
