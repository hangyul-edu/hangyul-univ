import { chromium } from '@playwright/test';
const b = await chromium.launch();
for (const w of [390, 1440]) {
  const p = await (await b.newContext({ viewport:{width:w,height:900} })).newPage();
  await p.goto('http://localhost:3100/universities/yonsei-university?lang=ko',{waitUntil:'networkidle'});
  await p.waitForTimeout(1200);
  console.log(await p.evaluate((w) => {
    const h=document.querySelector('.kn-header').getBoundingClientRect();
    // V20: `.mk-uni__head` → `.hg-uni-hero`, and the photographic variant is `--photo`.
    const head=document.querySelector('.hg-uni-hero');
    const visual = head?.classList.contains('hg-uni-hero--photo');
    const hr=head?.getBoundingClientRect();
    const t=document.querySelector('#main h1')?.getBoundingClientRect();
    return `${w}px  visualHead=${visual}  headTop=${Math.round(hr?.top ?? NaN)}  h1Top=${Math.round(t?.top ?? NaN)}  gapAfterPill=${Math.round((t?.top ?? 0) - h.bottom)}  overflowX=${document.documentElement.scrollWidth>w+1}`;
  }, w));
  await p.close();
}
await b.close();
