# Portugal Vivo - E2E Tests

## Setup

### Playwright (Web)

```bash
cd e2e
npm install
npx playwright install --with-deps

# Run tests
npm run test:playwright

# Run headed (see browser)
npm run test:playwright:headed

# View report
npm run test:playwright:report
```

### Maestro (Mobile)

1. Install Maestro CLI:
```bash
curl -Ls "https://get.maestro.mobile.dev" | bash
```

2. Run tests:
```bash
cd e2e
maestro test maestro/

# Or use Maestro Studio for interactive testing
maestro studio
```

## Test Files

### Playwright (Web)
- `playwright/homepage.spec.ts` - Homepage & navigation
- `playwright/map.spec.ts` - Map & filtering

### Maestro (Mobile)
- `maestro/flow_homepage.yaml` - Homepage & tabs
- `maestro/flow_map.yaml` - Map & filtering

## CI/CD Integration

Add to GitHub Actions:

```yaml
- name: Run E2E Tests
  run: |
    cd e2e
    npm ci
    npx playwright install --with-deps
    npm run test:playwright
```

## Environment Variables

```env
BASE_URL=http://localhost:3000  # For Playwright
```
