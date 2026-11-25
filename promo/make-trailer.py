# Turns the recorded screencast frames (variable timing) into a smooth 30 fps H.264 MP4.
# Usage: python make-trailer.py <frames-dir> <out.mp4>
import json, subprocess, sys
from pathlib import Path
import imageio_ffmpeg

frames_dir, out = Path(sys.argv[1]), sys.argv[2]
times = json.loads((frames_dir / 'times.json').read_text())
# Scene changes go through a plain dark "fade" frame while the next page loads. Squeeze any run of those
# (near-uniform dark frames) down to a quick 0.15 s blink so the cuts feel snappy.
from PIL import Image, ImageStat
durs = [(times[i + 1] - t) if i + 1 < len(times) else 1 / 30 for i, t in enumerate(times)]
def is_fade(i):
    st = ImageStat.Stat(Image.open(frames_dir / f'f{i:05d}.jpg').convert('L').resize((160, 90)))
    return st.mean[0] < 12 and st.stddev[0] < 3
fade = [is_fade(i) for i in range(len(times))]
i = 0
while i < len(times):
    if fade[i]:
        j = i
        while j < len(times) and fade[j]: j += 1
        run = sum(durs[i:j])
        if run > 0.15:
            for k in range(i, j): durs[k] *= 0.15 / run
        i = j
    else:
        i += 1
print('length after squeezing fades:', round(sum(durs), 1), 's')
# Where each scene starts in the final video (for add-voice.py).
marks_file = frames_dir / 'marks.json'
if marks_file.exists():
    import bisect
    marks = json.loads(marks_file.read_text())
    starts = [0.0]
    for d in durs: starts.append(starts[-1] + d)
    scene = {name: round(starts[min(bisect.bisect_left(times, t), len(times) - 1)], 2) for name, t in marks.items()}
    (frames_dir / 'scene-times.json').write_text(json.dumps(scene, indent=1))
    print('scene times:', scene)
lines = ['ffconcat version 1.0']
for i in range(len(times)):
    lines += [f"file 'f{i:05d}.jpg'", f'duration {max(durs[i], 0.001):.4f}']
lines.append(f"file 'f{len(times) - 1:05d}.jpg'")  # the concat demuxer needs the last file repeated
(frames_dir / 'list.ffconcat').write_text('\n'.join(lines))
ff = imageio_ffmpeg.get_ffmpeg_exe()
cmd = [ff, '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', str(frames_dir / 'list.ffconcat'),
       '-vf', 'fps=30,scale=1920:1080:flags=lanczos:in_range=full:out_range=tv,format=yuv420p,tpad=stop_mode=clone:stop_duration=1.2', '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20',
       '-movflags', '+faststart', out]
subprocess.run(cmd, check=True)
print('written', out, round(Path(out).stat().st_size / 1e6, 1), 'MB')
