# Changelog

All notable changes to Cloudflare Monitor will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-11-28

### 🎉 Initial Release

First production-ready release of Cloudflare Monitor - a real-time monitoring platform for Cloudflare Pages deployments.

### Added

#### Core Features
- **Real-time Dashboard** - Live monitoring of all Cloudflare Pages projects and deployments
- **Server-Sent Events (SSE)** - Millisecond-latency updates without polling overhead
- **Deployment Tracking** - Track deployment status (active, building, deploying, failed, queued, cancelled)
- **Project Overview** - View all projects with deployment statistics
- **Failure Monitoring** - Dedicated view for failed deployments with configurable retention period

#### Technical Architecture
- **Bun Runtime** - High-performance JavaScript runtime with native SQLite support
- **Hono Framework** - Ultrafast, lightweight web framework for the API
- **React 18** - Modern frontend with hooks and concurrent features
- **Zustand** - Lightweight state management for the dashboard
- **SQLite with WAL** - Embedded database with write-ahead logging for performance
- **LRU Caching** - Intelligent caching layer to reduce API calls

#### API Endpoints
- `GET /health` - Health check endpoints (detailed, ready, live)
- `GET /api/projects` - List all monitored projects
- `GET /api/projects/:id` - Get project details
- `GET /api/deployments` - List deployments with filtering
- `GET /api/deployments?status=failure` - Filter by status
- `GET /api/deployments/stats/summary` - Aggregate statistics
- `GET /api/events` - SSE endpoint for real-time updates

#### Dashboard Features
- **Stats Cards** - Clickable metrics tiles linking to filtered views
- **Recent Deployments** - Live-updating list of latest deployments
- **Status Badges** - Visual indicators for deployment status
- **Deployment Details** - Full timestamps, stage info, and direct links
- **Projects Page** - Overview of all monitored Cloudflare Pages projects
- **Responsive Design** - Mobile-friendly Tailwind CSS styling

#### Developer Experience
- **One-Command Install** - `./install.sh` handles complete setup
- **TypeScript Throughout** - Full type safety with Zod runtime validation
- **Monorepo Structure** - Organized workspace with shared packages
- **Hot Reloading** - Fast development iteration with `bun run dev`
- **Comprehensive Documentation** - README, API docs, architecture guide

#### Configuration
- `CLOUDFLARE_API_TOKEN` - Cloudflare API authentication
- `CLOUDFLARE_ACCOUNT_ID` - Target Cloudflare account
- `POLL_INTERVAL_MS` - Configurable polling frequency (default: 5000ms)
- `FAILURE_RETENTION_DAYS` - How long to show failed deployments (default: 7 days)
- `CACHE_TTL_MS` - Cache time-to-live (default: 10000ms)

#### Security
- **Pre-commit Hooks** - Gitleaks integration for secret detection
- **GitHub Actions** - Automated security scanning on push/PR
- **Comprehensive .gitignore** - Multi-layered defense against credential exposure
- **Environment Validation** - Fail-fast on invalid configuration

### Technical Notes

- Minimum Bun version: 1.0.0
- Minimum Node version: 20.0.0 (if not using Bun)
- SQLite database created automatically at `./data/monitor.db`
- Default ports: API on 3001, Frontend on 5173

### Known Limitations

- Single Cloudflare account support (multi-account planned for v1.1)
- No deployment log viewing (planned for v1.2)
- No alerting/notifications (planned for v1.1)

---

## [Unreleased]

### Changed
- **License** - Changed from GPL-3.0 to MIT License (2024-11-30)

### Planned for v1.1.0
- Email/Slack/Discord notifications for deployment failures
- Multi-account Cloudflare support
- Deployment log viewer
- Custom dashboard layouts

### Planned for v1.2.0
- Workers monitoring
- R2 storage metrics
- Analytics dashboard with historical trends
- Data export (CSV/JSON)

---

[1.0.0]: https://github.com/CrashBytes/cloudflare-monitor/releases/tag/v1.0.0
[Unreleased]: https://github.com/CrashBytes/cloudflare-monitor/compare/v1.0.0...HEAD
