// @ts-check
import { defineConfig } from 'astro/config';

// Static build, path URLs without trailing slashes (AD-1, AD-15).
export default defineConfig({
  site: 'https://ashleylibasci.com',
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'file' },
});
