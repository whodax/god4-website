// Private service-binding target. Receives only the edge-derived IP, never Scripture or credentials.
function failure(status){
  return Response.json({error:'Cloud speech is temporarily unavailable.'}, {
    status, headers:{'Cache-Control':'no-store'}
  });
}

async function readKey(request){
  const reader = request.body && request.body.getReader();
  if(!reader) throw new Error('Invalid request');
  const chunks = [];
  let length = 0;
  try{
    while(true){
      const {done, value} = await reader.read();
      if(done) break;
      length += value.byteLength;
      if(length > 256){ await reader.cancel(); throw new Error('Invalid request'); }
      chunks.push(value);
    }
  }finally{ reader.releaseLock(); }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for(const chunk of chunks){ bytes.set(chunk, offset); offset += chunk.byteLength; }
  const body = JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(bytes));
  if(!body || typeof body !== 'object' || Array.isArray(body) ||
      Object.keys(body).length !== 1 || typeof body.key !== 'string' ||
      !body.key || body.key.length > 45 || !/^[0-9a-f:.]+$/i.test(body.key) || !/[.:]/.test(body.key)){
    throw new Error('Invalid request');
  }
  return body.key;
}

export default {
  async fetch(request, env){
    if(request.method !== 'POST' || new URL(request.url).pathname !== '/check' ||
        !/^application\/json(?:\s*;|$)/i.test(request.headers.get('Content-Type') || '') ||
        Number(request.headers.get('Content-Length')) > 256) return failure(400);
    let key;
    try{ key = await readKey(request); }
    catch(error){ return failure(400); }
    try{
      const result = await env.TTS_RATE_LIMIT.limit({key});
      if(result && result.success === true) return new Response(null, {
        status:204, headers:{'Cache-Control':'no-store'}
      });
      if(result && result.success === false) return failure(429);
      return failure(503);
    }catch(error){ return failure(503); }
  }
};
