// أدوات عامة
const $ = (sel, root=document) => root.querySelector(sel);
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));

// مفاتيح التخزين
const K_PROGRESS = 'esl_progress_v1';
const K_DISCUSS = 'esl_thread_v1';

// نموذج التقدّم الافتراضي
const defaultProgress = () => ({
  vocab: { spoken: {}, copied: {} },        // {Apple:true, ...}
  grammar: { read: {} },                     // {present_simple:true, ...}
  quizzes: { bestPct: 0 },                   // 0..100
  placement: { done: false, level: '' },     // done, level string
  discussions: { posts: 0 }                  // count
});

// أوزان الأقسام
const weights = {
  vocab: 0.25,
  grammar: 0.20,
  quizzes: 0.25,
  placement: 0.20,
  discussions: 0.10
};

// قائمة المفردات المُعتمدة للحساب (يجب أن تطابق ما في initVocabulary)
const VOCAB_WORDS = [
  {en:'Apple', ar:'تفاحة', emoji:'🍎'},
  {en:'Book', ar:'كتاب', emoji:'📖'},
  {en:'Car', ar:'سيارة', emoji:'🚗'},
  {en:'House', ar:'منزل', emoji:'🏠'},
  {en:'Teacher', ar:'معلّم', emoji:'👩‍🏫'},
  {en:'Student', ar:'طالب', emoji:'🧑‍🏫'},
  {en:'Water', ar:'ماء', emoji:'💧'},
  {en:'Food', ar:'طعام', emoji:'🍽️'},
  {en:'Computer', ar:'حاسوب', emoji:'💻'},
  {en:'Phone', ar:'هاتف', emoji:'📱'},
  {en:'City', ar:'مدينة', emoji:'🏙️'},
  {en:'Music', ar:'موسيقى', emoji:'🎵'},
  {en:'Hello', ar:'مرحبا',},
];

// دروس القواعد المُعتمدة (أضف نفس المعرفات في HTML)
const GRAMMAR_LESSONS = [
  'present_simple',
  'past_simple',
  'future_will',
  'present_perfect'
];

// تهيئة عامة
document.addEventListener('DOMContentLoaded', () => {
  // تمييز الصفحة الراهنة
  const path = location.pathname.split('/').pop() || 'index.html';
  $$('.menu a').forEach(a => { if (a.getAttribute('href') === path) a.classList.add('active'); });

  initProgressUI();
  initVocabulary();
  initGrammarTracking();
  initQuizzes();
  initPlacement();
  initDiscussions();

  // تحديث واجهة التقدّم بعد التحميل
  updateProgressUI();
});

/* ====================== التقدّم: تخزين وحساب ====================== */
function getProgress(){
  try {
    return JSON.parse(localStorage.getItem(K_PROGRESS)) || defaultProgress();
  } catch { return defaultProgress(); }
}
function setProgress(p){
  localStorage.setItem(K_PROGRESS, JSON.stringify(p));
}
function resetProgress(){
  setProgress(defaultProgress());
  toast('تم تصفير التقدّم');
  updateProgressUI();
}
function computeProgress(){
  const p = getProgress();

  // المفردات: الكلمة متقنة إذا نُطقت و نُسخت
  const totalWords = VOCAB_WORDS.length;
  let mastered = 0;
  VOCAB_WORDS.forEach(w=>{
    if (p.vocab.spoken[w.en] && p.vocab.copied[w.en]) mastered++;
  });
  const vocabPct = totalWords ? mastered / totalWords : 0;

  // القواعد: نسبة الدروس المقروءة
  const totalLessons = GRAMMAR_LESSONS.length;
  let readCount = GRAMMAR_LESSONS.filter(id => !!p.grammar.read[id]).length;
  const grammarPct = totalLessons ? readCount / totalLessons : 0;

  // الاختبارات: أفضل نتيجة
  const quizzesPct = (p.quizzes.bestPct || 0) / 100;

  // تحديد المستوى: 1 إذا تم
  const placementPct = p.placement.done ? 1 : 0;

  // المناقشات: حتى 3 مشاركات = 100%
  const discussionsPct = Math.min((p.discussions.posts || 0) / 3, 1);

  // التجميع الموزون
  const overall =
    vocabPct * weights.vocab +
    grammarPct * weights.grammar +
    quizzesPct * weights.quizzes +
    placementPct * weights.placement +
    discussionsPct * weights.discussions;

  return {
    overallPct: Math.round(overall * 100),
    parts: {
      vocab: Math.round(vocabPct * 100),
      grammar: Math.round(grammarPct * 100),
      quizzes: Math.round(quizzesPct * 100),
      placement: Math.round(placementPct * 100),
      discussions: Math.round(discussionsPct * 100)
    },
    masteredWords: mastered,
    readLessons: readCount
  };
}

/* ====================== واجهة التقدّم ====================== */
function initProgressUI(){
  // زر إعادة الضبط اختياري: نضيفه في الصفحة الرئيسية أو عبر الاختصار التالي:
  const hdr = document.querySelector('.progress');
  if(hdr && !$('#reset-progress', hdr)){
    const sub = document.createElement('div');
    sub.className = 'progress-sub';
    sub.innerHTML = `
      <span id="progress-breakdown">—</span>
      • <span id="reset-progress" class="reset-link" role="button" tabindex="0">تصفير التقدّم</span>
    `;
    hdr.appendChild(sub);
    sub.querySelector('#reset-progress').addEventListener('click', resetProgress);
  }
}
function updateProgressUI(){
  const { overallPct, parts } = computeProgress();
  const bar = $('#progress-fill');
  const pct = $('#progress-pct');
  if(bar) bar.style.width = `${overallPct}%`;
  if(pct) pct.textContent = `${overallPct}%`;
  const bd = $('#progress-breakdown');
  if(bd){
    bd.textContent = `المفردات ${parts.vocab}% • القواعد ${parts.grammar}% • الاختبارات ${parts.quizzes}% • المستوى ${parts.placement}% • المناقشات ${parts.discussions}%`;
  }
}

/* ====================== المفردات ====================== */
function initVocabulary(){
  const list = $('.vocab-list');
  if(!list) return;

  const search = $('#vocab-search');
  const render = (filter='') => {
    list.innerHTML = '';
    VOCAB_WORDS
      .filter(w => (w.en + ' ' + w.ar).toLowerCase().includes(filter.toLowerCase()))
      .forEach(w => list.appendChild(vocabItem(w)));
  };
  const vocabItem = (w) => {
    const row = document.createElement('div');
    row.className = 'vocab-item';
    row.innerHTML = `
      <div class="vocab-word"><span style="font-size:20px">${w.emoji}</span>
        <b>${w.en}</b> — <span style="color:#64748b">${w.ar}</span>
      </div>
      <div class="vocab-actions">
        <button class="btn ghost" aria-label="نطق">🔊 نطق</button>
        <button class="btn primary" aria-label="نسخ">📋 نسخ</button>
      </div>
    `;
    const [speakBtn, copyBtn] = row.querySelectorAll('button');
    speakBtn.addEventListener('click', () => {
      speakWord(w.en);
      const p = getProgress();
      p.vocab.spoken[w.en] = true;
      setProgress(p);
      updateProgressUI();
    });
    copyBtn.addEventListener('click', async () => {
      try{
        await navigator.clipboard.writeText(`${w.en} - ${w.ar}`);
        toast('تم النسخ');
        const p = getProgress();
        p.vocab.copied[w.en] = true;
        setProgress(p);
        updateProgressUI();
      }catch{ toast('تعذّر النسخ'); }
    });
    return row;
  };
  search?.addEventListener('input', e => render(e.target.value));
  render();
}
function speakWord(text){
  if('speechSynthesis' in window){
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-US';
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  } else {
    toast('النطق غير مدعوم في متصفحك');
  }
}

/* ====================== القواعد: تعليم الدرس كمقروء ====================== */
function initGrammarTracking(){
  const cards = $$('.card [data-lesson-id]');
  if(cards.length===0) return;

  const markVisible = () => {
    const p = getProgress();
    cards.forEach(el=>{
      const id = el.getAttribute('data-lesson-id');
      const rect = el.getBoundingClientRect();
      const visible = rect.top < window.innerHeight - 80 && rect.bottom > 80;
      if(visible) p.grammar.read[id] = true;
    });
    setProgress(p);
    updateProgressUI();
  };
  window.addEventListener('scroll', throttle(markVisible, 300), {passive:true});
  markVisible();
}

/* ====================== الاختبارات ====================== */
function initQuizzes(){
  const form = $('#quiz-form');
  const result = $('#quiz-result');
  if(!form) return;

  form.addEventListener('submit', e => {
    e.preventDefault();
    const correctMap = { q1:'b', q2:'c', q3:'a', q4:'c', q5:'a' };
    let score = 0;
    Object.keys(correctMap).forEach(q=>{
      const val = (form.querySelector(`input[name="${q}"]:checked`)||{}).value;
      if(val === correctMap[q]) score++;
    });
    const pct = Math.round((score/5)*100);
    result.style.display='block';
    result.innerHTML = `
      <div><span class="badge ${pct>=80?'success':pct>=60?'info':'warn'}">نتيجتك</span></div>
      <h3 style="margin:6px 0">${score}/5 — ${pct}%</h3>
      <p style="margin:0;color:#64748b">${feedback(pct)}</p>
    `;
    // حفظ أفضل نتيجة
    const p = getProgress();
    p.quizzes.bestPct = Math.max(p.quizzes.bestPct || 0, pct);
    setProgress(p);
    updateProgressUI();
    window.scrollTo({top: result.offsetTop-60, behavior:'smooth'});
  });

  function feedback(p){
    if(p>=90) return 'ممتاز! استمر بهذا المستوى 👏';
    if(p>=70) return 'جيد جدًا! راجع الأخطاء لتحسن أكثر 💪';
    if(p>=50) return 'جيد، تحتاج لبعض المراجعة ✍️';
    return 'ابدأ من الأساسيات وستتقدم بسرعة 🚀';
  }
}

/* ====================== تحديد المستوى ====================== */
function initPlacement(){
  const form = $('#placement-form');
  const out = $('#placement-result');
  if(!form) return;

  form.addEventListener('submit', e=>{
    e.preventDefault();
    const correct = {p1:'a',p2:'b',p3:'c',p4:'a',p5:'b',p6:'c',p7:'c',p8:'b'};
    let score=0;
    Object.keys(correct).forEach(k=>{
      const val=(form.querySelector(`input[name="${k}"]:checked`)||{}).value;
      if(val===correct[k]) score++;
    });
    const pct = Math.round(score/8*100);
    let level='مبتدئ (A1-A2)', color='warn';
    if(score>=6){ level='متقدّم (C1)'; color='success'; }
    else if(score>=4){ level='متوسّط (B1-B2)'; color='info'; }
    out.style.display='block';
    out.innerHTML=`
      <div><span class="badge ${color}">تقييم المستوى</span></div>
      <h3 style="margin:6px 0">${level}</h3>
      <p style="margin:0;color:#64748b">النتيجة: ${score}/8 — ${pct}%</p>
    `;
    // وضع علامة "تم"
    const p = getProgress();
    p.placement.done = true;
    p.placement.level = level;
    setProgress(p);
    updateProgressUI();
    window.scrollTo({top: out.offsetTop-60, behavior:'smooth'});
  });
}

/* ====================== المناقشات ====================== */
function initDiscussions(){
  const form = $('#discussion-form');
  const thread = $('#thread');
  if(!form || !thread) return;

  const load = () => JSON.parse(localStorage.getItem(K_DISCUSS) || '[]');
  const save = (items) => localStorage.setItem(K_DISCUSS, JSON.stringify(items));

  const render = () => {
    const items = load();
    thread.innerHTML='';
    if(items.length===0){
      thread.innerHTML='<p class="meta">لا توجد مشاركات بعد. كن أول من يطرح سؤالًا 👋</p>';
      return;
    }
    items.slice().reverse().forEach(p=>{
      const div=document.createElement('div');
      div.className='post';
      div.innerHTML=`
        <div class="meta">${new Date(p.time).toLocaleString()} — <b>${escapeHtml(p.name||'مستخدم')}</b></div>
        <div style="margin-top:6px">${escapeHtml(p.text)}</div>
      `;
      thread.appendChild(div);
    });
  };

  form.addEventListener('submit', e=>{
    e.preventDefault();
    const name = $('#d-name').value.trim();
    const text = $('#d-text').value.trim();
    if(text.length<3){ toast('اكتب محتوى أطول قليلًا'); return; }
    const items = load();
    items.push({name, text, time: Date.now()});
    save(items);
    // تحديث تقدّم المناقشات
    const p = getProgress();
    p.discussions.posts = (p.discussions.posts || 0) + 1;
    setProgress(p);
    updateProgressUI();

    form.reset();
    render();
    toast('تم نشر سؤالك');
  });

  render();
}

/* ====================== أدوات مساعدة ====================== */
function toast(msg){
  let t = $('#toast');
  if(!t){
    t = document.createElement('div');
    t.id='toast';
    t.style.cssText='position:fixed;bottom:18px;left:50%;transform:translateX(-50%);background:#111827;color:#fff;padding:10px 14px;border-radius:10px;box-shadow:0 10px 24px rgba(0,0,0,.2);z-index:999;opacity:0;transition:.25s';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity='1';
  setTimeout(()=>{ t.style.opacity='0'; },1800);
}
function escapeHtml(s){
  return s.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}
function throttle(fn, wait){
  let t=0;
  return function(...args){
    const now=Date.now();
    if(now-t>=wait){ t=now; fn.apply(this,args); }
  }
}
// ====== Dark Mode Toggle ======
const THEME_KEY = 'site-theme';

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem(THEME_KEY, theme);
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    btn.textContent = theme === 'dark' ? '☀️' : '🌙';
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
}

document.addEventListener('DOMContentLoaded', () => {
  const stored = localStorage.getItem(THEME_KEY);
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = stored || (prefersDark ? 'dark' : 'light');
  applyTheme(theme);

  const btn = document.getElementById('theme-toggle');
  if (!btn) {
    console.error('⛔ زر التبديل غير موجود!');
    return;
  }

  btn.addEventListener('click', () => {
    console.log('🔘 ضغطت على زر التبديل');
    toggleTheme();
  });
});

