# My Learning Dashboard

## Overview

The "My Learning" dashboard (`/learn/my-learning`) is a learner-facing page that displays progress through learning modules based on localStorage tracking (no authentication required). This provides a centralized view of started and completed modules, helping learners track their progress and easily resume where they left off.

## Features

### 1. Progress Summary
- **Visual Statistics**: Large, prominent display of in-progress and completed module counts
- **Progress Bar**: Visual representation of overall completion (on pathways page)
- **Auth Prompt**: When TRACK_EVENTS_ENABLED is false and user has activity, shows an unobtrusive note about signing in to sync progress across devices (coming in v0.3)

### 2. Module Sections

#### In Progress
- Lists all modules that have been started but not completed
- Each module card shows:
  - "In Progress" badge
  - Module title
  - Estimated completion time
  - Brief description
  - "Continue Learning" call-to-action

#### Completed
- Lists all modules marked as complete
- Each module card shows:
  - "Completed" badge (with green styling)
  - Module title
  - Estimated completion time
  - Brief description
  - "Review Module" call-to-action

#### Empty State
- Displayed when no modules have been started
- Shows a friendly message encouraging users to explore pathways
- Includes prominent "Explore Pathways" button linking to `/learn/pathways`

### 3. Header Navigation
All Learn templates now include a navigation bar in the header with links to:
- Modules (`/learn`)
- Courses (`/learn/courses`)
- Pathways (`/learn/pathways`)
- **My Learning** (`/learn/my-learning`)

## Data Strategy (No Auth)

### localStorage Keys
Currently, the system tracks progress using the following localStorage patterns:

1. **Pathway Progress**: `hh-pathway-progress-{pathwaySlug}`
   - Stores JSON with `{ started: number, completed: number, lastUpdated: ISO8601 }`
   - Tracks aggregate progress within a pathway

2. **Module-Specific Progress** (future enhancement): `hh-module-{moduleSlug}`
   - Will store JSON with `{ started: boolean, completed: boolean, lastUpdated: ISO8601 }`
   - Enables per-module tracking independent of pathways

### Data Fetching
The dashboard fetches module metadata from the Modules HubDB table by:
1. Scanning localStorage for progress keys
2. Extracting module slugs from progress data
3. Querying HubDB Modules table filtered by `hs_path` (slug)
4. Handling missing or stale entries gracefully (modules not found are skipped)

### Privacy & Limitations

**Privacy**:
- All progress data is stored locally in the browser's localStorage
- No data is sent to servers unless TRACK_EVENTS_ENABLED is true
- Progress is device-specific and browser-specific
- Clearing browser data will reset progress

**Limitations (until v0.3 with auth)**:
- Progress does not sync across devices
- Progress does not sync across browsers on the same device
- No server-side backup of progress
- Limited to browsers with localStorage support
- Progress tracking is currently pathway-level, not module-level

## Template Structure

### File Location
`clean-x-hedgehog-templates/learn/my-learning.html`

### Template Binding
The page is bound to the Modules HubDB table (via `HUBDB_MODULES_TABLE_ID`) to enable HubDB API access for fetching module metadata.

### Key Components

1. **Loading State**: Displays spinner while fetching data
2. **Progress Summary Card**: Shows aggregate statistics
3. **Section Headers**: Dynamically show/hide based on content
4. **Module Cards**: Reusable card component with progress badges
5. **Empty State**: Encourages exploration when no progress exists

### JavaScript Functionality

The page includes client-side JavaScript that:
- Scans localStorage for all progress keys
- Fetches module metadata from HubDB via REST API
- Renders module cards dynamically
- Handles loading, empty, and error states
- Provides keyboard navigation support

## Provisioning

The `/learn/my-learning` page is created/updated via:

```bash
npm run provision:pages
```

The provisioning script (`scripts/hubspot/provision-pages.ts`) includes the My Learning page configuration:

```typescript
{
  name: 'My Learning',
  slug: 'learn/my-learning',
  templatePath: 'CLEAN x HEDGEHOG/templates/learn/my-learning.html',
  tableEnvVar: 'HUBDB_MODULES_TABLE_ID'
}
```

## Accessibility

- **Semantic HTML**: Proper use of `<nav>`, `<section>`, `<header>` elements
- **ARIA Labels**: Navigation and regions are properly labeled
- **Keyboard Navigation**: All interactive elements are keyboard accessible
- **Focus States**: Visible focus indicators on all links and buttons
- **Screen Reader Support**: Progress information announced to screen readers

## Future Enhancements (v0.3)

When authentication is added in v0.3:
1. Progress will sync across devices
2. Server-side progress storage and retrieval
3. Progress history and analytics
4. Recommendations based on progress patterns
5. Achievement/badge system
6. Social sharing of completed modules

## Testing Checklist

- [ ] Page loads without JavaScript errors
- [ ] Loading state displays initially
- [ ] Empty state shows when no progress exists
- [ ] Module cards render with correct data when progress exists
- [ ] Progress summary statistics are accurate
- [ ] Navigation links work correctly
- [ ] Responsive design works on mobile/tablet
- [ ] Keyboard navigation functions properly
- [ ] Screen reader announcements are appropriate
- [ ] localStorage clearing resets the dashboard
- [ ] Handles missing/archived modules gracefully

## Related Documentation

- [Events & Analytics](./events-and-analytics.md) - Details on TRACK_EVENTS_ENABLED and beacon tracking
- [Architecture](./architecture.md) - Overall system architecture
- [Course Authoring](./course-authoring.md) - Content creation guidelines
