# ashleylibasci.com

Source for Ashley Libasci's portfolio site, a static site built with [Astro](https://astro.build) and hosted on AWS Amplify.

Live at https://ashleylibasci.com. Career Star, which used to live at this address, is at https://careerstar.ashleylibasci.com; its old links forward there (see `redirects.json`).

```bash
npm install
npm run dev     # local preview at http://localhost:4321
npm run build   # static output in dist/
npm run check   # astro check: type errors in .astro, .ts and // @ts-check .mjs files
npm run check:links      # internal links, assets and fragments in dist/ (after build)
npm run check:redirects  # redirects.json shape, 404 order and collisions with dist/ (after build)
npm run -s sync-redirects -- --dry-run   # rules to paste into Amplify > Rewrites and redirects > Manage redirects > JSON editor
npm run sync-redirects -- --app-id <id>  # apply the rules to the Amplify app (needs the AWS CLI)
npm test        # privacy guard, link and redirect gate tests
npm run guard   # privacy guard over source, public/, dist/ and PDFs (needs GUARD_KEY in .env)
```
