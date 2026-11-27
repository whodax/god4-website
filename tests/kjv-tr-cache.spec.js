'use strict';

const {test,expect}=require('@playwright/test');

test('Word Study keeps both catalog indexes while evicting chapters under the shared limit',async({page})=>{
  await page.goto('/');
  await page.evaluate(()=>navigator.serviceWorker.ready.then(()=>true));
  if(!await page.evaluate(()=>!!navigator.serviceWorker.controller)) await page.reload();
  const state=await page.evaluate(async()=>{
    const web='/data/word-study/alignment/web/',tr='/data/word-study/alignment/kjv-tr/';
    const load=async path=>(await fetch(path)).json();
    await load(tr+'index.json');
    const catalog=await load(web+'index.json');
    const urls=Object.entries(catalog).flatMap(([book,chapters])=>chapters.map(chapter=>web+book+'/'+chapter+'.json')).slice(0,50);
    for(const url of urls) await load(url);
    const cache=await caches.open('god4-word-study-data-v1');
    const paths=(await cache.keys()).map(request=>new URL(request.url).pathname);
    return {count:paths.length,web:paths.includes(web+'index.json'),tr:paths.includes(tr+'index.json'),evicted:!paths.includes(urls[0])};
  });
  expect(state).toEqual({count:48,web:true,tr:true,evicted:true});
});

test.use({serviceWorkers:'allow'});
