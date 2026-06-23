const databaseName = "worterhaus-userdb";
const databaseVersion = 1;
const wordsStoreName = "words-cache";
const usersStoreName = "users-cache";

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(databaseName, databaseVersion);

    request.onerror = () => reject(request.error);
    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(wordsStoreName)) {
        database.createObjectStore(wordsStoreName, { keyPath: "key" });
      }

      if (!database.objectStoreNames.contains(usersStoreName)) {
        database.createObjectStore(usersStoreName, { keyPath: "uid" });
      }
    };
    request.onsuccess = () => resolve(request.result);
  });
}

async function runTransaction(storeName, mode, operation) {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    const result = operation(store);

    transaction.oncomplete = () => {
      database.close();
      resolve(result);
    };

    transaction.onerror = () => {
      database.close();
      reject(transaction.error);
    };
  });
}

export async function loadCachedWords() {
  const record = await runTransaction(
    wordsStoreName,
    "readonly",
    (store) =>
      new Promise((resolve, reject) => {
        const request = store.get("words");
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result ?? null);
      }),
  );

  return Array.isArray(record?.words) ? record.words : [];
}

export async function saveCachedWords(words) {
  await runTransaction(wordsStoreName, "readwrite", (store) => {
    store.put({ key: "words", words, updatedAt: Date.now() });
  });
}

export async function loadCachedLearnedWords(uid) {
  if (!uid) {
    return { learnedWords: [], dirty: false };
  }

  const record = await runTransaction(
    usersStoreName,
    "readonly",
    (store) =>
      new Promise((resolve, reject) => {
        const request = store.get(uid);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result ?? null);
      }),
  );

  return {
    learnedWords: Array.isArray(record?.learnedWords)
      ? record.learnedWords
      : [],
    dirty: Boolean(record?.dirty),
  };
}

export async function saveCachedLearnedWords(uid, learnedWords, dirty = false) {
  if (!uid) {
    return;
  }

  await runTransaction(usersStoreName, "readwrite", (store) => {
    store.put({ uid, learnedWords, dirty, updatedAt: Date.now() });
  });
}
