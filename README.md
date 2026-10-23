# HaptiGuide dashboard

Folder layout:
  app.py, requirements.txt, Procfile, render.yaml
  templates/index.html        <- your dashboard page (copy it here)
  static/app.js, style.css, floorplan.png, haptic_reference.png
  esp32_example/haptiguide_esp32_telemetry.ino

Run locally (Windows):
  py -m venv .venv
  .\.venv\Scripts\python.exe -m pip install -r requirements.txt
  .\.venv\Scripts\python.exe app.py
Open http://127.0.0.1:5000

Deploy online: see the steps given in chat (GitHub -> Render).
This is a prototype, not a certified mobility aid.
