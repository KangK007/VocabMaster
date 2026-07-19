(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }
  if (root) {
    root.VocabMasterMorphology = api;
  }
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const PREFIXES = [
    ['inter', '之间'], ['trans', '跨越'], ['under', '不足'], ['super', '超过'],
    ['anti', '反对'], ['auto', '自己'], ['fore', '预先'], ['over', '过度'],
    ['pre', '预先'], ['pro', '向前'], ['sub', '下面'], ['com', '共同'],
    ['con', '共同'], ['dis', '否定'], ['mis', '错误'], ['non', '否定'],
    ['re', '再次'], ['un', '否定'], ['in', '进入/否定'], ['im', '进入/否定'],
    ['ir', '否定'], ['il', '否定'], ['en', '使成为'], ['de', '去除'],
    ['bi', '二'], ['co', '共同'], ['ab', '离开']
  ];

  const SUFFIXES = [
    ['ability', '名词'], ['ibility', '名词'], ['ation', '名词'], ['ition', '名词'],
    ['tion', '名词'], ['sion', '名词'], ['ment', '名词'], ['ness', '名词'],
    ['ence', '名词'], ['ance', '名词'], ['ity', '名词'], ['ship', '名词'],
    ['ion', '名词'], ['nce', '名词'], ['ess', '名词/女性'],
    ['itude', '名词'], ['tude', '名词'], ['ure', '名词'], ['age', '名词'],
    ['ism', '主义/行为'], ['ian', '人/相关'], ['ent', '形容词/名词'], ['ant', '形容词/名词'],
    ['able', '可...的'], ['ible', '可...的'], ['ble', '可...的'], ['less', '没有'], ['ful', '充满'],
    ['ive', '形容词'], ['ous', '形容词'], ['ical', '形容词'], ['ic', '形容词'],
    ['ular', '形容词'], ['ary', '相关的'], ['ory', '相关的'], ['ile', '形容词'],
    ['ine', '相关的'], ['ite', '相关的'], ['ide', '相关物'], ['al', '形容词'], ['ly', '副词'],
    ['ing', '进行/名词'], ['ed', '过去/完成'], ['y', '形容词'],
    ['ward', '方向'], ['ard', '人/倾向'], ['est', '最高级'], ['ute', '状态'],
    ['er', '人/物'], ['or', '人/物'], ['ist', '人'], ['ish', '有...性质'],
    ['ize', '使...化'], ['ise', '使...化'], ['ify', '使...化'], ['ate', '动词']
  ];

  const ROOTS = [
    ['spect', '看'], ['struct', '建造'], ['script', '写'], ['scrib', '写'],
    ['tract', '拉'], ['press', '压'], ['port', '携带'], ['form', '形状'],
    ['dict', '说'], ['cred', '相信'], ['graph', '写/画'], ['phon', '声音'],
    ['photo', '光'], ['tele', '远'], ['micro', '微小'], ['macro', '宏大'],
    ['scope', '观察'], ['meter', '测量'], ['therm', '热'], ['chron', '时间'],
    ['bio', '生命'], ['geo', '地球'], ['log', '说/学科'], ['vis', '看'],
    ['vid', '看'], ['mit', '送'], ['miss', '送'], ['ject', '投射'],
    ['cept', '拿取'], ['capt', '拿取'], ['duc', '引导'], ['duct', '引导'],
    ['fer', '带来'], ['vers', '转'], ['vert', '转'], ['mov', '移动'],
    ['mot', '移动'], ['sent', '感觉'], ['sens', '感觉'], ['fact', '做'],
    ['fect', '做'], ['fic', '做'], ['norm', '规则'], ['act', '行动'],
    ['pose', '放置'], ['pos', '放置'], ['tain', '持有'], ['ten', '持有'],
    ['cede', '走/让步'], ['ceed', '走/让步'], ['cess', '走/让步'],
    ['cur', '跑/发生'], ['curs', '跑/发生'], ['grad', '步'], ['gress', '步'],
    ['rupt', '破裂'], ['reg', '规则'], ['rect', '直/正'], ['sequ', '跟随'],
    ['solv', '松开'], ['spir', '呼吸'], ['stat', '站立'], ['stit', '站立'],
    ['temp', '时间'], ['voc', '声音'], ['vok', '声音'], ['volv', '转'],
    ['viv', '生命'], ['vit', '生命'], ['lect', '选择/读'], ['leg', '法律/选择'],
    ['loc', '地方'], ['loqu', '说'], ['luc', '光'], ['lum', '光'],
    ['magn', '大'], ['bene', '好'], ['mal', '坏'], ['medi', '中间'],
    ['mem', '记忆'], ['min', '小'], ['max', '大'], ['mort', '死'],
    ['nat', '出生'], ['nov', '新'], ['numer', '数'], ['pac', '和平'],
    ['pass', '承受'], ['path', '感受'], ['phil', '爱'], ['phys', '自然'],
    ['plac', '放置/使满意'], ['plic', '折叠'], ['pop', '人民'], ['psych', '心理'],
    ['quest', '寻找'], ['quir', '寻找'], ['quis', '寻找'], ['sci', '知道'],
    ['serv', '服务/保持'], ['sign', '标记'], ['simil', '相似'], ['tact', '接触'],
    ['term', '界限'], ['text', '编织/文本'], ['tort', '扭曲'], ['urb', '城市'],
    ['vac', '空'], ['ven', '来'], ['vent', '来'], ['ver', '真实'], ['vol', '意愿'],
    ['aero', '空气'], ['audi', '听'], ['aud', '听'], ['arch', '主要/古老'],
    ['aster', '星'], ['astr', '星'], ['athl', '竞争'], ['atom', '原子'],
    ['card', '心'], ['centr', '中心'], ['circ', '环绕'], ['claim', '呼喊'],
    ['clud', '关闭'], ['clus', '关闭'], ['cord', '心'], ['corp', '身体'],
    ['count', '计算'], ['dem', '人民'], ['demo', '人民'], ['equ', '相等'],
    ['fin', '界限'], ['flam', '火焰'], ['flu', '流动'], ['found', '基础'],
    ['gen', '产生'], ['gram', '写/记录'], ['hand', '手'], ['her', '粘附'],
    ['labor', '劳动'], ['later', '侧面'], ['manu', '手'], ['meter', '测量'],
    ['mind', '心智'], ['part', '部分'], ['plan', '计划'], ['point', '点'],
    ['range', '排列'], ['strain', '拉紧'], ['time', '时间']
  ];

  function normalizeWord(value) {
    return String(value || '').toLowerCase().replace(/[^a-z]/g, '');
  }

  function findPrefix(word) {
    return PREFIXES.find(([text]) => word.startsWith(text) && word.length - text.length >= 4) || null;
  }

  function findSuffix(word, prefixLength) {
    return SUFFIXES.find(([text]) => word.endsWith(text) && word.length - prefixLength - text.length >= 3) || null;
  }

  function findRoot(base) {
    return ROOTS
      .filter(([text]) => base.includes(text))
      .sort((a, b) => b[0].length - a[0].length)[0] || null;
  }

  function analyzeMorphology(value) {
    const word = normalizeWord(value);
    if (word.length < 5) return [];

    const prefix = findPrefix(word);
    const prefixLength = prefix ? prefix[0].length : 0;
    const suffix = findSuffix(word, prefixLength);
    const suffixLength = suffix ? suffix[0].length : 0;
    const base = word.slice(prefixLength, word.length - suffixLength);
    const root = findRoot(base);
    if (!root && !suffix && prefix && prefix[0].length >= 3) {
      return [{ type: 'prefix', text: prefix[0], meaning: prefix[1] }];
    }
    if (!root && !suffix) return [];

    const parts = [];
    if (prefix && (root || suffixLength > 0)) {
      parts.push({ type: 'prefix', text: prefix[0], meaning: prefix[1] });
    }
    if (root) {
      parts.push({ type: 'root', text: root[0], meaning: root[1] });
    }
    if (suffix) {
      parts.push({ type: 'suffix', text: suffix[0], meaning: suffix[1] });
    }
    return parts.slice(0, 3);
  }

  function coverage(words) {
    const list = Array.isArray(words) ? words : [];
    const covered = list.filter(item => analyzeMorphology(item && item.word).length > 0).length;
    return {
      total: list.length,
      covered,
      ratio: list.length ? covered / list.length : 0
    };
  }

  return {
    analyzeMorphology,
    coverage
  };
});
