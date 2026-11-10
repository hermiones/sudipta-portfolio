#!/usr/bin/env node
// Generates Testy's voice with ElevenLabs. Run from the repo root.
//
//   node tools/testy-voice.mjs design         design 3 voice previews, save them and play them (macOS afplay)
//   node tools/testy-voice.mjs save <1|2|3>   keep a preview as Testy's permanent voice
//   node tools/testy-voice.mjs clips          render every line in tools/testy-lines.json to audio/testy/*.mp3
//        --force        re-render clips that already exist
//        --only a,b     render just these line ids
//
// The API key is read from $ELEVENLABS_API_KEY or ~/.elevenlabs_key. It is never written into the repo.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://api.elevenlabs.io';
const CFG = join(ROOT, 'tools', 'testy-voice.json');          // { voice_id, generated: [...] }  (no secrets)
const PREV = join(ROOT, 'tools', 'voice-previews');
const OUT = join(ROOT, 'audio', 'testy');

const key = (process.env.ELEVENLABS_API_KEY || (existsSync(join(homedir(), '.elevenlabs_key')) ? readFileSync(join(homedir(), '.elevenlabs_key'), 'utf8') : '')).trim();
if (!key) { console.error('No ElevenLabs key. Save it with:  echo "YOUR_KEY" > ~/.elevenlabs_key && chmod 600 ~/.elevenlabs_key'); process.exit(1); }

const cfg = existsSync(CFG) ? JSON.parse(readFileSync(CFG, 'utf8')) : {};
const saveCfg = () => writeFileSync(CFG, JSON.stringify(cfg, null, 2) + '\n');
async function call(path, body, { raw = false, method = 'POST' } = {}) {
  const r = await fetch(API + path, { method, headers: { 'xi-api-key': key, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status}: ${(await r.text()).slice(0, 400)}`);
  return raw ? Buffer.from(await r.arrayBuffer()) : r.json();
}

const DESCRIPTION = 'An adorable, high-pitched cartoon robot mascot with a sweet, babyish, sing-song voice. Bubbly, giggly and very expressive, ' +
  'like a cute animated movie sidekick. Warm, playful and emotional, with clear, friendly American English pronunciation.';
const PREVIEW_TEXT = "Hi hi! I'm Testy, Sudipta's little Q A bot! [giggles] I check every single page before you see it. " +
  'Ooh, want to hear something cool? Sudipta cut regression time in half! Yaaay! [excited] Ask me anything!';

const cmd = process.argv[2];
const arg = n => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };

if (cmd === 'design') {
  const res = await call('/v1/text-to-voice/design', { voice_description: DESCRIPTION, model_id: 'eleven_ttv_v3', text: PREVIEW_TEXT, guidance_scale: 5, loudness: 0.6 });
  mkdirSync(PREV, { recursive: true });
  cfg.generated = res.previews.map((p, i) => {
    const f = join(PREV, `preview-${i + 1}.mp3`);
    writeFileSync(f, Buffer.from(p.audio_base_64, 'base64'));
    return { n: i + 1, generated_voice_id: p.generated_voice_id, file: f };
  });
  saveCfg();
  for (const p of cfg.generated) {
    console.log(`▶ preview ${p.n}: ${p.file}`);
    try { execFileSync('afplay', [p.file]); } catch { /* not on macOS: open the files manually */ }
  }
  console.log('\nPick one:  node tools/testy-voice.mjs save <1|2|3>   (or run "design" again for new options)');
} else if (cmd === 'save') {
  const p = (cfg.generated || []).find(g => g.n === Number(process.argv[3]));
  if (!p) { console.error('Run "design" first, then pass 1, 2 or 3.'); process.exit(1); }
  const v = await call('/v1/text-to-voice', { voice_name: 'Testy (portfolio mascot)', voice_description: DESCRIPTION, generated_voice_id: p.generated_voice_id });
  cfg.voice_id = v.voice_id; saveCfg();
  console.log('Saved Testy\'s voice:', v.voice_id, '\nNext:  node tools/testy-voice.mjs clips');
} else if (cmd === 'clips') {
  const voice = arg('--voice') || cfg.voice_id;
  if (!voice) { console.error('No voice yet. Run "design" then "save <n>" (or pass --voice <id>).'); process.exit(1); }
  const models = await call('/v1/models', null, { method: 'GET' });
  const tts = models.filter(m => m.can_do_text_to_speech).map(m => m.model_id);
  const model = arg('--model') || ['eleven_v3', 'eleven_v4', 'eleven_multilingual_v2'].find(m => tts.includes(m)) || tts[0];
  const tags = /^eleven_v[34]/.test(model);
  console.log(`voice ${voice} · model ${model}${tags ? ' (audio tags on)' : ' (audio tags stripped)'}`);
  const lines = JSON.parse(readFileSync(join(ROOT, 'tools', 'testy-lines.json'), 'utf8'));
  const only = arg('--only')?.split(',');
  mkdirSync(OUT, { recursive: true });
  const manPath = join(OUT, 'manifest.json');
  const man = existsSync(manPath) ? JSON.parse(readFileSync(manPath, 'utf8')) : { clips: {} };
  let done = 0, chars = 0;
  for (const [id, text0] of Object.entries(lines)) {
    if (only && !only.includes(id)) continue;
    const file = `${id}.mp3`;
    if (!process.argv.includes('--force') && man.clips[id] && existsSync(join(OUT, file))) continue;
    const text = tags ? text0 : text0.replace(/\[[^\]]+\]\s*/g, '');
    const settings = tags ? { stability: 0.5, similarity_boost: 0.8 } : { stability: 0.3, similarity_boost: 0.8, style: 0.7, use_speaker_boost: true };
    let audio;
    try { audio = await call(`/v1/text-to-speech/${voice}?output_format=mp3_44100_64`, { text, model_id: model, voice_settings: settings }, { raw: true }); }
    catch (e) { audio = await call(`/v1/text-to-speech/${voice}?output_format=mp3_44100_64`, { text, model_id: model }, { raw: true }); } // retry with the voice's own settings
    writeFileSync(join(OUT, file), audio);
    man.clips[id] = file; done++; chars += text.length;
    console.log(`✓ ${id.padEnd(16)} ${(audio.length / 1024).toFixed(0)} KB`);
  }
  man.voice = voice; man.model = model;
  writeFileSync(manPath, JSON.stringify(man, null, 2) + '\n');
  console.log(`\n${done} clip(s) rendered (~${chars} characters). Manifest: audio/testy/manifest.json`);
} else {
  console.log(readFileSync(fileURLToPath(import.meta.url), 'utf8').split('\n').slice(1, 11).join('\n').replace(/^\/\/ ?/gm, ''));
}
