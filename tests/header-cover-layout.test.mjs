import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const coverFiles = [
  'src/components/blog/CoverSinglePost.astro',
  'src/layouts/MarkdownLayout.astro',
  'src/pages/[...blog]/[...page].astro',
];

test('full-screen cover images fill the hero without side gaps', () => {
  for (const file of coverFiles) {
    const source = readFileSync(file, 'utf8');
    const imageClass = source.match(/<Image\b[^>]*class="([^"]*)"/)?.[1];

    assert.ok(imageClass, `${file} should render a cover image`);

    const classes = new Set(imageClass.split(/\s+/));
    for (const requiredClass of ['absolute', 'inset-0', 'h-full', 'w-full', 'object-cover']) {
      assert.ok(classes.has(requiredClass), `${file} cover image should include ${requiredClass}`);
    }

    assert.match(
      source,
      /<Image\b[^>]*layout="fullWidth"/,
      `${file} cover image should request full-width optimization`
    );
    assert.match(source, /<Image\b[^>]*style="height: 100%;"/, `${file} cover image should fill the hero height`);
    assert.ok(!classes.has('h-screen'), `${file} cover image should not pin its own viewport height`);
    assert.ok(!classes.has('w-auto'), `${file} cover image should not size itself from intrinsic width`);
  }
});
