(function (root, make) {
  const api = make();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.CNState = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';
  const object = v => !!v && typeof v === 'object' && !Array.isArray(v);
  const empty = () => ({version:1, studied:{}, records:{}, stars:{}, drafts:{}});
  const iso = v => typeof v === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(v) && Number.isFinite(Date.parse(v));
  function validateState(value, known) {
    if (!object(value) || value.version !== 1 || !object(value.studied) || !object(value.records) || !object(value.stars) || (value.drafts !== undefined && !object(value.drafts))) throw Error('记录格式不匹配');
    for (const [chapter, learned] of Object.entries(value.studied)) if (!/^[1-7]$/.test(chapter) || typeof learned !== 'boolean') throw Error('已学章节字段无效');
    for (const [id, starred] of Object.entries(value.stars)) if (!known.has(id) || typeof starred !== 'boolean') throw Error('收藏字段无效');
    for (const [id, draft] of Object.entries(value.drafts || {})) if (!known.has(id) || typeof draft !== 'string' || draft.length > 1_000_000) throw Error('草稿字段无效');
    for (const [id, entries] of Object.entries(value.records)) {
      if (!known.has(id) || !Array.isArray(entries) || entries.length > 10_000) throw Error(`题目记录无效：${id}`);
      const q = known.get(id);
      for (const r of entries) {
        if (!object(r) || !/^[a-f0-9]{64}$/.test(r.hash) || !/^(?:[A-D]|self-right|self-wrong)$/.test(r.answer) || typeof r.correct !== 'boolean' || !iso(r.at)) throw Error(`作答字段无效：${id}`);
        if (r.hash === q.hash && q.grading === 'auto' && /^[A-D]$/.test(r.answer) && r.correct !== (r.answer === q.answer)) throw Error(`判分字段不一致：${id}`);
        if (r.answer === 'self-right' && !r.correct || r.answer === 'self-wrong' && r.correct) throw Error(`自评字段不一致：${id}`);
        if (r.reviewVersion !== undefined && !/^recheck-\d{8}$/.test(r.reviewVersion)) throw Error(`审核版本无效：${id}`);
      }
    }
    return {...value, drafts:value.drafts || {}};
  }
  function validateExport(payload, known) {
    if (!object(payload) || payload.format !== 'cn-exercises-v1') throw Error('导出文件格式不匹配');
    return validateState(payload.state, known);
  }
  function merge(current, incoming) {
    const result = structuredClone(current);
    for (const [id, entries] of Object.entries(incoming.records)) {
      const all = result.records[id] || [];
      const keys = new Set(all.map(r => `${r.hash}|${r.answer}|${r.at}|${r.reviewVersion || ''}`));
      for (const r of entries) {
        const key = `${r.hash}|${r.answer}|${r.at}|${r.reviewVersion || ''}`;
        if (!keys.has(key)) { all.push(r); keys.add(key); }
      }
      all.sort((a,b) => a.at.localeCompare(b.at));
      result.records[id] = all;
    }
    for (const [chapter, learned] of Object.entries(incoming.studied)) result.studied[chapter] = !!result.studied[chapter] || learned;
    for (const [id, starred] of Object.entries(incoming.stars)) if (starred) result.stars[id] = true;
    for (const [id, draft] of Object.entries(incoming.drafts)) if (draft && !result.drafts[id]) result.drafts[id] = draft;
    return result;
  }
  function currentRecord(q, review, entries = []) {
    if (review?.status === 'disputed') return null;
    const mode = review?.scoring || q.grading;
    return entries.findLast(r => r.hash === q.hash &&
      (mode === 'self' ? /^self-(right|wrong)$/.test(r.answer) : /^[A-D]$/.test(r.answer)) &&
      (review?.status !== 'corrected' || r.reviewVersion === review.recheckId)) || null;
  }
  return {empty, validateState, validateExport, merge, currentRecord};
});
