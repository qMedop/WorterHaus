export default async function handler(req, res) {
  const { word } = req.query;

  const response = await fetch(
    `https://translate.google.com/translate_tts?ie=UTF-8&tl=de&client=tw-ob&q=${encodeURIComponent(word)}`,
  );

  res.setHeader("Content-Type", "audio/mpeg");

  const buffer = await response.arrayBuffer();
  res.send(Buffer.from(buffer));
}
