# Cognify - Project Structure

## Overview
Cognify is a modern AI SaaS web application built with React, TypeScript, Tailwind CSS v4, and Motion (Framer Motion). It features a premium dark mode design with glassmorphism effects, gradient backgrounds, and neon purple/blue accents.

## Technology Stack

### Frontend Framework
- **React 18.3.1** - UI library
- **TypeScript** - Type safety
- **Vite 6.3.5** - Build tool and dev server

### Styling
- **Tailwind CSS 4.1.12** - Utility-first CSS framework
- **Custom CSS Variables** - Theme tokens and gradients

### UI Components
- **Radix UI** - Accessible component primitives
- **Lucide React** - Icon library
- **Motion (Framer Motion)** - Animation library

### State Management
- **React useState/useEffect** - Built-in React hooks
- **Component-level state** - No external state management needed yet

## Directory Structure

```
cognify/
├── src/
│   ├── api.js                          # API integration layer
│   ├── app/
│   │   ├── App.tsx                     # Main application component
│   │   └── components/
│   │       ├── CognifyLogo.tsx         # Animated SVG logo with gradient
│   │       ├── MainChat.tsx            # Chat interface and message display
│   │       ├── Sidebar.tsx             # Navigation sidebar with chat history
│   │       ├── figma/
│   │       │   └── ImageWithFallback.tsx  # Protected image component
│   │       └── ui/                     # Radix UI component library
│   │           ├── button.tsx
│   │           ├── card.tsx
│   │           ├── input.tsx
│   │           └── ...                 # 40+ pre-built components
│   └── styles/
│       ├── fonts.css                   # Font imports
│       ├── index.css                   # Entry point for all styles
│       ├── tailwind.css                # Tailwind directives
│       └── theme.css                   # Custom CSS variables and tokens
├── package.json                        # Dependencies and scripts
├── vite.config.ts                      # Vite configuration
├── postcss.config.mjs                  # PostCSS configuration
├── BACKEND_INTEGRATION.md              # API integration guide
├── PROJECT_STRUCTURE.md                # This file
└── README.md                           # Quick start guide
```

## Key Files Explained

### `/src/app/App.tsx`
**Purpose:** Main application entry point

**Key Features:**
- Full-screen layout with gradient background
- Animated background glow effects
- Film grain texture overlay
- Container for Sidebar and MainChat

**Dependencies:**
```tsx
import { Sidebar } from './components/Sidebar';
import { MainChat } from './components/MainChat';
```

### `/src/app/components/Sidebar.tsx`
**Purpose:** Left navigation panel

**Key Features:**
- Glassmorphism design with backdrop blur
- Cognify logo with glow effect
- "New Chat" button with hover animations
- Chat history with active state
- Settings button in footer
- Scrollable chat list with custom scrollbar

**State:**
```tsx
const [activeChat, setActiveChat] = useState(0);
```

### `/src/app/components/MainChat.tsx`
**Purpose:** Main chat interface

**Key Features:**
- Empty state with hero section and suggestion cards
- Message display with user/assistant bubbles
- Loading state with animated spinner
- Floating input bar with gradient glow
- Auto-scroll to latest message
- API integration for sending messages

**State:**
```tsx
const [input, setInput] = useState('');
const [messages, setMessages] = useState([]);
const [isLoading, setIsLoading] = useState(false);
```

**API Integration:**
```tsx
const data = await askQuestion(userMsg);
```

### `/src/app/components/CognifyLogo.tsx`
**Purpose:** Animated brain/circuit logo

**Key Features:**
- SVG-based design with gradient colors
- Pulsing glow effect
- Represents AI neural network
- Reusable with customizable size

### `/src/api.js`
**Purpose:** Centralized API layer

**Endpoints:**
1. `askQuestion(question)` - POST `/v1/ask`
2. `getHints(attempt_id)` - POST `/v1/hints`
3. `getDashboard(student_id)` - GET `/v1/practice/dashboard/{id}`

**Features:**
- Error handling with fallback mock responses
- Configurable base URL
- Ready for authentication headers

### `/src/styles/theme.css`
**Purpose:** Custom design tokens

**Includes:**
- CSS custom properties for colors
- Typography defaults
- Responsive utilities
- Tailwind base styles

## Component Architecture

### Component Hierarchy
```
App
├── Background Effects (gradients, noise)
├── Sidebar
│   ├── CognifyLogo
│   ├── New Chat Button
│   ├── Chat History List
│   │   └── Chat Items (with icons)
│   └── Settings Footer
└── MainChat
    ├── Empty State
    │   ├── Hero Section (logo, title, subtitle)
    │   └── Suggestion Cards (4 cards)
    └── Chat State
        ├── Message List
        │   ├── User Messages
        │   └── Assistant Messages (with logo)
        ├── Loading Indicator
        └── Floating Input Bar
```

## Design System

### Color Palette
```css
Background Gradient: #020617 → #1a0f2e
Primary Purple: #7C3AED
Glow Purple: #9333EA
Accent Blue: #4F46E5
Text White: #EDEDED
Text Gray: #A1A1AA
Border: white/4-8% opacity
Glass BG: #0A0A0A/60-80% with backdrop-blur
```

### Spacing Scale
- Tight: 1-2px (borders, outlines)
- Compact: 4-8px (icon gaps, small padding)
- Default: 12-24px (card padding, section gaps)
- Spacious: 32-64px (major sections)

### Border Radius
- Small: 12px (buttons)
- Medium: 20px (cards)
- Large: 26px (input bar)

### Animations
```tsx
// Entry animations
initial={{ opacity: 0, y: 20 }}
animate={{ opacity: 1, y: 0 }}
transition={{ duration: 0.8 }}

// Hover effects
hover:scale-105
hover:shadow-[0_0_30px_rgba(124,58,237,0.6)]
transition-all duration-300
```

## State Management

### Current Approach
- **Local component state** using `useState`
- **Ref-based scrolling** using `useRef` and `useEffect`
- **Props drilling** for simple data flow

### Future Scalability
For larger features, consider:
- **React Context** for theme/auth state
- **Zustand or Jotai** for global state
- **React Query** for server state caching
- **Local Storage** for chat history persistence

## Responsive Design

### Breakpoints (Tailwind)
```css
sm: 640px
md: 768px  /* Main breakpoint for grid layout */
lg: 1024px
xl: 1280px
```

### Current Responsive Behavior
- Sidebar: Fixed 280px width (consider making collapsible for mobile)
- Main Chat: Flexes to fill remaining space
- Suggestion Grid: 1 column mobile, 2 columns desktop
- Max Content Width: 800px for readability

### Mobile Improvements (Future)
- Add hamburger menu for sidebar
- Make sidebar overlay on mobile
- Adjust text sizes for smaller screens
- Touch-friendly button sizes (min 44px)

## Performance Optimizations

### Current Optimizations
1. **Lazy Loading**: Use `React.lazy()` for route-based code splitting
2. **Memoization**: Consider `React.memo()` for ChatItem components
3. **Virtual Scrolling**: For large chat histories (react-window)
4. **Image Optimization**: ImageWithFallback component
5. **CSS**: Tailwind purges unused classes in production

### Bundle Size
- React + React DOM: ~140KB
- Radix UI components: ~50KB (tree-shakeable)
- Motion: ~30KB
- Lucide icons: ~5KB (only imported icons)
- **Estimated Total**: ~250KB (gzipped ~80KB)

## Build & Deployment

### Development
```bash
npm run dev      # Starts Vite dev server on localhost:5173
```

### Production Build
```bash
npm run build    # Outputs to /dist folder
```

### Preview Production Build
```bash
npm run preview  # Tests the production build locally
```

### Deployment Targets
- **Vercel** (recommended for React apps)
- **Netlify**
- **AWS Amplify**
- **Docker** (for self-hosting)

See `DEPLOYMENT_GUIDE.md` for detailed instructions.

## Adding New Features

### Adding a New Component
1. Create component in `/src/app/components/`
2. Import icons from `lucide-react`
3. Use Tailwind classes for styling
4. Add TypeScript types for props
5. Import and use in parent component

### Adding a New API Endpoint
1. Add function to `/src/api.js`:
```javascript
export const newEndpoint = async (param) => {
  const res = await fetch(`${BASE_URL}/new-endpoint`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ param }),
  });
  return res.json();
};
```
2. Import in component: `import { newEndpoint } from '../../api'`
3. Call in component logic: `const data = await newEndpoint(value)`

### Adding a New Route (Future)
This app is currently single-page. To add routing:
```bash
npm install react-router
```

Then create routes in `/src/app/routes.ts`:
```typescript
import { createBrowserRouter } from "react-router";

export const router = createBrowserRouter([
  { path: "/", Component: MainChat },
  { path: "/settings", Component: Settings },
  { path: "/dashboard", Component: Dashboard },
]);
```

## Testing Strategy (Future)

### Unit Tests
- Component rendering
- API function calls
- Utility functions

### Integration Tests
- User interactions
- API integration
- State updates

### E2E Tests
- Complete user flows
- Chat functionality
- Navigation

### Recommended Tools
- **Vitest** - Unit testing
- **React Testing Library** - Component testing
- **Playwright** - E2E testing

## Security Considerations

### Current
- No authentication implemented
- API calls use mock student ID
- No sensitive data storage

### Production Requirements
1. **Authentication**: Add JWT or session-based auth
2. **Rate Limiting**: Prevent API abuse
3. **Input Sanitization**: Validate user input
4. **HTTPS**: Always use secure connections
5. **Environment Variables**: Store API keys securely
6. **CORS**: Configure properly on backend

## Accessibility (a11y)

### Current Implementation
- Semantic HTML elements
- Keyboard navigation (Enter to send)
- Focus states on interactive elements
- Radix UI components (WCAG compliant)

### Improvements Needed
- Screen reader announcements for new messages
- ARIA labels for icon buttons
- Focus trap in modal dialogs
- Reduced motion support

## Browser Support

### Supported Browsers
- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

### Required Features
- CSS backdrop-filter (glassmorphism)
- CSS Grid
- Flexbox
- ES6+ JavaScript
- Fetch API

## Environment Variables

### Current Configuration
- API base URL hardcoded in `/src/api.js`

### Recommended Setup
Create `.env` file:
```env
VITE_API_BASE_URL=http://localhost:8000/v1
VITE_STUDENT_ID=test123
```

Update `/src/api.js`:
```javascript
const BASE_URL = import.meta.env.VITE_API_BASE_URL;
const STUDENT_ID = import.meta.env.VITE_STUDENT_ID;
```

## Known Limitations

1. **No Chat Persistence**: Messages clear on refresh
2. **Single User**: No multi-user support yet
3. **No File Uploads**: Text-only input
4. **No Streaming**: Full response loaded at once
5. **Fixed Sidebar**: Not collapsible on mobile

## Roadmap & Future Enhancements

### Phase 1 (MVP) ✅
- [x] Chat interface
- [x] Backend integration
- [x] Premium UI design
- [x] Suggestion cards

### Phase 2 (Enhanced)
- [ ] Chat history persistence (localStorage or DB)
- [ ] User authentication
- [ ] Settings panel (theme, API key)
- [ ] Practice dashboard integration
- [ ] Mobile responsive improvements

### Phase 3 (Advanced)
- [ ] Streaming responses (SSE or WebSockets)
- [ ] File/image uploads
- [ ] Code syntax highlighting
- [ ] Export conversations
- [ ] Collaborative features

### Phase 4 (Enterprise)
- [ ] Team workspaces
- [ ] Admin dashboard
- [ ] Usage analytics
- [ ] API key management
- [ ] Custom model selection

## Contributing Guidelines

When adding code:
1. Follow existing code style
2. Add TypeScript types for new components
3. Use Tailwind classes (avoid custom CSS)
4. Add comments for complex logic
5. Test locally before committing
6. Keep components under 300 lines

## Support & Resources

- **React Docs**: https://react.dev
- **Tailwind CSS**: https://tailwindcss.com
- **Vite**: https://vitejs.dev
- **Motion**: https://motion.dev
- **Radix UI**: https://radix-ui.com
- **Lucide Icons**: https://lucide.dev

## License

Private project - All rights reserved.
