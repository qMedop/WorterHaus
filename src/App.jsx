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
import UploadWords from "./components/uploadWords";

const appStateStorageKey = "worterhaus.app-state";
const wordBatchSize = 8;

const ADMIN_UID = "P2xazy0GriXlkjj0QAobkaZ6bxt1";

const defaultWords = [];

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

const sortMethodOptions = [
  { value: "az", label: "A-Z Alphabetical" },
  { value: "der", label: "der Nouns First" },
  { value: "die", label: "die Nouns First" },
  { value: "das", label: "das Nouns First" },
  { value: "random", label: "🎲 Mix Randomly" },
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

  // Filter States
  const [learnedFilter, setLearnedFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [articleFilter, setArticleFilter] = useState("all");
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedTags, setSelectedTags] = useState([]);
  const [openDropdown, setOpenDropdown] = useState(null);

  // Search & Sorting States
  const [searchQuery, setSearchQuery] = useState("");
  const [sortMethod, setSortMethod] = useState("az");
  const [randomSeed, setRandomSeed] = useState(0);

  const [visibleWordCount, setVisibleWordCount] = useState(wordBatchSize);
  const [expandedWords, setExpandedWords] = useState(() => new Set());
  const [testModeEnabled, setTestModeEnabled] = useState(false);
  const [testModeDirection, setTestModeDirection] = useState("du-en");
  const [apiKeyModalOpen, setApiKeyModalOpen] = useState(false);
  const [uploadModule, setUploadModule] = useState(false);
  const [apiKeyDraft, setApiKeyDraft] = useState("");
  const [geminiApiKey, setGeminiApiKey] = useState();

  const filterPanelRef = useRef(null);
  const loadMoreRef = useRef(null);

  // Firebase Auth Verification Hook with Offline Fallback Mode
  useEffect(() => {
    const checkIfMobile = () => {
      const mobileRegex =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent,
        );
      const isMacTouch =
        navigator.userAgent.includes("Mac") && navigator.maxTouchPoints > 1;
      const mobileDeviceDetected = mobileRegex || isMacTouch;

      if (mobileDeviceDetected) {
        document.body.classList.add("mobile");
      } else {
        document.body.classList.remove("mobile");
      }
    };

    checkIfMobile();
    window.addEventListener("resize", checkIfMobile);
    return () => window.removeEventListener("resize", checkIfMobile);
  }, []);
  useEffect(() => {
    let authTimer;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (authTimer) clearTimeout(authTimer);
      setCurrentUser(user);
      setIsAdmin(user ? user.uid === ADMIN_UID : false);
      setAuthReady(true);
    });

    if (!navigator.onLine) {
      authTimer = setTimeout(() => {
        console.warn(
          "Firebase Auth timed out offline. Forcing fallback lifecycle.",
        );
        setAuthReady(true);
      }, 1500);
    }

    return () => {
      unsubscribe();
      if (authTimer) clearTimeout(authTimer);
    };
  }, []);

  // Window Connection Network Listener
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

  // Non-Auth User Redirect Block
  useEffect(() => {
    if (!authReady) return;
    if (!currentUser) navigate("/login", { replace: true });
  }, [authReady, currentUser, navigate]);

  // Unified Local Storage Cache & Database Fetch Sync Loop
  useEffect(() => {
    if (!authReady || !currentUser) return undefined;
    let cancelled = false;

    async function loadWordsForSession() {
      setIsLoadingWords(true);
      setSyncMessage(
        isOnline ? "Syncing with Firebase..." : "Using offline cache.",
      );

      try {
        if (isOnline) {
          let remoteKey = "";
          try {
            if (typeof loadRemoteApiKey === "function") {
              remoteKey = await loadRemoteApiKey(currentUser.uid);
              if (remoteKey && !cancelled) setGeminiApiKey(remoteKey);
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
          if (!cancelled) {
            setWords(
              applyLearnedWords(
                effectiveWords,
                cachedLearnedState.learnedWords,
              ),
            );
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
        if (!cancelled) setIsLoadingWords(false);
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

  // Extraction logic now sorts string parameters alphabetically right away
  const categories = useMemo(
    () =>
      [...new Set(words.map((word) => word.category).filter(Boolean))].sort(
        (a, b) => a.localeCompare(b, "de"),
      ),
    [words],
  );
  const tags = useMemo(
    () =>
      [...new Set(words.flatMap((word) => word.tags ?? []))].sort((a, b) =>
        a.localeCompare(b, "de"),
      ),
    [words],
  );

  // --- Combined Search, Filter, and Sorting Pipeline ---
  const filteredAndSortedWords = useMemo(() => {
    const targetScope = words.filter((word) => {
      const matchesSearch =
        searchQuery.trim() === "" ||
        word.word.toLowerCase().includes(searchQuery.toLowerCase()) ||
        word.translation.toLowerCase().includes(searchQuery.toLowerCase());

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
          : selectedTags.some((t) => word.tags?.includes(t));

      const matchesLearned =
        learnedFilter === "all"
          ? true
          : learnedFilter === "learned"
            ? word.learned
            : !word.learned;

      return (
        matchesSearch &&
        matchesType &&
        matchesArticle &&
        matchesCategories &&
        matchesTags &&
        matchesLearned
      );
    });

    const sorted = [...targetScope];
    if (sortMethod === "az") {
      sorted.sort((a, b) => a.word.localeCompare(b.word, "de"));
    } else if (["der", "die", "das"].includes(sortMethod)) {
      sorted.sort((a, b) => {
        if (a.article === sortMethod && b.article !== sortMethod) return -1;
        if (a.article !== sortMethod && b.article === sortMethod) return 1;
        return a.word.localeCompare(b.word, "de");
      });
    } else if (sortMethod === "random") {
      let currentSeed = randomSeed;
      const pseudorandom = () => {
        const x = Math.sin(currentSeed++) * 10000;
        return x - Math.floor(x);
      };
      sorted.sort(() => pseudorandom() - 0.5);
    }

    return sorted;
  }, [
    words,
    searchQuery,
    typeFilter,
    articleFilter,
    selectedCategories,
    selectedTags,
    learnedFilter,
    sortMethod,
    randomSeed,
  ]);

  const visibleWords = useMemo(
    () => filteredAndSortedWords.slice(0, visibleWordCount),
    [filteredAndSortedWords, visibleWordCount],
  );
  const hasMoreWords = visibleWordCount < filteredAndSortedWords.length;

  // Dropdown Auto Close Logic on Outside Interactions
  useEffect(() => {
    if (!openDropdown) return undefined;
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

  // Infinite Scroll Observer Trigger
  useEffect(() => {
    const sentinel = loadMoreRef.current;
    if (!sentinel || !hasMoreWords) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleWordCount((currentCount) =>
            Math.min(
              currentCount + wordBatchSize,
              filteredAndSortedWords.length,
            ),
          );
        }
      },
      { rootMargin: "240px 0px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [filteredAndSortedWords.length, hasMoreWords]);

  const learnedCount = words.filter((word) => word.learned).length;
  const totalCount = words.length;
  const progressPercent =
    totalCount > 0 ? Math.round((learnedCount / totalCount) * 100) : 0;

  // Sorting Mode Controller
  function handleSortChange(method) {
    if (method === "random") {
      setRandomSeed(Math.random());
    }
    setSortMethod(method);
    resetViewParameters();
  }

  function resetViewParameters() {
    setVisibleWordCount(wordBatchSize);
    setExpandedWords(new Set());
  }

  async function toggleLearned(wordName) {
    const previousWords = [...words];
    const nextWords = words.map((word) =>
      word.word === wordName ? { ...word, learned: !word.learned } : word,
    );
    setWords(nextWords);

    if (!currentUser) return;
    const learnedWordNames = getLearnedWordNames(nextWords);

    try {
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
      setSyncMessage("Failed to update status. Rolled back changes.");
      setWords(previousWords);
      await saveCachedWords(previousWords);
    }
  }

  function toggleSelectedValue(value, setter) {
    setter((currentValues) =>
      currentValues.includes(value)
        ? currentValues.filter((v) => v !== value)
        : [...currentValues, value],
    );
    resetViewParameters();
  }

  function toggleWordExpanded(wordName) {
    setExpandedWords((current) => {
      const next = new Set(current);
      if (next.has(wordName)) next.delete(wordName);
      else next.add(wordName);
      return next;
    });
  }

  async function deleteWord(wordName) {
    if (!isOnline) {
      setSyncMessage("Editing words requires internet.");
      return;
    }
    const previousWords = [...words];
    const previousExpanded = new Set(expandedWords);

    const nextWords = words.filter((word) => word.word !== wordName);
    setWords(nextWords);
    setExpandedWords((current) => {
      const next = new Set(current);
      next.delete(wordName);
      return next;
    });

    try {
      await deleteRemoteWord(wordName);
      await saveCachedWords(nextWords);
      setSyncMessage("Word deleted from Firebase.");
    } catch (error) {
      setWords(previousWords);
      setExpandedWords(previousExpanded);
    }
  }

  async function handleUploadSuccess(newWordsPayload) {
    if (!isOnline) {
      setSyncMessage(
        "Uploading new datasets requires an active internet connection.",
      );
      return;
    }
    const previousWords = [...words];
    const cleanCurrentWords = words.filter(
      (cw) => !newWordsPayload.some((nw) => nw.word === cw.word),
    );
    const combinedNextWords = [...cleanCurrentWords, ...newWordsPayload];

    setWords(combinedNextWords);
    try {
      await saveCachedWords(combinedNextWords);
      await Promise.all(
        newWordsPayload.map((wordData) => saveRemoteWord(wordData)),
      );
      setSyncMessage(
        `Successfully synchronized ${newWordsPayload.length} words.`,
      );
    } catch (error) {
      setWords(previousWords);
      await saveCachedWords(previousWords);
    }
  }

  function openApiKeyModal() {
    setApiKeyDraft(geminiApiKey);
    setApiKeyModalOpen(true);
  }

  async function saveApiKey() {
    const trimmedKey = apiKeyDraft.trim();
    setGeminiApiKey(trimmedKey);
    setApiKeyModalOpen(false);
    if (currentUser && isOnline) {
      try {
        if (typeof saveRemoteApiKey === "function") {
          await saveRemoteApiKey(currentUser.uid, trimmedKey);
          setSyncMessage("API Key saved to your cloud profile.");
        }
      } catch (e) {
        console.error(e);
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

  function getConjugation(word, key) {
    return word.conjugations?.[key] ?? "—";
  }

  function pronounceWord(word) {
    new Audio(`/api/pronounce?word=${encodeURIComponent(word)}`).play();
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
      <Navbar
        onOpenApiKeyModal={openApiKeyModal}
        isAdmin={isAdmin}
        setUploadModule={setUploadModule}
      />

      <main className={styles.main}>
        <section className={styles.hero}>
          <ProgressBar
            learnedCount={learnedCount}
            totalCount={totalCount}
            progressPercent={progressPercent}
          />
        </section>

        {/* --- Global Input Search Bar Layer --- */}
        <section ref={filterPanelRef} className={styles.panel}>
          <section className={styles.searchBarSection}>
            <div className={styles.searchBarWrapper}>
              <svg
                className={styles.searchIconSvg}
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M15.7955 15.8111L21 21M18 10.5C18 14.6421 14.6421 18 10.5 18C6.35786 18 3 14.6421 3 10.5C3 6.35786 6.35786 3 10.5 3C14.6421 3 18 6.35786 18 10.5Z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <input
                type="text"
                placeholder="Search vocabulary terms or translations..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  resetViewParameters();
                }}
                className={styles.globalSearchInputField}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    resetViewParameters();
                  }}
                  className={styles.clearSearchFieldBtn}
                >
                  ×
                </button>
              )}
            </div>
          </section>

          {/* Unified Filters Row including the newly added sorting dropdown layout */}
          <FilterGrid
            openDropdown={openDropdown}
            setOpenDropdown={setOpenDropdown}
            learnedFilter={learnedFilter}
            setLearnedFilter={setLearnedFilter}
            typeFilter={typeFilter}
            setTypeFilter={setTypeFilter}
            articleFilter={articleFilter}
            setArticleFilter={setArticleFilter}
            selectedCategories={selectedCategories}
            setSelectedCategories={setSelectedCategories}
            selectedTags={selectedTags}
            setSelectedTags={setSelectedTags}
            categories={categories}
            tags={tags}
            sortMethod={sortMethod}
            handleSortChange={handleSortChange}
            toggleSelectedValue={toggleSelectedValue}
            resetViewParameters={resetViewParameters}
          />

          <div className={styles.testModePanel}>
            <div className={styles.testModeToggle}>
              <div
                style={{ display: "flex", alignItems: "center", gap: "12px" }}
              >
                <button
                  type="button"
                  className={`${styles.toggle} ${testModeEnabled ? styles.toggleOn : ""}`}
                  onClick={() => {
                    setTestModeEnabled((p) => !p);
                    resetViewParameters();
                  }}
                >
                  <span className={styles.toggleThumb} />
                </button>
                <span>Test mode</span>
              </div>
              {testModeEnabled && (
                <div className={styles.testModeDirections}>
                  {testDirectionOptions.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      className={`${styles.testDirectionButton} ${testModeDirection === o.value ? styles.testDirectionButtonActive : ""}`}
                      onClick={() => {
                        setTestModeDirection(o.value);
                        resetViewParameters();
                      }}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* --- Primary Output Word Cards Grid --- */}
        <section className={styles.grid}>
          {visibleWords.map((word) => (
            <WordCard
              key={word.word}
              word={word}
              isAdmin={isAdmin}
              expanded={expandedWords.has(word.word)}
              requireApiKey={requireApiKey}
              testModeEnabled={testModeEnabled}
              testModeDirection={testModeDirection}
              onToggleLearned={() => toggleLearned(word.word)}
              onDelete={() => deleteWord(word.word)}
              onToggleExpanded={() => toggleWordExpanded(word.word)}
              onPronounce={pronounceWord}
              getConjugation={getConjugation}
              geminiApiKey={geminiApiKey}
            />
          ))}
          {visibleWords.length === 0 && (
            <div className={styles.emptyResultsCatchBlock}>
              <p>
                No German vocabulary entries matched your active search query
                filter rules.
              </p>
            </div>
          )}
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
      {uploadModule ? (
        <UploadWords
          currentWords={words}
          onUploadSuccess={handleUploadSuccess}
          onClose={() => setUploadModule(false)}
        />
      ) : null}
    </div>
  );
}

function Navbar({ onOpenApiKeyModal, isAdmin, setUploadModule }) {
  return (
    <nav className={styles.navbar}>
      <div>
        <h1>WörterHaus</h1>
      </div>
      <div className={styles.navActions}>
        <button
          style={{ padding: "0.65rem", borderRadius: "50%" }}
          type="button"
          className={styles.navActionButton}
          onClick={onOpenApiKeyModal}
        >
          <div className="svg" style={{ width: "24px", height: "24px" }}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M12 3C12 7.97056 16.0294 12 21 12C16.0294 12 12 16.0294 12 21C12 16.0294 7.97056 12 3 12C7.97056 12 12 7.97056 12 3Z"
                stroke="#f1f1f1"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              ></path>
            </svg>
          </div>
        </button>
        {isAdmin && (
          <button
            style={{ padding: "0.65rem", borderRadius: "50%" }}
            type="button"
            className={`${styles.navActionButton} ${styles.adminBtn}`}
            onClick={() => setUploadModule(true)}
          >
            <div className="svg" style={{ width: "24px", height: "24px" }}>
              <svg
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M11.4697 3.46967C11.7626 3.17678 12.2374 3.17678 12.5303 3.46967L18.5303 9.46967C18.8232 9.76256 18.8232 10.2374 18.5303 10.5303C18.2374 10.8232 17.7626 10.8232 17.4697 10.5303L12.75 5.81066L12.75 20C12.75 20.4142 12.4142 20.75 12 20.75C11.5858 20.75 11.25 20.4142 11.25 20L11.25 5.81066L6.53033 10.5303C6.23744 10.8232 5.76256 10.8232 5.46967 10.5303C5.17678 10.2374 5.17678 9.76256 5.46967 9.46967L11.4697 3.46967Z"
                  fill="#f1f1f1"
                ></path>
              </svg>
            </div>
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

function SortDropdownFilter({ sortMethod, handleSortChange, open, onToggle }) {
  return (
    <DropdownFilter
      open={open}
      onToggle={onToggle}
      title="Sort order"
      summary={
        sortMethodOptions.find((o) => o.value === sortMethod)?.label ??
        "Alphabetical"
      }
    >
      {sortMethodOptions.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`${styles.dropdownOption} ${sortMethod === o.value ? styles.dropdownOptionActive : ""}`}
          onClick={() => {
            handleSortChange(o.value);
            onToggle();
          }}
        >
          {o.label}
        </button>
      ))}
    </DropdownFilter>
  );
}

function FilterGrid({
  openDropdown,
  setOpenDropdown,
  learnedFilter,
  setLearnedFilter,
  typeFilter,
  setTypeFilter,
  articleFilter,
  setArticleFilter,
  selectedCategories,
  setSelectedCategories,
  selectedTags,
  setSelectedTags,
  categories,
  tags,
  sortMethod,
  handleSortChange,
  toggleSelectedValue,
  resetViewParameters,
}) {
  return (
    <div className={styles.filterGrid}>
      <DropdownFilter
        open={openDropdown === "learned"}
        onToggle={() =>
          setOpenDropdown((c) => (c === "learned" ? null : "learned"))
        }
        title="Learned status"
        summary={
          learnedFilterOptions.find((o) => o.value === learnedFilter)?.label ??
          "All"
        }
      >
        {learnedFilterOptions.map((o) => (
          <button
            key={o.value}
            type="button"
            className={`${styles.dropdownOption} ${learnedFilter === o.value ? styles.dropdownOptionActive : ""}`}
            onClick={() => {
              setLearnedFilter(o.value);
              resetViewParameters();
              setOpenDropdown(null);
            }}
          >
            {o.label}
          </button>
        ))}
      </DropdownFilter>

      <DropdownFilter
        open={openDropdown === "type"}
        onToggle={() => setOpenDropdown((c) => (c === "type" ? null : "type"))}
        title="Word type"
        summary={
          typeFilterOptions.find((o) => o.value === typeFilter)?.label ?? "All"
        }
      >
        {typeFilterOptions.map((o) => (
          <button
            key={o.value}
            type="button"
            className={`${styles.dropdownOption} ${typeFilter === o.value ? styles.dropdownOptionActive : ""}`}
            onClick={() => {
              setTypeFilter(o.value);
              resetViewParameters();
              setOpenDropdown(null);
            }}
          >
            {o.label}
          </button>
        ))}
      </DropdownFilter>

      <DropdownFilter
        open={openDropdown === "article"}
        onToggle={() =>
          setOpenDropdown((c) => (c === "article" ? null : "article"))
        }
        title="Article"
        summary={
          articleFilterOptions.find((o) => o.value === articleFilter)?.label ??
          "All"
        }
      >
        {articleFilterOptions.map((o) => (
          <button
            key={o.value}
            type="button"
            className={`${styles.dropdownOption} ${articleFilter === o.value ? styles.dropdownOptionActive : ""}`}
            onClick={() => {
              setArticleFilter(o.value);
              resetViewParameters();
              setOpenDropdown(null);
            }}
          >
            {o.label}
          </button>
        ))}
      </DropdownFilter>

      <DropdownFilter
        open={openDropdown === "categories"}
        onToggle={() =>
          setOpenDropdown((c) => (c === "categories" ? null : "categories"))
        }
        title="Categories"
        summary={
          selectedCategories.length > 0
            ? `${selectedCategories.length} selected`
            : "All"
        }
        multi
      >
        {categories.map((cat) => (
          <label key={cat} className={styles.dropdownCheckRow}>
            <input
              type="checkbox"
              checked={selectedCategories.includes(cat)}
              onChange={() => toggleSelectedValue(cat, setSelectedCategories)}
            />
            <span>{cat}</span>
          </label>
        ))}
      </DropdownFilter>

      <DropdownFilter
        open={openDropdown === "tags"}
        onToggle={() => setOpenDropdown((c) => (c === "tags" ? null : "tags"))}
        title="Tags"
        summary={
          selectedTags.length > 0 ? `${selectedTags.length} selected` : "All"
        }
        multi
      >
        {tags.map((tag) => (
          <label key={tag} className={styles.dropdownCheckRow}>
            <input
              type="checkbox"
              checked={selectedTags.includes(tag)}
              onChange={() => toggleSelectedValue(tag, setSelectedTags)}
            />
            <span>{tag}</span>
          </label>
        ))}
      </DropdownFilter>

      {/* Embedded extracted Sort Selection Component */}
      <SortDropdownFilter
        sortMethod={sortMethod}
        handleSortChange={handleSortChange}
        open={openDropdown === "sort"}
        onToggle={() => setOpenDropdown((c) => (c === "sort" ? null : "sort"))}
      />
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
              Go to the{" "}
              <a
                href="https://aistudio.google.com/"
                target="_blank"
                rel="noreferrer"
                style={{ color: "#0066cc", textDecoration: "underline" }}
              >
                Google AI Studio
              </a>{" "}
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
