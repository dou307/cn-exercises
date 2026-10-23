(() => {
  'use strict';
  const KEY = 'cn-exercises-20261023-v1';
  const CHAPTERS = ['概述', '物理层', '数据链路层', '网络层', '传输层', '应用层', '网络安全'];
  const $ = s => document.querySelector(s);
  const strip = html => { const e = document.createElement('div'); e.innerHTML = html; return e.textContent || ''; };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  let questions = [], notes = [], byId = new Map(), chapter = 1, visible = [], current = null;
  let state = {version:1, studied:{}, records:{}, stars:{}};
  let picked = null, revealed = false, redoId = null;

  function load() {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (v && v.version === 1 && v.records && v.studied && v.stars) state = v;
    } catch (_) {}
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); return true; }
    catch (_) { alert('浏览器存储失败，请导出记录备份。'); return false; }
  }
  function last(q) {
    const entries = state.records[q.id] || [];
    return entries.length ? entries[entries.length - 1] : null;
  }
  function status(q) {
    const r = last(q);
    if (!r || r.hash !== q.hash) return '未作答';
    return r.correct ? '正确' : '错题';
  }
  function renderMath(node) {
    if (window.renderMathInElement) window.renderMathInElement(node, {delimiters:[{left:'$$',right:'$$',display:true},{left:'\\(',right:'\\)',display:false}],throwOnError:false});
  }
  function chapterCounts(n) { return questions.filter(q => q.noteChapter === n).length; }
  function renderChapters() {
    $('#chapters').innerHTML = CHAPTERS.map((name,i) => `<button class="chapter ${chapter === i+1 ? 'active' : ''}" data-ch="${i+1}" type="button">${i+1}. ${name}<small>${chapterCounts(i+1)} 题 ${state.studied[i+1] ? '· 已学' : ''}</small></button>`).join('');
    $('#chapters').querySelectorAll('button').forEach(b => b.onclick = () => { chapter = +b.dataset.ch; current = null; picked = null; revealed = false; render(); });
  }
  function matches(q) {
    if (q.noteChapter !== chapter) return false;
    const kind = $('#filter-type').value, st = $('#filter-status').value, term = $('#search').value.trim().toLowerCase();
    if (kind !== 'all' && q.grading !== kind) return false;
    if (st === 'wrong' && status(q) !== '错题') return false;
    if (st === 'unanswered' && status(q) !== '未作答') return false;
    if (st === 'starred' && !state.stars[q.id]) return false;
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
    $('#question-list').querySelectorAll('button[data-id]').forEach(b => b.onclick = () => { current = b.dataset.id; picked = null; revealed = false; renderList(); renderQuestion(); });
  }
  function record(q, answer, correct) {
    (state.records[q.id] ||= []).push({hash:q.hash, answer, correct, at:new Date().toISOString()});
    redoId = null;
    save();
    renderList();
    renderQuestion();
    updateProgress();
  }
  function renderQuestion() {
    const card = $('#question-card'), q = byId.get(current);
    if (!q) { card.innerHTML = '<div class="empty">当前没有可显示的题目。</div>'; return; }
    const r = last(q), valid = r && r.hash === q.hash;
    const answered = !!valid && redoId !== q.id;
    const shown = revealed || answered;
    let options = '';
    if (q.grading === 'auto') {
      options = `<div class="options">${q.optionsHtml.map((o,i) => {
        const letter = String.fromCharCode(65+i);
        const cls = shown ? (letter === q.answer ? 'correct' : r?.answer === letter ? 'wrong' : '') : picked === letter ? 'selected' : '';
        return `<button class="option ${cls}" data-pick="${letter}" type="button" ${shown ? 'disabled' : ''}>${o}</button>`;
      }).join('')}</div>`;
    } else if (q.optionsHtml.length) options = `<div class="options">${q.optionsHtml.map(o => `<div class="option">${o}</div>`).join('')}</div>`;
    const idx = visible.findIndex(x => x.id === q.id);
    card.innerHTML = `<div class="question-meta"><span class="pill">${esc(q.sourceLabel)}</span><span class="pill muted">${q.grading === 'auto' ? '单选 · 自动判分' : '综合／特殊 · 自评'}</span><span class="pill muted">来源第 ${q.sourceChapter} 章</span></div>
      <h2>${esc(q.sourceHeading || '章末习题')}</h2><div class="source-note">题目 ID：${q.id} · ${esc(q.sourcePath)} · 原答案尚未独立复核</div>
      <div class="stem">${q.stemHtml}</div>${options}
      <div class="card-actions">${q.grading === 'auto' && !shown ? '<button id="submit" class="primary" type="button" disabled>提交答案</button>' : ''}${q.grading === 'self' && !shown ? '<button id="reveal" class="primary" type="button">查看参考解答</button>' : ''}<button id="star" type="button">${state.stars[q.id] ? '★ 已收藏' : '☆ 收藏'}</button>${answered ? '<button id="redo" type="button">重做此题</button>' : ''}</div>
      ${answered && !revealed ? `<div class="feedback">上次作答：${r.correct ? '正确' : '需复习'} · ${new Date(r.at).toLocaleString('zh-CN')}</div>` : ''}
      ${shown ? `<div class="answer-panel"><h3>原来源答案与解析</h3>${q.answerHtml || '<p>来源没有可提取的答案，请自行核对原页面。</p>'}${q.grading === 'self' && !answered ? '<div class="self-actions"><button id="self-right" type="button">我做对了</button><button id="self-wrong" type="button">需要复习</button></div>' : ''}</div>` : ''}
      <div class="card-nav"><button id="prev" type="button" ${idx <= 0 ? 'disabled' : ''}>← 上一题</button><button id="next" type="button" ${idx >= visible.length-1 ? 'disabled' : ''}>下一题 →</button></div>`;
    card.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => { picked = b.dataset.pick; card.querySelectorAll('[data-pick]').forEach(x => x.classList.toggle('selected', x === b)); $('#submit').disabled = false; });
    if ($('#submit')) $('#submit').onclick = () => { if (picked) record(q, picked, picked === q.answer); };
    if ($('#reveal')) $('#reveal').onclick = () => { revealed = true; renderQuestion(); };
    if ($('#self-right')) $('#self-right').onclick = () => record(q, 'self-right', true);
    if ($('#self-wrong')) $('#self-wrong').onclick = () => record(q, 'self-wrong', false);
    $('#star').onclick = () => { state.stars[q.id] = !state.stars[q.id]; save(); renderList(); renderQuestion(); };
    if ($('#redo')) $('#redo').onclick = () => { revealed = false; picked = null; redoId = q.id; renderQuestion(); };
    $('#prev').onclick = () => selectIndex(idx-1);
    $('#next').onclick = () => selectIndex(idx+1);
    renderMath(card);
  }
  function selectIndex(i) { if (!visible[i]) return; current = visible[i].id; picked = null; revealed = false; renderList(); renderQuestion(); document.querySelector('.practice-layout').scrollIntoView({behavior:'smooth',block:'start'}); }
  function updateProgress() {
    const inChapter = questions.filter(q => q.noteChapter === chapter);
    const done = inChapter.filter(q => status(q) !== '未作答').length;
    $('#stat-total').textContent = questions.length;
    $('#stat-progress').textContent = `本章已作答 ${done}/${inChapter.length}`;
  }
  function render() {
    renderChapters();
    $('#page-title').textContent = `第 ${chapter} 章 · ${CHAPTERS[chapter-1]}`;
    $('#page-description').textContent = chapter === 7 ? '笔记中有网络安全章节；当前王道来源没有独立的第 7 章习题。' : '按实际笔记章节练习。来源题目保留原题号；学习进度由你自行标记。';
    $('#btn-study').textContent = state.studied[chapter] ? '✓ 已标为已学' : '标为已学';
    const note = notes.find(n => n.chapter === chapter);
    const link = $('#note-link');
    if (note) { link.hidden = false; link.href = `obsidian://open?path=${encodeURIComponent(note.path)}`; link.title = note.path; }
    else link.hidden = true;
    $('#scope-info').textContent = note ? `笔记：${note.name} · 当前仅建立章节级对应` : '未找到对应笔记';
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
    if (data?.format !== 'cn-exercises-v1' || data.state?.version !== 1 || !data.state.records || !data.state.studied || !data.state.stars) { alert('记录格式不匹配。'); return; }
    const incoming = data.state;
    for (const [id, arr] of Object.entries(incoming.records)) {
      if (!byId.has(id) || !Array.isArray(arr) || arr.some(r => !r || typeof r.hash !== 'string' || typeof r.correct !== 'boolean' || typeof r.at !== 'string')) { alert('记录包含无效题目或字段，未导入。'); return; }
    }
    const merged = structuredClone(state);
    for (const [id, arr] of Object.entries(incoming.records)) {
      const known = new Set((merged.records[id] || []).map(r => JSON.stringify(r)));
      for (const r of arr) if (!known.has(JSON.stringify(r))) (merged.records[id] ||= []).push(r);
      merged.records[id].sort((a,b) => a.at.localeCompare(b.at));
    }
    for (const n of Object.keys(incoming.studied)) if (/^[1-7]$/.test(n)) merged.studied[n] = !!incoming.studied[n] || !!merged.studied[n];
    for (const id of Object.keys(incoming.stars)) if (byId.has(id) && incoming.stars[id]) merged.stars[id] = true;
    state = merged; save(); render(); alert('记录已合并导入。');
  }
  async function init() {
    load();
    try {
      [questions, notes] = await Promise.all(['../data/questions.json','../data/notes.json'].map(p => fetch(p).then(r => { if (!r.ok) throw Error(p); return r.json(); })));
      byId = new Map(questions.map(q => [q.id,q]));
    } catch (_) { $('#question-card').innerHTML = '<div class="empty">数据加载失败。请用项目启动脚本运行本地 HTTP 服务，不要直接双击 HTML。</div>'; return; }
    ['#filter-status','#filter-type','#search'].forEach(s => $(s).addEventListener(s === '#search' ? 'input' : 'change', () => { current = null; picked = null; revealed = false; renderList(); renderQuestion(); }));
    $('#btn-study').onclick = () => { state.studied[chapter] = !state.studied[chapter]; save(); render(); };
    $('#btn-export').onclick = exportData;
    $('#file-import').onchange = e => importData(e.target.files[0]);
    render();
  }
  init();
})();
