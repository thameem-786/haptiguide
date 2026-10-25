
# HaptiGuide AI

**An agentic haptic wearable for spatial awareness, navigation and context-aware physical interaction.**

- **Vishwakarma Application ID:** VK26-AU-HCI-0025
- **Event:** Vishwakarma Awards 2026-27, Stage 2
- **Track:** Human-Computer Interaction (HCI)
- **Institution:** Dr. Mahalingam College of Engineering and Technology (MCET), Pollachi
- **Live software prototype:** https://haptiguide.onrender.com

## Team

| Name |
|------|
| Mohammed Thameem B |
| Nikilesh Mano |
| Hari Kummaran |
| Sri Hari G |
| Rahul Pravin K |

## What it does

HaptiGuide AI guides a user through touch instead of a screen or audio. It follows a continuous loop:

1. **Sense:** a ToF sensor, ultrasonic sensors and an IMU observe the space.
2. **Understand:** a context engine reads distance, direction and motion.
3. **Decide:** an agentic priority layer picks the single most important cue.
4. **Feel:** vibration motors on the body give a directional pattern.
5. **Act:** the user responds with eyes and ears free.

## Haptic channels

| Channel | Position | Meaning |
|---------|----------|---------|
| 01 | Left shoulder | Turn left |
| 02 | Right shoulder | Turn right |
| 03 | Upper back | Forward / alert |
| 04 | Lower back | Stop / danger |

## Repository structure

Add your files into these folders. Do not re-save or rename native files, because creation timestamps are audited.

```
HaptiGuide-AI/
|-- README.md
|-- cad/
|   |-- step/                 # native .STEP files
|   |-- drawings/             # HG-AI-CONCEPT-01, 02, 03 (PDF)
|   `-- renders/              # exploded view, position map, module detail
|-- electronics/
|   |-- kicad/                # .kicad_sch, .kicad_pcb, DRC report
|   `-- bom/                  # BOM spreadsheet
|-- firmware/                 # ESP32 source code
|-- software/                 # navigation dashboard source code
|-- fea/                      # simulation files, stress plots, mesh statistics
`-- evidence/
    |-- photos/               # team photos with ID badges, bench photos
    `-- screenshots/          # CAD feature tree, KiCad, dashboard
```

## Hardware (prototype)

- ESP32 development board (ESP32-WROOM-32)
- VL53L1X time-of-flight sensor (front)
- 2x HC-SR04 ultrasonic sensors
- MPU6050 IMU
- 4x coin vibration motors with transistor drivers and flyback diodes
- 2x 18650 Li-ion cells with a 2-cell holder
- DC-DC converter module
- Optional ESP32-CAM for scene tags

The current build is a breadboard prototype. The next step is moving the circuit onto perfboard inside the waist enclosure.

## Planned ESP32 pin map

This is the planned map. Update it to match your wiring and firmware.

| Signal | GPIO |
|--------|------|
| I2C SDA / SCL (ToF, IMU) | 21 / 22 |
| Ultrasonic left TRIG / ECHO | 25 / 34 |
| Ultrasonic right TRIG / ECHO | 26 / 35 |
| Motor left shoulder / right shoulder PWM | 18 / 19 |
| Motor upper back / lower back PWM | 23 / 16 |
| Battery sense (ADC) | 36 |

The ultrasonic echo lines need a 5 V to 3.3 V divider.

## Mechanical design (CAD Rev A)

- Garment shell, adult-medium envelope: 487 mm high, 770 mm cuff-to-cuff, 436 mm waist width
- Motor module: 74 x 74 x 3.5 mm plate, 4x M3 holes at 58 mm pitch, 26 mm motor cavity
- Waist electronics enclosure: 160 x 112 x 37 mm, ventilated lid, battery hatch 54 x 68 mm
- Proposed material: PETG (FDM) for the enclosure and motor modules

## Software prototype

A web dashboard with a destination picker, an indoor map of the MCET ECE block, next-turn instructions, a haptic feedback guide and ESP32 device status. Without the ESP32 connected, it runs in demo mode.

## Project status

| Area | Status |
|------|--------|
| Software dashboard | Working demo |
| Breadboard hardware | Working prototype |
| CAD Rev A and drawings | Concept complete |
| FEA | Planned, results to be added |
| Fit, comfort and safety validation | Not yet done |
| Field testing | Planned for Stage 3 |

The CAD is a conceptual design envelope. It is not checked for human fit, comfort, water ingress or safety. Measure the real ESP32, motors, cells and driver before fabrication.

## Safety note

HaptiGuide AI is an assistive guidance aid. It does not guarantee obstacle detection or user safety.

## Roadmap (planning dates)

| Month | Focus |
|-------|-------|
| Nov 2026 | Measure real parts, revise CAD, order parts, KiCad layout |
| Dec 2026 | Print enclosure and modules, assemble electronics, sensor tests |
| Jan 2027 | Spatial logic, priority agent, navigation-to-haptic mapping |
| Feb 2027 | Indoor and outdoor trials, tuning, documentation |

## License

Add a license of your choice, for example MIT, before making the repository public.
