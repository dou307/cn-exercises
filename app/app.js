(() => {
  'use strict';
  const KEY = new URL(location.href).searchParams.has('test') ? 'cn-exercises-test-v1' : 'cn-exercises-20261023-v1';
  const CHAPTERS = ['概述', '物理层', '数据链路层', '网络层', '传输层', '应用层', '网络安全'];
  const $ = s => document.querySelector(s);
  const strip = html => { const e = document.createElement('div'); e.innerHTML = html; return e.textContent || ''; };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let questions = [], notes = [], byId = new Map(), byReview = new Map(), byMapping = new Map(), chapter = 1, visible = [], current = null;
  let state = CNState.empty(), persistBlocked = false;
  let picked = null, revealed = false, redoId = null;

  function load() {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (v) state = CNState.validateState(v, byId);
    } catch (_) { persistBlocked = true; $('#storage-warning').hidden = false; $('#storage-warning').textContent = '本机记录损坏或格式不兼容：已保留原数据。本次练习暂不写入浏览器；可导入有效备份恢复。'; }
  }
  function save() {
    if (persistBlocked) return false;
    try { localStorage.setItem(KEY, JSON.stringify(state)); return true; }
    catch (_) { $('#storage-warning').hidden = false; $('#storage-warning').textContent = '浏览器存储失败：本次练习仅保存在内存，请立即导出记录。'; return false; }
  }
  function last(q) {
    const entries = state.records[q.id] || [];
    return entries.length ? entries[entries.length - 1] : null;
  }
  function review(q) { const r = byReview.get(q.id); return r?.sourceContentHash === q.hash ? r : null; }
  function scoring(q) { return review(q)?.scoring || q.grading; }
  function status(q) {
    if (review(q)?.status === 'disputed') return '待核对';
    const r = last(q);
    if (!r || r.hash !== q.hash) return '未作答';
    return (r.answer === 'self-right' || r.answer === q.answer) ? '正确' : '错题';
  }
  function renderMath(node) {
    if (window.renderMathInElement) window.renderMathInElement(node, {delimiters:[{left:'$$',right:'$$',display:true},{left:'\\(',right:'\\)',display:false}],throwOnError:false});
  }
  function chapterCounts(n) { return questions.filter(q => q.noteChapter === n).length; }
  function renderChapters() {
    $('#chapters').innerHTML = CHAPTERS.map((name,i) => `<button class="chapter ${chapter === i+1 ? 'active' : ''}" data-ch="${i+1}" type="button">${i+1}. ${name}<small>${chapterCounts(i+1)} 题 ${state.studied[i+1] ? '· 已学' : ''}</small></button>`).join('');
    $('#chapters').querySelectorAll('button').forEach(b => b.onclick = () => { chapter = +b.dataset.ch; current = null; picked = null; revealed = false; redoId = null; render(); });
  }
  function matches(q) {
    if (q.noteChapter !== chapter) return false;
    const kind = $('#filter-type').value, st = $('#filter-status').value, section = $('#filter-section').value, audit = $('#filter-review').value, term = $('#search').value.trim().toLowerCase();
    if (audit !== 'all' && review(q)?.status !== audit) return false;
    if (kind !== 'all' && scoring(q) !== kind) return false;
    if (section !== 'all' && q.sourceSection !== section) return false;
    if (st === 'wrong' && status(q) !== '错题') return false;
    if (st === 'unanswered' && status(q) !== '未作答') return false;
    if (st === 'starred' && !state.stars[q.id]) return false;
    if (st === 'disputed' && status(q) !== '待核对') return false;
    if (term && !(`${q.id} ${q.sourceLabel} ${q.sourceHeading} ${strip(q.stemHtml)} ${q.optionsHtml.map(strip).join(' ')}`).toLowerCase().includes(term)) return false;
    return true;
  }
  function renderList() {
    visible = questions.filter(matches);
    if (current && !visible.some(q => q.id === current)) current = visible[0]?.id || null;
    if (!current) current = visible[0]?.id || null;
    $('#list-count').textContent = `${visible.length} 题`;
    $('#question-list').innerHTML = visible.length ? visible.map(q => {
      const st = status(q), cls = st === '正确' ? 'correct' : st === '错题' ? 'wrong' : '';
      const excerpt = strip(q.stemHtml).replace(/\s+/g,' ').slice(0,65);
      return `<button type="button" class="q-row ${current === q.id ? 'active' : ''}" data-id="${q.id}" role="listitem"><span class="row-top"><span>${esc(q.sourceLabel)} ${state.stars[q.id] ? '★' : ''}</span><span class="row-status ${cls}">${st}</span></span><span class="excerpt">${esc(excerpt)}</span></button>`;
    }).join('') : '<div class="empty">当前筛选没有题目。</div>';
    $('#question-list').querySelectorAll('button[data-id]').forEach(b => b.onclick = () => selectQuestion(b.dataset.id));
    const url = new URL(location.href);
    if (current) url.searchParams.set('q', current);
    else url.searchParams.delete('q');
    history.replaceState(null, '', url);
  }
  function selectQuestion(id) { if (!byId.has(id)) return; current = id; picked = null; revealed = false; redoId = null; renderList(); renderQuestion(); }
  function record(q, answer, correct) {
    if (review(q)?.status === 'disputed') return;
    const next = visible[visible.findIndex(item => item.id === q.id)+1]?.id;
    (state.records[q.id] ||= []).push({hash:q.hash, answer, correct, at:new Date().toISOString()});
    redoId = null;
    save();
    if (!matches(q) && next && byId.has(next)) current = next;
    renderList();
    renderQuestion();
    updateProgress();
  }
  function renderQuestion() {
    const card = $('#question-card'), q = byId.get(current);
    if (!q) { card.innerHTML = '<div class="empty">当前没有可显示的题目。</div>'; return; }
    const rv = review(q), mp = byMapping.get(q.id), mode = scoring(q), disputed = rv?.status === 'disputed';
    const r = last(q), valid = r && r.hash === q.hash;
    const answered = !!valid && redoId !== q.id && !disputed;
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
    const reviewLabel = rv ? ({verified:'已逐题审核', qualified:'附前提', disputed:'答案待核对'}[rv.status]) : '未独立审核';
    const topicLabel = mp?.primaryTopic ? `笔记：${mp.primaryTopic}` : mp?.topicCandidates?.length ? `候选考点：${mp.topicCandidates.join('、')}` : '笔记中未找到明确小节';
    card.innerHTML = `<div class="question-meta"><span class="pill">${esc(q.sourceLabel)}</span><span class="pill muted">${disputed ? '争议 · 不计分' : mode === 'auto' ? '单选 · 来源答案判分' : '综合／特殊 · 自评'}</span><span class="pill muted">${reviewLabel}</span></div>
      <h2>${esc(q.sourceHeading || '章末习题')}</h2><div class="source-note">题目 ID：${q.id} · 来源第 ${q.sourceChapter} 章 / ${esc(q.sourceSection)} · ${esc(topicLabel)}</div>
      <div class="stem">${q.stemHtml}</div>${options}
      ${mode === 'self' && !disputed ? `<label class="draft-label">我的思路或答案草稿<textarea id="draft" rows="5" placeholder="先写下解题过程，再查看参考解答">${esc(state.drafts[q.id] || '')}</textarea></label>` : ''}
      <div class="card-actions">${mode === 'auto' && !shown ? '<button id="submit" class="primary" type="button" disabled>提交答案</button>' : ''}${mode === 'self' && !shown ? `<button id="reveal" class="primary" type="button">${disputed ? '查看来源答案与争议' : '查看参考解答'}</button>` : ''}<button id="star" type="button">${state.stars[q.id] ? '★ 已收藏' : '☆ 收藏'}</button>${answered ? '<button id="redo" type="button">重做此题</button>' : ''}</div>
      ${answered && !revealed ? `<div class="feedback">上次作答：${status(q) === '正确' ? '正确' : '需复习'} · ${new Date(r.at).toLocaleString('zh-CN')}</div>` : ''}
      ${shown ? `<div class="answer-panel"><h3>原来源答案与解析</h3>${q.answerHtml || '<p>来源没有可提取的答案，请自行核对原页面。</p>'}${rv ? `<div class="review-note"><strong>本项目审核：${reviewLabel}</strong><p>${esc(rv.conclusion)}</p>${rv.references?.length ? `<div class="review-references">核查依据：${rv.references.map(ref => `<a href="${esc(ref.url)}" target="_blank" rel="noopener noreferrer">${esc(ref.title)} ↗</a>`).join('')}</div>` : ''}</div>` : '<p class="unreviewed">本题尚未在本项目逐题审核；判分只按来源给出的答案。</p>'}${mode === 'self' && !disputed && !answered ? '<div class="self-actions"><button id="self-right" type="button">我做对了</button><button id="self-wrong" type="button">需要复习</button></div>' : ''}${mode === 'self' && answered ? '<button id="self-change" type="button">更正本轮自评</button>' : ''}</div>` : ''}
      <div class="card-nav"><button id="prev" type="button" ${idx <= 0 ? 'disabled' : ''}>← 上一题</button><label>跳到题号 <input id="jump" type="number" min="1" max="${visible.length}" value="${idx+1}"></label><button id="next" type="button" ${idx >= visible.length-1 ? 'disabled' : ''}>下一题 →</button></div><div id="jump-error" class="jump-error" role="status"></div>`;
    card.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => { picked = b.dataset.pick; card.querySelectorAll('[data-pick]').forEach(x => x.classList.toggle('selected', x === b)); $('#submit').disabled = false; });
    if ($('#submit')) $('#submit').onclick = () => { if (picked) record(q, picked, picked === q.answer); };
    if ($('#reveal')) $('#reveal').onclick = () => { revealed = true; renderQuestion(); };
    if ($('#self-right')) $('#self-right').onclick = () => record(q, 'self-right', true);
    if ($('#self-wrong')) $('#self-wrong').onclick = () => record(q, 'self-wrong', false);
    if ($('#self-change')) $('#self-change').onclick = () => { r.answer = r.answer === 'self-right' ? 'self-wrong' : 'self-right'; r.correct = r.answer === 'self-right'; save(); renderList(); renderQuestion(); };
    if ($('#draft')) $('#draft').oninput = e => { state.drafts[q.id] = e.target.value; save(); };
    $('#star').onclick = () => { state.stars[q.id] = !state.stars[q.id]; save(); renderList(); renderQuestion(); };
    if ($('#redo')) $('#redo').onclick = () => { revealed = false; picked = null; redoId = q.id; renderQuestion(); };
    $('#prev').onclick = () => selectIndex(idx-1);
    $('#next').onclick = () => selectIndex(idx+1);
    $('#jump').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); const n = +e.target.value; if (Number.isInteger(n) && n >= 1 && n <= visible.length) selectIndex(n-1); else $('#jump-error').textContent = `请输入 1～${visible.length} 的题号`; } };
    renderMath(card);
  }
  function selectIndex(i) { if (!visible[i]) return; current = visible[i].id; picked = null; revealed = false; redoId = null; renderList(); renderQuestion(); document.querySelector('.practice-layout').scrollIntoView({behavior:'smooth',block:'start'}); }
  function renderSections() {
    const sections = [...new Set(questions.filter(q => q.noteChapter === chapter).map(q => q.sourceSection))].sort((a,b) => a.localeCompare(b, 'zh-CN', {numeric:true}));
    const select = $('#filter-section'), old = select.value;
    select.innerHTML = '<option value="all">全部小节</option>' + sections.map(s => `<option value="${esc(s)}">来源 ${esc(s)}</option>`).join('');
    select.value = sections.includes(old) ? old : 'all';
  }
  function updateProgress() {
    const inChapter = questions.filter(q => q.noteChapter === chapter);
    const done = inChapter.filter(q => ['正确','错题'].includes(status(q))).length;
    $('#stat-total').textContent = questions.length;
    const disputed = inChapter.filter(q => review(q)?.status === 'disputed').length;
    $('#stat-progress').textContent = `本章已作答 ${done}/${inChapter.length-disputed}${disputed ? ` · ${disputed} 题待核对` : ''}`;
  }
  function render() {
    renderChapters();
    renderSections();
    $('#page-title').textContent = `第 ${chapter} 章 · ${CHAPTERS[chapter-1]}`;
    $('#page-description').textContent = chapter === 7 ? '笔记中有网络安全章节；当前王道来源没有独立的第 7 章习题。' : '按实际笔记章节练习。来源题目保留原题号；学习进度由你自行标记。';
    $('#btn-study').textContent = state.studied[chapter] ? '✓ 已标为已学' : '标为已学';
    const note = notes.find(n => n.chapter === chapter);
    const link = $('#note-link');
    if (note) { link.hidden = false; link.href = `obsidian://open?path=${encodeURIComponent(note.path)}`; link.title = note.path; }
    else link.hidden = true;
    const inChapter = questions.filter(q => q.noteChapter === chapter);
    const counts = inChapter.reduce((acc,q) => { const s=review(q)?.status; if(s) acc[s]=(acc[s]||0)+1; return acc; },{});
    $('#scope-info').textContent = note ? `笔记：${note.name} · ${inChapter.length ? `本章审核 ${inChapter.length} 题：${counts.verified||0} 题结论成立 / ${counts.qualified||0} 题附前提 / ${counts.disputed||0} 题待核对` : '本章暂无来源习题'}` : '未找到对应笔记';
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
      let reviews, mappings;
      [questions, notes, reviews, mappings] = await Promise.all(['../data/questions.json','../data/notes.json','../data/reviews/all.json','../data/mappings.json'].map(p => fetch(p).then(r => { if (!r.ok) throw Error(p); return r.json(); })));
      byId = new Map(questions.map(q => [q.id,q]));
      byReview = new Map(reviews.map(r => [r.questionId,r]));
      byMapping = new Map(mappings.map(m => [m.questionId,m]));
    } catch (_) { $('#question-card').innerHTML = '<div class="empty">数据加载失败。请用项目启动脚本运行本地 HTTP 服务，不要直接双击 HTML。</div>'; return; }
    load();
    const route = new URL(location.href).searchParams.get('q');
    if (byId.has(route)) { current = route; chapter = byId.get(route).noteChapter; }
    ['#filter-status','#filter-type','#filter-section','#filter-review','#search'].forEach(s => $(s).addEventListener(s === '#search' ? 'input' : 'change', () => { current = null; picked = null; revealed = false; redoId = null; renderList(); renderQuestion(); }));
    $('#btn-study').onclick = () => { state.studied[chapter] = !state.studied[chapter]; save(); render(); };
    $('#btn-export').onclick = exportData;
    $('#file-import').onchange = e => importData(e.target.files[0]);
    render();
  }
  init();
})();
