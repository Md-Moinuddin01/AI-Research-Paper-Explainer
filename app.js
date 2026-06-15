const PDFJS_VERSION = "6.0.227";
const PDFJS_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.mjs`;
const PDFJS_WORKER_URL = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.mjs`;

const els = {
  dropzone: document.querySelector("#dropzone"),
  fileInput: document.querySelector("#fileInput"),
  paperText: document.querySelector("#paperText"),
  analyzeTextButton: document.querySelector("#analyzeTextButton"),
  sampleButton: document.querySelector("#sampleButton"),
  exportButton: document.querySelector("#exportButton"),
  statusPill: document.querySelector("#statusPill"),
  paperTitle: document.querySelector("#paperTitle"),
  wordCount: document.querySelector("#wordCount"),
  sectionCount: document.querySelector("#sectionCount"),
  conceptCount: document.querySelector("#conceptCount"),
  focusList: document.querySelector("#focusList"),
  summaryContent: document.querySelector("#summaryContent"),
  emptyState: document.querySelector("#emptyState"),
  visualContent: document.querySelector("#visualContent"),
  conceptContent: document.querySelector("#conceptContent"),
  roadmapContent: document.querySelector("#roadmapContent"),
  toast: document.querySelector("#toast"),
  tabs: [...document.querySelectorAll(".tab")],
  views: [...document.querySelectorAll(".view")],
};

const stopWords = new Set(
  [
    "about",
    "above",
    "across",
    "after",
    "again",
    "against",
    "algorithm",
    "also",
    "among",
    "because",
    "before",
    "being",
    "between",
    "could",
    "dataset",
    "datasets",
    "during",
    "each",
    "either",
    "every",
    "from",
    "further",
    "given",
    "have",
    "having",
    "here",
    "however",
    "into",
    "itself",
    "method",
    "methods",
    "model",
    "models",
    "more",
    "most",
    "paper",
    "papers",
    "present",
    "provide",
    "result",
    "results",
    "should",
    "show",
    "shown",
    "shows",
    "significant",
    "such",
    "than",
    "that",
    "their",
    "there",
    "these",
    "they",
    "this",
    "through",
    "using",
    "various",
    "were",
    "where",
    "which",
    "while",
    "with",
    "within",
    "without",
  ].map((word) => word.toLowerCase()),
);

const sectionPatterns = [
  { key: "abstract", label: "Abstract", match: /^abstract\b/i },
  { key: "introduction", label: "Introduction", match: /^(\d+\.?\s*)?introduction\b/i },
  { key: "related", label: "Related Work", match: /^(\d+\.?\s*)?related work\b/i },
  { key: "method", label: "Method", match: /^(\d+\.?\s*)?(method|methodology|approach|framework|proposed)\b/i },
  { key: "data", label: "Data", match: /^(\d+\.?\s*)?(data|dataset|datasets|experimental setup)\b/i },
  { key: "experiments", label: "Experiments", match: /^(\d+\.?\s*)?(experiment|experiments|evaluation)\b/i },
  { key: "results", label: "Results", match: /^(\d+\.?\s*)?(result|results|findings)\b/i },
  { key: "discussion", label: "Discussion", match: /^(\d+\.?\s*)?discussion\b/i },
  { key: "limitations", label: "Limitations", match: /^(\d+\.?\s*)?limitations?\b/i },
  { key: "conclusion", label: "Conclusion", match: /^(\d+\.?\s*)?(conclusion|conclusions|future work)\b/i },
];

const samplePaper = `Adaptive Retrieval-Augmented Learning for Clinical Question Answering

Abstract
Clinical question answering systems often fail when patient context is incomplete, ambiguous, or distributed across long records. We introduce Adaptive Retrieval-Augmented Learning, a framework that combines uncertainty-aware retrieval, evidence reranking, and constrained generation. The system learns when to request more context, when to cite retrieved evidence, and when to abstain. Across three public clinical QA benchmarks, the approach improves answer faithfulness by 18 percent and reduces unsupported claims by 31 percent compared with standard retrieval-augmented baselines.

Introduction
Large language models can summarize medical documents, but their answers may be unreliable when the available evidence is sparse. Existing retrieval-augmented systems retrieve fixed-size passages and pass them directly to a generator. This creates a mismatch between the question, the patient's record, and the evidence needed for a safe response.

Method
The proposed framework has four modules. First, a query planner rewrites the clinical question into evidence needs. Second, an uncertainty estimator predicts whether retrieved passages are sufficient. Third, an evidence reranker scores passages with factuality constraints. Fourth, a generator produces an answer with sentence-level citations and abstains when confidence is low.

Experiments
We evaluate on MedQA, PubMedQA, and a de-identified hospital note benchmark. Baselines include BM25 retrieval, dense retrieval, and standard retrieval-augmented generation. Metrics include exact match, citation precision, answer faithfulness, and abstention accuracy.

Results
Adaptive retrieval improves citation precision from 62 percent to 79 percent and improves faithfulness from 71 percent to 89 percent. The largest gains occur for multi-hop questions that require combining medication history, lab trends, and diagnosis notes. Error analysis shows that most remaining failures are caused by missing temporal information and ambiguous abbreviations.

Conclusion
Adaptive retrieval-augmented learning helps clinical QA systems give more faithful and cautious answers. Future work should validate the approach in prospective clinical workflows and improve robustness to noisy records.`;

let currentReport = null;

function init() {
  wireEvents();
  refreshIcons();
}

function wireEvents() {
  els.fileInput.addEventListener("change", (event) => {
    const [file] = event.target.files;
    if (file) {
      handleFile(file);
    }
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    els.dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      els.dropzone.classList.add("dragging");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    els.dropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      els.dropzone.classList.remove("dragging");
    });
  });

  els.dropzone.addEventListener("drop", (event) => {
    const [file] = event.dataTransfer.files;
    if (file) {
      handleFile(file);
    }
  });

  els.analyzeTextButton.addEventListener("click", () => {
    const text = els.paperText.value.trim();
    if (!text) {
      showToast("Paste paper text or upload a file first.");
      return;
    }
    analyzeAndRender(text, "Pasted paper text");
  });

  els.sampleButton.addEventListener("click", () => {
    els.paperText.value = samplePaper;
    analyzeAndRender(samplePaper, "Sample clinical QA paper");
  });

  els.exportButton.addEventListener("click", exportReport);

  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => setActiveView(tab.dataset.view));
  });
}

async function handleFile(file) {
  try {
    setBusy(`Reading ${file.name}`);
    const extension = file.name.split(".").pop()?.toLowerCase();
    let text = "";
    if (extension === "pdf" || file.type === "application/pdf") {
      text = await readPdf(file);
    } else {
      text = await file.text();
    }

    if (!text.trim()) {
      throw new Error("No readable text was found in this file.");
    }

    els.paperText.value = text.slice(0, 32000);
    analyzeAndRender(text, file.name);
  } catch (error) {
    console.error(error);
    setReady("Needs input");
    showToast(error.message || "Could not read that file.");
  }
}

async function readPdf(file) {
  const pdfjsLib = await import(PDFJS_URL);
  pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pageTexts = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pageTexts.push(content.items.map((item) => item.str).join(" "));
  }

  return pageTexts.join("\n\n");
}

function analyzeAndRender(rawText, sourceName) {
  setBusy("Analyzing");
  window.requestAnimationFrame(() => {
    const report = buildReport(rawText, sourceName);
    currentReport = report;
    renderReport(report);
    setReady("Explained");
    showToast("Paper explainer generated.");
  });
}

function buildReport(rawText, sourceName) {
  const text = normalizeText(rawText);
  const title = extractTitle(text, sourceName);
  const sentences = splitSentences(text);
  const sections = extractSections(text);
  const terms = extractTerms(text, title).slice(0, 14);
  const summary = buildSummary(sentences, sections, terms);
  const visual = buildVisualModel(summary, sections, terms);
  const concepts = buildConcepts(terms, sentences);
  const roadmap = buildRoadmap(summary, sections, terms);
  const wordTotal = text.split(/\s+/).filter(Boolean).length;

  return {
    title,
    sourceName,
    createdAt: new Date().toISOString(),
    stats: {
      wordTotal,
      sectionTotal: sections.length,
      conceptTotal: concepts.length,
    },
    sections,
    terms,
    summary,
    visual,
    concepts,
    roadmap,
  };
}

function normalizeText(text) {
  return text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/-\s*\n\s*/g, "")
    .trim();
}

function extractTitle(text, fallback) {
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !/^(abstract|introduction|keywords)\b/i.test(line));
  const title = lines.find((line) => line.length >= 12 && line.length <= 140);
  return title || fallback || "Research paper";
}

function splitSentences(text) {
  const cleaned = text.replace(/\n+/g, " ");
  const rough = cleaned.split(/(?<=[.!?])\s+(?=[A-Z0-9])/);
  return rough
    .map((sentence) => sentence.trim().replace(/\s+/g, " "))
    .filter((sentence) => sentence.length > 35 && sentence.length < 420);
}

function extractSections(text) {
  const lines = text.split("\n");
  const sections = [];
  let current = {
    key: "overview",
    label: "Overview",
    text: "",
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const found = sectionPatterns.find((section) => section.match.test(trimmed));
    if (found && current.text.trim()) {
      sections.push({ ...current, text: current.text.trim() });
      current = { key: found.key, label: found.label, text: "" };
      continue;
    }
    if (found && !current.text.trim()) {
      current = { key: found.key, label: found.label, text: "" };
      continue;
    }
    current.text += `${line}\n`;
  }

  if (current.text.trim()) {
    sections.push({ ...current, text: current.text.trim() });
  }

  const merged = new Map();
  sections.forEach((section) => {
    const existing = merged.get(section.key);
    if (existing) {
      existing.text = `${existing.text}\n${section.text}`;
    } else {
      merged.set(section.key, { ...section });
    }
  });

  return [...merged.values()].map((section) => ({
    ...section,
    wordCount: section.text.split(/\s+/).filter(Boolean).length,
  }));
}

function extractTerms(text, title) {
  const words = tokenize(text);
  const counts = new Map();
  const titleTokens = new Set(tokenize(title));

  words.forEach((word) => {
    const score = titleTokens.has(word) ? 2.2 : 1;
    counts.set(word, (counts.get(word) || 0) + score);
  });

  for (let index = 0; index < words.length - 1; index += 1) {
    const first = words[index];
    const second = words[index + 1];
    if (first === second) continue;
    const phrase = `${first} ${second}`;
    counts.set(phrase, (counts.get(phrase) || 0) + 2.6);
  }

  return [...counts.entries()]
    .filter(([term]) => term.length > 4)
    .map(([term, score]) => ({
      term: titleCase(term),
      raw: term,
      score,
      count: Math.max(1, Math.round(score)),
    }))
    .sort((a, b) => b.score - a.score)
    .filter(uniqueByStem)
    .slice(0, 20);
}

function tokenize(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((word) => word.replace(/^-+|-+$/g, ""))
    .filter((word) => word.length > 3 && !stopWords.has(word) && !/^\d+$/.test(word));
}

function uniqueByStem(term, index, terms) {
  const root = term.raw.split(" ")[0].replace(/s$/, "");
  return terms.findIndex((item) => item.raw.split(" ")[0].replace(/s$/, "") === root) === index;
}

function buildSummary(sentences, sections, terms) {
  const problemText = sectionText(sections, ["abstract", "introduction", "overview"]);
  const methodText = sectionText(sections, ["method", "data", "experiments"]);
  const resultText = sectionText(sections, ["results", "discussion", "conclusion"]);
  const ranked = rankSentences(sentences, terms);

  const problem = selectSentence(problemText, /(problem|challenge|difficult|fail|gap|limitation|objective|aim|need)/i) || ranked[0] || fallbackSentence(terms, "The paper studies");
  const method = selectSentence(methodText, /(propose|introduce|framework|method|model|algorithm|approach|module|system)/i) || ranked[1] || fallbackSentence(terms, "The core method combines");
  const evidence = selectSentence(resultText, /(improve|outperform|result|show|achieve|reduce|increase|accuracy|precision|faithfulness)/i) || ranked[2] || fallbackSentence(terms, "The evaluation focuses on");
  const impact = selectSentence(resultText, /(future|conclusion|therefore|enable|helps|robust|practical|workflow)/i) || ranked[3] || fallbackSentence(terms, "The work is useful for");

  return {
    oneLine: shorten(`${problem} ${method}`, 260),
    bullets: [
      { label: "Problem", text: cleanSentence(problem) },
      { label: "Method", text: cleanSentence(method) },
      { label: "Evidence", text: cleanSentence(evidence) },
      { label: "Impact", text: cleanSentence(impact) },
    ],
    bestSentences: ranked.slice(0, 5).map(cleanSentence),
  };
}

function sectionText(sections, keys) {
  return sections
    .filter((section) => keys.includes(section.key))
    .map((section) => section.text)
    .join(" ");
}

function selectSentence(text, pattern) {
  return splitSentences(text).find((sentence) => pattern.test(sentence));
}

function rankSentences(sentences, terms) {
  const termSet = terms.slice(0, 10).map((item) => item.raw);
  return [...sentences]
    .map((sentence, index) => {
      const lower = sentence.toLowerCase();
      const termScore = termSet.reduce((score, term) => score + (lower.includes(term) ? 4 : 0), 0);
      const signalScore = /(propose|introduce|show|improve|result|challenge|framework|evaluation|conclusion|future)/i.test(sentence) ? 5 : 0;
      const positionScore = index < 8 ? 4 : index < 20 ? 2 : 0;
      const lengthScore = sentence.length > 80 && sentence.length < 240 ? 3 : 0;
      return { sentence, score: termScore + signalScore + positionScore + lengthScore };
    })
    .sort((a, b) => b.score - a.score)
    .map((item) => item.sentence);
}

function fallbackSentence(terms, prefix) {
  const top = terms.slice(0, 3).map((term) => term.term.toLowerCase()).join(", ");
  return `${prefix} ${top || "the main research idea"}.`;
}

function buildVisualModel(summary, sections, terms) {
  const dataCue = selectSentence(sectionText(sections, ["data", "experiments"]), /(data|dataset|benchmark|sample|corpus|records|images|signals)/i);
  return [
    { label: "Problem", text: summary.bullets[0].text },
    { label: "Inputs", text: cleanSentence(dataCue || `The paper works with ${terms.slice(0, 2).map((term) => term.term.toLowerCase()).join(" and ") || "research data"}.`) },
    { label: "Mechanism", text: summary.bullets[1].text },
    { label: "Validation", text: summary.bullets[2].text },
    { label: "Use", text: summary.bullets[3].text },
  ];
}

function buildConcepts(terms, sentences) {
  const used = new Set();
  return terms.slice(0, 9).map((term) => {
    const supporting = sentences.find((sentence) => sentence.toLowerCase().includes(term.raw.split(" ")[0])) || "";
    const type = inferConceptType(term.raw, supporting);
    const why = supporting
      ? shorten(cleanSentence(supporting), 190)
      : `This appears often in the paper and likely anchors the ${type.toLowerCase()} layer of the work.`;
    const normalizedName = term.term.replace(/\b\w/g, (letter) => letter.toUpperCase());
    const label = used.has(normalizedName) ? `${normalizedName} Signal` : normalizedName;
    used.add(normalizedName);
    return {
      label,
      type,
      score: Math.min(99, Math.round(54 + term.score * 4)),
      why,
    };
  });
}

function inferConceptType(term, context) {
  const text = `${term} ${context}`.toLowerCase();
  if (/(dataset|benchmark|record|image|signal|corpus|data)/.test(text)) return "Data";
  if (/(loss|network|model|retrieval|generation|planner|module|algorithm|framework)/.test(text)) return "Method";
  if (/(accuracy|precision|recall|faithfulness|score|metric|evaluation|error)/.test(text)) return "Evaluation";
  if (/(clinical|medical|user|workflow|application|system)/.test(text)) return "Application";
  return "Concept";
}

function buildRoadmap(summary, sections, terms) {
  const topTerms = terms.slice(0, 5).map((term) => term.term.toLowerCase());
  const methodTerm = topTerms.find((term) => /(retrieval|learning|network|model|framework|planner|generation)/.test(term)) || topTerms[0] || "core method";
  const dataTerm = topTerms.find((term) => /(data|dataset|record|benchmark|corpus|image|clinical)/.test(term)) || "paper data";
  const metricTerm = topTerms.find((term) => /(accuracy|precision|faithfulness|score|error|evaluation)/.test(term)) || "paper metrics";
  const hasLimitations = sections.some((section) => section.key === "limitations");

  return [
    {
      title: "Frame the research goal",
      text: "Convert the paper question into a product or experiment objective.",
      tasks: [
        summary.bullets[0].text,
        `Define success around ${metricTerm}.`,
        "Write the assumptions and non-goals before coding.",
      ],
    },
    {
      title: "Recreate the data path",
      text: "Build the smallest reliable path from raw input to model-ready examples.",
      tasks: [
        `Collect or simulate ${dataTerm}.`,
        "Create preprocessing checks for missing, noisy, and duplicated records.",
        "Save a small inspection set for quick manual review.",
      ],
    },
    {
      title: "Implement the core method",
      text: "Start with a readable baseline, then add the paper-specific mechanism.",
      tasks: [
        `Build a baseline around ${methodTerm}.`,
        summary.bullets[1].text,
        "Keep configs, prompts, seeds, and model versions reproducible.",
      ],
    },
    {
      title: "Evaluate against the paper claims",
      text: "Use the same comparison logic before extending the idea.",
      tasks: [
        summary.bullets[2].text,
        `Track ${metricTerm} plus failure examples.`,
        "Compare against a simple baseline and one stronger baseline.",
      ],
    },
    {
      title: "Package the next iteration",
      text: "Turn the experiment into something another person can inspect and run.",
      tasks: [
        hasLimitations ? "Test the listed limitations directly." : "Add a limitation checklist from observed errors.",
        "Create a small demo with input, output, explanation, and citations.",
        summary.bullets[3].text,
      ],
    },
  ];
}

function renderReport(report) {
  els.paperTitle.textContent = report.title;
  els.wordCount.textContent = formatNumber(report.stats.wordTotal);
  els.sectionCount.textContent = formatNumber(report.stats.sectionTotal);
  els.conceptCount.textContent = formatNumber(report.stats.conceptTotal);
  els.exportButton.disabled = false;
  renderFocus(report.terms);
  renderSummary(report);
  renderVisual(report);
  renderConcepts(report);
  renderRoadmap(report);
  els.emptyState.classList.add("hidden");
  els.summaryContent.classList.remove("hidden");
  setActiveView("summary");
  refreshIcons();
}

function renderFocus(terms) {
  els.focusList.innerHTML = terms
    .slice(0, 7)
    .map((term) => `<span class="chip">${escapeHtml(term.term)}</span>`)
    .join("");
}

function renderSummary(report) {
  const sectionMax = Math.max(...report.sections.map((section) => section.wordCount), 1);
  const sectionRows = report.sections
    .slice(0, 8)
    .map((section) => {
      const width = Math.max(7, Math.round((section.wordCount / sectionMax) * 100));
      return `
        <div class="section-row">
          <strong>${escapeHtml(section.label)}</strong>
          <span class="bar"><span style="width:${width}%"></span></span>
          <span>${formatNumber(section.wordCount)}</span>
        </div>
      `;
    })
    .join("");

  els.summaryContent.innerHTML = `
    <div class="summary-hero">
      <article class="result-card lead-card">
        <h2>${escapeHtml(report.title)}</h2>
        <p>${escapeHtml(report.summary.oneLine)}</p>
      </article>
      <article class="result-card">
        <h3>Paper Shape</h3>
        <div class="section-map">${sectionRows || "<p>No clear sections detected.</p>"}</div>
      </article>
    </div>
    <div class="insight-grid">
      <article class="result-card">
        <h3>Executive Summary</h3>
        <ul class="summary-list">
          ${report.summary.bullets
            .map((item, index) => `<li><b>${index + 1}</b><span><strong>${escapeHtml(item.label)}:</strong> ${escapeHtml(item.text)}</span></li>`)
            .join("")}
        </ul>
      </article>
      <article class="result-card">
        <h3>High-Signal Sentences</h3>
        <ul class="summary-list">
          ${report.summary.bestSentences
            .map((sentence, index) => `<li><b>${index + 1}</b><span>${escapeHtml(sentence)}</span></li>`)
            .join("")}
        </ul>
      </article>
    </div>
  `;
}

function renderVisual(report) {
  const flow = report.visual
    .map(
      (item) => `
        <div class="flow-node">
          <strong>${escapeHtml(item.label)}</strong>
          <p>${escapeHtml(shorten(item.text, 150))}</p>
        </div>
      `,
    )
    .join("");

  els.visualContent.innerHTML = `
    <article class="visual-card full">
      <h3>Paper Logic Flow</h3>
      <p>${escapeHtml(report.summary.oneLine)}</p>
      <div class="flow-visual">${flow}</div>
    </article>
    <article class="visual-card">
      <h3>Concept Orbit</h3>
      <div class="concept-orbit">${buildConceptSvg(report.concepts)}</div>
    </article>
    <article class="visual-card">
      <h3>Reading Model</h3>
      <p>${escapeHtml(buildReadingModel(report))}</p>
    </article>
  `;
}

function buildConceptSvg(concepts) {
  const colors = ["#087c72", "#3e56b3", "#e6a700", "#c94f66", "#045b55", "#6b5cc2", "#ad7c00", "#9a3f53"];
  const centerX = 260;
  const centerY = 170;
  const rings = concepts.slice(0, 8).map((concept, index) => {
    const angle = (Math.PI * 2 * index) / Math.max(1, Math.min(concepts.length, 8)) - Math.PI / 2;
    const radius = index % 2 === 0 ? 118 : 92;
    const x = centerX + Math.cos(angle) * radius;
    const y = centerY + Math.sin(angle) * radius;
    const label = concept.label.length > 16 ? `${concept.label.slice(0, 14)}...` : concept.label;
    const color = colors[index % colors.length];
    return `
      <line x1="${centerX}" y1="${centerY}" x2="${x}" y2="${y}" stroke="${color}" stroke-opacity="0.24" stroke-width="2" />
      <circle cx="${x}" cy="${y}" r="${Math.max(28, Math.min(44, concept.score / 2.2))}" fill="${color}" fill-opacity="0.14" stroke="${color}" stroke-width="2" />
      <text x="${x}" y="${y + 4}" text-anchor="middle" font-size="12" font-weight="800" fill="#18201f">${escapeHtml(label)}</text>
    `;
  });

  return `
    <svg viewBox="0 0 520 340" role="img" aria-label="Concept orbit">
      <rect width="520" height="340" rx="8" fill="#fbfcfe" />
      <circle cx="${centerX}" cy="${centerY}" r="56" fill="#dbf5ee" stroke="#087c72" stroke-width="2" />
      <text x="${centerX}" y="${centerY - 4}" text-anchor="middle" font-size="13" font-weight="900" fill="#045b55">Paper</text>
      <text x="${centerX}" y="${centerY + 14}" text-anchor="middle" font-size="11" font-weight="800" fill="#667381">logic</text>
      ${rings.join("")}
    </svg>
  `;
}

function buildReadingModel(report) {
  const conceptNames = report.concepts.slice(0, 4).map((concept) => concept.label.toLowerCase());
  if (!conceptNames.length) {
    return "Read the paper as a chain from problem, to method, to evidence, to practical use.";
  }
  return `Read the paper as a chain: first locate the problem, then inspect ${conceptNames.slice(0, 2).join(" and ")}, then verify the claims through ${conceptNames.slice(2).join(" and ") || "the evaluation section"}.`;
}

function renderConcepts(report) {
  els.conceptContent.innerHTML = report.concepts
    .map(
      (concept) => `
        <article class="concept-card">
          <h3>${escapeHtml(concept.label)}</h3>
          <div class="meta">
            <span>${escapeHtml(concept.type)}</span>
            <span class="score">${concept.score}% signal</span>
          </div>
          <p>${escapeHtml(concept.why)}</p>
        </article>
      `,
    )
    .join("");
}

function renderRoadmap(report) {
  els.roadmapContent.innerHTML = report.roadmap
    .map(
      (step, index) => `
        <article class="roadmap-step">
          <div class="step-index">${index + 1}</div>
          <div>
            <h3>${escapeHtml(step.title)}</h3>
            <p>${escapeHtml(step.text)}</p>
            <ul>
              ${step.tasks.map((task) => `<li>${escapeHtml(shorten(task, 180))}</li>`).join("")}
            </ul>
          </div>
        </article>
      `,
    )
    .join("");
}

function setActiveView(viewName) {
  els.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.view === viewName));
  els.views.forEach((view) => view.classList.toggle("active", view.dataset.viewPanel === viewName));
}

function exportReport() {
  if (!currentReport) return;
  const reportHtml = `
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(currentReport.title)} - Explainer Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 32px; color: #18201f; line-height: 1.55; }
    h1 { color: #045b55; }
    section { border-top: 1px solid #dbe3eb; padding-top: 18px; margin-top: 18px; }
    li { margin-bottom: 8px; }
  </style>
</head>
<body>
  <h1>${escapeHtml(currentReport.title)}</h1>
  <p><strong>Source:</strong> ${escapeHtml(currentReport.sourceName)}</p>
  <section>
    <h2>Summary</h2>
    <ul>${currentReport.summary.bullets.map((item) => `<li><strong>${escapeHtml(item.label)}:</strong> ${escapeHtml(item.text)}</li>`).join("")}</ul>
  </section>
  <section>
    <h2>Key Concepts</h2>
    <ul>${currentReport.concepts.map((concept) => `<li><strong>${escapeHtml(concept.label)}:</strong> ${escapeHtml(concept.why)}</li>`).join("")}</ul>
  </section>
  <section>
    <h2>Implementation Roadmap</h2>
    <ol>${currentReport.roadmap.map((step) => `<li><strong>${escapeHtml(step.title)}</strong><br>${escapeHtml(step.tasks.join(" "))}</li>`).join("")}</ol>
  </section>
</body>
</html>`;

  const blob = new Blob([reportHtml], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${slugify(currentReport.title)}-explainer.html`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  showToast("Report exported as HTML.");
}

function setBusy(message) {
  els.statusPill.textContent = message;
  els.statusPill.style.background = "var(--amber-soft)";
  els.statusPill.style.color = "#6c4d00";
}

function setReady(message) {
  els.statusPill.textContent = message;
  els.statusPill.style.background = "var(--mint)";
  els.statusPill.style.color = "var(--teal-deep)";
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    els.toast.classList.remove("show");
  }, 2600);
}

function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function cleanSentence(sentence) {
  return sentence.replace(/\s+/g, " ").replace(/\s([,.;:!?])/g, "$1").trim();
}

function shorten(text, maxLength) {
  const clean = cleanSentence(text);
  if (clean.length <= maxLength) return clean;
  const clipped = clean.slice(0, maxLength - 1);
  const boundary = Math.max(clipped.lastIndexOf("."), clipped.lastIndexOf(";"), clipped.lastIndexOf(","));
  return `${(boundary > 90 ? clipped.slice(0, boundary) : clipped).trim()}...`;
}

function titleCase(text) {
  return text.replace(/\b[a-z0-9]/g, (letter) => letter.toUpperCase());
}

function formatNumber(number) {
  return new Intl.NumberFormat("en-US").format(number);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 80) || "paper";
}

init();
