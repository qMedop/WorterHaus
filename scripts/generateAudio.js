import admin from "firebase-admin";
import serviceAccount from "./serviceAccountKey.json" with { type: "json" };

import axios from "axios";
import googleTTS from "google-tts-api";

import fs from "fs";
import path from "path";

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

const OUTPUT_DIR = path.resolve("./public/audio");

if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function download(url, destination) {
  const response = await axios({
    url,
    method: "GET",
    responseType: "stream",
  });

  const writer = fs.createWriteStream(destination);

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
}

async function main() {
  const snapshot = await db.collection("words").get();

  const docs = snapshot.docs;

  console.log(`Found ${docs.length} words\n`);

  let i = 1;

  for (const doc of docs) {
    const data = doc.data();

    const word = data.word;

    const output = path.join(OUTPUT_DIR, `${doc.id}.mp3`);

    if (fs.existsSync(output)) {
      console.log(`[${i}/${docs.length}] ${word} (already exists)`);
      i++;
      continue;
    }

    try {
      const url = googleTTS.getAudioUrl(word, {
        lang: "de",
        slow: false,
      });

      await download(url, output);

      console.log(`[${i}/${docs.length}] ✔ ${word}`);
    } catch (err) {
      console.error(`[${i}/${docs.length}] ❌ ${word}`);
      console.error(err.message);
    }

    // Wait 2-4 seconds
    const delay = 2000 + Math.random() * 2000;

    await sleep(delay);

    i++;
  }

  console.log("\nDone!");
}

main();
