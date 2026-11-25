# Trailer

`conceptarium-trailer.mp4` (1080p, ~57 s, ~11 MB, with narration) is a screen recording of the real site with captions, for
LinkedIn / Instagram / WhatsApp. It is not committed (see `.gitignore`); remake it after UI changes:

```
python serve.py 5175                                    # in one terminal
node promo/record-trailer.mjs http://localhost:5175/ promo/frames
pip install imageio-ffmpeg                               # once: provides ffmpeg
python promo/make-trailer.py promo/frames promo/trailer-silent.mp4
python promo/add-voice.py promo/frames promo/trailer-silent.mp4 promo/conceptarium-trailer.mp4
```

`record-trailer.mjs` drives headless Chrome (DevTools screencast) through the scenes; `make-trailer.py` turns the
frames into a 30 fps H.264 MP4 and notes where each scene starts; `add-voice.py` speaks the narration
(Windows' built-in Microsoft Zira voice, offline; pass another installed voice name as a 4th argument) and syncs each
line to its scene. The script's lines are at the top of `add-voice.py`.
