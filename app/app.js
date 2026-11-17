(() => {
  'use strict';
  const KEY = new URL(location.href).searchParams.has('test') ? 'cn-exercises-test-v1' : 'cn-exercises-20261023-v1';
  const CHAPTERS = ['概述', '物理层', '数据链路层', '网络层', '传输层', '应用层', '网络安全'];
  const $ = s => document.querySelector(s);
  const strip = html => { const e = document.createElement('div'); e.innerHTML = html; return e.textContent || ''; };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let questions = [], notes = [], byId = new Map(), byReview = new Map(), byMapping = new Map(), chapter = 1, visible = [], current = null;
  let state = CNState.empty(), persistBlocked = false;
  let savedState = CNState.empty(), syncClient = null, syncTimer = null, credential = '';
  const SYNC_CONFIG = KEY+'-sync-config', SYNC_TOKEN = KEY+'-sync-token';
  let syncConfig = {repository:'dou307/cn-exercises-progress', remember:false};
  let picked = null, revealed = false, redoId = null;
  let view = 'chapter';
  let submittedId = null;
  const listExpansion = new Map();
  function resetAttempt() { picked=null; revealed=false; redoId=null; submittedId=null; }

  function load() {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (v) state = CNState.validateState(v, byId);
      savedState = structuredClone(state);
    } catch (_) { persistBlocked = true; $('#storage-warning').hidden = false; $('#storage-warning').textContent = '本机记录损坏或格式不兼容：已保留原数据。本次练习暂不写入浏览器；可导入有效备份恢复。'; }
  }
  function save(localChange = true) {
    if (persistBlocked) return false;
    try {
      if (localChange) CNState.stampChanges(state,savedState);
      localStorage.setItem(KEY, JSON.stringify(state));
      savedState = structuredClone(state);
      if (localChange) scheduleSync();
      return true;
    }
    catch (_) { $('#storage-warning').hidden = false; $('#storage-warning').textContent = '浏览器存储失败：本次练习仅保存在内存，请立即导出记录。'; return false; }
  }
  function scheduleSync(delay=2500) {
    clearTimeout(syncTimer);
    if (credential && syncClient) syncTimer=setTimeout(()=>syncClient.sync().catch(()=>{}),delay);
  }
  function setupSync() {
    try {
      syncConfig={...syncConfig,...JSON.parse(localStorage.getItem(SYNC_CONFIG)||'{}')};
      credential=(syncConfig.remember?localStorage:sessionStorage).getItem(SYNC_TOKEN)||'';
    } catch (_) { /* Unavailable settings do not block local practice. */ }
    $('#sync-repo').value=syncConfig.repository;
    $('#sync-remember').checked=syncConfig.remember;
    const setStatus=text=>{ $('#sync-status').textContent=text; $('#btn-sync').title=text; };
    syncClient=CNSync.create({
      token:()=>credential, repository:()=>syncConfig.repository, read:()=>state,
      validate:value=>CNState.validateState(value,byId), merge:CNState.merge, status:setStatus,
      apply:async value=>{
        if (persistBlocked) throw Error('本机记录需要先恢复，已停止自动合并');
        state=value;
        if (!save(false)) throw Error('本机存储失败，未上传');
        // Avoid replacing a focused draft or a pending selected option during background pulls.
        renderChapters(); updateProgress(); renderList();
        if (document.activeElement?.id !== 'draft' && !picked && redoId === null) renderQuestion();
      }
    });
    if (credential) setStatus('此设备已连接，等待同步');
    $('#btn-sync').onclick=()=>$('#sync-dialog').showModal();
    $('#sync-close').onclick=()=>$('#sync-dialog').close();
    $('#sync-form').onsubmit=async event=>{
      event.preventDefault();
      const repo=$('#sync-repo').value.trim(), value=$('#sync-token').value.trim();
      if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) { setStatus('仓库格式应为账号/仓库名'); return; }
      if (value) credential=value;
      $('#sync-token').value='';
      if (!credential) { setStatus('请先在此设备填写令牌'); return; }
      syncConfig={repository:repo,remember:$('#sync-remember').checked};
      try {
        localStorage.removeItem(SYNC_TOKEN); sessionStorage.removeItem(SYNC_TOKEN);
        (syncConfig.remember?localStorage:sessionStorage).setItem(SYNC_TOKEN,credential);
        localStorage.setItem(SYNC_CONFIG,JSON.stringify(syncConfig));
      } catch (_) { setStatus('无法记住连接，本次页面内仍可同步'); }
      await syncClient.sync().catch(()=>{});
    };
    $('#sync-disconnect').onclick=()=>{
      credential=''; clearTimeout(syncTimer);
      try { localStorage.removeItem(SYNC_TOKEN); sessionStorage.removeItem(SYNC_TOKEN); } catch (_) {}
      setStatus('已断开；本机与私有仓库的记录均保留');
    };
    window.addEventListener('online',()=>scheduleSync(0));
    window.addEventListener('focus',()=>scheduleSync(0));
    document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible') scheduleSync(0);});
    setInterval(()=>{if(document.visibilityState==='visible') scheduleSync(0);},60000);
    window.addEventListener('storage',event=>{
      if(event.key!==KEY || !event.newValue || persistBlocked) return;
      try {
        state=CNState.merge(state,CNState.validateState(JSON.parse(event.newValue),byId));
        savedState=structuredClone(state);
        renderChapters(); updateProgress(); renderList();
        if(document.activeElement?.id!=='draft' && !picked && redoId===null) renderQuestion();
        scheduleSync();
      } catch (_) {}
    });
    scheduleSync(0);
  }
  function last(q) {
    return CNState.currentRecord(q, review(q), state.records[q.id]);
  }
  function review(q) { const r = byReview.get(q.id); return r?.sourceContentHash === q.hash ? r : null; }
  function scoring(q) { return review(q)?.scoring || q.grading; }
  function status(q) {
    if (review(q)?.status === 'disputed') return '答案有争议';
    const r = last(q);
    if (!r || r.hash !== q.hash) return '未作答';
    return (r.answer === 'self-right' || r.answer === q.answer) ? '正确' : '错题';
  }
  function renderMath(node) {
    if (window.renderMathInElement) window.renderMathInElement(node, {delimiters:[{left:'$$',right:'$$',display:true},{left:'\\(',right:'\\)',display:false}],throwOnError:false});
  }
  function chapterCounts(n) { return questions.filter(q => q.noteChapter === n).length; }
  function renderChapters() {
    const counts = {wrong:questions.filter(q=>status(q)==='错题').length,starred:questions.filter(q=>state.stars[q.id]).length};
    $('#chapters').innerHTML = CHAPTERS.map((name,i) => `<button class="chapter ${view === 'chapter' && chapter === i+1 ? 'active' : ''}" data-ch="${i+1}" type="button" ${view === 'chapter' && chapter === i+1 ? 'aria-current="page"' : ''}>${i+1}. ${name}</button>`).join('')+
      `<button class="chapter collection ${view==='wrong'?'active':''}" data-view="wrong" type="button" ${view==='wrong'?'aria-current="page"':''}>错题库 <span class="nav-count">${counts.wrong}</span></button><button class="chapter collection ${view==='starred'?'active':''}" data-view="starred" type="button" ${view==='starred'?'aria-current="page"':''}>收藏夹 <span class="nav-count">${counts.starred}</span></button>`;
    $('#chapters').querySelectorAll('button').forEach(b => b.onclick = () => {
      view=b.dataset.view || 'chapter'; if(b.dataset.ch) chapter=+b.dataset.ch;
      for(const id of ['filter-status','filter-type','filter-section','filter-review','filter-chapter']) $('#'+id).value='all';
      $('#search').value=''; current=null;resetAttempt();render();
    });
  }
  function inScope(q) {
    return view==='wrong' ? status(q)==='错题' || q.id===submittedId : view==='starred' ? !!state.stars[q.id] : q.noteChapter===chapter;
  }
  function matches(q) {
    if (!inScope(q)) return false;
    const ch=$('#filter-chapter').value;
    if(view!=='chapter' && ch!=='all' && q.noteChapter!==+ch) return false;
    const kind = $('#filter-type').value, st = $('#filter-status').value, section = $('#filter-section').value, audit = $('#filter-review').value, term = $('#search').value.trim().toLowerCase();
    if (audit !== 'all' && review(q)?.status !== audit) return false;
    if (kind !== 'all' && scoring(q) !== kind) return false;
    if (section !== 'all' && q.sourceSection !== section) return false;
    if (st === 'wrong' && status(q) !== '错题') return false;
    if (st === 'unanswered' && status(q) !== '未作答') return false;
    if (st === 'starred' && !state.stars[q.id]) return false;
    if (st === 'disputed' && status(q) !== '答案有争议') return false;
    if (term && !(`${q.id} ${q.sourceLabel} ${q.sourceHeading} ${strip(q.stemHtml)} ${q.optionsHtml.map(strip).join(' ')}`).toLowerCase().includes(term)) return false;
    return true;
  }
  function renderList() {
    visible = questions.filter(matches).sort((a,b)=>a.noteChapter-b.noteChapter || a.sourceSection.localeCompare(b.sourceSection,'zh-CN',{numeric:true}) || a.sourceOrdinal-b.sourceOrdinal);
    if (current && !visible.some(q => q.id === current)) current = visible[0]?.id || null;
    if (!current) current = visible[0]?.id || null;
    $('#list-count').textContent = `${visible.length} 题`;
    const row = q => {
      const st = status(q), cls = st === '正确' ? 'correct' : st === '错题' ? 'wrong' : st === '答案有争议' ? 'disputed' : '';
      const symbol = st === '正确' ? '✓' : st === '错题' ? '✕' : st === '答案有争议' ? '!' : '—';
      const excerpt = strip(q.stemHtml).replace(/\s+/g,' ').slice(0,65);
      return `<button type="button" class="q-row ${current === q.id ? 'active' : ''}" data-id="${q.id}" role="listitem"><span class="row-top"><span>${esc(q.sourceLabel)} ${state.stars[q.id] ? '★' : ''}</span><span class="row-status ${cls}" role="img" aria-label="${esc(st)}" title="${esc(st)}"><span aria-hidden="true">${symbol}</span></span></span><span class="excerpt">${esc(excerpt)}</span></button>`;
    };
    const groups = new Map();
    for (const q of visible) {
      if(!groups.has(q.noteChapter)) groups.set(q.noteChapter,new Map());
      const sections=groups.get(q.noteChapter);
      if(!sections.has(q.sourceSection)) sections.set(q.sourceSection,[]);
      sections.get(q.sourceSection).push(q);
    }
    const open = (key, active) => (listExpansion.get(key) ?? active) ? 'open' : '';
    $('#question-list').innerHTML = visible.length ? [...groups].map(([ch,sections])=>{
      const chapterKey='chapter-'+ch;
      const activeChapter=visible.some(q=>q.id===current && q.noteChapter===ch);
      const count=[...sections.values()].reduce((n,qs)=>n+qs.length,0);
      return `<details class="question-group chapter-group" data-group="${chapterKey}" ${open(chapterKey,activeChapter)}><summary><span>第 ${ch} 章 · ${CHAPTERS[ch-1]}</span><small>${count}</small></summary>${[...sections].sort(([a],[b])=>a.localeCompare(b,'zh-CN',{numeric:true})).map(([section,qs])=>{
        const active=qs.some(q=>q.id===current);
        return `<details class="question-group section-group" data-group="section-${section}" ${open('section-'+section,active)}><summary><span>${esc(sectionTitle(section))}</span><small>${qs.length}</small></summary>${qs.map(row).join('')}</details>`;
      }).join('')}</details>`;
    }).join('') : `<div class="empty">${questions.some(inScope) ? '当前筛选没有题目。' : view==='wrong' ? '暂无错题，继续练习吧。' : view==='starred' ? '暂无收藏，在题目中点击「收藏」即可加入。' : '当前筛选没有题目。'}</div>`;
    $('#question-list').querySelectorAll('details[data-group]').forEach(d=>d.ontoggle=()=>listExpansion.set(d.dataset.group,d.open));
    $('#question-list').querySelectorAll('button[data-id]').forEach(b => b.onclick = () => selectQuestion(b.dataset.id));
    const url = new URL(location.href);
    if(view==='chapter') url.searchParams.delete('view'); else url.searchParams.set('view',view);
    if (current) url.searchParams.set('q', current);
    else url.searchParams.delete('q');
    history.replaceState(null, '', url);
  }
  function sectionTitle(section) {
    const extras={'7.1':'安全威胁','7.2':'密码学','7.3':'数字签名','7.4':'实体识别','7.5':'密钥分发','7.6':'IPSec 协议族'};
    if(extras[section]) return section+' '+extras[section];
    const q=questions.find(q=>q.sourceSection===section && q.sourceHeading.includes(section) && q.sourceHeading.includes('选择题'));
    return q ? q.sourceHeading.slice(q.sourceHeading.indexOf(section)).split(/[（(]/)[0].trim() : section+' 综合练习';
  }
  function expandCurrent() {
    const q=byId.get(current); if(!q) return;
    listExpansion.set('chapter-'+q.noteChapter,true);listExpansion.set('section-'+q.sourceSection,true);
  }
  function selectQuestion(id) { if (!byId.has(id)) return; current = id; resetAttempt(); expandCurrent(); renderList(); renderQuestion(); }
  function record(q, answer, correct) {
    if (review(q)?.status === 'disputed') return;
    const next = visible[visible.findIndex(item => item.id === q.id)+1]?.id;
    submittedId = q.id;
    (state.records[q.id] ||= []).push({hash:q.hash, answer, correct, at:new Date().toISOString(), ...(review(q)?.recheckId ? {reviewVersion:review(q).recheckId} : {})});
    redoId = null;
    save();
    if (!matches(q) && next && byId.has(next)) { current = next; resetAttempt(); }
    renderList();
    renderQuestion();
    updateProgress();
  }
  function renderQuestion() {
    const card = $('#question-card'), q = byId.get(current);
    if (!q) { card.innerHTML = '<div class="empty">当前没有可显示的题目。</div>'; return; }
    const rv = review(q), mp = byMapping.get(q.id), mode = scoring(q), disputed = rv?.status === 'disputed';
    const r = last(q), valid = r && r.hash === q.hash;
    const answered = !!valid && redoId !== q.id && !disputed && (view==='chapter' || submittedId===q.id);
    const shown = revealed || answered;
    let options = '';
    if (mode === 'auto') {
      options = `<div class="options">${q.optionsHtml.map((o,i) => {
        const letter = String.fromCharCode(65+i);
        const cls = shown ? (letter === q.answer ? 'correct' : r?.answer === letter ? 'wrong' : '') : picked === letter ? 'selected' : '';
        return `<button class="option ${cls}" data-pick="${letter}" type="button" ${shown ? 'disabled' : ''}>${o}</button>`;
      }).join('')}</div>`;
    } else if (q.optionsHtml.length) options = `<div class="options">${q.optionsHtml.map(o => `<div class="option">${o}</div>`).join('')}</div>`;
    const idx = visible.findIndex(x => x.id === q.id);
    const reviewLabel = rv ? ({verified:rv.recheckId ? '复核确认' : '已逐题审核', qualified:'附前提', corrected:'已勘误', disputed:'答案有争议'}[rv.status]) : '未独立审核';
    const referenceLinks = rv?.references?.length ? `<div class="review-references">核查依据：${rv.references.map(ref => `<a href="${esc(ref.url)}" target="_blank" rel="noopener noreferrer">${esc(ref.title)} ↗</a>`).join('')}</div>` : '';
    const reviewPanel = rv ? `<div class="review-note"><strong>本项目审核：${reviewLabel}${rv.recheckId ? ` · ${esc(rv.reviewedAt)}` : ''}</strong>${rv.answerLabel ? `<h3>复核答案：${esc(rv.answerLabel)}</h3>` : ''}<p>${esc(rv.conclusion)}</p>${referenceLinks}</div>` : '<p class="unreviewed">本题尚未在本项目逐题审核；判分只按来源给出的答案。</p>';
    const answerTitle = q.sourceChapter === 7 ? '本站原创参考答案与解析' : '原来源答案与解析';
    const topicLabel = mp?.primaryTopic ? `笔记：${mp.primaryTopic}` : mp?.topicCandidates?.length ? `候选考点：${mp.topicCandidates.join('、')}` : '笔记中未找到明确小节';
    card.innerHTML = `<div class="question-meta"><span class="pill">${esc(q.sourceLabel)}</span>${q.sourceChapter === 7 ? '<span class="pill">本站原创补充</span>' : ''}<span class="pill muted">${disputed ? '争议 · 不计分' : rv?.status === 'corrected' ? '勘误参考答案 · 自评' : mode === 'auto' ? '单选 · 参考答案判分' : '综合／特殊 · 自评'}</span>${rv?.status === 'qualified' || rv?.status === 'corrected' ? `<span class="pill muted">${reviewLabel}</span>` : ''}</div>
      <div class="stem">${q.stemHtml}</div>${options}
      ${mode === 'self' && !disputed ? `<label class="draft-label">我的思路或答案草稿<textarea id="draft" rows="5" placeholder="先写下解题过程，再查看参考解答">${esc(state.drafts[q.id] || '')}</textarea></label>` : ''}
      <div class="card-actions">${mode === 'auto' && !shown ? '<button id="submit" class="primary" type="button" disabled>提交答案</button>' : ''}${mode === 'self' && !shown ? `<button id="reveal" class="primary" type="button">${disputed ? '查看来源答案与争议' : '查看参考解答'}</button>` : ''}<button id="star" type="button">${state.stars[q.id] ? '★ 已收藏' : '☆ 收藏'}</button>${answered ? '<button id="redo" type="button">重做此题</button>' : ''}</div>
      ${answered && !revealed ? `<div class="feedback">上次作答：${status(q) === '正确' ? '正确' : '需复习'} · ${new Date(r.at).toLocaleString('zh-CN')}</div>` : ''}
      ${shown ? `<div class="answer-panel">${rv?.recheckId ? reviewPanel : ''}${rv?.recheckId ? '<details class="source-answer"><summary>对照原来源答案与解析（未覆盖原文）</summary>' : `<h3>${answerTitle}</h3>`}${q.answerHtml || '<p>来源没有可提取的答案，请自行核对原页面。</p>'}${rv?.recheckId ? '</details>' : reviewPanel}${mode === 'self' && !disputed && !answered ? '<div class="self-actions"><button id="self-right" type="button">我做对了</button><button id="self-wrong" type="button">需要复习</button></div>' : ''}${mode === 'self' && answered ? '<button id="self-change" type="button">更正本轮自评</button>' : ''}</div>` : ''}
      <details class="question-info"><summary>题目信息</summary><div class="source-note">题目 ID：${q.id} · ${esc(sectionTitle(q.sourceSection))} · ${esc(topicLabel)}</div></details><div class="card-nav"><button id="prev" type="button" ${idx <= 0 ? 'disabled' : ''}>← 上一题</button><label>跳到题号 <input id="jump" type="number" min="1" max="${visible.length}" value="${idx+1}"></label><button id="next" type="button" ${idx >= visible.length-1 ? 'disabled' : ''}>下一题 →</button></div><div id="jump-error" class="jump-error" role="status"></div>`;
    card.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => { picked = b.dataset.pick; card.querySelectorAll('[data-pick]').forEach(x => x.classList.toggle('selected', x === b)); $('#submit').disabled = false; });
    if ($('#submit')) $('#submit').onclick = () => { if (picked) record(q, picked, picked === q.answer); };
    if ($('#reveal')) $('#reveal').onclick = () => { revealed = true; renderQuestion(); };
    if ($('#self-right')) $('#self-right').onclick = () => record(q, 'self-right', true);
    if ($('#self-wrong')) $('#self-wrong').onclick = () => record(q, 'self-wrong', false);
    if ($('#self-change')) $('#self-change').onclick = () => { r.answer = r.answer === 'self-right' ? 'self-wrong' : 'self-right'; r.correct = r.answer === 'self-right'; save(); renderList(); renderQuestion(); updateProgress(); };
    if ($('#draft')) $('#draft').oninput = e => { state.drafts[q.id] = e.target.value; save(); };
    $('#star').onclick = () => { state.stars[q.id] = !state.stars[q.id]; save(); renderList(); renderQuestion(); updateProgress(); };
    if ($('#redo')) $('#redo').onclick = () => { resetAttempt(); redoId = q.id; renderQuestion(); };
    $('#prev').onclick = () => selectIndex(idx-1);
    $('#next').onclick = () => selectIndex(idx+1);
    $('#jump').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); const n = +e.target.value; if (Number.isInteger(n) && n >= 1 && n <= visible.length) selectIndex(n-1); else $('#jump-error').textContent = `请输入 1～${visible.length} 的题号`; } };
    renderMath(card);
  }
  function selectIndex(i) { if (!visible[i]) return; current = visible[i].id; resetAttempt(); expandCurrent(); renderList(); renderQuestion(); document.querySelector('.practice-layout').scrollIntoView({behavior:'smooth',block:'start'}); }
  function renderSections() {
    const sections = [...new Set(questions.filter(inScope).map(q => q.sourceSection))].sort((a,b) => a.localeCompare(b, 'zh-CN', {numeric:true}));
    const select = $('#filter-section'), old = select.value;
    select.innerHTML = '<option value="all">全部小节</option>' + sections.map(s => `<option value="${esc(s)}">来源 ${esc(s)}</option>`).join('');
    select.value = sections.includes(old) ? old : 'all';
  }
  function updateProgress() {
    const inChapter = questions.filter(q=>view==='wrong' ? status(q)==='错题' : inScope(q));
    const done = inChapter.filter(q => ['正确','错题'].includes(status(q))).length;
    const disputed = inChapter.filter(q => review(q)?.status === 'disputed').length;
    $('#stat-progress').textContent = view==='chapter' ? `${inChapter.length} 题 · 已作答 ${done}/${inChapter.length-disputed}${disputed ? ` · ${disputed} 题有争议，不计分` : ''}` : `${inChapter.length} 题 · 汇总所有章节`;
    renderChapters();
  }
  function render() {
    renderChapters();
    renderSections();
    $('#page-title').textContent = view==='wrong' ? '错题库' : view==='starred' ? '收藏夹' : `第 ${chapter} 章 · ${CHAPTERS[chapter-1]}`;
    $('#chapter-filter-label').hidden=view==='chapter';
    $('#filter-status').parentElement.hidden=view==='wrong';
    $('#btn-study').hidden=view!=='chapter';
    $('#btn-study').textContent = state.studied[chapter] ? '✓ 已标为已学' : '标为已学';
    const note = notes.find(n => n.chapter === chapter);
    const link = $('#note-link');
    if (note && view==='chapter') { const path = note.path || `D:\\desk\\Obsidian\\1大三秋冬\\CN\\${note.name}.md`; link.hidden = false; link.href = `obsidian://open?path=${encodeURIComponent(path)}`; link.title = '在此电脑的 Obsidian 中打开'; }
    else link.hidden = true;
    const inChapter = questions.filter(q => q.noteChapter === chapter);
    const counts = inChapter.reduce((acc,q) => { const s=review(q)?.status; if(s) acc[s]=(acc[s]||0)+1; return acc; },{});
    $('#scope-info').textContent = view!=='chapter' ? '错题按最新一次有效作答统计；收藏夹包含所有章节，取消收藏后会移出。' : note ? `笔记：${note.name} · ${counts.verified||0} 题结论成立 / ${counts.qualified||0} 题附前提 / ${counts.corrected||0} 题已勘误 / ${counts.disputed||0} 题答案有争议` : '未找到对应笔记';
    updateProgress(); renderList(); renderQuestion();
  }
  function exportData() {
    const blob = new Blob([JSON.stringify({format:'cn-exercises-v1',exportedAt:new Date().toISOString(),state},null,2)],{type:'application/json'});
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = `cn-exercises-${new Date().toISOString().slice(0,10)}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(url),1000);
  }
  async function importData(file) {
    if (!file) return;
    let data;
    try { data = JSON.parse(await file.text()); } catch (_) { alert('文件不是有效 JSON。'); return; }
    let incoming;
    try { incoming = CNState.validateExport(data, byId); }
    catch (error) { alert(`导入失败：${error.message}。本机记录未修改。`); return; }
    const merged = CNState.merge(state, incoming);
    const previous = state, wasBlocked = persistBlocked;
    state = merged;
    persistBlocked = false;
    if (!save()) { state = previous; persistBlocked = wasBlocked; alert('浏览器存储失败，未完成导入。'); return; }
    $('#storage-warning').hidden = true;
    render(); alert('记录已合并导入。');
  }
  async function init() {
    try {
      let reviews, mappings, supplement;
      [questions, notes, reviews, mappings, supplement] = await Promise.all(['../data/questions.json','../data/notes.json','../data/reviews/all.json','../data/mappings.json','../data/ch7-bundle.json'].map(p => fetch(p).then(r => { if (!r.ok) throw Error(p); return r.json(); })));
      questions.push(...supplement.questions); reviews.push(...supplement.reviews); mappings.push(...supplement.mappings);
      byId = new Map(questions.map(q => [q.id,q]));
      byReview = new Map(reviews.map(r => [r.questionId,r]));
      byMapping = new Map(mappings.map(m => [m.questionId,m]));
    } catch (_) { $('#question-card').innerHTML = '<div class="empty">题库加载失败。请刷新重试；本地预览需通过HTTP服务打开。</div>'; return; }
    load();
    const route = new URL(location.href).searchParams.get('q');
    if (byId.has(route)) { current = route; chapter = byId.get(route).noteChapter; }
    const routeView=new URL(location.href).searchParams.get('view');
    if(['wrong','starred'].includes(routeView)) view=routeView;
    $('#filter-chapter').innerHTML='<option value="all">全部章节</option>'+CHAPTERS.map((name,i)=>`<option value="${i+1}">${i+1}. ${name}</option>`).join('');
    ['#filter-status','#filter-type','#filter-section','#filter-review','#filter-chapter','#search'].forEach(s => $(s).addEventListener(s === '#search' ? 'input' : 'change', () => { current = null; resetAttempt(); renderList(); renderQuestion(); }));
    $('#btn-study').onclick = () => { state.studied[chapter] = !state.studied[chapter]; save(); render(); };
    $('#btn-export').onclick = exportData;
    $('#file-import').onchange = e => importData(e.target.files[0]);
    render();
    setupSync();
  }
  init();
})();
