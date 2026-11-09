# sudipta.site

[![Portfolio tests](https://github.com/hermiones/sudipta-portfolio/actions/workflows/tests.yml/badge.svg)](https://github.com/hermiones/sudipta-portfolio/actions/workflows/tests.yml)

Personal portfolio of **Sudipta Mohanty**, SDET · Test automation · CI/CD · AI-assisted QA.
Live at **https://sudipta.site**.

## Tested like production code

An SDET's portfolio should be tested too. [`tests/`](tests/) holds a Playwright suite that checks the live site on
**Chromium (Chrome/Edge), Firefox and WebKit (Safari)** at 7 screen sizes, from iPhone SE to a 1920px desktop. That's 21 checks in total:

- no JavaScript errors
- no horizontal scroll or content overflowing the screen
- hero (name, title, buttons) visible and not clipped
- contact bar, all sections, GitHub cards and CV download present

GitHub Actions ([`.github/workflows/tests.yml`](.github/workflows/tests.yml)) runs the suite on every push, after every production deploy, and once a day.

```bash
cd tests
npm ci && npx playwright install
SITE_URL=https://sudipta.site npx playwright test
```

## Stack

Plain HTML/CSS/JS in a single file, with no framework. The animations (the agent swarm build, the 3D wireframes, the CI pipeline) are hand-written canvas code. It's hosted on Vercel.
