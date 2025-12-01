// ======================================================
// Section configuration
// (Uses banks defined in data/vocab_bank.js, data/comp.js, data/cloze.js)
// ======================================================
const VSECTIONS = {
  vocab: { title: "Vocabulary Review", bank: window.VOCAB_BANK },
  comp:  { title: "Comprehension Review", bank: window.COMP_BANK },
  cloze: { title: "Cloze Review", bank: window.CLOZE_BANK },
};

// ======================================================
// DOM references
// ======================================================
const coverSection   = document.getElementById("coverSection");
const viewQuiz       = document.getElementById("view-quiz");
const viewResult     = document.getElementById("view-result");
const tabs           = document.querySelectorAll(".tab");

const sectionTitleEl = document.getElementById("sectionTitle");
const counterEl      = document.getElementById("counter");
const progressBarEl  = document.getElementById("progressBar");
const promptEl       = document.getElementById("prompt");
const choicesWrap    = document.getElementById("choices");
const feedbackEl     = document.getElementById("feedback");
const nextBtn        = document.getElementById("nextBtn");
const scoreLineEl    = document.getElementById("scoreLine");
const messageEl      = document.getElementById("message");
const toTopBtn       = document.getElementById("toTop");

// ======================================================
// Tab behavior – clicking a tab starts that review
// ======================================================
tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    tabs.forEach(x => x.classList.remove("active"));
    tab.classList.add("active");

    const mode = tab.dataset.view; // "vocab", "comp", "cloze"
    startQuiz(mode);
  });
});

// Return to cover
toTopBtn.addEventListener("click", () => {
  coverSection.classList.add("visible");
  viewQuiz.classList.remove("visible");
  viewResult.classList.remove("visible");
});

// Initially show cover only
coverSection.classList.add("visible");
viewQuiz.classList.remove("visible");
viewResult.classList.remove("visible");

// ======================================================
// Session state
// ======================================================
let session = null;

// Simple Fisher–Yates shuffle
function shuffle(a) {
  const arr = a.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// ======================================================
// Start a quiz for a given mode (vocab / comp / cloze)
// ======================================================
function startQuiz(mode) {
  const cfg = VSECTIONS[mode];
  if (!cfg) return;

  session = {
    mode,
    title: cfg.title,
    bank: shuffle(cfg.bank),
    idx: 0,
    correct: 0
  };

  sectionTitleEl.textContent = cfg.title;

  // Switch views
  coverSection.classList.remove("visible");
  viewResult.classList.remove("visible");
  viewQuiz.classList.add("visible");

  render();
}

// ======================================================
// Render the current question
// Supports:
//   - Single-answer:  q.answer = Number
//   - Multi-answer:   q.answers = [Number, Number, ...]
// ======================================================
function render() {
  const q = session.bank[session.idx];
  const total = session.bank.length;

  // Counter + progress bar
  counterEl.textContent = `Question ${session.idx + 1} of ${total}`;
  progressBarEl.style.width = `${(session.idx) / total * 100}%`;

  // Question text
  promptEl.innerHTML = q.q;

  // Reset choices area
  choicesWrap.innerHTML = "";
  choicesWrap.classList.remove("locked");
  feedbackEl.textContent = "";

  const letters = ["A", "B", "C", "D"];
  const isMulti = Array.isArray(q.answers); // multi-answer if answers array exists

  const opts = q.choices.map((text, i) => ({ text, letter: letters[i], i }));

  opts.forEach(opt => {
    const btn = document.createElement("button");
    btn.className = "choice";
    btn.innerHTML = `<strong>${opt.letter}.</strong> ${opt.text}`;

    if (isMulti) {
      // Multi-select: toggle choice, grade happens when they press "Check Answer"
      btn.addEventListener("click", () => {
        if (choicesWrap.classList.contains("locked")) return;
        btn.classList.toggle("selected");
        feedbackEl.textContent = "";
      });
    } else {
      // Single-answer: click grades immediately
      btn.addEventListener("click", () =>
        grade(opt.i, btn, choicesWrap, q.answer)
      );
    }

    choicesWrap.appendChild(btn);
  });

  // Button behavior
  if (isMulti) {
    // For “pick TWO” style questions
    nextBtn.textContent = "Check Answer";
    nextBtn.classList.remove("hidden");
    nextBtn.onclick = () => gradeMulti(choicesWrap, q.answers);
  } else {
    // For normal single-answer questions
    nextBtn.textContent = "Next";
    nextBtn.classList.add("hidden");
    nextBtn.onclick = next; // will be used after grading
  }
}

// ======================================================
// Grade single-answer questions
// ======================================================
function grade(i, btn, wrap, answerIdx) {
  if (wrap.classList.contains("locked")) return;
  wrap.classList.add("locked");

  const buttons = Array.from(wrap.children);
  buttons.forEach((b, idx) => {
    if (idx === answerIdx) {
      b.classList.add("correct");
    }
  });

  if (i === answerIdx) {
    btn.classList.add("correct");
    session.correct++;
    chime(true);
    feedbackEl.textContent = "✅ Correct!";
  } else {
    btn.classList.add("wrong");
    chime(false);
    feedbackEl.textContent = "❌ Not quite.";
  }

  nextBtn.classList.remove("hidden");
  nextBtn.textContent = (session.idx === session.bank.length - 1) ? "See Score" : "Next";
  nextBtn.onclick = next;
}

// ======================================================
// Grade multi-answer (“pick TWO choices”) questions
// Expect:
//   - wrap = choices container
//   - answerIdxs = [correctIndex1, correctIndex2, ...]
// ======================================================
function gradeMulti(wrap, answerIdxs) {
  if (wrap.classList.contains("locked")) return;
  if (!Array.isArray(answerIdxs) || answerIdxs.length === 0) return;

  const buttons = Array.from(wrap.children);
  const selected = [];

  buttons.forEach((b, idx) => {
    if (b.classList.contains("selected")) {
      selected.push(idx);
    }
  });

  if (selected.length === 0) {
    feedbackEl.textContent = "Select your TWO answers first.";
    return;
  }

  wrap.classList.add("locked");

  // Highlight correct & wrong selections
  buttons.forEach((b, idx) => {
    if (answerIdxs.includes(idx)) {
      b.classList.add("correct");
    }
    if (b.classList.contains("selected") && !answerIdxs.includes(idx)) {
      b.classList.add("wrong");
    }
  });

  const correctKey = answerIdxs.slice().sort().join(",");
  const pickedKey = selected.slice().sort().join(",");

  if (correctKey === pickedKey) {
    session.correct++;
    chime(true);
    feedbackEl.textContent = "✅ Correct! You picked both correct answers.";
  } else {
    chime(false);
    feedbackEl.textContent = "❌ Not quite. Check both of your choices.";
  }

  nextBtn.classList.remove("hidden");
  nextBtn.textContent = (session.idx === session.bank.length - 1) ? "See Score" : "Next";
  nextBtn.onclick = next;
}

// ======================================================
// Move to next question or finish
// ======================================================
function next() {
  if (!session) return;
  session.idx++;

  if (session.idx < session.bank.length) {
    render();
  } else {
    // Show results
    const total = session.bank.length;
    const pct = Math.round((session.correct / total) * 100);

    scoreLineEl.textContent = `You scored ${session.correct} / ${total} (${pct}%).`;

    let msg = "Nice review! Keep practicing and you'll master this story.";
    if (pct >= 90) msg = "Excellent! ⭐ You're ready!";
    else if (pct >= 80) msg = "Great job! One more quick review and you're set.";
    else if (pct >= 70) msg = "Good effort — revisit a few questions and try again.";

    messageEl.textContent = msg;

    confetti();
    viewQuiz.classList.remove("visible");
    viewResult.classList.add("visible");
  }
}

// ======================================================
// WebAudio chime (simple correct / incorrect sound)
// ======================================================
let audioCtx;

function chime(ok = true) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();

    o.type = "sine";
    const now = audioCtx.currentTime;

    if (ok) {
      // Upward, happy beep
      o.frequency.setValueAtTime(880, now);
      o.frequency.linearRampToValueAtTime(1320, now + 0.18);
    } else {
      // Slightly downward, “oops” beep
      o.frequency.setValueAtTime(260, now);
      o.frequency.linearRampToValueAtTime(180, now + 0.18);
    }

    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(0.25, now + 0.03);
    g.gain.linearRampToValueAtTime(0.0001, now + 0.30);

    o.connect(g);
    g.connect(audioCtx.destination);
    o.start(now);
    o.stop(now + 0.35);
  } catch (e) {
    // ignore audio errors (e.g., older browsers)
  }
}

// ======================================================
// Confetti (DOM-based celebration)
// ======================================================
function confetti() {
  const colors = ["#ffd54f", "#b22222", "#d64545", "#6b2e2e", "#fff8e1"];
  const pieces = 80;

  for (let i = 0; i < pieces; i++) {
    const el = document.createElement("div");
    el.className = "confetti";
    el.style.position = "fixed";
    el.style.top = "-10vh";
    el.style.left = Math.random() * 100 + "vw";
    el.style.width = "8px";
    el.style.height = "14px";
    el.style.background = colors[Math.floor(Math.random() * colors.length)];
    el.style.opacity = "0.9";
    el.style.zIndex = "9999";
    el.style.transform = "rotate(0deg)";
    el.style.transition =
      `transform ${2 + Math.random() * 1.5}s linear, ` +
      `top ${2 + Math.random() * 1.5}s linear, ` +
      `opacity 2.2s ease`;

    document.body.appendChild(el);

    requestAnimationFrame(() => {
      el.style.top = "110vh";
      el.style.transform = `rotate(${360 + Math.random() * 360}deg)`;
      el.style.opacity = "0.85";
    });

    setTimeout(() => el.remove(), 2600);
  }
}
