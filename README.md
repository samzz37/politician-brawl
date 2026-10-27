# Politician Brawl 🎤🥊

A responsive browser party brawler inspired by the broad layout and pick-up-and-play controls of browser fighting games such as Sansad Showdown. It uses original fictional parody characters and original UI/code.

A responsive browser party brawler for phones, tablets and PCs. Players can create/join rooms by code, with up to six players per room. Built with HTML/CSS/vanilla JS, Node.js, Express and Socket.IO.

## Features
- Responsive touch controls and PC keyboard controls
- Create a room or join using a room code
- Up to 6 players in one room
- Server-synchronized movement, health, score, attacks, grabbing and dragging
- Selectable fictional politician-parody characters, jump/climb, debate and a Shakti-powered super attack
- Landscape-friendly mobile layout with on-screen touch controls
- No database or paid asset required

## Run locally
Requires Node.js 20+.

```bash
npm install
npm start
```

Open http://localhost:3000. To test multiplayer on your local Wi-Fi, use the computer's LAN IP address from each device; allow Node.js through the local firewall if prompted.

## Free hosting on Render
This repository includes `render.yaml` for a Node web service.

1. Create a GitHub repository and upload these project files (keep `package.json`, `server.js`, `render.yaml`, and `public/`).
2. Sign in to Render and choose **New → Blueprint** (or create a **Web Service** connected to the repo).
3. For a Blueprint, Render reads `render.yaml`. For manual setup use:
   - Runtime: Node
   - Build command: `npm install`
   - Start command: `npm start`
   - Plan: Free
4. Deploy. Render will provide a public `https://…onrender.com` address. Open it on PC/mobile and share the same room code.

### Free-tier caveat
Render free web services can spin down after 15 minutes without inbound traffic and may take about a minute to wake. Free hosting is suitable for a hobby/demo, not guaranteed always-on service. Hosting plan limits can change.

## Gameplay controls
- Move: `A` / `D` or arrow keys
- Jump: `W` / `↑`
- Punch: `J`
- Kick: `K`
- Grab: `G`
- Drag: `H`
- Climb: `E`
- Debate: `Q`
- Super: `L` (charge Shakti by landing attacks)
- Touch users can tap the on-screen buttons.

## Notes
- This is a playful fictional parody; the character names are fictional.
- The game does not require logins or collect persistent player profiles.
