import { motion, AnimatePresence } from "framer-motion";
import styles from "./wordCard.module.css";

function WordCard({
  word,
  isAdmin,
  expanded,
  aiResult,
  aiBusy,
  testModeEnabled,
  testModeDirection,
  pressedWordName,
  onToggleLearned,
  onDelete,
  onGenerateAiExample,
  onGenerateAiMnemonic,
  onToggleExpanded,
  onPronounce,
  onPromptPressStart,
  onPromptPressEnd,
  getConjugation,
}) {
  const articleClass = word.article ? styles[word.article] : styles.neutral;
  const genderBorderClass = word.article
    ? styles[`border-${word.article}`]
    : styles.borderNeutral;

  const showGermanPrompt = testModeDirection === "du-en";
  const promptIsPressed = pressedWordName === word.word;
  const shouldBlurGerman = testModeEnabled && !showGermanPrompt;
  const shouldBlurEnglish = testModeEnabled && showGermanPrompt;

  return (
    <article
      className={`${styles.card} ${expanded ? styles.cardExpanded : ""} ${
        word.learned ? styles.cardLearned : ""
      } ${genderBorderClass}`}
    >
      {/* Upper Main Interactive Row */}
      <div className={styles.cardHeader}>
        <div className={styles.cardHeaderMain} onClick={onToggleExpanded}>
          <div className={styles.cardTopMetadataRow}>
            <div>
              <div className={styles.articlePill + ` ${articleClass}`}>
                <span
                  className={` ${testModeEnabled ? styles.hiddenInTestMode : ""}`}
                >
                  {word.article ?? "—"}
                </span>
              </div>
              {word.type && (
                <span className={styles.wordTypeLabel}>{word.type}</span>
              )}
            </div>
            <div className={styles.topRightActions}>
              <button
                type="button"
                className={`${styles.arrowToggleBtn} ${expanded ? styles.arrowToggleBtnActive : ""}`}
                onClick={onToggleExpanded}
                aria-label="Toggle structural card data collapse views"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className={styles.arrowSvg}
                >
                  <path
                    d="M18.5303 9.46967C18.5303 9.46967 18.5303 9.46967 18.5303 9.46967C18.8232 9.76256 18.8232 10.2374 18.5303 10.5303L12.5303 16.5303C12.2374 16.8232 11.7626 16.8232 11.4697 16.5303L5.46967 10.5303C5.17678 10.2374 5.17678 9.76256 5.46967 9.46967C5.76256 9.17678 6.23744 9.17678 6.53033 9.46967L12 14.9393L17.4697 9.46967C17.7626 9.17678 18.2374 9.17678 18.5303 9.46967Z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </div>
          </div>

          <div className={styles.cardTitleBlock}>
            {/* German Term Side */}
            <div
              className={`${styles.termContainer} ${shouldBlurGerman ? styles.clickablePromptBox : ""}`}
              onMouseDown={showGermanPrompt ? undefined : onPromptPressStart}
              onMouseUp={showGermanPrompt ? undefined : onPromptPressEnd}
              onMouseLeave={showGermanPrompt ? undefined : onPromptPressEnd}
              onTouchStart={showGermanPrompt ? undefined : onPromptPressStart}
              onTouchEnd={showGermanPrompt ? undefined : onPromptPressEnd}
              onTouchCancel={showGermanPrompt ? undefined : onPromptPressEnd}
            >
              <h3
                className={`${shouldBlurGerman ? styles.promptBlur : ""} ${promptIsPressed && shouldBlurGerman ? styles.promptReveal : ""}`}
              >
                {word.word}
              </h3>
              <SoundIcon onPronounce={onPronounce} word={word} />
            </div>

            {/* English Target Translation Side */}
            <div
              className={`${styles.termContainerEN} ${shouldBlurEnglish ? styles.clickablePromptBox : ""}`}
              onMouseDown={showGermanPrompt ? onPromptPressStart : undefined}
              onMouseUp={showGermanPrompt ? onPromptPressEnd : undefined}
              onMouseLeave={showGermanPrompt ? onPromptPressEnd : undefined}
              onTouchStart={showGermanPrompt ? onPromptPressStart : undefined}
              onTouchEnd={showGermanPrompt ? onPromptPressEnd : undefined}
              onTouchCancel={showGermanPrompt ? onPromptPressEnd : undefined}
            >
              <p
                className={`${styles.translationText} ${shouldBlurEnglish ? styles.promptBlur : ""} ${promptIsPressed && shouldBlurEnglish ? styles.promptReveal : ""}`}
              >
                {word.translation}
              </p>
              {shouldBlurEnglish && (
                <span className={styles.pressToRevealHint}>Hold to reveal</span>
              )}
            </div>
          </div>
        </div>

        {/* Right utilities tray */}
      </div>
      {/* Clean Framer-Motion Accordion Component with Conditional Content Rendering */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{
              height: "auto",
              opacity: 1,
              transition: {
                height: { duration: 0.25 },
                opacity: { duration: 0.15, delay: 0.05 },
              },
            }}
            exit={{
              height: 0,
              opacity: 0,
              transition: {
                height: { duration: 0.2 },
                opacity: { duration: 0.2 },
              },
            }}
            className={styles.cardBodyWrapper}
          >
            <div className={styles.cardBodyInner}>
              {testModeEnabled &&
              testModeDirection === "en-du" ? null : word.plural ? (
                <div className={styles.fullWidthBlock}>
                  <span className={styles.blockLabel}>Plural Form</span>
                  <strong className={styles.blockValue}>{word.plural}</strong>
                </div>
              ) : null}

              {testModeEnabled &&
              testModeDirection === "en-du" ? null : word.compound_breakdown ? (
                <div className={styles.fullWidthBlock}>
                  <span className={styles.blockLabel}>Compound Components</span>
                  <strong className={styles.blockValue}>
                    {word.compound_breakdown.join(" + ")}
                  </strong>
                </div>
              ) : null}

              {testModeEnabled &&
              testModeDirection === "en-du" ? null : word.type === "verb" &&
                word.conjugations ? (
                <div className={styles.detailBox}>
                  <span className={styles.blockLabel}>Verb Conjugations</span>
                  <div className={styles.conjugationList}>
                    {[
                      ["ich", getConjugation(word, "ich")],
                      ["du", getConjugation(word, "du")],
                      ["er/sie/es", getConjugation(word, "er")],
                      ["wir", getConjugation(word, "wir")],
                      ["Sie/sie", getConjugation(word, "Sie_sie")],
                    ].map(([person, form]) => (
                      <div key={person} className={styles.conjugationRow}>
                        <strong className={styles.conjPerson}>{person}</strong>
                        <span className={styles.conjForm}>{form ?? "—"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {testModeEnabled && testModeDirection === "en-du" ? null : (
                <div className={styles.aiSection}>
                  <div className={styles.aiHeader}>
                    <span>AI Study Assistants</span>
                    <em>{aiResult ? "Ready" : "Tap to generate"}</em>
                  </div>

                  <div className={styles.aiButtons}>
                    <button
                      type="button"
                      className={styles.aiButton}
                      onClick={onGenerateAiExample}
                    >
                      Context Example
                    </button>
                    <button
                      type="button"
                      className={styles.aiButton}
                      onClick={onGenerateAiMnemonic}
                    >
                      Mnemonic Memory Trick
                    </button>
                  </div>

                  {aiBusy && (
                    <div className={styles.generatingWrapper}>
                      <span className={styles.loadingPulse}></span>
                      <span className={styles.emptyState}>
                        Generating structural intelligence...
                      </span>
                    </div>
                  )}

                  {aiResult?.example && (
                    <p className={styles.aiResult}>💡 {aiResult.example}</p>
                  )}
                  {aiResult?.mnemonic && (
                    <p className={styles.aiResult}>🧠 {aiResult.mnemonic}</p>
                  )}
                </div>
              )}

              {testModeEnabled &&
              testModeDirection === "en-du" ? null : word.notes ? (
                <div className={styles.notesBlock}>
                  <span className={styles.blockLabel}>Usage Notes</span>
                  <p className={styles.notesText}>{word.notes}</p>
                </div>
              ) : null}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Floating Action Chips Row */}
      <div className={styles.cardActionsRow}>
        <button
          type="button"
          className={`${styles.actionChip} ${styles.learnedChip} ${word.learned ? styles.actionChipLearned : ""}`}
          onClick={onToggleLearned}
        >
          <div className={styles.chipIcon}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className={styles.chipIcon}
            >
              <path
                d="M4 12.6111L8.92308 17.5L20 6.5"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </button>

        {isAdmin && (
          <button
            type="button"
            className={`${styles.actionChip} ${styles.deleteChip}`}
            onClick={onDelete}
            aria-label={`Delete entry ${word.word}`}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className={styles.chipIcon}
            >
              <path
                d="M9.1709 4C9.58273 2.83481 10.694 2 12.0002 2C13.3064 2 14.4177 2.83481 14.8295 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <path
                d="M20.5001 6H3.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <path
                d="M18.8332 8.5L18.3732 15.3991C18.1962 18.054 18.1077 19.3815 17.2427 20.1907C16.3777 21 15.0473 21 12.3865 21H11.6132C8.95235 21 7.62195 21 6.75694 20.1907C5.89194 19.3815 5.80344 18.054 5.62644 15.3991L5.1665 8.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        )}
      </div>
    </article>
  );
}
function SoundIcon({ onPronounce, word }) {
  return (
    <button
      type="button"
      className={styles.soundButton}
      onClick={(e) => {
        e.stopPropagation();
        onPronounce();
      }}
      aria-label={`Pronounce ${word.word}`}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={styles.actionSvg}
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M11.5457 4.73972C11.518 4.5659 11.3052 4.47296 11.1545 4.62495L7.98018 7.826C6.92171 8.89337 5.48542 9.49312 3.9877 9.49312C3.73959 9.49312 3.53846 9.69572 3.53846 9.94564V14.0544C3.53846 14.3043 3.7396 14.5069 3.9877 14.5069C5.48542 14.5069 6.92171 15.1066 7.98018 16.174L11.1545 19.3751C11.3052 19.527 11.518 19.4341 11.5457 19.2603C11.8531 17.3313 12.2564 14.3455 12.2564 12C12.2564 9.65454 11.8531 6.66871 11.5457 4.73972ZM10.0661 3.52973C11.0771 2.51017 12.8319 3.03295 13.0647 4.49411C13.3737 6.43286 13.7949 9.52248 13.7949 12C13.7949 14.4775 13.3737 17.5671 13.0647 19.5059C12.8319 20.967 11.0771 21.4898 10.0661 20.4703L6.89173 17.2692C6.12182 16.4928 5.07711 16.0566 3.9877 16.0566C2.88992 16.0566 2 15.1602 2 14.0544V9.94564C2 8.83984 2.88993 7.94341 3.9877 7.94341C5.07711 7.94341 6.12182 7.50717 6.89173 6.73079L10.0661 3.52973Z"
          fill="currentColor"
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M18.7444 4.129C19.0948 3.88697 19.5736 3.97686 19.8139 4.32978C21.1805 6.33709 22 9.04653 22 12C22 14.9535 21.1805 17.6629 19.8139 19.6702C19.5736 20.0231 19.0948 20.113 18.7444 19.871C18.3941 19.629 18.3048 19.1467 18.5451 18.7937C19.7163 17.0735 20.4615 14.6777 20.4615 12C20.4615 9.32227 19.7163 6.92651 18.5451 5.20626C18.3048 4.85334 18.3941 4.37103 18.7444 4.129Z"
          fill="currentColor"
        />
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M15.7697 6.13577C16.1526 5.95056 16.6122 6.11317 16.796 6.49896C17.49 7.95518 17.8974 9.89761 17.8974 12C17.8974 14.1024 17.49 16.0448 16.796 17.501C16.6122 17.8868 16.1526 18.0494 15.7697 17.8642C15.3867 17.679 15.2252 17.2162 15.4091 16.8304C15.984 15.624 16.359 13.9199 16.359 12C16.359 10.0801 15.984 8.37596 15.4091 7.16964C15.2252 6.78385 15.3867 6.32097 15.7697 6.13577Z"
          fill="currentColor"
        />
      </svg>
    </button>
  );
}
export default WordCard;
