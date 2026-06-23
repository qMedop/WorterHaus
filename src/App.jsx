import { useEffect, useMemo, useRef, useState } from "react";
import styles from "./App.module.css";

const storageKey = "worterhaus.words";
const appStateStorageKey = "worterhaus.app-state";
const geminiApiKeyStorageKey = "worterhaus.gemini-api-key";
const wordBatchSize = 4;

const defaultWords = [
  {
    word: "Apfel",
    article: "der",
    type: "noun",
    translation: "apple",
    plural: "Äpfel",
    compound_breakdown: null,
    conjugations: null,
    notes: "Common masculine food word.",
    category: "food",
    tags: ["food", "fruit", "everyday"],
    learned: false,
  },
  {
    word: "Bäckerei",
    article: "die",
    type: "noun",
    translation: "bakery",
    plural: "Bäckereien",
    compound_breakdown: null,
    conjugations: null,
    notes: "Nouns ending in -ei are always 'die'.",
    category: "places",
    tags: ["shop", "food", "city"],
    learned: false,
  },
  {
    word: "Auto",
    article: "das",
    type: "noun",
    translation: "car",
    plural: "Autos",
    compound_breakdown: null,
    conjugations: null,
    notes: "Simple neuter noun.",
    category: "transport",
    tags: ["travel", "everyday", "vehicle"],
    learned: false,
  },
  {
    word: "Hochhaus",
    article: "das",
    type: "noun",
    translation: "skyscraper",
    plural: "Hochhäuser",
    compound_breakdown: ["hoch", "das Haus"],
    conjugations: null,
    notes: "Compound word: high + house.",
    category: "buildings",
    tags: ["city", "compound", "architecture"],
    learned: false,
  },
  {
    word: "sehen",
    article: null,
    type: "verb",
    translation: "to see",
    plural: null,
    compound_breakdown: null,
    conjugations: {
      ich: "sehe",
      du: "siehst",
      er: "sieht",
      sie: "sieht",
      es: "sieht",
      wir: "sehen",
      Sie_sie: "sehen",
    },
    notes: "Irregular verb with an e-to-ie vowel change.",
    category: "actions",
    tags: ["irregular", "everyday", "sense"],
    learned: false,
  },
];

const learnedFilterOptions = [
  { value: "all", label: "All" },
  { value: "learned", label: "Learned" },
  { value: "notLearned", label: "Not learned" },
];

const typeFilterOptions = [
  { value: "all", label: "All" },
  { value: "noun", label: "Nouns" },
  { value: "verb", label: "Verbs" },
  { value: "other", label: "Other" },
];

const articleFilterOptions = [
  { value: "all", label: "All" },
  { value: "der", label: "der" },
  { value: "die", label: "die" },
  { value: "das", label: "das" },
];

function App() {
  const [words, setWords] = useState(() => {
    const storedWords = localStorage.getItem(storageKey);

    if (!storedWords) {
      return defaultWords;
    }

    try {
      const parsedWords = JSON.parse(storedWords);

      if (!Array.isArray(parsedWords)) {
        return defaultWords;
      }

      return defaultWords.map((defaultWord) => {
        const storedWord = parsedWords.find(
          (item) => item.word === defaultWord.word,
        );

        return storedWord ? { ...defaultWord, ...storedWord } : defaultWord;
      });
    } catch {
      return defaultWords;
    }
  });

  const [learnedFilter, setLearnedFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [articleFilter, setArticleFilter] = useState("all");
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [visibleWordCount, setVisibleWordCount] = useState(wordBatchSize);
  const [expandedWords, setExpandedWords] = useState(() => new Set());
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [geminiApiKey, setGeminiApiKey] = useState(
    () => localStorage.getItem(geminiApiKeyStorageKey) ?? "",
  );
  const [aiBusyWord, setAiBusyWord] = useState(null);
  const [aiResults, setAiResults] = useState({});
  const filterPanelRef = useRef(null);
  const loadMoreRef = useRef(null);
  const pronunciationAudioRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(words));
  }, [words]);

  useEffect(() => {
    localStorage.setItem(
      appStateStorageKey,
      JSON.stringify([...expandedWords]),
    );
  }, [expandedWords]);

  useEffect(() => {
    if (geminiApiKey) {
      localStorage.setItem(geminiApiKeyStorageKey, geminiApiKey);
    }
  }, [geminiApiKey]);

  const categories = useMemo(
    () => [...new Set(words.map((word) => word.category).filter(Boolean))],
    [words],
  );

  const tags = useMemo(
    () => [...new Set(words.flatMap((word) => word.tags ?? []))],
    [words],
  );

  const scopeWords = useMemo(() => {
    return words.filter((word) => {
      const matchesType =
        typeFilter === "all"
          ? true
          : typeFilter === "other"
            ? word.type !== "noun" && word.type !== "verb"
            : word.type === typeFilter;

      const matchesArticle =
        articleFilter === "all" ? true : word.article === articleFilter;

      const matchesCategories =
        selectedCategories.length === 0
          ? true
          : selectedCategories.includes(word.category);

      const matchesTags =
        selectedTags.length === 0
          ? true
          : selectedTags.some((tag) => word.tags?.includes(tag));

      return matchesType && matchesArticle && matchesCategories && matchesTags;
    });
  }, [articleFilter, selectedCategories, selectedTags, typeFilter, words]);

  const filteredWords = useMemo(() => {
    return scopeWords.filter((word) => {
      if (learnedFilter === "learned") {
        return word.learned;
      }

      if (learnedFilter === "notLearned") {
        return !word.learned;
      }

      return true;
    });
  }, [learnedFilter, scopeWords]);

  const visibleWords = useMemo(
    () => filteredWords.slice(0, visibleWordCount),
    [filteredWords, visibleWordCount],
  );

  const hasMoreWords = visibleWordCount < filteredWords.length;

  useEffect(() => {
    if (!openDropdown) {
      return undefined;
    }

    function handlePointerDown(event) {
      if (
        filterPanelRef.current &&
        !filterPanelRef.current.contains(event.target)
      ) {
        setOpenDropdown(null);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [openDropdown]);

  useEffect(() => {
    const sentinel = loadMoreRef.current;

    if (!sentinel || !hasMoreWords) {
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleWordCount((currentCount) =>
            Math.min(currentCount + wordBatchSize, filteredWords.length),
          );
        }
      },
      { rootMargin: "240px 0px" },
    );

    observer.observe(sentinel);

    return () => {
      observer.disconnect();
    };
  }, [filteredWords.length, hasMoreWords]);

  const learnedCount = scopeWords.filter((word) => word.learned).length;
  const totalCount = scopeWords.length;
  const progressPercent =
    totalCount > 0 ? Math.round((learnedCount / totalCount) * 100) : 0;

  function toggleLearned(wordName) {
    setWords((currentWords) =>
      currentWords.map((word) =>
        word.word === wordName ? { ...word, learned: !word.learned } : word,
      ),
    );
  }

  function toggleSelectedValue(value, setter) {
    setter((currentValues) =>
      currentValues.includes(value)
        ? currentValues.filter((currentValue) => currentValue !== value)
        : [...currentValues, value],
    );
  }

  function setLearnedFilterValue(value) {
    setLearnedFilter(value);
    setVisibleWordCount(wordBatchSize);
    setOpenDropdown(null);
    setExpandedWords(new Set());
  }

  function setTypeFilterValue(value) {
    setTypeFilter(value);
    setVisibleWordCount(wordBatchSize);
    setOpenDropdown(null);
    setExpandedWords(new Set());
  }

  function setArticleFilterValue(value) {
    setArticleFilter(value);
    setVisibleWordCount(wordBatchSize);
    setOpenDropdown(null);
    setExpandedWords(new Set());
  }

  function toggleCategoryValue(value) {
    toggleSelectedValue(value, setSelectedCategories);
    setVisibleWordCount(wordBatchSize);
    setOpenDropdown(null);
    setExpandedWords(new Set());
  }

  function toggleTagValue(value) {
    toggleSelectedValue(value, setSelectedTags);
    setVisibleWordCount(wordBatchSize);
    setOpenDropdown(null);
    setExpandedWords(new Set());
  }

  function toggleWordExpanded(wordName) {
    setExpandedWords((currentExpandedWords) => {
      const nextExpandedWords = new Set(currentExpandedWords);

      if (nextExpandedWords.has(wordName)) {
        nextExpandedWords.delete(wordName);
      } else {
        nextExpandedWords.add(wordName);
      }

      return nextExpandedWords;
    });
  }

  function deleteWord(wordName) {
    setWords((currentWords) =>
      currentWords.filter((word) => word.word !== wordName),
    );
    setExpandedWords((currentExpandedWords) => {
      const nextExpandedWords = new Set(currentExpandedWords);
      nextExpandedWords.delete(wordName);
      return nextExpandedWords;
    });
  }

  function openApiKeyModal() {
    setApiKeyDraft(geminiApiKey);
    setApiKeyModalOpen(true);
  }

  function saveApiKey() {
    setGeminiApiKey(apiKeyDraft.trim());
    setApiKeyModalOpen(false);
  }

  function requireApiKey() {
    if (!geminiApiKey) {
      openApiKeyModal();
      return false;
    }

    return true;
  }

  function generateAiResult(word, mode) {
    if (!requireApiKey()) {
      return;
    }

    setAiBusyWord(word.word);

    window.setTimeout(() => {
      const resultText =
        mode === "example"
          ? `Example: Ich sehe den ${word.word.toLowerCase()} jeden Tag.`
          : `Mnemonic: ${word.word} helps you remember ${word.translation}.`;

      setAiResults((currentResults) => ({
        ...currentResults,
        [word.word]: {
          ...(currentResults[word.word] ?? {}),
          [mode]: resultText,
        },
      }));
      setAiBusyWord(null);
    }, 700);
  }

  function getConjugation(word, key) {
    if (!word.conjugations) {
      return "—";
    }

    return word.conjugations[key] ?? "—";
  }

  function pronounceWord(word) {
    const audio = new Audio(`/api/pronounce?word=${encodeURIComponent(word)}`);

    audio.play();
  }

  return (
    <div className={styles.page}>
      <Navbar onOpenApiKeyModal={openApiKeyModal} />

      <main className={styles.main}>
        <section className={styles.hero}>
          <ProgressBar
            learnedCount={learnedCount}
            totalCount={totalCount}
            progressPercent={progressPercent}
          />
        </section>

        <section ref={filterPanelRef} className={styles.panel}>
          <div className={styles.filterGrid}>
            <DropdownFilter
              open={openDropdown === "learned"}
              onToggle={() =>
                setOpenDropdown((current) =>
                  current === "learned" ? null : "learned",
                )
              }
              title="Learned status"
              summary={
                learnedFilterOptions.find(
                  (option) => option.value === learnedFilter,
                )?.label ?? "All"
              }
            >
              {learnedFilterOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`${styles.dropdownOption} ${
                    learnedFilter === option.value
                      ? styles.dropdownOptionActive
                      : ""
                  }`}
                  onClick={() => setLearnedFilterValue(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </DropdownFilter>

            <DropdownFilter
              open={openDropdown === "type"}
              onToggle={() =>
                setOpenDropdown((current) =>
                  current === "type" ? null : "type",
                )
              }
              title="Word type"
              summary={
                typeFilterOptions.find((option) => option.value === typeFilter)
                  ?.label ?? "All"
              }
            >
              {typeFilterOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`${styles.dropdownOption} ${
                    typeFilter === option.value
                      ? styles.dropdownOptionActive
                      : ""
                  }`}
                  onClick={() => setTypeFilterValue(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </DropdownFilter>

            <DropdownFilter
              open={openDropdown === "article"}
              onToggle={() =>
                setOpenDropdown((current) =>
                  current === "article" ? null : "article",
                )
              }
              title="Article"
              summary={
                articleFilterOptions.find(
                  (option) => option.value === articleFilter,
                )?.label ?? "All"
              }
            >
              {articleFilterOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`${styles.dropdownOption} ${
                    articleFilter === option.value
                      ? styles.dropdownOptionActive
                      : ""
                  }`}
                  onClick={() => setArticleFilterValue(option.value)}
                >
                  {option.label}
                </button>
              ))}
            </DropdownFilter>

            <DropdownFilter
              open={openDropdown === "categories"}
              onToggle={() =>
                setOpenDropdown((current) =>
                  current === "categories" ? null : "categories",
                )
              }
              title="Categories"
              summary={
                selectedCategories.length > 0
                  ? `${selectedCategories.length} selected`
                  : "All"
              }
              multi
            >
              {categories.map((category) => (
                <label key={category} className={styles.dropdownCheckRow}>
                  <input
                    type="checkbox"
                    checked={selectedCategories.includes(category)}
                    onChange={() => toggleCategoryValue(category)}
                  />
                  <span>{category}</span>
                </label>
              ))}
            </DropdownFilter>

            <DropdownFilter
              open={openDropdown === "tags"}
              onToggle={() =>
                setOpenDropdown((current) =>
                  current === "tags" ? null : "tags",
                )
              }
              title="Tags"
              summary={
                selectedTags.length > 0
                  ? `${selectedTags.length} selected`
                  : "All"
              }
              multi
            >
              {tags.map((tag) => (
                <label key={tag} className={styles.dropdownCheckRow}>
                  <input
                    type="checkbox"
                    checked={selectedTags.includes(tag)}
                    onChange={() => toggleTagValue(tag)}
                  />
                  <span>{tag}</span>
                </label>
              ))}
            </DropdownFilter>
          </div>
        </section>

        <section className={styles.grid}>
          {visibleWords.map((word) => (
            <WordCard
              key={word.word}
              word={word}
              expanded={expandedWords.has(word.word)}
              aiResult={aiResults[word.word] ?? null}
              aiBusy={aiBusyWord === word.word}
              onToggleLearned={() => toggleLearned(word.word)}
              onDelete={() => deleteWord(word.word)}
              onGenerateAiExample={() => generateAiResult(word, "example")}
              onGenerateAiMnemonic={() => generateAiResult(word, "mnemonic")}
              onToggleExpanded={() => toggleWordExpanded(word.word)}
              onPronounce={() => pronounceWord(word.word)}
              getConjugation={getConjugation}
            />
          ))}
        </section>

        <div ref={loadMoreRef} className={styles.loadMoreSentinel}>
          {hasMoreWords ? <span>Loading more words...</span> : null}
        </div>
      </main>

      {apiKeyModalOpen ? (
        <ApiKeyModal
          apiKeyDraft={apiKeyDraft}
          onChangeApiKeyDraft={setApiKeyDraft}
          onClose={() => setApiKeyModalOpen(false)}
          onSave={saveApiKey}
        />
      ) : null}
    </div>
  );
}

function Navbar({ onOpenApiKeyModal }) {
  return (
    <nav className={styles.navbar}>
      <div>
        <h1>WörterHaus</h1>
        <p>Build your German vocabulary step by step.</p>
      </div>

      <div className={styles.navActions}>
        <button
          type="button"
          className={styles.navActionButton}
          onClick={onOpenApiKeyModal}
        >
          Gemini API
        </button>
        <button type="button" className={styles.navActionButton}>
          Library
        </button>
      </div>
    </nav>
  );
}

function ProgressBar({ learnedCount, totalCount, progressPercent }) {
  return (
    <div className={styles.progressCard}>
      <div className={styles.progressHeader}>
        <div>
          <p className={styles.progressLabel}>Scope progress</p>
          <strong>
            {learnedCount} of {totalCount} learned
          </strong>
        </div>
        <span>{progressPercent}%</span>
      </div>

      <div className={styles.progressTrack} aria-label="Learning progress">
        <div
          className={styles.progressFill}
          style={{ width: `${progressPercent}%` }}
        />
      </div>
    </div>
  );
}

function DropdownFilter({
  title,
  summary,
  children,
  open,
  onToggle,
  multi = false,
}) {
  return (
    <div className={`${styles.dropdown} ${open ? styles.dropdownOpen : ""}`}>
      <button
        type="button"
        className={styles.dropdownSummary}
        onClick={onToggle}
      >
        <span className={styles.dropdownSummaryText}>
          <strong>{title}</strong>
          <em>{summary}</em>
        </span>
        <span className={styles.dropdownCaret} aria-hidden="true">
          ▾
        </span>
      </button>

      <div className={styles.dropdownMenuWrap} aria-hidden={!open}>
        <div
          className={`${styles.dropdownMenu} ${multi ? styles.dropdownMenuMulti : ""}`}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function WordCard({
  word,
  expanded,
  aiResult,
  aiBusy,
  onToggleLearned,
  onDelete,
  onGenerateAiExample,
  onGenerateAiMnemonic,
  onToggleExpanded,
  onPronounce,
  getConjugation,
}) {
  const articleClass = word.article ? styles[word.article] : styles.neutral;

  return (
    <article
      className={`${styles.card} ${expanded ? styles.cardExpanded : ""} ${word.learned ? styles.cardLearned : ""}`}
    >
      <div className={styles.cardHeader}>
        <button
          type="button"
          className={styles.cardHeaderMain}
          onClick={onToggleExpanded}
        >
          <span className={`${styles.articlePill} ${articleClass}`}>
            {word.article ?? "—"}
          </span>
          <div className={styles.cardTitleBlock}>
            <div className={styles.cardTitleLine}>
              <h3>{word.word}</h3>
              <span className={styles.cardArrow} aria-hidden="true">
                ▾
              </span>
            </div>
            <p>{word.translation}</p>
          </div>
        </button>

        <button
          type="button"
          className={styles.soundButton}
          onClick={onPronounce}
          aria-label={`Pronounce ${word.word}`}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M11 5L6.5 9H3v6h3.5L11 19V5Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path
              d="M15 9.5C16.1 10.2 16.8 11.3 16.8 12.5C16.8 13.7 16.1 14.8 15 15.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
            <path
              d="M17.8 7C19.5 8.2 20.5 10.2 20.5 12.5C20.5 14.8 19.5 16.8 17.8 18"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </div>

      <div className={styles.cardActions}>
        <div className={styles.actionGroup}>
          <button
            type="button"
            className={styles.iconButton}
            onClick={onToggleLearned}
            aria-label={word.learned ? "Mark not learned" : "Mark learned"}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M5 12.5L9.2 16.7L19 7"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          <button
            type="button"
            className={styles.iconButton}
            onClick={onDelete}
            aria-label={`Delete ${word.word}`}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M4 7H20"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
              <path
                d="M9 7V5.8C9 5.31 9.31 5 9.8 5H14.2C14.69 5 15 5.31 15 5.8V7"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
              <path
                d="M8 7L8.7 19.1C8.74 19.74 9.26 20.25 9.9 20.25H14.1C14.74 20.25 15.26 19.74 15.3 19.1L16 7"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
      </div>

      <div
        className={`${styles.cardBody} ${expanded ? styles.cardBodyOpen : ""}`}
      >
        {word.plural ? (
          <div className={styles.fullWidthBlock}>
            <span className={styles.blockLabel}>Plural</span>
            <strong>{word.plural}</strong>
          </div>
        ) : null}

        {word.compound_breakdown ? (
          <div className={styles.fullWidthBlock}>
            <span className={styles.blockLabel}>Compound</span>
            <strong>{word.compound_breakdown.join(" + ")}</strong>
          </div>
        ) : null}

        {word.type === "verb" && word.conjugations ? (
          <div className={styles.detailBox}>
            <span>Conjugations</span>
            <div className={styles.conjugationList}>
              {[
                ["ich", getConjugation(word, "ich")],
                ["du", getConjugation(word, "du")],
                ["er/sie/es", getConjugation(word, "er")],
                ["wir", getConjugation(word, "wir")],
                ["Sie/sie", getConjugation(word, "Sie_sie")],
              ].map(([person, form]) => (
                <div key={person} className={styles.conjugationRow}>
                  <strong>{person}</strong>
                  <span>{form ?? "—"}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className={styles.aiSection}>
          <div className={styles.aiHeader}>
            <span>AI section</span>
            <em>{aiResult ? "Ready" : "Tap to generate"}</em>
          </div>

          <div className={styles.aiButtons}>
            <button
              type="button"
              className={styles.aiButton}
              onClick={onGenerateAiExample}
            >
              Generate example
            </button>
            <button
              type="button"
              className={styles.aiButton}
              onClick={onGenerateAiMnemonic}
            >
              Create mnemonic
            </button>
          </div>

          {aiBusy ? (
            <span className={styles.emptyState}>Generating...</span>
          ) : null}
          {aiResult?.example ? (
            <p className={styles.aiResult}>{aiResult.example}</p>
          ) : null}
          {aiResult?.mnemonic ? (
            <p className={styles.aiResult}>{aiResult.mnemonic}</p>
          ) : null}
        </div>

        {expanded ? <p className={styles.notes}>{word.notes}</p> : null}
      </div>
    </article>
  );
}

function ApiKeyModal({ apiKeyDraft, onChangeApiKeyDraft, onClose, onSave }) {
  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div
        className={styles.modalCard}
        onClick={(event) => event.stopPropagation()}
      >
        <h3>Gemini API key</h3>
        <p>
          Paste your Gemini API key here. It stays on this device in local
          storage.
        </p>
        <input
          className={styles.modalInput}
          type="password"
          value={apiKeyDraft}
          onChange={(event) => onChangeApiKeyDraft(event.target.value)}
          placeholder="AIza..."
        />
        <div className={styles.modalActions}>
          <button
            type="button"
            className={styles.modalSecondaryButton}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.modalPrimaryButton}
            onClick={onSave}
          >
            Save key
          </button>
        </div>
      </div>
    </div>
  );
}

export default App;
