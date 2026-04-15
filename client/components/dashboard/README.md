# Enterprise Dashboard Layout System

A premium, enterprise-grade dashboard layout system inspired by Linear, Vercel, Stripe, Notion, Supabase, and GitHub Enterprise.

## Components

### `DashboardLayout`
Main layout wrapper that combines the sidebar and header into a cohesive dashboard experience.

**Props:**
- `children: ReactNode` - Page content
- `variant?: "admin" | "user"` - Layout variant (default: "admin")
- `className?: string` - Additional CSS classes

**Usage:**
```tsx
import { DashboardLayout } from "@/components/dashboard";

export default function AdminPage() {
  return (
    <DashboardLayout variant="admin">
      <YourContent />
    </DashboardLayout>
  );
}
```

### `DashboardSidebar`
Advanced collapsible sidebar with role-based navigation, section grouping, and mobile drawer support.

**Features:**
- Collapsible (icon-only + expanded modes)
- Role-aware menu items (Admin / User / Analyst)
- Section grouping with separators
- Active route highlighting with smooth animations
- Mobile drawer with overlay
- Tooltips in collapsed mode
- Keyboard accessible

**Props:**
- `variant?: "admin" | "user"` - Sidebar variant
- `onToggle?: (collapsed: boolean) => void` - Callback when sidebar state changes

### `DashboardHeader`
Premium header with breadcrumbs, global search, notifications, theme toggle, and user menu.

**Features:**
- Context-aware breadcrumb navigation
- Global search (⌘K / Ctrl+K)
- Notifications dropdown
- Theme toggle (Light / Dark / System)
- User profile menu with avatar
- Sticky with subtle shadow on scroll
- Smooth animations

**Props:**
- `sidebarCollapsed?: boolean` - Whether sidebar is collapsed
- `onSidebarToggle?: () => void` - Toggle sidebar callback

## Navigation Structure

The sidebar is organized into sections:

1. **Overview** - Dashboard, Analytics
2. **Management** - Users, Roles, Content (Admin only)
3. **Operations** - Tasks, Workflows, Logs (Admin only)
4. **AI & Automation** - Models, Jobs, Monitoring (Admin only)
5. **Reports** - Exports, Insights
6. **Settings** - General, Security, Billing

## Responsive Behavior

- **Desktop (≥1024px)**: Persistent sidebar, full header
- **Tablet (768px-1023px)**: Collapsible sidebar
- **Mobile (<768px)**: Off-canvas drawer with overlay

## Keyboard Shortcuts

- `⌘K` / `Ctrl+K`: Open global search
- `Esc`: Close search or mobile menu

## Styling

The components use:
- Tailwind CSS for styling
- Framer Motion for animations
- shadcn/ui components
- Consistent 8px spacing system
- Rounded corners (2xl)
- Soft shadows, no harsh borders

## Accessibility

- Keyboard navigation support
- ARIA labels where appropriate
- Focus states for all interactive elements
- Screen reader friendly

