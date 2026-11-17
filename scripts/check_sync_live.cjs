/* Explicit live integration check. Credential stays in process memory; test file is isolated. */
const {execFileSync}=require('node:child_process');
const assert=require('node:assert/strict');
const Sync=require('../app/sync.js');
const S=require('../app/state.js');
const qs=[...require('../data/questions.json'),...require('../data/ch7-bundle.json').questions];
const known=new Map(qs.map(q=>[q.id,q]));
const q=qs[0], repo='dou307/cn-exercises-progress', file='integration-check.json';
async function main(){
  const token=execFileSync('gh',['auth','token'],{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
  const path=`https://api.github.com/repos/${repo}/contents/${file}`;
  const headers={Authorization:'Bearer '+token,Accept:'application/vnd.github+json','Content-Type':'application/json'};
  const existing=await fetch(path,{headers});
  if(existing.status!==404) throw Error('isolated test path already exists; refusing to replace it');
  const device=(local)=>Sync.create({token:()=>token,repository:()=>repo,file,read:()=>local,
    apply:async value=>{Object.keys(local).forEach(k=>delete local[k]);Object.assign(local,value);},
    validate:value=>S.validateState(value,known),merge:S.merge});
  const pc=S.empty(),phone=S.empty();
  pc.stars[q.id]=true;S.stampChanges(pc,S.empty());
  phone.drafts[q.id]='跨设备测试（不含个人数据）';S.stampChanges(phone,S.empty());
  const a=device(pc),b=device(phone);
  try {
    await a.sync();await b.sync();await a.sync();
    assert.equal(pc.drafts[q.id],phone.drafts[q.id]);assert.equal(phone.stars[q.id],true);
    const old=structuredClone(phone);phone.stars[q.id]=false;phone.drafts[q.id]='';S.stampChanges(phone,old);
    await b.sync();await a.sync();assert.equal(pc.stars[q.id],false);assert.equal(pc.drafts[q.id],'');
    console.log('LIVE PASS: two independent clients merged through private GitHub, including unstar and empty draft');
  } finally {
    const response=await fetch(path,{headers});
    if(response.ok){
      const record=await response.json();
      const removed=await fetch(path,{method:'DELETE',headers,body:JSON.stringify({message:'清理隔离的同步集成测试文件',sha:record.sha})});
      assert(removed.ok,'test cleanup failed');
      console.log('isolated test file removed; production progress file was never touched');
    }
  }
}
main().catch(()=>{console.error('live sync verification failed (no credentials logged)');process.exitCode=1;});
