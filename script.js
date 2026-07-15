(function () {
  const chapters = window.EIKEN3_DATA || [];
  const storageKey = "brunei-malay-progress-v2";
  const speeds = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
  const state = {
    chapterId: null,
    questions: [],
    index: 0,
    selectedChoice: null,
    sortAnswer: [],
    recording: null,
    chunks: []
  };

  const el = {
    homeView: document.getElementById("homeView"),
    practiceView: document.getElementById("practiceView"),
    chapterList: document.getElementById("chapterList"),
    overallAccuracy: document.getElementById("overallAccuracy"),
    studiedCount: document.getElementById("studiedCount"),
    chapterTitle: document.getElementById("chapterTitle"),
    questionTitle: document.getElementById("questionTitle"),
    questionMeta: document.getElementById("questionMeta"),
    imageArea: document.getElementById("imageArea"),
    passageArea: document.getElementById("passageArea"),
    questionText: document.getElementById("questionText"),
    sortArea: document.getElementById("sortArea"),
    choicesArea: document.getElementById("choicesArea"),
    dictationInput: document.getElementById("dictationInput"),
    audioPanel: document.getElementById("audioPanel"),
    audioPlayer: document.getElementById("audioPlayer"),
    speedSelect: document.getElementById("speedSelect"),
    answerPanel: document.getElementById("answerPanel"),
    resultTitle: document.getElementById("resultTitle"),
    answerText: document.getElementById("answerText"),
    explanationText: document.getElementById("explanationText"),
    grammarText: document.getElementById("grammarText"),
    vocabText: document.getElementById("vocabText"),
    modelAnswerText: document.getElementById("modelAnswerText"),
    shadowingPanel: document.getElementById("shadowingPanel"),
    shadowingText: document.getElementById("shadowingText"),
    recordingPanel: document.getElementById("recordingPanel"),
    recordBtn: document.getElementById("recordBtn"),
    recordStatus: document.getElementById("recordStatus"),
    recordPlayback: document.getElementById("recordPlayback"),
    progressBar: document.getElementById("progressBar"),
    positionText: document.getElementById("positionText"),
    checkBtn: document.getElementById("checkBtn")
  };

  let progress = sanitizeProgress(loadProgress());

  function loadProgress() {
    try {
      return JSON.parse(localStorage.getItem(storageKey)) || baseProgress();
    } catch (error) {
      return baseProgress();
    }
  }

  function baseProgress() {
    return {
      correct: 0,
      incorrect: 0,
      wrongIds: [],
      studiedIds: [],
      answers: {},
      chapters: {},
      lastStudyDate: null
    };
  }

  function sanitizeProgress(data) {
    const source = data && typeof data === "object" ? data : baseProgress();
    const validKeys = new Set();
    const validIdsByChapter = new Map();
    chapters.forEach((chapter) => {
      const ids = new Set();
      chapter.questions.forEach((question) => {
        const chapterId = question.chapter || chapter.id;
        validKeys.add(`${chapterId}:${question.id}`);
        ids.add(String(question.id));
      });
      validIdsByChapter.set(String(chapter.id), ids);
    });

    const answers = Object.fromEntries(
      Object.entries(source.answers || {}).filter(([key]) => validKeys.has(key))
    );
    const studiedIds = [...new Set((source.studiedIds || []).filter((key) => validKeys.has(key)))];
    const wrongIds = [...new Set((source.wrongIds || []).filter((key) => validKeys.has(key)))];
    const chapterProgress = {};
    Object.entries(source.chapters || {}).forEach(([chapterId, entries]) => {
      const validIds = validIdsByChapter.get(String(chapterId));
      if (!validIds || !entries || typeof entries !== "object") return;
      chapterProgress[chapterId] = Object.fromEntries(
        Object.entries(entries).filter(([questionId]) => validIds.has(String(questionId)))
      );
    });
    const answerResults = Object.values(answers);
    const clean = {
      correct: answerResults.filter((answer) => answer?.correct === true).length,
      incorrect: answerResults.filter((answer) => answer?.correct === false).length,
      wrongIds,
      studiedIds,
      answers,
      chapters: chapterProgress,
      lastStudyDate: source.lastStudyDate || null
    };
    localStorage.setItem(storageKey, JSON.stringify(clean));
    return clean;
  }

  function saveProgress() {
    progress.lastStudyDate = new Date().toISOString();
    localStorage.setItem(storageKey, JSON.stringify(progress));
    renderHome();
  }

  function questionKey(question) {
    return `${question.chapter || state.chapterId}:${question.id}`;
  }

  function byId(id) {
    return chapters.find((chapter) => chapter.id === id);
  }

  function renderHome() {
    const total = progress.correct + progress.incorrect;
    el.overallAccuracy.textContent = total ? `${Math.round((progress.correct / total) * 100)}%` : "0%";
    el.studiedCount.textContent = `${progress.studiedIds.length}問`;
    el.chapterList.innerHTML = chapters.map((chapter) => {
      const chapterProgress = progress.chapters[chapter.id] || {};
      const done = Object.keys(chapterProgress).length;
      const percent = chapter.questions.length ? Math.round((done / chapter.questions.length) * 100) : 0;
      return `
        <article class="chapter-card">
          <h2><span class="pill">Duolingo</span> ${escapeHtml(chapter.title)}</h2>
          <div class="chapter-progress" aria-label="${percent}%"><span style="width:${percent}%"></span></div>
          <p class="summary-label">${done}/${chapter.questions.length}問 学習済み</p>
          <button class="primary-button" type="button" data-chapter="${chapter.id}">学習する</button>
        </article>
      `;
    }).join("");
  }

  function openHome() {
    el.homeView.classList.add("active");
    el.practiceView.classList.remove("active");
    stopAudio();
    renderHome();
  }

  function openChapter(chapterId, filter) {
    const chapter = byId(chapterId);
    if (!chapter) return;
    state.chapterId = chapterId;
    const chapterQuestions = filter ? chapter.questions.filter(filter) : chapter.questions.slice();
    state.questions = chapterQuestions.map((question) => randomizeChoices({
      ...question,
      chapter: question.chapter || chapter.id
    }, chapter.questions));
    state.index = 0;
    if (!state.questions.length) {
      alert("対象の問題はまだありません。");
      return;
    }
    el.homeView.classList.remove("active");
    el.practiceView.classList.add("active");
    renderQuestion();
  }

  function openReview(kind) {
    const ids = progress.wrongIds;
    const wanted = new Set(ids);
    const questions = chapters.flatMap((chapter) => chapter.questions.map((question) => ({
      ...question,
      chapter: question.chapter || chapter.id
    }))).filter((question) => wanted.has(`${question.chapter}:${question.id}`)).map((question) => (
      randomizeChoices(question, byId(question.chapter)?.questions || [])
    ));
    if (!questions.length) {
      alert("間違えた問題はまだありません。");
      return;
    }
    state.chapterId = "review";
    state.questions = questions;
    state.index = 0;
    el.homeView.classList.remove("active");
    el.practiceView.classList.add("active");
    renderQuestion();
  }

  function currentQuestion() {
    return state.questions[state.index];
  }

  function randomizeChoices(question, sectionQuestions) {
    if (!Array.isArray(question.choices) || question.choices.length < 2) return question;
    const correct = question.choices[getAnswerIndex(question)];
    const candidates = (sectionQuestions || [])
      .filter((candidate) => candidate.id !== question.id && candidate.typeLabel === question.typeLabel && Array.isArray(candidate.choices))
      .map((candidate) => candidate.choices[getAnswerIndex(candidate)])
      .filter((choice, index, list) => choice !== correct && list.indexOf(choice) === index);
    for (let index = candidates.length - 1; index > 0; index--) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [candidates[index], candidates[randomIndex]] = [candidates[randomIndex], candidates[index]];
    }
    const choices = [correct, ...candidates.slice(0, 3)];
    for (let index = choices.length - 1; index > 0; index--) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [choices[index], choices[randomIndex]] = [choices[randomIndex], choices[index]];
    }
    return { ...question, choices, answerIndex: choices.indexOf(correct) };
  }

  function renderQuestion() {
    const question = currentQuestion();
    const chapter = byId(question.chapter);
    state.selectedChoice = null;
    state.sortAnswer = [];
    el.chapterTitle.textContent = chapter ? `Chapter ${String(chapter.id).padStart(2, "0")} ${chapter.title}` : "復習";
    const type = question.type || "choice";
    el.questionTitle.textContent = question.title || question.section || `問題 ${question.id}`;
    el.questionMeta.innerHTML = [
      `ID ${question.id}`,
      question.cd ? `CD ${question.cd}` : "",
      question.typeLabel || question.section || type
    ].filter(Boolean).map((text) => `<span class="pill">${escapeHtml(text)}</span>`).join("");
    el.progressBar.style.width = `${Math.round(((state.index + 1) / state.questions.length) * 100)}%`;
    el.positionText.textContent = `${state.index + 1} / ${state.questions.length}`;
    const passage = getPassage(question);
    el.imageArea.classList.toggle("hidden", !question.image);
    el.imageArea.innerHTML = "";
    if (question.image) {
      const image = new Image();
      image.alt = question.imageAlt || question.title || "面接カード";
      image.onload = () => el.imageArea.classList.remove("hidden");
      image.onerror = () => {
        el.imageArea.classList.add("hidden");
        el.imageArea.innerHTML = "";
      };
      image.src = question.image;
      el.imageArea.appendChild(image);
    }
    el.passageArea.classList.toggle("hidden", !passage);
    el.passageArea.textContent = passage;
    el.questionText.textContent = question.prompt || question.question || "";
    el.answerPanel.classList.add("hidden");
    el.dictationInput.value = "";
    el.dictationInput.classList.toggle("hidden", type !== "listening" && type !== "interview");
    el.checkBtn.classList.toggle("hidden", type === "study");
    renderChoices(question);
    renderSort(question);
    renderAudio(question);
    renderTraining(question);
    updateWrongButton(question);
  }

  function renderChoices(question) {
    if ((question.type || "choice") === "sort") {
      el.choicesArea.innerHTML = "";
      return;
    }
    el.choicesArea.innerHTML = (question.choices || []).map((choice, index) => (
      `<button class="choice" type="button" data-choice="${index}">${escapeHtml(choice)}</button>`
    )).join("");
  }

  function renderSort(question) {
    el.sortArea.classList.toggle("hidden", (question.type || "choice") !== "sort");
    if ((question.type || "choice") !== "sort") return;
    const words = question.words || [];
    el.sortArea.innerHTML = `
      <div class="sort-answer" id="sortAnswer"></div>
      <div class="sort-bank" id="sortBank">
        ${words.map((word, index) => `<button class="word-chip" type="button" data-word="${index}">${escapeHtml(word)}</button>`).join("")}
      </div>
    `;
  }

  function renderAudio(question) {
    const hasAudio = Boolean(question.audio);
    el.audioPanel.classList.toggle("hidden", !hasAudio);
    if (!hasAudio) {
      stopAudio();
      el.audioPlayer.removeAttribute("src");
      return;
    }
    const sources = audioSources(question.audio);
    let sourceIndex = 0;
    el.audioPlayer.src = sources[sourceIndex];
    el.audioPlayer.playbackRate = Number(el.speedSelect.value);
    el.audioPlayer.onerror = function () {
      sourceIndex++;
      if (sourceIndex < sources.length) {
        el.audioPlayer.src = sources[sourceIndex];
        el.audioPlayer.load();
      } else {
        el.audioPanel.classList.add("hidden");
      }
    };
  }

  function audioSources(audioPath) {
    const sources = [];
    const fileName = String(audioPath || "").split("/").pop() || "";
    const eikenTrack = fileName.match(/^E(\d+)\.mp3$/i);
    const numberedTrack = fileName.match(/^0*(\d+)\.mp3$/);
    if (eikenTrack) {
      sources.push(`audio/eiken3/E${Number(eikenTrack[1])}.mp3`);
    } else if (numberedTrack) {
      sources.push(`audio/eiken3/E${Number(numberedTrack[1])}.mp3`);
    }
    sources.push(audioPath);
    return [...new Set(sources)];
  }

  function renderTraining(question) {
    el.shadowingPanel.classList.toggle("hidden", !question.shadowing);
    el.shadowingText.textContent = question.shadowing || "";
    el.recordingPanel.classList.toggle("hidden", question.chapter !== 6);
  }

  function updateWrongButton(question) {
    const wrong = progress.wrongIds.includes(questionKey(question));
    document.getElementById("wrongBtn").textContent = wrong ? "Buang Soalan Salah" : "Soalan Salah";
  }

  function checkAnswer() {
    const question = currentQuestion();
    let correct = false;
    let userAnswer = "";
    const type = question.type || "choice";
    const answerIndex = getAnswerIndex(question);
    if (type === "sort") {
      userAnswer = state.sortAnswer.join(" ");
      const expected = Array.isArray(question.correctOrder) ? question.correctOrder.join(" ") : question.answer;
      correct = normalize(userAnswer) === normalize(expected);
    } else if (type === "listening" && !(question.choices || []).length) {
      userAnswer = el.dictationInput.value;
      correct = normalize(userAnswer) === normalize(question.answer);
    } else if (type === "interview" && !(question.choices || []).length) {
      userAnswer = el.dictationInput.value;
      correct = true;
    } else {
      userAnswer = question.choices ? question.choices[state.selectedChoice] : el.dictationInput.value;
      correct = String(state.selectedChoice) === String(answerIndex);
    }

    const key = questionKey(question);
    const previous = progress.answers[key];
    if (!previous) {
      correct ? progress.correct++ : progress.incorrect++;
    } else if (previous.correct !== correct) {
      if (correct) {
        progress.correct++;
        progress.incorrect = Math.max(0, progress.incorrect - 1);
      } else {
        progress.incorrect++;
        progress.correct = Math.max(0, progress.correct - 1);
      }
    }
    progress.answers[key] = { correct, userAnswer };
    addUnique(progress.studiedIds, key);
    if (!correct) addUnique(progress.wrongIds, key);
    if (correct) progress.wrongIds = progress.wrongIds.filter((id) => id !== key);
    progress.chapters[question.chapter] = progress.chapters[question.chapter] || {};
    progress.chapters[question.chapter][question.id] = { correct };
    saveProgress();
    showAnswer(question, correct, userAnswer);
  }

  function showAnswer(question, correct) {
    el.answerPanel.classList.remove("hidden");
    el.resultTitle.textContent = correct ? "正解" : "確認しよう";
    el.resultTitle.className = correct ? "good" : "bad";
    const answerIndex = getAnswerIndex(question);
    const answer = (question.type || "choice") === "sort" ? (question.sentence || question.answer) : (question.choices ? question.choices[answerIndex] : question.answer);
    el.answerText.innerHTML = `<p><strong>答え：</strong>${escapeHtml(answer || "")}</p>`;
    el.explanationText.innerHTML = question.explanation ? `<p><strong>解説：</strong>${escapeHtml(question.explanation)}</p>` : "";
    el.grammarText.innerHTML = question.grammar ? `<p>${escapeHtml(question.grammar)}</p>` : "";
    el.vocabText.innerHTML = [
      ...(question.vocab || []),
      question.chinese ? `中国語：${question.chinese}（${question.pinyin || ""}）` : ""
    ].filter(Boolean).map((text) => `<p>${escapeHtml(text)}</p>`).join("");
    el.modelAnswerText.innerHTML = question.modelAnswer ? `<p><strong>模範解答：</strong>${escapeHtml(question.modelAnswer)}</p>` : "";
    document.querySelectorAll(".choice").forEach((button) => {
      const index = Number(button.dataset.choice);
      button.classList.toggle("correct", index === answerIndex);
      button.classList.toggle("wrong", index === state.selectedChoice && index !== answerIndex);
    });
  }

  function getAnswerIndex(question) {
    if (typeof question.answerIndex === "number") return question.answerIndex;
    if (!question.choices || typeof question.answer === "undefined") return -1;
    return question.choices.findIndex((choice) => normalize(choice) === normalize(question.answer));
  }

  function getPassage(question) {
    if (question.passage) return question.passage;
    if (Array.isArray(question.conversation)) return question.conversation.join("\n");
    return "";
  }

  function addUnique(list, value) {
    if (!list.includes(value)) list.push(value);
  }

  function normalize(text) {
    return String(text || "").toLowerCase().replace(/[.,?!]/g, "").replace(/\s+/g, " ").trim();
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[char]));
  }

  function stopAudio() {
    el.audioPlayer.pause();
    el.audioPlayer.currentTime = 0;
  }

  document.getElementById("resetBtn").addEventListener("click", () => {
    if (!window.confirm("すべての学習履歴をリセットしますか？")) return;
    progress = baseProgress();
    localStorage.setItem(storageKey, JSON.stringify(progress));
    openHome();
  });
  document.getElementById("backBtn").addEventListener("click", openHome);
  document.getElementById("reviewWrongBtn").addEventListener("click", () => openReview("wrong"));
  el.chapterList.addEventListener("click", (event) => {
    const button = event.target.closest("[data-chapter]");
    if (button) openChapter(Number(button.dataset.chapter));
  });
  el.choicesArea.addEventListener("click", (event) => {
    const button = event.target.closest("[data-choice]");
    if (!button) return;
    state.selectedChoice = Number(button.dataset.choice);
    document.querySelectorAll(".choice").forEach((item) => item.classList.remove("selected"));
    button.classList.add("selected");
  });
  el.sortArea.addEventListener("click", (event) => {
    const button = event.target.closest("[data-word]");
    if (!button) return;
    const word = button.textContent;
    state.sortAnswer.push(word);
    button.disabled = true;
    document.getElementById("sortAnswer").insertAdjacentHTML("beforeend", `<button class="word-chip" type="button" data-remove="${state.sortAnswer.length - 1}">${escapeHtml(word)}</button>`);
  });
  el.sortArea.addEventListener("dblclick", () => {
    state.sortAnswer = [];
    renderSort(currentQuestion());
  });
  document.getElementById("checkBtn").addEventListener("click", checkAnswer);
  document.getElementById("wrongBtn").addEventListener("click", () => {
    const key = questionKey(currentQuestion());
    if (progress.wrongIds.includes(key)) {
      progress.wrongIds = progress.wrongIds.filter((id) => id !== key);
    } else {
      progress.wrongIds.push(key);
    }
    saveProgress();
    updateWrongButton(currentQuestion());
  });
  document.getElementById("prevBtn").addEventListener("click", () => {
    if (state.index > 0) {
      state.index--;
      renderQuestion();
    }
  });
  document.getElementById("nextBtn").addEventListener("click", () => {
    if (state.index < state.questions.length - 1) {
      state.index++;
      renderQuestion();
    } else {
      openHome();
    }
  });
  el.speedSelect.addEventListener("change", () => {
    const selectedSpeed = speeds.includes(Number(el.speedSelect.value)) ? Number(el.speedSelect.value) : 1;
    el.audioPlayer.playbackRate = selectedSpeed;
  });
  document.getElementById("replayBtn").addEventListener("click", () => {
    el.audioPlayer.currentTime = 0;
    el.audioPlayer.play().catch(() => {});
  });
  el.recordBtn.addEventListener("click", async () => {
    if (!navigator.mediaDevices || !window.MediaRecorder) {
      el.recordStatus.textContent = "このブラウザは録音に対応していません。";
      return;
    }
    if (state.recording && state.recording.state === "recording") {
      state.recording.stop();
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.chunks = [];
    state.recording = new MediaRecorder(stream);
    state.recording.ondataavailable = (event) => state.chunks.push(event.data);
    state.recording.onstop = () => {
      const blob = new Blob(state.chunks, { type: "audio/webm" });
      el.recordPlayback.src = URL.createObjectURL(blob);
      el.recordPlayback.classList.remove("hidden");
      el.recordStatus.textContent = "録音が完了しました。";
      el.recordBtn.textContent = "録音開始";
      stream.getTracks().forEach((track) => track.stop());
    };
    state.recording.start();
    el.recordStatus.textContent = "録音中です。";
    el.recordBtn.textContent = "録音停止";
  });

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./service-worker.js").catch(() => {});
    });
  }

  renderHome();
})();
