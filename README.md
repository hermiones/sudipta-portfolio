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

## Future scope

- **Contact form through Web3Forms.** Right now "Send message" opens the visitor's own email app with the message pre-filled, and the address is only assembled on click, so it isn't scrapable. To send straight from the page instead, paste a Web3Forms access key into `WEB3FORMS_KEY` in `index.html`. The 12-second timeout and the clipboard + LinkedIn fallback are already built in.
- **Live 👁 "people here now" counter.** The `/api/presence` function is ready. It needs Upstash Redis (free) connected to the Vercel project.
- **Visitor analytics.** Enable Vercel Web Analytics on the project (the script is already on the page).
- **Recommendations carousel**, built from real LinkedIn recommendations.
- **Real dates in the Level-Up Log.**
