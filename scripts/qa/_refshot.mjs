import { chromium } from '@playwright/test';
const out='docs/qa/v6/references';
const b=await chromium.launch({args:['--headless=new']});
const targets=[['edm','https://www.edmsaf.com/'],['sik','https://www.studyinkorea.go.kr/ko/main.do'],['figma','https://www.figma.com/design/o5v8a9a6rhYspvgFUtGRo7/%ED%95%9C%EA%B7%A4_%EB%9E%9C%EB%94%A9%ED%8E%98%EC%9D%B4%EC%A7%80?node-id=1058-9903&p=f&t=WDiqULH2S8naAqWC-11']];
for (const [n,u] of targets) for (const [w,h] of [[1440,900],[390,844]]) {
  const p=await b.newPage({viewport:{width:w,height:h}});
  try{ await p.goto(u,{waitUntil:'networkidle',timeout:45000}); }catch(e){console.log(n,'nav',e.message.slice(0,80))}
  await p.waitForTimeout(3000);
  await p.screenshot({path:`${out}/${n}-${w}.png`});
  try{ await p.screenshot({path:`${out}/${n}-${w}-full.png`,fullPage:true}); }catch{}
  console.log(n,w,await p.title());
  await p.close();
}
await b.close();
