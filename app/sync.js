(function(root, make) {
  const api = make();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.CNSync = api;
})(typeof window !== 'undefined' ? window : globalThis, function() {
  'use strict';
  const encode = data => {
    const bytes = new TextEncoder().encode(JSON.stringify(data));
    let s = ''; for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s);
  };
  const decode = data => JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(data.replace(/\s/g,'')), c => c.charCodeAt(0))));
  function create({fetcher=fetch, token, repository, read, apply, validate, merge, status=()=>{}, file='cn-progress-v1.json'}) {
    let running=null;
    async function request(path, method='GET', body) {
      if (!token()) throw Error('此设备已断开连接');
      const r = await fetcher('https://api.github.com'+path, {
        method, cache:'no-store', signal:AbortSignal.timeout(20000),
        headers:{Accept:'application/vnd.github+json', Authorization:'Bearer '+token(), 'X-GitHub-Api-Version':'2022-11-28', ...(body?{'Content-Type':'application/json'}:{})},
        ...(body?{body:JSON.stringify(body)}:{})
      });
      if (r.status===404 && method==='GET' && path.includes('/contents/')) return null;
      if (r.status===409 || r.status===422) { const e=new Error('远端更新冲突'); e.conflict=true; throw e; }
      if (!r.ok) throw Error(({401:'连接凭据无效或过期',403:'GitHub权限不足或请求受限',404:'私有仓库不存在或无权访问'})[r.status] || `请求失败（${r.status}）`);
      return r.json();
    }
    async function perform() {
      if (!token()) throw Error('请先连接此设备');
      const repo=repository();
      if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw Error('仓库格式应为账号/仓库名');
      const base='/repos/'+repo;
      const info=await request(base);
      if (!info.private || info.archived) throw Error('同步目标必须是未归档的私有仓库');
      if (!/^[\w.-]+\.json$/.test(file)) throw Error('进度文件名无效');
      const path=base+'/contents/'+file;
      for (let i=0;i<4;i++) {
        const remote=await request(path);
        let remoteState=null;
        if (remote) {
          if (remote.encoding!=='base64' || typeof remote.content!=='string') throw Error('远端文件过大或格式不支持');
          const payload=decode(remote.content);
          if (payload.format!=='cn-exercises-v1') throw Error('远端不是CN记录，已停止同步');
          remoteState=validate(payload.state);
          await apply(merge(read(),remoteState));
        }
        const snapshot=structuredClone(read());
        if (remoteState && JSON.stringify(snapshot)===JSON.stringify(remoteState)) return;
        const content=encode({format:'cn-exercises-v1',state:snapshot});
        if (content.length>1200000) throw Error('记录超过当前同步容量，本机记录已保留');
        try {
          await request(path,'PUT',{message:'同步CN个人练习进度',content,...(remote?{sha:remote.sha}:{})});
          // Local work may continue while the upload is in flight.
          if (JSON.stringify(read())!==JSON.stringify(snapshot)) continue;
          return;
        } catch(e) { if (!e.conflict || i===3) throw e; }
      }
      throw Error('同步期间持续有更新，稍后将重试');
    }
    function sync() {
      if (running) return running;
      status('正在同步…');
      running=perform().then(()=>status('已同步 · '+new Date().toLocaleTimeString('zh-CN')))
        .catch(e=>{status('同步未完成：'+e.message+'；本机记录保留'); throw e;}).finally(()=>{running=null;});
      return running;
    }
    return {sync};
  }
  return {create,encode,decode};
});
