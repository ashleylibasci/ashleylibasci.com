// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import { satteri } from '@astrojs/markdown-satteri';

/**
 * Fonts resolve only from installed @fontsource packages, never a CDN (AD-19).
 * Two gaps in Astro 7.4.12 / unifont 1.0.3 with `remote: false`, patched here:
 * - the provider returns `file://` URLs, but Astro only reads absolute paths
 *   and tries to fetch anything else, so they become POSIX paths (macOS and
 *   the Linux build image only);
 * - local resolution ignores `subsets`, so faces are kept only when the
 *   Fontsource file name (`<family>-<subset>-<weight>-<style>`) has a
 *   requested subset.
 * Remove the wrapper once upstream handles both.
 */
function localNpm() {
  const provider = fontProviders.npm({ remote: false });
  return {
    ...provider,
    /** @param {Parameters<typeof provider.resolveFont>[0]} options */
    async resolveFont(options) {
      const result = await provider.resolveFont(options);
      if (!result?.fonts) return result;
      const subsets = options.subsets ?? [];
      /** @param {string} url */
      const subsetOf = (url) =>
        subsets.find((/** @type {string} */ subset) => new RegExp(`-${subset}-\\d+-[a-z]+\\.[a-z0-9]+$`).test(url));
      const fonts = [];
      for (const font of result.fonts) {
        const src = font.src.map((source) =>
          'url' in source && source.url.startsWith('file:')
            ? { ...source, url: decodeURIComponent(new URL(source.url).pathname) }
            : source,
        );
        const urls = src.filter((source) => 'url' in source).map((source) => source.url);
        const subset = subsets.length ? urls.map(subsetOf).find(Boolean) : undefined;
        if (subsets.length && !subset) continue;
        fonts.push({ ...font, src, meta: { ...font.meta, ...(subset && { subset }) } });
      }
      return { ...result, fonts };
    },
  };
}

// Static build, path URLs without trailing slashes (AD-1, AD-15).
export default defineConfig({
  site: 'https://ashleylibasci.com',
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'file' },
  // Copy keeps the straight quotes it is written with, in Markdown as in the pages.
  markdown: { processor: satteri({ features: { smartPunctuation: false } }) },
  fonts: [
    {
      name: 'Marcellus',
      cssVariable: '--font-marcellus',
      provider: localNpm(),
      weights: [400],
      styles: ['normal'],
      subsets: ['latin'],
      fallbacks: ['serif'],
    },
    {
      name: 'Albert Sans',
      cssVariable: '--font-albert-sans',
      provider: localNpm(),
      weights: [400, 500],
      styles: ['normal', 'italic'],
      subsets: ['latin'],
      fallbacks: ['sans-serif'],
    },
  ],
});
