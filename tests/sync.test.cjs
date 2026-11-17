const test=require('node:test');
const assert=require('node:assert/strict');
const S=require('../app/state.js');
const Sync=require('../app/sync.js');
const questions=[...require('../data/questions.json'),...require('../data/ch7-bundle.json').questions];
const known=new Map(questions.map(q=>[q.id,q]));
const q=questions[0];
const validate=s=>S.validateState(s,known);
const clone=s=>structuredClone(s);
const attempt=at=>({hash:q.hash,answer:q.answer,correct:true,at});

test('mutable state converges including unstar, unlearn and emptied draft',()=>{
  const a=S.empty(); a.stars[q.id]=true; a.studied[1]=true; a.drafts[q.id]='旧草稿'; S.stampChanges(a,S.empty());
  const b=clone(a); b.stars[q.id]=false;b.studied[1]=false;b.drafts[q.id]=''; S.stampChanges(b,a);
  const ab=S.merge(a,b),ba=S.merge(b,a);
  assert.deepEqual(ab,ba); assert.equal(ab.stars[q.id],false);assert.equal(ab.studied[1],false);assert.equal(ab.drafts[q.id],'');
  assert.deepEqual(S.merge(ab,a),ab);
  validate(ab);
});

test('corrected self rating replaces the same attempt without losing other attempts',()=>{
  const a=S.empty();a.records[q.id]=[{...attempt('2026-11-17T00:00:00.000Z'),answer:'self-right'}];S.stampChanges(a,S.empty());
  const b=clone(a);b.records[q.id][0].answer='self-wrong';b.records[q.id][0].correct=false;S.stampChanges(b,a);
  const c=clone(a);c.records[q.id].push(attempt('2026-11-17T00:01:00.000Z'));S.stampChanges(c,a);
  const result=S.merge(b,c);assert.equal(result.records[q.id].length,2);assert.equal(result.records[q.id][0].answer,'self-wrong');
  assert.deepEqual(result,S.merge(c,b));validate(result);
});

function server(initial=null) {
  let state=initial, sha=0, puts=0, conflict=null;
  return {
    get state(){return state;},get puts(){return puts;}, conflictOnce(fn){conflict=fn;},
    fetch:async(url,options)=>{
      if(!url.includes('/contents/')) return new Response(JSON.stringify({private:true}));
      if(options.method==='GET') return state?new Response(JSON.stringify({encoding:'base64',content:Sync.encode({format:'cn-exercises-v1',state}),sha:String(sha)})):new Response('',{status:404});
      const body=JSON.parse(options.body);
      if(conflict){state=conflict();conflict=null;sha++;return new Response('',{status:409});}
      if((body.sha ?? undefined)!==(state?String(sha):undefined)) return new Response('',{status:409});
      state=Sync.decode(body.content).state;sha++;puts++;return new Response('{}');
    }
  };
}
function device(api,initial,extra={}) {
  let state=clone(initial);
  const c=Sync.create({token:()=> 'test-only-placeholder',repository:()=> 'example/private',fetcher:api.fetch,
    read:()=>state,apply:async s=>{state=validate(s);},validate,merge:S.merge,...extra});
  return {sync:c.sync,get state(){return state;}};
}
test('two devices merge offline answers and pull back unstar/empty draft',async()=>{
  const api=server();const a=S.empty(); a.records[q.id]=[attempt('2026-11-17T01:00:00.000Z')];a.stars[q.id]=true;a.drafts[q.id]='电脑';S.stampChanges(a,S.empty());
  const pc=device(api,a);await pc.sync();
  const b=S.empty();b.records[q.id]=[attempt('2026-11-17T02:00:00.000Z')];S.stampChanges(b,S.empty());
  const phone=device(api,b);await phone.sync();await pc.sync();
  assert.equal(pc.state.records[q.id].length,2);assert.equal(phone.state.records[q.id].length,2);
  const previous=clone(phone.state);phone.state.stars[q.id]=false;phone.state.drafts[q.id]='';S.stampChanges(phone.state,previous);
  await phone.sync();await pc.sync();assert.equal(pc.state.stars[q.id],false);assert.equal(pc.state.drafts[q.id],'');
  assert(!JSON.stringify(api.state).includes('test-only-placeholder'));
});
test('SHA conflict causes a fresh read and merge before retry',async()=>{
  const a=S.empty();a.records[q.id]=[attempt('2026-11-17T03:00:00.000Z')];
  const b=S.empty();b.records[q.id]=[attempt('2026-11-17T04:00:00.000Z')];
  const api=server();api.conflictOnce(()=>b);const pc=device(api,a);await pc.sync();
  assert.equal(api.state.records[q.id].length,2);
});
test('rejects malformed remote and public repository without writing',async()=>{
  const local=S.empty();local.stars[q.id]=true;
  const invalid=server({version:99});const a=device(invalid,local);await assert.rejects(a.sync());assert.deepEqual(a.state,local);assert.equal(invalid.puts,0);
  const publicFetch=async()=>new Response(JSON.stringify({private:false}));const b=device(server(),local,{fetcher:publicFetch});await assert.rejects(b.sync(),/私有/);assert.deepEqual(b.state,local);
});
test('network failure leaves local answers intact; one in-flight operation is reused',async()=>{
  const local=S.empty();local.records[q.id]=[attempt('2026-11-17T05:00:00.000Z')];
  const pc=device(server(),local,{fetcher:async()=>{throw Error('离线');}});
  const p=pc.sync();assert.equal(p,pc.sync());await assert.rejects(p,/离线/);assert.deepEqual(pc.state,local);
});
