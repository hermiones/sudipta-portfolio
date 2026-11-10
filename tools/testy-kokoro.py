#!/usr/bin/env python3
"""Generate Testy's voice for free, offline, with Kokoro (open-source TTS), then make it small and cute.

Setup (one time, outside the repo):
  python3.11 -m venv ~/.cache/testy-voice/venv && ~/.cache/testy-voice/venv/bin/pip install kokoro-onnx soundfile
  download kokoro-v1.0.onnx + voices-v1.0.bin from github.com/thewh1teagle/kokoro-onnx/releases into ~/.cache/testy-voice

Usage (from the repo root):
  ~/.cache/testy-voice/venv/bin/python tools/testy-kokoro.py preview          # play a few voice styles on your Mac
  ~/.cache/testy-voice/venv/bin/python tools/testy-kokoro.py clips --style 2  # render every line to audio/testy/*.mp3
       --force      re-render existing clips      --only a,b   just these line ids
"""
import json, os, re, subprocess, sys, tempfile
from pathlib import Path

import soundfile as sf
from kokoro_onnx import Kokoro

ROOT = Path(__file__).resolve().parent.parent
CACHE = Path.home() / '.cache' / 'testy-voice'
OUT = ROOT / 'audio' / 'testy'
LINES = json.loads((ROOT / 'tools' / 'testy-lines.json').read_text())

# voice styles to audition: (kokoro voice, pitch ratio, base speed)
# pitch ratio > 1 raises pitch AND formants together, which sounds like a smaller, younger speaker
STYLES = {
    1: ('af_heart', 1.18, 0.96),   # sweet, gently higher
    2: ('af_bella', 1.24, 0.94),   # bubbly, clearly little
    3: ('af_sky',   1.30, 0.92),   # tiny and baby-like
    4: ('af_nicole', 1.22, 0.95),  # soft and cosy
}
# emotion → (extra pitch, speed multiplier)
MOOD = {'excited': (1.04, 1.06), 'happy': (1.0, 1.0), 'sad': (0.95, 0.86), 'curious': (1.02, 0.97),
        'mischievously': (1.0, 0.98), 'giggles': (1.03, 1.02)}
# say Indian names the Indian way (phonemes), e.g. Sudipta = su-DEE-p-taa, Kolkata = KOL-kaa-taa
SAY = [('sˈuːdɪptə', 'sudˈiːptɑː'), ('kɑːlkˈɑːɾə', 'kˈoʊlkɑːtɑː'), ('mˈoʊhənti', 'mˈoʊhənti')]
from kokoro_onnx.tokenizer import Tokenizer
TOK = Tokenizer()


def prep(text):
    """Split a line into sentences with a mood. Tags become delivery, not sounds (synthetic giggles sound robotic)."""
    tags = re.findall(r'\[([^\]]+)\]', text)
    mood = next((t for t in tags if t in MOOD), 'happy')
    spoken = re.sub(r'\s+', ' ', re.sub(r'\[[^\]]+\]', ' ', text)).strip()
    parts = [p.strip() for p in re.findall(r'[^.!?]+(?:\.\.\.|[.!?]+)?', spoken) if p.strip()]
    return parts, mood


def phon(sentence):
    ph = TOK.phonemize(sentence, 'en-us')
    for a, b in SAY: ph = ph.replace(a, b)
    return ph


def shift(samples, sr, r, out_sr=44100):
    """Raise pitch and formants by r (sounds smaller / younger) while keeping the duration."""
    with tempfile.TemporaryDirectory() as d:
        i, o = os.path.join(d, 'i.wav'), os.path.join(d, 'o.wav')
        sf.write(i, samples, sr)
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', i, '-af', f'asetrate={sr}*{r:.4f},aresample={out_sr},atempo={1 / r:.5f}', '-ac', '1', o], check=True)
        y, _ = sf.read(o, dtype='float32')
    return y


def render(k, text, style, path):
    import numpy as np, random
    voice, ratio, speed = STYLES[style]
    parts, mood = prep(text)
    p_mood, s_mood = MOOD.get(mood, (1.0, 1.0))
    rnd = random.Random(text)                     # deterministic per line
    out = []
    for i, sent in enumerate(parts):
        lift, pace = 1.0, 1.0
        words = len(sent.split())
        if sent.endswith('!'): lift += 0.035
        if sent.endswith('?'): lift += 0.02
        if sent.endswith('...'): lift -= 0.03; pace *= 0.9
        if i == 0 and words <= 3: lift += 0.05; pace *= 1.04          # "Ooh!", "Yay!", "Aww..." pop out
        pace *= 1 + rnd.uniform(-0.03, 0.03)                           # tiny human variation
        y, sr = k.create(phon(sent), voice=voice, speed=speed * s_mood * pace, lang='en-us', is_phonemes=True)
        out.append(shift(y, sr, ratio * p_mood * lift))
        if i < len(parts) - 1: out.append(np.zeros(int(44100 * rnd.uniform(0.14, 0.24)), dtype='float32'))
    with tempfile.NamedTemporaryFile(suffix='.wav', delete=False) as tmp:
        sf.write(tmp.name, np.concatenate(out), 44100)
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', tmp.name, '-af', 'loudnorm=I=-16:TP=-1.5,afade=t=in:d=0.015',
                        '-ac', '1', '-c:a', 'libmp3lame', '-b:a', '64k', str(path)], check=True)
    os.unlink(tmp.name)


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else ''
    arg = lambda n: sys.argv[sys.argv.index(n) + 1] if n in sys.argv else None
    k = Kokoro(str(CACHE / 'kokoro-v1.0.onnx'), str(CACHE / 'voices-v1.0.bin'))
    if cmd == 'preview':
        d = CACHE / 'previews'; d.mkdir(exist_ok=True)
        line = LINES['greet'] + ' ' + LINES['sk-playwright']
        for n in STYLES:
            f = d / f'style-{n}.mp3'; render(k, line, n, f)
            print(f'▶ style {n}: {STYLES[n][0]} · {f}', flush=True)
            subprocess.run(['afplay', str(f)])
        print('\nPick one:  tools/testy-kokoro.py clips --style <n>')
    elif cmd == 'clips':
        style = int(arg('--style') or 3); only = (arg('--only') or '').split(',') if arg('--only') else None
        OUT.mkdir(parents=True, exist_ok=True)
        man_p = OUT / 'manifest.json'
        man = json.loads(man_p.read_text()) if man_p.exists() else {'clips': {}}
        n = 0
        for id_, text in LINES.items():
            if only and id_ not in only: continue
            f = OUT / f'{id_}.mp3'
            if f.exists() and '--force' not in sys.argv and man['clips'].get(id_): continue
            render(k, text, style, f); man['clips'][id_] = f.name; n += 1
            print(f'✓ {id_:16} {f.stat().st_size // 1024} KB', flush=True)
        man['voice'] = f'kokoro:{STYLES[style][0]}@{STYLES[style][1]}'
        man_p.write_text(json.dumps(man, indent=2) + '\n')
        print(f'\n{n} clip(s) rendered → audio/testy/')
    else:
        print(__doc__)


if __name__ == '__main__':
    main()
