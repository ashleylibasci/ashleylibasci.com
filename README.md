# ashleylibasci.com

Source for Ashley Libasci's portfolio site, a static site built with [Astro](https://astro.build) and hosted on AWS Amplify.

```bash
npm install
npm run dev     # local preview at http://localhost:4321
npm run build   # static output in dist/
npm run check   # astro check: type errors in .astro, .ts and // @ts-check .mjs files
npm run check:links      # internal links, assets and fragments in dist/ (after build)
npm run check:redirects  # redirects.json shape, 404 order and collisions with dist/ (after build)
npm test        # privacy guard, link and redirect gate tests
npm run guard   # privacy guard over source, public/, dist/ and PDFs (needs GUARD_KEY in .env)
```
