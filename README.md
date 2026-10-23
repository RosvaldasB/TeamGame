# Drafters vs Workload Demons — party ledger, role dashboards + offline sandbox v1.2

A browser deduction game for 30 players plus one human Game Master. English only, with a retro drafting-office interface, private rooms, live text chats, secret role actions, and text announcements. Desktop first; a narrow layout is included, but phone usability still needs testing.

## Open without Node.js (recommended for your company PC)

1. Extract the ZIP.
2. Double-click **OFFLINE_DEMO.html**, or right-click → Open with → Chrome/Edge.
3. Click **Explore the night shift** for a ready-made game, or **Test the lobby** to change rules first.
4. Use the top selector to switch between Darius (GM), simulated players, and public presentation.
5. Try individual actions/chats/votes, or use **Submit sample actions** and **Simulate night outcome**. Then select Darius and release the results.
6. Continue into discussion, trial, and another night using the normal GM controls.

No Node.js, internet, installation, terminal, or hosted server is required for this demo. Both supplied pictures, CSS, JavaScript, and the real rules engine are embedded in the HTML file. You can copy this single file anywhere. It simulates 16 players locally; it is not live multiplayer. Role switching is deliberately available only in this sandbox.

The demo also has **Simulate unread messages** to test the two orange chat indicators. General and demon messages are separate, and a player only sees permitted channels.

The demo remembers progress in browser storage when the browser permits it. Use Export/Import demo save if file-based storage is restricted. Reset creates a new sandbox. Detached chat/public windows require browser popups to be allowed. Private role text is hidden by default. Real multiplayer still runs through the Node.js server with permissions enforced.

The visual theme now uses your Draftersville entrance and Drafters-versus-Demons artwork directly, dark office surfaces, warm amber accents, confidential red dossiers, and green CRT chat panels. Announcements remain text; no role-event videos have been added.

## Run the multiplayer server on Windows

1. Install **Node.js 24** from https://nodejs.org/ . No other packages are required.
2. Extract the entire ZIP. Do not run files from inside the ZIP.
3. Double-click **START_GAME.bat**.
4. Open **http://localhost:3000**. If the browser opened before the server was ready, refresh it.
5. Create a room with your nickname and a private GM code of at least six characters.
6. Creating as **Darius** automatically makes you GM. In another nickname, the lobby elects GM by a majority of everyone currently in the room. A joining Darius can claim an unfilled GM position using the creator's private GM code.
7. Keep the server window open. Stop it with Ctrl+C.

Mac/Linux or terminal equivalent:

```sh
# Open a terminal in the extracted project folder.
npm start
```

There is no npm install step because this project uses Node's built-in HTTP, cryptography, and SQLite support. It uses a live server event stream and HTTP commands rather than a Socket.IO dependency.

## How teammates connect

**localhost refers to each person's own computer.** A localhost link does not let remote teammates join your computer.

For a test on the same trusted local network, teammates can visit http://YOUR-COMPUTER-LAN-IP:3000 if Windows Firewall and your company network allow it. Use a different browser profile/private window for each test player. Ask your IT team before changing office firewall/network settings.

For normal remote play, deploy the project to an HTTPS hosting service. Everyone then uses the same hosted URL, enters a room nickname, and joins with the room code. Only the person hosting needs Node.js; players just need a browser. No purchased domain is necessary.

## First test game and updated controls

1. Create a room as Darius. Join from another browser profile/private window for each player. At least four players are needed; the default 12 special roles must be reduced for a smaller test.
2. In the lobby, save role counts, timers, Priest targeting, tie behavior, and the new **Automatically publish special-role success notices** checkbox. It is **off by default**.
3. Assign roles and begin night. The main view is now the **Party Night Log** spreadsheet. It shows employee status, current public nomination/trial votes, previous public voting rounds, and revealed roles in the right-hand column. Dead ghosts keep their revealed role visible.
4. General and Demons are the only chats. A dark-orange button and unread count signal messages not yet read. Demons chat is available only to living demons and GM. The chat panel opens when its button is clicked; close it to prioritize the table.
5. Special-role players use **Your Desk → Private role action dashboard**. Save a selection, review the draft, then **Lock in actions**. The GM receives only the locked submission. Saved drafts cannot protect, poison, or investigate. Locks are final for the night. Choose **Skip this window** to submit no action.
6. Analyst, Doctor, Guard, and Priest act before the GM locks demon voting. The Succubus window opens after that lock; it receives a fresh night-length timer. Expired windows reject saves and locks on the server. Priest can save both a protection target and a redirection target before locking the combined selection.
7. Investigations deliver a private **Yes/No** in the acting player's dashboard immediately after lock-in, with a private result history. No chat or public bulletin receives that answer. The GM can inspect the locked selection and answer.
8. GM resolves the night privately. Review deaths/protections and any pending Enforcer action. Private protection outcome details remain held until GM releases the outcomes to the notice board.
9. With automatic success notices checked, successful role tasks are posted on the notice board after the GM releases outcomes. With it unchecked, they stay in the GM dashboard until GM clicks **Reveal on notice board**. These menacing notices name the role/task, never the acting or investigated player. Secret Burned-Out conversions are never auto-announced publicly.
10. During discussion, living players can choose a public nomination. The table shows who nominated whom. GM chooses the final accused and opens trial voting. Execute, spare, and abstain votes are shown against that accused. One trial per day; nominations and final ballots are preserved in the table's Shift columns.
11. Begin the next night. Night demon targets never enter the public history. Only demons and GM see the secret target-vote column; everyone else sees **Sealed**.

Timers require the GM to advance phases and announce results. Zero means unlimited. Unsubmitted roles skip their optional action when the GM closes their window; Guard's automatic self-protection still applies. Start a new room for another game.

## Privacy, chats, notices and screen sharing

- General and Demons are the only chat channels. The old player-ID/GM chat tabs have been removed from the interface **and denied by the server**.
- System events, deaths, Cat saves, ghost arrivals and GM announcements appear on the pinned **Office Notice Board**, not as chat messages.
- No role drafts, answers, private result history, successes awaiting release, Cat ownership or unused ability counts are sent to other players or the public presentation.
- The GM's table reveals all roles and includes a private resources strip. **Share only the separate public presentation window**, which receives public data only. Hide all secrets switches the GM screen to that projection.
- Public chat is read-only at night; private demon chat stays available. Dead spectators can read public chat but cannot write; eligible ghosts can write but cannot vote or reveal secrets.
- Unread chat receipts are tracked separately for each room, player and channel. An open, focused chat at the bottom marks arriving messages read; a closed/background chat keeps the orange unread indicator.
- Refreshing reconnects using the browser token. Reconnect-key files grant role/session access: keep them private.
- Old saved rooms are migrated on access: private player channels are removed, old system messages become board notices, and existing submitted role selections remain locked. Test with a new room when changing versions; do not update the service mid-game.

## Agreed role rules implemented

- Four demon identities: Auditor, Deadline Beast, Ink Demon, Whispering Manager. They know teammates and vote on nightly targets. Counts are configurable.
- Analyst: one nightly yes/no inquiry about whether a player is evil (attacking demons plus Succubus). Unconverted Burned-Out Drafter is No; converted is Yes.
- Succubus: one nightly yes/no inquiry about whether a player is Analyst, after demon vote lock. Its death grants two different targets for the next night only.
- Burned-Out Drafter: an unblocked demon attack converts them without death. They privately join the demon team after GM releases the night's outcomes. Trial, poison, and Enforcer attacks kill normally.
- Cat Neo: a secret transferable item, not a player role. Starts with nine charges. Assigned randomly among living players at the first night and each following night; stays through the day. A random draw may select the same holder again. Blocks demon attack, trial execution, poison, or Enforcer kill; consumes one charge per blocked event. Only GM sees holder and remaining charges. Public learns when it prevents a death.
- Guard: protects himself automatically and may protect one other person from demon attacks. Three lives; at most one life is spent per night, even if both are targeted. Spending the final life still blocks that night's covered attacks. With zero lives on a later night, automatic protection is gone.
- Doctor: protect one person each night OR poison once per game. Self-protection once per game. Submitting a protection replaces poison and vice versa. Poison and self-protection uses are consumed when night resolves. Protection blocks demon attacks.
- Priest: protect someone else twice per game; consumes a protection only when it blocks a demon attack. Redirect a demon attack against himself once per game. Target mode is chosen by GM before the game: player selection or random other living player. Random redirects may hit demons. In player mode, no selected redirect target means no redirection.
- Enforcer: on death, may kill one living player; can decline. GM can submit/waive the final action if the player is unavailable. Cat can prevent the final kill.
- Touched by Heaven: death caused by demons skips their next attack. Trial death skips the following day's trial. Poison or Enforcer death causes neither effect.
- Protection precedence for demon attacks: Cat → Guard → Priest → Doctor → Burnout conversion → death. Cat also precedes other kill types. Poison resolves after demon attacks. Redirect loops are stopped.
- Drafters win when no attacking demons remain, even if Succubus or an unconverted Burned-Out Drafter remains. Attacking demons win when they equal/outnumber living non-evil Drafters. Succubus is excluded from the Drafter count but does not count as an attacking demon.
- Exact roles are publicly revealed upon death. No living role reveal.

Unique special roles have counts of 0 or 1; demon variants can have multiple copies. The rules board locks at game start. Some edge-case interpretations above were necessary to make this playable; we can revise them after a team test.

## Deployment on Render — free trial setup

This is a runnable server project, not a single static HTML page. Choose **Web Service**, not Static Site.

1. Create a private GitHub repository. The v1.2 deployment ZIP has no extra enclosing folder. Upload **all files and subfolders**, including `public/assets`, so `package.json`, `server.js`, and `public` are at the repository root. Do not upload `data` or reconnect keys.
2. In https://dashboard.render.com/ choose **New → Web Service** and connect the repository.
3. Select the Node runtime and a region near your team.
4. Set **Build Command** to `npm test` and **Start Command** to `npm start`.
5. Set environment variable **NODE_VERSION=24.19.0**. This is the exact version used for development/testing. The included `.node-version` also specifies it.
6. Set health-check path to `/health`. Choose the Free plan for a first trial.
7. Deploy. Open the HTTPS `onrender.com` URL, create a room, and share the room link/code.

The included `render.yaml` is an optional Blueprint alternative with these values.

**Free-plan limitation:** Render free web services sleep after inactivity and use an ephemeral filesystem. This SQLite version can lose rooms/sessions when a free host restarts or redeploys. Do not depend on free Render for preserving an ongoing game. Free bandwidth limits also apply. Browser refresh recovery works as long as the server still has the room.

For durable hosted games, use a paid Render web service with a persistent disk mounted at `/var/data`, and set **DATA_DIR=/var/data**. The SQLite file must live on that mount. Run one service instance; this version does not coordinate multiple servers. Do not deploy updates in the middle of a game.

Official deployment references checked on 2026-10-09:
- https://render.com/docs/deploy-node-express-app
- https://render.com/docs/node-version
- https://render.com/docs/free
- https://render.com/docs/disks

## Railway or Docker alternative

Railway can run the included Dockerfile. Connect the same repository, use one instance, attach a volume at `/app/data`, and expose the application's HTTP port (3000, or Railway's PORT value). The Dockerfile sets DATA_DIR=/app/data. Set the health-check path to `/health`. Review current pricing before deploying: https://railway.com/pricing . Hobby has a $5 monthly minimum including usage, with additional charges if resources exceed it. A volume is necessary for restart-safe sessions.

Docker locally:

```sh
docker build -t drafters-game .
docker run --rm -p 3000:3000 -v drafters-data:/app/data drafters-game
```

## Media placeholders

All events currently use text. `public/media.js` contains the future event mapping placeholders. Public announcements contain `media: null`. When we coordinate actual assets, add the trigger, file, audience, and whether GM releases it. Confidential videos/images need authenticated delivery, not public files whose filenames spoil roles. The two theme images are included. Role-event media remain text placeholders; no media upload feature is included.

## Project files

- `server.js`: HTTP API, live event streams, authentication, transactional game-state saves, SQLite persistence.
- `game.js`: game rules, action permissions, chat access, and public/private state projections.
- `public/`: browser interface, style, and future media mapping placeholders.
- `test/`: gameplay/privacy tests and HTTP/SSE/restart integration test.
- `START_GAME.bat`: Windows server launcher.
- `OFFLINE_DEMO.html`: standalone no-install browser sandbox.
- `scripts/build-offline.py`: developer utility to rebuild the sandbox after changing shared code (Python needed only to rebuild it).
- `Dockerfile` / `render.yaml`: deployment templates.

## Validation and current limits

Run `npm test`. The included checks cover locked/draft role separation, private responses, optional success notices, readable chat labels, unread indicators, public voting history and night secrecy, plus 30-player joining, GM permissions, private chat access, investigation rules, conversion, protection priority, consumable limits, ghost permissions, outcome release, win conditions, live event delivery, reconnecting, concurrent joining, and SQLite recovery after restart.

A real visual browser test has not run. Automated interface checks validate generated markup and code paths, not pixel layout. Start with a small team test to check layout, detached windows, and screen sharing. Voice chat is not built in; use your existing team call alongside text chat. There is no deployment/account connection yet: the ZIP is ready to host, but no public server has been created.

The prototype has no room deletion, player removal, late joining, GM transfer, replay-in-place, or outcome undo. Reconnect works with the original browser token/key. Timers retain absolute deadlines over restart, so an elapsed timer is shown as time up; GM decides when to advance. Keep the database private. Back it up while the server is stopped, including SQLite sidecar files if they remain.
