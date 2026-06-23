import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase/firebase";
import {
  deleteRemoteWord,
  loadRemoteLearnedWords,
  loadRemoteWords,
  saveRemoteLearnedWords,
  saveRemoteWord,
  // Assuming these are exported from your firebase helper to update/load the API key in user table
  saveRemoteApiKey,
  loadRemoteApiKey,
} from "./firebase/firebase";
import {
  loadCachedLearnedWords,
  loadCachedWords,
  saveCachedLearnedWords,
  saveCachedWords,
} from "./lib/userDb";
import styles from "./App.module.css";
import WordCard from "./components/wordCard";

const appStateStorageKey = "worterhaus.app-state";
const geminiApiKeyStorageKey = "worterhaus.gemini-api-key";
const wordBatchSize = 4;

const ADMIN_UID = "P2xazy0GriXlkjj0QAobkaZ6bxt1";

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

const testDirectionOptions = [
  { value: "du-en", label: "DU-EN" },
  { value: "en-du", label: "EN-DU" },
];

function getLearnedWordNames(wordList) {
  return wordList.filter((word) => word.learned).map((word) => word.word);
}

function applyLearnedWords(words, learnedWordNames) {
  const learnedSet = new Set(learnedWordNames);

  return words.map((word) => ({
    ...word,
    learned: learnedSet.has(word.word),
  }));
}

function App() {
  const navigate = useNavigate();
  const [words, setWords] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncMessage, setSyncMessage] = useState("");
  const [isLoadingWords, setIsLoadingWords] = useState(true);

  const [learnedFilter, setLearnedFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [articleFilter, setArticleFilter] = useState("all");
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [visibleWordCount, setVisibleWordCount] = useState(wordBatchSize);
  const [expandedWords, setExpandedWords] = useState(() => new Set());
  const [testModeEnabled, setTestModeEnabled] = useState(false);
  const [testModeDirection, setTestModeDirection] = useState("du-en");
  const [pressedWordName, setPressedWordName] = useState(null);
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [geminiApiKey, setGeminiApiKey] = useState(
    () => localStorage.getItem(geminiApiKeyStorageKey) ?? "",
  );
  const [aiBusyWord, setAiBusyWord] = useState(null);
  const [aiResults, setAiResults] = useState({});
  const filterPanelRef = useRef(null);
  const loadMoreRef = useRef(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      if (user) {
        setIsAdmin(user.uid === ADMIN_UID);
      } else {
        setIsAdmin(false);
      }
      setAuthReady(true);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
    }

    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!authReady) {
      return;
    }

    if (!currentUser) {
      navigate("/login", { replace: true });
    }
  }, [authReady, currentUser, navigate]);

  useEffect(() => {
    if (!authReady || !currentUser) {
      return undefined;
    }

    let cancelled = false;

    async function loadWordsForSession() {
      setIsLoadingWords(true);
      setSyncMessage(
        isOnline ? "Syncing with Firebase..." : "Using offline cache.",
      );

      try {
        if (isOnline) {
          // Attempt to pull the API key from the user table alongside words
          let remoteKey = "";
          try {
            if (typeof loadRemoteApiKey === "function") {
              remoteKey = await loadRemoteApiKey(currentUser.uid);
              if (remoteKey && !cancelled) {
                setGeminiApiKey(remoteKey);
                localStorage.setItem(geminiApiKeyStorageKey, remoteKey);
              }
            }
          } catch (e) {
            console.error(
              "Failed to sync API key from user database table:",
              e,
            );
          }

          const [remoteWords, remoteLearnedWords, cachedLearnedState] =
            await Promise.all([
              loadRemoteWords(),
              loadRemoteLearnedWords(currentUser.uid),
              loadCachedLearnedWords(currentUser.uid),
            ]);

          const effectiveWords =
            remoteWords.length > 0 ? remoteWords : defaultWords;

          if (remoteWords.length === 0) {
            await Promise.all(defaultWords.map((word) => saveRemoteWord(word)));
          }

          const learnedWordNames = cachedLearnedState.dirty
            ? cachedLearnedState.learnedWords
            : remoteLearnedWords;

          if (cachedLearnedState.dirty) {
            await saveRemoteLearnedWords(currentUser.uid, learnedWordNames);
            await saveCachedLearnedWords(
              currentUser.uid,
              learnedWordNames,
              false,
            );
          } else if (remoteLearnedWords.length > 0) {
            await saveCachedLearnedWords(
              currentUser.uid,
              remoteLearnedWords,
              false,
            );
          } else if (cachedLearnedState.learnedWords.length > 0) {
            await saveRemoteLearnedWords(
              currentUser.uid,
              cachedLearnedState.learnedWords,
            );
            await saveCachedLearnedWords(
              currentUser.uid,
              cachedLearnedState.learnedWords,
              false,
            );
          }

          const mergedWords = applyLearnedWords(
            effectiveWords,
            learnedWordNames,
          );

          await Promise.all([
            saveCachedWords(effectiveWords),
            saveCachedLearnedWords(currentUser.uid, learnedWordNames, false),
          ]);

          if (!cancelled) {
            setWords(mergedWords);
            setSyncMessage("Firebase data loaded.");
          }
        } else {
          const [cachedWords, cachedLearnedState] = await Promise.all([
            loadCachedWords(),
            loadCachedLearnedWords(currentUser.uid),
          ]);

          const effectiveWords =
            cachedWords.length > 0 ? cachedWords : defaultWords;
          const learnedWordNames = cachedLearnedState.learnedWords;

          if (!cancelled) {
            setWords(applyLearnedWords(effectiveWords, learnedWordNames));
            setSyncMessage("Offline mode: loaded from device cache.");
          }
        }
      } catch {
        const [cachedWords, cachedLearnedState] = await Promise.all([
          loadCachedWords(),
          loadCachedLearnedWords(currentUser.uid),
        ]);

        const effectiveWords =
          cachedWords.length > 0 ? cachedWords : defaultWords;

        if (!cancelled) {
          setWords(
            applyLearnedWords(effectiveWords, cachedLearnedState.learnedWords),
          );
          setSyncMessage("Loaded local cache after Firebase sync failed.");
        }
      } finally {
        if (!cancelled) {
          setIsLoadingWords(false);
        }
      }
    }

    void loadWordsForSession();

    return () => {
      cancelled = true;
    };
  }, [authReady, currentUser, isOnline]);

  useEffect(() => {
    localStorage.setItem(
      appStateStorageKey,
      JSON.stringify([...expandedWords]),
    );
  }, [expandedWords]);

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

  async function toggleLearned(wordName) {
    // 1. Snapshot previous state for potential rollback
    const previousWords = [...words];

    // 2. Optimistically update UI state
    const nextWords = words.map((word) =>
      word.word === wordName ? { ...word, learned: !word.learned } : word,
    );
    setWords(nextWords);

    if (!currentUser) return;

    const learnedWordNames = getLearnedWordNames(nextWords);

    try {
      // Direct local cache upgrade
      await saveCachedWords(nextWords);

      if (isOnline) {
        await saveRemoteLearnedWords(currentUser.uid, learnedWordNames);
        await saveCachedLearnedWords(currentUser.uid, learnedWordNames, false);
        setSyncMessage("Changes saved to Firebase.");
      } else {
        await saveCachedLearnedWords(currentUser.uid, learnedWordNames, true);
        setSyncMessage("Saved offline. It will sync when connection returns.");
      }
    } catch (error) {
      console.error("Failed to modify learning state, rolling back...", error);
      setSyncMessage("Failed to update status. Rolled back changes.");
      // Rollback to prior UI configuration on error
      setWords(previousWords);
      // Synchronize indexedDB storage back to safe snapshot
      await saveCachedWords(previousWords);
    }
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

  function resetResultsForTestMode() {
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

  async function deleteWord(wordName) {
    if (!isOnline) {
      setSyncMessage("Editing words requires internet.");
      return;
    }

    // 1. Snapshot previous structural elements for potential rollback
    const previousWords = [...words];
    const previousExpanded = new Set(expandedWords);

    // 2. Optimistic UI update
    const nextWords = words.filter((word) => word.word !== wordName);
    setWords(nextWords);
    setExpandedWords((currentExpandedWords) => {
      const nextExpandedWords = new Set(currentExpandedWords);
      nextExpandedWords.delete(wordName);
      return nextExpandedWords;
    });

    try {
      // 3. Initiate backend call synchronously without pausing UI lifecycle
      await deleteRemoteWord(wordName);
      await saveCachedWords(nextWords);
      setSyncMessage("Word deleted from Firebase.");
    } catch (error) {
      console.error("Deletion failed, rolling back changes...", error);
      setSyncMessage("Delete failed. Reverting changes.");
      // Rollback to baseline on exception response
      setWords(previousWords);
      setExpandedWords(previousExpanded);
    }
  }

  function openApiKeyModal() {
    setApiKeyDraft(geminiApiKey);
    setApiKeyModalOpen(true);
  }

  async function saveApiKey() {
    const trimmedKey = apiKeyDraft.trim();
    setGeminiApiKey(trimmedKey);
    localStorage.setItem(geminiApiKeyStorageKey, trimmedKey);
    setApiKeyModalOpen(false);

    // Persist to user table backend if authenticated and online
    if (currentUser && isOnline) {
      try {
        if (typeof saveRemoteApiKey === "function") {
          await saveRemoteApiKey(currentUser.uid, trimmedKey);
          setSyncMessage("API Key saved to your cloud profile.");
        }
      } catch (e) {
        console.error(
          "Could not backup API key to cloud user record table:",
          e,
        );
      }
    }
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

  function handlePromptPressStart(wordName) {
    setPressedWordName(wordName);
  }

  function handlePromptPressEnd() {
    setPressedWordName(null);
  }

  if (!authReady || isLoadingWords) {
    return (
      <div className={styles.loadingState}>
        <div className={styles.loadingCard}>
          <p className={styles.loadingLabel}>WörterHaus</p>
          <strong>
            {isOnline ? "Loading from Firebase..." : "Loading offline cache..."}
          </strong>
          {syncMessage ? <span>{syncMessage}</span> : null}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <Navbar onOpenApiKeyModal={openApiKeyModal} isAdmin={isAdmin} />

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

          <div className={styles.testModePanel}>
            <div className={styles.testModeToggle}>
              <div
                style={{ display: "flex", alignItems: "center", gap: "12px" }}
              >
                <button
                  type="button"
                  className={`${styles.toggle} ${
                    testModeEnabled ? styles.toggleOn : ""
                  }`}
                  onClick={() => {
                    setTestModeEnabled((prev) => !prev);
                    resetResultsForTestMode();
                  }}
                >
                  <span className={styles.toggleThumb} />
                </button>
                <span>Test mode</span>
              </div>
              {testModeEnabled && (
                <div className={styles.testModeDirections}>
                  {testDirectionOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      className={`${styles.testDirectionButton} ${
                        testModeDirection === option.value
                          ? styles.testDirectionButtonActive
                          : ""
                      }`}
                      onClick={() => {
                        setTestModeDirection(option.value);
                        resetResultsForTestMode();
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className={styles.grid}>
          {visibleWords.map((word) => (
            <WordCard
              key={word.word}
              word={word}
              isAdmin={isAdmin}
              expanded={expandedWords.has(word.word)}
              aiResult={aiResults[word.word] ?? null}
              aiBusy={aiBusyWord === word.word}
              testModeEnabled={testModeEnabled}
              testModeDirection={testModeDirection}
              pressedWordName={pressedWordName}
              onToggleLearned={() => toggleLearned(word.word)}
              onDelete={() => deleteWord(word.word)}
              onGenerateAiExample={() => generateAiResult(word, "example")}
              onGenerateAiMnemonic={() => generateAiResult(word, "mnemonic")}
              onToggleExpanded={() => toggleWordExpanded(word.word)}
              onPronounce={() => pronounceWord(word.word)}
              onPromptPressStart={() => handlePromptPressStart(word.word)}
              onPromptPressEnd={handlePromptPressEnd}
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

function Navbar({ onOpenApiKeyModal, isAdmin }) {
  return (
    <nav className={styles.navbar}>
      <div>
        <h1>WörterHaus</h1>
      </div>

      <div className={styles.navActions}>
        <button
          type="button"
          className={styles.navActionButton}
          onClick={onOpenApiKeyModal}
        >
          Gemini API
        </button>

        {isAdmin && (
          <button
            type="button"
            className={`${styles.navActionButton} ${styles.adminBtn}`}
          >
            Upload
          </button>
        )}
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
          <div className="svg">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M18.5303 9.46967C18.8232 9.76256 18.8232 10.2374 18.5303 10.5303L12.5303 16.5303C12.2374 16.8232 11.7626 16.8232 11.4697 16.5303L5.46967 10.5303C5.17678 10.2374 5.17678 9.76256 5.46967 9.46967C5.76256 9.17678 6.23744 9.17678 6.53033 9.46967L12 14.9393L17.4697 9.46967C17.7626 9.17678 18.2374 9.17678 18.5303 9.46967Z"
                fill="#f1f1f1"
              ></path>
            </svg>
          </div>
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

function ApiKeyModal({ apiKeyDraft, onChangeApiKeyDraft, onClose, onSave }) {
  return (
    <div className={styles.modalBackdrop} onClick={onClose}>
      <div
        className={styles.modalCard}
        onClick={(event) => event.stopPropagation()}
      >
        <h3>Gemini API key</h3>
        <p>
          This cost you no money but it count toward your Gemini API usage
          limits, that's why i can't provide my own key, so if you want to use
          the AI features provide your own or you can contuine using the app
          without the AI features.
        </p>

        <p>
          If you don't have a key yet, you can get one for free from Google AI
          Studio.
        </p>
        <div
          style={{
            padding: "12px",
            borderRadius: "6px",
            fontSize: "13px",
            lineHeight: "1.5em",
            color: "#f1f1f1",
          }}
        >
          <strong>How to get your own API Key:</strong>
          <ol style={{ margin: "6px 0 0 18px", padding: 0 }}>
            <li>
              Go to the
              <a
                href="https://aistudio.google.com/"
                target="_blank"
                rel="noreferrer"
                style={{ color: "#0066cc", decoration: "underline" }}
              >
                Google AI Studio
              </a>
              console.
            </li>
            <li>Sign in using your primary Google Account.</li>
            <li>
              Click the blue <strong>"Get API key"</strong> button in the upper
              left corner.
            </li>
            <li>
              Select <strong>"Create API key"</strong>, assign it to a project
              (or create a new one), and copy the resulting string.
            </li>
            <li>
              Paste the key string directly into the field below and save!
            </li>
          </ol>
        </div>

        <input
          className={styles.modalInput}
          type="password"
          value={apiKeyDraft}
          onChange={(event) => onChangeApiKeyDraft(event.target.value)}
          placeholder="XXXXXXXXXXXXXXXX"
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
