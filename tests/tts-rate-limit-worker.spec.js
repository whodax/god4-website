const {test, expect} = require('@playwright/test');
const fs = require('fs');
const path = require('path');
let worker;
test.beforeAll(async () => {
  const source = fs.readFileSync(path.join(__dirname, '../workers/tts-rate-limit/worker.js'), 'utf8');
  ({default:worker} = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64')));
});
function request(body = {key:'192.0.2.1'}, options = {}){
  return new Request('https://tts-rate-limit.internal' + (options.path || '/check'), {
    method:options.method || 'POST', headers:{'Content-Type':options.type || 'application/json'},
    ...(options.method === 'GET' ? {} : {body:options.raw || JSON.stringify(body)})
  });
}
for(const [success, status] of [[true,204],[false,429]]){
  test(`limit({key}) returns ${status} with no-store and no internal details`, async () => {
    const calls = [];
    const response = await worker.fetch(request(), {TTS_RATE_LIMIT:{async limit(input){
      calls.push(input); return {success};
    }}});
    expect(calls).toEqual([{key:'192.0.2.1'}]);
    expect(response.status).toBe(status);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.text()).toBe(success ? '' : JSON.stringify({error:'Cloud speech is temporarily unavailable.'}));
  });
}
for(const [label, body, options] of [
  ['missing key', {}, {}], ['empty key',{key:''},{}], ['wrong key type',{key:42},{}],
  ['extra field',{key:'192.0.2.1',text:'Verse'},{}], ['array',[],{}], ['null',null,{}],
  ['non-IP key',{key:'Verse'},{}], ['malformed JSON',{}, {raw:'{invalid'}],
  ['oversized streamed body',{}, {raw:' '.repeat(257)}],
  ['wrong method',{}, {method:'GET'}], ['wrong path',{}, {path:'/api'}],
  ['wrong content type',{}, {type:'text/plain'}]
]){
  test(`rejects ${label} before calling the binding`, async () => {
    let calls = 0;
    const response = await worker.fetch(request(body, options), {TTS_RATE_LIMIT:{limit(){calls++;}}});
    expect(response.status).toBe(400);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({error:'Cloud speech is temporarily unavailable.'});
    expect(calls).toBe(0);
  });
}
for(const [label, binding] of [
  ['exception', {limit(){throw new Error('private namespace IP counter details');}}],
  ['missing binding', undefined], ['malformed result', {limit:async () => ({success:'yes'})}]
]){
  test(`${label} is generic uncached 503`, async () => {
    const response = await worker.fetch(request(), {TTS_RATE_LIMIT:binding});
    expect(response.status).toBe(503);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await response.json()).toEqual({error:'Cloud speech is temporarily unavailable.'});
  });
}
