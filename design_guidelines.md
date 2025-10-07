# LIA CORTEX Design Guidelines

## Design Approach: Enterprise System Architecture

**Selected Framework:** Carbon Design System + Linear-inspired Interface Patterns  
**Rationale:** LIA CORTEX is an enterprise-grade AI orchestration platform requiring clarity, efficiency, and data-dense interfaces. Carbon's enterprise DNA combined with Linear's modern aesthetic creates optimal agent productivity.

**Core Principles:**
- Clarity over decoration: Every pixel serves agent efficiency
- Information density with breathing room
- Real-time feedback for AI operations
- Trustworthy, professional aesthetic for B2B platform

---

## Color Palette

### Dark Mode (Primary)
**Background Layers:**
- Base: 220 15% 8%
- Surface: 220 15% 12%
- Elevated: 220 15% 16%
- Overlay: 220 15% 20%

**Brand & Accent:**
- Primary (AI Blue): 215 85% 55%
- Primary Hover: 215 85% 62%
- Success (Active Assistant): 142 75% 45%
- Warning (Processing): 38 92% 55%
- Error (Failed): 0 75% 55%

**Text Hierarchy:**
- Primary: 220 10% 95%
- Secondary: 220 8% 70%
- Tertiary: 220 8% 50%
- Disabled: 220 8% 35%

### Light Mode (Secondary)
**Backgrounds:**
- Base: 0 0% 99%
- Surface: 0 0% 100%
- Elevated: 220 20% 98%

**Accent Colors:** Same hues, adjusted lightness for contrast

---

## Typography

**Font Stack:**
- Primary: 'Inter', -apple-system, BlinkMacSystemFont, system-ui, sans-serif
- Monospace: 'JetBrains Mono', 'Fira Code', Consolas, monospace

**Scale & Usage:**
- Headings (Dashboard Sections): text-2xl font-semibold (24px)
- Subheadings (Panel Titles): text-lg font-medium (18px)
- Body (Chat Messages, Forms): text-sm (14px)
- Small (Metadata, Timestamps): text-xs (12px)
- Code/JSON (API Responses): text-xs font-mono

**Line Heights:**
- Headings: leading-tight (1.2)
- Body: leading-relaxed (1.6)
- Dense Lists: leading-snug (1.4)

---

## Layout System

**Spacing Primitives:** Use Tailwind units of 2, 4, 6, 8, 12, 16 for consistent rhythm
- Micro spacing (icons, badges): p-1, gap-2
- Component padding: p-4, p-6
- Section spacing: py-8, py-12
- Page margins: px-6, px-8

**Grid Structure:**
- Dashboard: 3-column layout (Sidebar 240px | Main Content flex-1 | Details Panel 320px)
- Chat Interface: 2-column (Conversation List 280px | Active Chat flex-1)
- Responsive: Collapse to single column below 1024px

**Container Widths:**
- Dashboard max-width: Full viewport with controlled inner padding
- Forms/Settings: max-w-4xl mx-auto
- Chat messages: max-w-3xl

---

## Component Library

### Navigation
**Sidebar (Agent Dashboard):**
- Fixed left, dark surface (220 15% 12%)
- Active state: Primary blue left border (4px) + blue/10 background
- Icons: 20px, secondary color
- Item height: h-10, hover state with subtle background lift

**Top Bar:**
- Fixed header, h-16
- Breadcrumbs on left, user profile + notifications on right
- Search bar (max-w-md) with ⌘K shortcut indicator
- Divider: border-b with 220 15% 20% color

### Chat Components
**Message Bubbles:**
- Customer messages: bg-surface, rounded-2xl, max-w-lg
- AI responses: bg-primary/10, border-l-2 border-primary
- Agent messages: bg-elevated, rounded-2xl
- Padding: p-4, with avatar (8x8 rounded-full) aligned top

**Assistant Status Indicators:**
- Pill badges: px-3 py-1 rounded-full text-xs font-medium
- LIA Suporte: green badge
- LIA Comercial: blue badge  
- Processing: amber badge with pulse animation
- Function calls: purple badge with code icon

**Input Area:**
- Sticky bottom, border-t, bg-surface
- Auto-resize textarea, max-h-32
- Send button: Primary blue, rounded-lg, h-10 w-10
- File attachment + emoji picker icons (secondary color)

### Data Display
**Metrics Cards:**
- bg-surface, rounded-lg, border border-elevated
- Title: text-sm text-secondary, uppercase tracking-wide
- Value: text-3xl font-bold text-primary
- Change indicator: text-xs with trend arrow (↑↓)
- Grid layout: grid-cols-4 gap-4

**Knowledge Base Search Results:**
- List items: py-3 px-4, border-b
- Relevance score: Progress bar (h-1) with gradient
- Document source: text-xs text-tertiary with file icon
- Matched text: Highlighted with bg-primary/20

**Thread/Session List:**
- Compact rows: h-16, hover:bg-elevated
- Client name: font-medium
- Last message preview: truncate, text-secondary
- Timestamp: absolute right, text-xs
- Unread badge: Numeric, bg-primary, rounded-full

### Forms & Inputs
**Text Inputs:**
- Height: h-10 (consistent across forms)
- Background: bg-elevated in dark mode
- Border: border border-220-15-20, focus:border-primary
- Padding: px-3
- Labels: text-sm font-medium mb-1.5

**Buttons:**
- Primary: bg-primary text-white, h-10 px-6 rounded-lg font-medium
- Secondary: bg-elevated border border-elevated, same dimensions
- Ghost: hover:bg-elevated, no initial background
- Icon buttons: h-10 w-10, flex items-center justify-center

**Dropdowns/Selects:**
- Match input styling
- Options menu: bg-surface, shadow-xl, rounded-lg, max-h-64 overflow-auto
- Selected item: bg-primary/10

### Overlays
**Modals (RAG Query Preview, Function Call Details):**
- Backdrop: bg-black/60 backdrop-blur-sm
- Content: bg-surface, rounded-xl, max-w-2xl, p-6
- Header: flex justify-between, mb-4
- Footer: flex gap-3, justify-end, pt-4 border-t

**Toasts (System Notifications):**
- Fixed bottom-right, stack vertically with gap-2
- bg-surface, border-l-4 (success green, error red, info blue)
- Auto-dismiss after 5s, slide-in animation
- Icon + message + close button

---

## Specialized Features

### AI Routing Visualization
**Flow Diagram (Optional Dashboard Widget):**
- SVG-based connector lines between assistant nodes
- Nodes: Rounded rectangles, 120px width, color-coded by assistant type
- Active route: Animated gradient stroke
- Labels: text-xs, positioned above connectors

### Real-time Indicators
**Typing Indicators:** Three bouncing dots (4px each), gray-400, gap-1
**Processing Functions:** Spinner icon (16px) with "Consulting knowledge base..." text
**Connection Status:** Small dot (6px) in top bar - green (online), amber (reconnecting), red (offline)

### RAG Context Display
**Knowledge Chunks Panel:**
- Accordion-style, each chunk in bg-elevated rounded-lg
- Source document badge at top-right
- Relevance percentage: Bold, primary color
- Expandable full text with "Show more" link

---

## Animations

**Use Sparingly:**
- Page transitions: None (instant for productivity)
- Micro-interactions only:
  - Button hover: scale-[1.02] (subtle)
  - Message send: slide-up with fade-in (200ms)
  - Assistant switch: Crossfade between panels (150ms)
  - Toast entrance: slide-in-right (300ms ease-out)

**Loading States:**
- Skeleton screens for data tables (shimmer effect, 220 15% 16% to 220 15% 20%)
- Inline spinners for button actions (16px, border-2)

---

## Images

**Dashboard Header (Optional):**
- Subtle abstract neural network pattern as background texture (low opacity, 0.03)
- Not a traditional hero - integrated into top bar area

**Assistant Avatars:**
- 32x32 rounded-full icons representing each assistant
- LIA Suporte: Support headset icon on blue gradient
- LIA Comercial: Handshake icon on green gradient
- Custom generated with consistent style

**Empty States:**
- Centered illustrations (max 240px width) for "No active conversations", "Knowledge base empty"
- Minimalist line art style, primary color with 60% opacity

**No large hero images** - This is a utility-focused enterprise dashboard prioritizing efficiency over visual splash.