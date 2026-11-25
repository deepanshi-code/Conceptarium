# Adds a narrator voice to the trailer: each line is spoken by a Windows built-in voice (System.Speech, offline),
# placed at the start of its scene (scene-times.json from make-trailer.py), and mixed into the MP4.
# Usage: python promo/add-voice.py <frames-dir> <video.mp4> <out.mp4> [voice name]
import json, subprocess, sys, wave
from pathlib import Path
import imageio_ffmpeg

frames_dir, video, out = Path(sys.argv[1]), sys.argv[2], sys.argv[3]
VOICE = sys.argv[4] if len(sys.argv) > 4 else 'Microsoft Zira Desktop'
scenes = json.loads((frames_dir / 'scene-times.json').read_text())

# (scene, seconds after the scene starts, line). SSML <break/> gives natural pauses.
LINES = [
    ('hello', 1.3, 'Hello.'),
    ('hero', 0.4, 'Welcome to Conceptarium.'),
    ('sky', 0.1, 'Fifty-eight interactive 3D models <break time="80ms"/> in fifteen subjects.'),
    ('beam', 0.3, 'Each model responds as you change it. <break time="250ms"/> Move the load, <break time="100ms"/> and the bending moment updates instantly.'),
    ('projectile', 0.2, 'Topics span physics, <break time="80ms"/> mechanical engineering, <break time="80ms"/> mathematics, <break time="80ms"/> and data structures.'),
    ('orbitals', 0.2, 'They also cover chemistry, <break time="80ms"/> biology, <break time="80ms"/> and electrical and civil engineering.'),
    ('network', 0.2, 'Computer networks are included too.'),
    ('practice', 0.2, 'Each concept includes exam-style problems with worked solutions.'),
    ('ask', 0.3, 'A built-in assistant answers your questions.'),
    ('end', 0.4, 'Conceptarium is free, <break time="100ms"/> requires no sign-up, <break time="100ms"/> and works offline.'),
]

work = frames_dir / 'voice'
work.mkdir(exist_ok=True)
ps_lines = ['Add-Type -AssemblyName System.Speech', '$s = New-Object System.Speech.Synthesis.SpeechSynthesizer', f"$s.SelectVoice('{VOICE}')"]
for i, (_, _, text) in enumerate(LINES):
    ssml = ('<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="en-US">'
            f'<prosody rate="-4%" pitch="-3%">{text}</prosody></speak>')
    path = (work / f'line{i}.wav').resolve()
    ps_lines += [f"$s.SetOutputToWaveFile('{path}')", f"$s.SpeakSsml('{ssml.replace(chr(39), chr(39) * 2)}')"]
ps_lines.append('$s.SetOutputToNull()')
(work / 'speak.ps1').write_text('\n'.join(ps_lines), encoding='utf-8-sig')
subprocess.run(['powershell', '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', str(work / 'speak.ps1')], check=True)

# The voice engine leaves silence at the end of each clip: trim it, so timing uses the real speech length.
import array
def trim_tail(path):
    with wave.open(str(path)) as w:
        params = w.getparams()
        data = array.array('h', w.readframes(w.getnframes()))
    ch = params.nchannels
    end = len(data)
    while end > ch and abs(data[end - ch]) < 300: end -= ch
    end = min(len(data), end + int(params.framerate * 0.08) * ch)  # keep a short natural tail
    with wave.open(str(path), 'wb') as w:
        w.setparams(params)
        w.writeframes(data[:end].tobytes())
for i in range(len(LINES)): trim_tail(work / f'line{i}.wav')

# Schedule: each line at its scene, but never overlapping the previous line.
starts, prev_end = [], 0.0
for i, (scene, offset, text) in enumerate(LINES):
    with wave.open(str(work / f'line{i}.wav')) as w:
        dur = w.getnframes() / w.getframerate()
    start = max(scenes[scene] + offset, prev_end + 0.15)
    starts.append(start)
    prev_end = start + dur
    print(f'{start:6.2f}s  {dur:4.1f}s  {scene:10}  {text[:60]}')

ff = imageio_ffmpeg.get_ffmpeg_exe()
inputs, chains = ['-i', video], []
for i, start in enumerate(starts):
    inputs += ['-i', str(work / f'line{i}.wav')]
    chains.append(f'[{i + 1}:a]aresample=48000,adelay={int(start * 1000)}:all=1[a{i}]')
mix = ''.join(f'[a{i}]' for i in range(len(starts)))
# Mix, add a touch of warmth and loudness normalisation for phones/social media.
graph = ';'.join(chains) + f';{mix}amix=inputs={len(starts)}:normalize=0,highpass=f=80,lowpass=f=9000,acompressor=threshold=-18dB:ratio=3,loudnorm=I=-16:TP=-1.5,aresample=48000,apad[aout]'
subprocess.run([ff, '-y', '-loglevel', 'error', *inputs, '-filter_complex', graph, '-map', '0:v', '-map', '[aout]',
                '-c:v', 'copy', '-c:a', 'aac', '-b:a', '160k', '-ar', '48000', '-shortest', '-movflags', '+faststart', out], check=True)
print('written', out, round(Path(out).stat().st_size / 1e6, 1), 'MB')
