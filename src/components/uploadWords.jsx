import { useState, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import styles from "./uploadWords.module.css";

// Allowed structural keys for normalization
const ALLOWED_WORD_KEYS = [
  "word",
  "translation",
  "compound_breakdown",
  "type",

  "article",
  "plural",
  "genitive",

  "conjugations",
  "past",
  "participle",
  "auxiliary",

  "comparative",
  "superlative",

  "reflexive",

  "notes",
];

function UploadWords({ currentWords = [], onUploadSuccess, onClose }) {
  // --- State for Global Assignments ---
  const [categoryMode, setCategoryMode] = useState("select"); // 'select' | 'create'
  const [selectedCategory, setSelectedCategory] = useState("");
  const [newCategory, setNewCategory] = useState("");

  const [tagMode, setTagMode] = useState("select"); // 'select' | 'create'
  const [selectedTag, setSelectedTag] = useState("");
  const [newTag, setNewTag] = useState("");

  // --- State for Input Types ---
  const [activeTab, setActiveTab] = useState("file"); // 'file' | 'text'
  const [textInput, setTextInput] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState({
    type: "",
    text: "",
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef(null);

  // --- State for Export Panel ---
  const [exportCategoryFilter, setExportCategoryFilter] = useState("all");
  const [exportTagFilter, setExportTagFilter] = useState("all");
  const [copyFeedback, setCopyFeedback] = useState(false);

  // --- Derive existing distinct categories & tags for dropdowns ---
  const existingCategories = useMemo(() => {
    return [...new Set(currentWords.map((w) => w.category).filter(Boolean))];
  }, [currentWords]);

  const existingTags = useMemo(() => {
    return [
      ...new Set(
        currentWords.flatMap((w) => w.tags || w.tag || []).filter(Boolean),
      ),
    ];
  }, [currentWords]);

  const activeCategory =
    categoryMode === "select" ? selectedCategory : newCategory.trim();
  const activeTag = tagMode === "select" ? selectedTag : newTag.trim();

  // --- Filtered Words calculation for Exporting ---
  const wordsToExport = useMemo(() => {
    return currentWords.filter((word) => {
      const matchesCat =
        exportCategoryFilter === "all" ||
        word.category === exportCategoryFilter;
      const matchesTag =
        exportTagFilter === "all" ||
        (word.tags && word.tags.includes(exportTagFilter)) ||
        word.tag === exportTagFilter;
      return matchesCat && matchesTag;
    });
  }, [currentWords, exportCategoryFilter, exportTagFilter]);

  // --- Data Normalization & Validation Helper ---
  const cleanAndProcessPayload = (rawArray) => {
    if (!Array.isArray(rawArray)) {
      throw new Error(
        "Invalid format: Root element must be a JSON array of word objects.",
      );
    }

    if (!activeCategory || !activeTag) {
      throw new Error(
        "Missing Assignment: You must specify a Category and a Tag before uploading.",
      );
    }

    return rawArray.map((rawWord, idx) => {
      if (!rawWord.word || !rawWord.translation) {
        throw new Error(
          `Item at index ${idx} is missing required 'word' or 'translation' values.`,
        );
      }

      // Strict structural key isolation
      const cleaned = {};
      ALLOWED_WORD_KEYS.forEach((key) => {
        if (rawWord[key] !== undefined) {
          cleaned[key] = rawWord[key];
        }
      });

      // Inject validated singular globally assigned structures
      cleaned.category = activeCategory;
      cleaned.tags = [activeTag]; // Saved inside array for scope matching filters
      cleaned.learned = false;

      return cleaned;
    });
  };

  // --- Handle Core Pipeline Upload Submissions ---
  const handleProcessData = async (jsonString) => {
    setIsProcessing(true);
    setFeedbackMessage({ type: "", text: "" });

    try {
      const parsed = JSON.parse(jsonString);
      const normalizedPayload = cleanAndProcessPayload(parsed);

      if (typeof onUploadSuccess === "function") {
        await onUploadSuccess(normalizedPayload);
      }

      setFeedbackMessage({
        type: "success",
        text: `Successfully imported and normalized ${normalizedPayload.length} words!`,
      });
      setTextInput("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setFeedbackMessage({
        type: "error",
        text:
          err instanceof Error
            ? err.message
            : "Parsing execution failed. Verify JSON markup structure.",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        handleProcessData(event.target.result);
      }
    };
    reader.readAsText(file);
  };

  // --- Export Actions ---
  const handleDownloadJson = () => {
    const dataStr =
      "data:text/json;charset=utf-8," +
      encodeURIComponent(JSON.stringify(wordsToExport, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute(
      "download",
      `worterhaus_export_${exportCategoryFilter}_${exportTagFilter}.json`,
    );
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const handleCopyToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(wordsToExport, null, 2));
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  return (
    <div className={styles.modalOverlay}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className={styles.container}
      >
        <div className={styles.header}>
          <div>
            <h2>Data Workspace Hub</h2>
            <p>Expand or back up your German vocabulary dictionary datasets</p>
          </div>
          {onClose && (
            <button onClick={onClose} className={styles.closeBtn}>
              &times;
            </button>
          )}
        </div>

        {/* --- SECTION 1: STRICT CATEGORY & TAG CONFIGURATION --- */}
        <section className={styles.configCard}>
          <h4 className={styles.sectionTitle}>1. Global Taxonomy Assignment</h4>
          <p className={styles.sectionSubtitle}>
            Every word uploaded below will automatically adopt these values
          </p>

          <div className={styles.gridFields}>
            {/* Category Configuration Block */}
            <div className={styles.controlBlock}>
              <div className={styles.labelRow}>
                <label>Category (e.g., A1, B2)</label>
                <button
                  onClick={() =>
                    setCategoryMode(
                      categoryMode === "select" ? "create" : "select",
                    )
                  }
                  className={styles.toggleModeBtn}
                >
                  {categoryMode === "select"
                    ? "+ Create New"
                    : "« Select Existing"}
                </button>
              </div>
              {categoryMode === "select" ? (
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className={styles.inputField}
                >
                  <option value="">-- Choose Category --</option>
                  {existingCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="Type new category name..."
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className={styles.inputField}
                />
              )}
            </div>

            {/* Tag Configuration Block */}
            <div className={styles.controlBlock}>
              <div className={styles.labelRow}>
                <label>Tag / Lesson (e.g., Lektion 1)</label>
                <button
                  onClick={() =>
                    setTagMode(tagMode === "select" ? "create" : "select")
                  }
                  className={styles.toggleModeBtn}
                >
                  {tagMode === "select" ? "+ Create New" : "« Select Existing"}
                </button>
              </div>
              {tagMode === "select" ? (
                <select
                  value={selectedTag}
                  onChange={(e) => setSelectedTag(e.target.value)}
                  className={styles.inputField}
                >
                  <option value="">-- Choose Tag --</option>
                  {existingTags.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  placeholder="Type new tag/lesson reference..."
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  className={styles.inputField}
                />
              )}
            </div>
          </div>
        </section>

        {/* --- SECTION 2: IMPORT/UPLOAD INTERFACE PANEL --- */}
        <section className={styles.workspaceSection}>
          <div className={styles.tabHeaderRow}>
            <h4 className={styles.sectionTitle}>2. Import Vocabulary</h4>
            <div className={styles.tabButtons}>
              <button
                className={`${styles.tabBtn} ${activeTab === "file" ? styles.tabBtnActive : ""}`}
                onClick={() => setActiveTab("file")}
              >
                JSON File Upload
              </button>
              <button
                className={`${styles.tabBtn} ${activeTab === "text" ? styles.tabBtnActive : ""}`}
                onClick={() => setActiveTab("text")}
              >
                Raw Text JSON
              </button>
            </div>
          </div>

          <div className={styles.tabViewBody}>
            {activeTab === "file" ? (
              <div
                className={`${styles.dropzone} ${!activeCategory || !activeTag ? styles.dropzoneDisabled : ""}`}
                onClick={() =>
                  !activeCategory || !activeTag
                    ? null
                    : fileInputRef.current?.click()
                }
              >
                <input
                  type="file"
                  accept=".json"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  disabled={!activeCategory || !activeTag}
                  style={{ display: "none" }}
                />
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className={styles.uploadIcon}
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M12 16V8M12 8L9 11M12 8L15 11M3 15V16C3 18.2091 4.79086 20 7 20H17C19.2091 20 21 18.2091 21 16V15"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {!activeCategory || !activeTag ? (
                  <p className={styles.warningText}>
                    ⚠️ Complete the Category & Tag assignments above to unlock
                    uploading.
                  </p>
                ) : (
                  <p>
                    Click to browse or drop your <strong>.json</strong> array
                    dataset here
                  </p>
                )}
              </div>
            ) : (
              <div className={styles.textInputWrapper}>
                <textarea
                  className={styles.textAreaField}
                  rows={6}
                  placeholder={`[\n  {\n    "word": "Beispiel",\n    "translation": "example",\n    "type": "noun",\n    "article": "das"\n  }\n]`}
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  disabled={!activeCategory || !activeTag}
                />
                <button
                  onClick={() => handleProcessData(textInput)}
                  disabled={
                    isProcessing ||
                    !textInput.trim() ||
                    !activeCategory ||
                    !activeTag
                  }
                  className={styles.submitDataBtn}
                >
                  {isProcessing
                    ? "Processing Integrity Checks..."
                    : "Parse & Inject Dataset"}
                </button>
              </div>
            )}
          </div>

          {/* Feedback Toast Alerts */}
          <AnimatePresence>
            {feedbackMessage.text && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={`${styles.alertBanner} ${feedbackMessage.type === "success" ? styles.alertSuccess : styles.alertError}`}
              >
                {feedbackMessage.text}
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* --- SECTION 3: ADVANCED DYNAMIC FILTER EXPORT MANAGER --- */}
        <section className={styles.exportSection}>
          <h4 className={styles.sectionTitle}>
            3. Dynamic Target Data Export Workspace
          </h4>
          <p className={styles.sectionSubtitle}>
            Filter targets down to export specific lesson lists or structural
            backups
          </p>

          <div className={styles.exportControlsStrip}>
            <div className={styles.filterGroup}>
              <label>Filter Category</label>
              <select
                value={exportCategoryFilter}
                onChange={(e) => setExportCategoryFilter(e.target.value)}
                className={styles.inputFieldCompact}
              >
                <option value="all">
                  All Categories ({existingCategories.length})
                </option>
                {existingCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.filterGroup}>
              <label>Filter Tag</label>
              <select
                value={exportTagFilter}
                onChange={(e) => setExportTagFilter(e.target.value)}
                className={styles.inputFieldCompact}
              >
                <option value="all">All Tags ({existingTags.length})</option>
                {existingTags.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.exportActionButtons}>
              <button
                type="button"
                onClick={handleDownloadJson}
                disabled={wordsToExport.length === 0}
                className={styles.exportActionBtn}
              >
                Download JSON ({wordsToExport.length})
              </button>
              <button
                type="button"
                onClick={handleCopyToClipboard}
                disabled={wordsToExport.length === 0}
                className={`${styles.exportActionBtn} ${styles.copyBtnAccent}`}
              >
                {copyFeedback ? "✓ Copied Content" : "Copy to Clipboard"}
              </button>
            </div>
          </div>
        </section>
      </motion.div>
    </div>
  );
}

export default UploadWords;
