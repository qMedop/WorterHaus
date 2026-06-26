import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import styles from "../App.module.css"; // Adjust path to match your layout hierarchy
import { SoundIcon } from "./wordCard";

export default function FlashcardStudySession({
  wordsList,
  tags,
  onCloseSession,
  onPronounce,
}) {
  const [selectedTags, setSelectedTags] = useState([]);
  const [sessionDeck, setSessionDeck] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [isStudyActive, setIsStudyActive] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [slideDirection, setSlideDirection] = useState(0);

  const toggleTagSelection = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  };

  const handleStartDeck = () => {
    const matched = wordsList.filter((word) => {
      if (selectedTags.length === 0) return true;
      return selectedTags.some((t) => word.tags?.includes(t));
    });

    const shuffled = [...matched].sort(() => Math.random() - 0.5);
    setSessionDeck(shuffled);
    setCurrentIndex(0);
    setIsFlipped(false);
    setIsStudyActive(true);
  };

  const handleNavigate = (direction) => {
    setSlideDirection(direction);
    setIsFlipped(false);
    setCurrentIndex((prev) => prev + direction);
  };

  const totalCards = sessionDeck.length;
  const currentProgressPercent =
    totalCards > 0 ? Math.round(((currentIndex + 1) / totalCards) * 100) : 0;
  const currentCard = sessionDeck[currentIndex];

  const slideVariants = {
    enter: (direction) => ({
      x: direction > 0 ? "20%" : "-20%",
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
      transition: {
        x: { type: "spring", stiffness: 260, damping: 26 },
        opacity: { duration: 0.25 },
      },
    },
    exit: (direction) => ({
      x: direction < 0 ? "20%" : "-20%",
      opacity: 0,
      transition: {
        x: { type: "spring", stiffness: 260, damping: 26 },
        opacity: { duration: 0.2 },
      },
    }),
  };

  if (isStudyActive) {
    return (
      <div className={styles.flashcardViewContainer}>
        <div className={styles.progressCard}>
          <div className={styles.progressTrack}>
            <div
              className={styles.progressFill}
              style={{ width: `${currentProgressPercent}%` }}
            />
          </div>
          <div className={styles.progressHeader}>
            <div>
              <strong>
                {currentIndex + 1} of {totalCards}
              </strong>
            </div>
          </div>
        </div>

        {totalCards === 0 ? (
          <div className={styles.emptyResultsCatchBlock}>
            <p>No words found matching the selected lessons.</p>
          </div>
        ) : (
          <>
            <div className={styles.flashcardSliderStage}>
              <AnimatePresence
                initial={false}
                custom={slideDirection}
                mode="popLayout"
              >
                <motion.div
                  key={currentIndex}
                  custom={slideDirection}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className={styles.flashcardMotionWrapper}
                >
                  <div
                    className={`${styles.flashcardItemElement} ${isFlipped ? styles.flashcardFlippedState : ""}`}
                  >
                    <div
                      className={styles.flashcardInnerFrame}
                      onClick={() => setIsFlipped(!isFlipped)}
                    >
                      <div className={styles.flashcardSideFront}>
                        {currentCard.article && (
                          <span
                            className={`${styles.cardArticleLabel} ${styles[currentCard.article]}`}
                          >
                            {currentCard.article}
                          </span>
                        )}
                        <h2>{currentCard.word}</h2>
                        {currentCard.type && (
                          <span className={styles.wordTypeLabel}>
                            {currentCard.type}
                          </span>
                        )}
                        <em className={styles.tapTipLabel}>
                          Tap to reveal translation
                        </em>
                        <div className={styles.soundBtn}>
                          <SoundIcon
                            word={currentCard.word}
                            onPronounce={onPronounce}
                          />
                        </div>
                      </div>

                      <div className={styles.flashcardSideBack}>
                        <p className={styles.blockLabel}>
                          English Translation:
                        </p>
                        <h3>{currentCard.translation}</h3>
                        {currentCard.plural && (
                          <div className={styles.cardMiniDetail}>
                            <strong>Plural:</strong> {currentCard.plural}
                          </div>
                        )}
                        {currentCard.compound_breakdown && (
                          <div className={styles.cardMiniDetail}>
                            <strong>Components:</strong>{" "}
                            {currentCard.compound_breakdown}
                          </div>
                        )}
                        <em className={styles.tapTipLabel}>Tap to flip back</em>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            <div className={styles.flashcardControlsRow}>
              <button
                type="button"
                className={styles.navDeckBtn}
                disabled={currentIndex === 0}
                onClick={() => handleNavigate(-1)}
              >
                Previous
              </button>
              <button
                type="button"
                className={styles.navDeckBtn}
                disabled={currentIndex === totalCards - 1}
                onClick={() => handleNavigate(1)}
              >
                Next
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className={styles.flashcardConfigDeckWindow}>
      <div className={styles.popupHeaderRow}>
        <h3>Configure Flashcard Session</h3>
      </div>

      <div style={{ padding: "8px 0", minHeight: "100px" }}>
        <div className={styles.filterSectionHeader}>Select Lessons</div>

        {/* Reusing exact platform filter dropdown structures cleanly */}
        <div
          className={`${styles.dropdown} ${isDropdownOpen ? styles.dropdownOpen : ""}`}
        >
          <button
            type="button"
            className={styles.dropdownSummary}
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          >
            <span className={styles.dropdownSummaryText}>
              <strong>Lessons Selected</strong>
              <em>
                {selectedTags.length > 0
                  ? `${selectedTags.length} lessons selected`
                  : "All Lessons"}
              </em>
            </span>
            <span className={styles.dropdownCaret}>
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

          <div
            className={styles.dropdownMenuWrap}
            aria-hidden={!isDropdownOpen}
          >
            <div className={styles.dropdownMenu}>
              {tags.map((tag) => (
                <label key={tag} className={styles.dropdownCheckRow}>
                  <input
                    type="checkbox"
                    checked={selectedTags.includes(tag)}
                    onChange={() => toggleTagSelection(tag)}
                  />
                  <span>{tag}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        className={styles.startFlashcardsActionBtn}
        onClick={handleStartDeck}
      >
        Start Study Deck
      </button>
    </div>
  );
}
