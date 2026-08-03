import type { GuideDocument } from "@/features/guide/guide-types";

/**
 * Story spine for Pokémon Modern Emerald (nzl_modern) — this league’s ROM.
 * Focused on non-obvious progression gates, not 100% completion.
 *
 * Notable Modern Emerald vs vanilla callouts are baked into step copy
 * (random starter, bag HMs, etc.).
 *
 * Gym party notes use vanilla Emerald teams (Modern Emerald Normal keeps them;
 * Hard+ may differ).
 */
export const EMERALD_GUIDE: GuideDocument = {
  id: "modern-emerald",
  gameLabel: "Pokémon Modern Emerald",
  chapters: [
    {
      id: "prologue",
      title: "Littleroot → Petalburg",
      summary: "Random starter, start the Nuzlocke on Route 103, then Dad in Petalburg.",
      requiresBadges: [],
      locations: [
        "Littleroot Town",
        "Route 101",
        "Oldale Town",
        "Route 103",
        "Route 102",
        "Petalburg City",
      ],
      sortOrder: 0,
    },
    {
      id: "rustboro",
      title: "Rustboro & Devon",
      summary: "Petalburg Woods, Roxanne, and the letter for Steven.",
      requiresBadges: [],
      clearsWithBadge: "gym-1",
      locations: [
        "Route 104",
        "Petalburg Woods",
        "Rustboro City",
        "Route 116",
      ],
      sortOrder: 1,
    },
    {
      id: "dewford",
      title: "Dewford & Steven",
      summary: "Letter delivery, Granite Cave, Brawly.",
      requiresBadges: ["gym-1"],
      clearsWithBadge: "gym-2",
      locations: [
        "Dewford Town",
        "Granite Cave",
        "Route 106",
        "Route 107",
        "Route 108",
        "Route 109",
        "Abandoned Ship",
      ],
      sortOrder: 2,
    },
    {
      id: "mauville",
      title: "Slateport → Mauville",
      summary: "Museum plot, Wattson, Rock Smash → Rusturf Tunnel.",
      requiresBadges: ["gym-1", "gym-2"],
      clearsWithBadge: "gym-3",
      locations: [
        "Slateport City",
        "Route 110",
        "Mauville City",
        "Route 117",
        "Verdanturf Town",
        "Rusturf Tunnel",
        "New Mauville",
      ],
      sortOrder: 3,
    },
    {
      id: "fallarbor",
      title: "Fallarbor & Meteor Falls",
      summary: "Route 111 north, Meteor Falls plot, Go-Goggles, cable car setup.",
      requiresBadges: ["gym-1", "gym-2", "gym-3"],
      locations: [
        "Route 111",
        "Route 112",
        "Fiery Path",
        "Route 113",
        "Fallarbor Town",
        "Route 114",
        "Meteor Falls",
        "Route 115",
      ],
      sortOrder: 4,
    },
    {
      id: "lavaridge",
      title: "Mt. Chimney → Lavaridge",
      summary: "Cable car, Team Magma/Aqua on the summit, Flannery.",
      requiresBadges: ["gym-1", "gym-2", "gym-3"],
      clearsWithBadge: "gym-4",
      locations: [
        "Mt. Chimney",
        "Jagged Pass",
        "Lavaridge Town",
        "Desert Underpass",
      ],
      sortOrder: 5,
    },
    {
      id: "petalburg-gym",
      title: "Petalburg Gym",
      summary: "Norman unlocks after four badges.",
      requiresBadges: ["gym-1", "gym-2", "gym-3", "gym-4"],
      clearsWithBadge: "gym-5",
      locations: [],
      sortOrder: 6,
    },
    {
      id: "fortree",
      title: "Fortree & Weather Institute",
      summary: "Surf north, Team Magma/Aqua, Winona.",
      requiresBadges: ["gym-1", "gym-2", "gym-3", "gym-4", "gym-5"],
      clearsWithBadge: "gym-6",
      locations: [
        "Route 118",
        "Route 119",
        "Fortree City",
        "Route 120",
        "Safari Zone",
      ],
      sortOrder: 7,
    },
    {
      id: "mossdeep",
      title: "Lilycove → Mossdeep",
      summary:
        "Mt. Pyre → Magma Hideout → Slateport sub theft → Aqua Hideout → Mossdeep / Space Center / Dive.",
      requiresBadges: [
        "gym-1",
        "gym-2",
        "gym-3",
        "gym-4",
        "gym-5",
        "gym-6",
      ],
      clearsWithBadge: "gym-7",
      locations: [
        "Route 120",
        "Route 121",
        "Mt. Pyre",
        "Jagged Pass",
        "Magma Hideout",
        "Slateport City",
        "Lilycove City",
        "Route 122",
        "Route 123",
        "Route 124",
        "Mossdeep City",
        "Mossdeep Space Center",
        "Route 125",
        "Shoal Cave",
      ],
      sortOrder: 8,
    },
    {
      id: "sootopolis",
      title: "Seafloor → Sootopolis",
      summary: "Dive, Seafloor Cavern, Sky Pillar / Rayquaza, Juan.",
      requiresBadges: [
        "gym-1",
        "gym-2",
        "gym-3",
        "gym-4",
        "gym-5",
        "gym-6",
        "gym-7",
      ],
      clearsWithBadge: "gym-8",
      locations: [
        "Route 126",
        "Route 127",
        "Route 128",
        "Underwater",
        "Seafloor Cavern",
        "Sootopolis City",
        "Cave of Origin",
        "Route 131",
        "Sky Pillar",
      ],
      sortOrder: 9,
    },
    {
      id: "elite-four",
      title: "Victory Road & League",
      summary: "Ever Grande, Victory Road, Elite Four, Champion.",
      requiresBadges: [
        "gym-1",
        "gym-2",
        "gym-3",
        "gym-4",
        "gym-5",
        "gym-6",
        "gym-7",
        "gym-8",
      ],
      clearsWithBadge: "championship",
      locations: [
        "Route 129",
        "Route 130",
        "Route 131",
        "Pacifidlog Town",
        "Route 132",
        "Route 133",
        "Route 134",
        "Ever Grande City",
        "Victory Road",
      ],
      sortOrder: 10,
    },
    {
      id: "last-step",
      title: "Last Step",
      summary: "Ping the season hosts in Discord to lock in your team.",
      requiresBadges: [],
      locations: [],
      sortOrder: 11,
    },
  ],
  steps: [
    // —— Prologue ——
    {
      id: "prologue-starter",
      chapterId: "prologue",
      title: "Receive your random starter",
      summary:
        "Help Prof. Birch on Route 101 — Modern Emerald gives a randomized starter (not a fixed Hoenn trio pick).",
      detail:
        "After the moving truck cutscene in **Littleroot**, help Birch on **Route 101**. In **Modern Emerald** your starter is **randomized** from the challenge/randomizer settings — you don’t pick Mudkip / Torchic / Treecko unless that option is off.\n\n**The Nuzlocke has not started yet.** Wild encounters before the Route 103 rival fight do not count. Plan early gym prep around whatever species you rolled (Roxanne is Rock; Brawly is Fighting).",
      locations: ["Littleroot Town", "Route 101"],
      nuzlockeNote:
        "Starter is free. Do not treat Route 101 as your first locked encounter.",
      priority: "critical",
      sortOrder: 10,
    },
    {
      id: "prologue-start-nuzlocke",
      chapterId: "prologue",
      title: "Start the Nuzlocke (Route 103)",
      summary:
        "Rival fight north of Oldale, then return to Littleroot for the Pokédex and 100 Poké Balls — that’s when the run begins.",
      detail:
        "The Modern Emerald Nuzlocke **does not start** when you get your starter. Complete this sequence first:\n\n1. Walk **Oldale Town → Route 103** (the route **north** of Oldale).\n2. Fight your **rival** on Route 103.\n3. Return to **Littleroot** and get the **Pokédex** from **Prof. Birch**.\n4. Receive **100 Poké Balls** from your rival.\n\nAfter that handoff, encounter locking and the rest of the Nuzlocke rules are live. Head west/south from Oldale toward Petalburg when you’re ready.",
      locations: ["Oldale Town", "Route 103", "Littleroot Town"],
      requiresSteps: ["prologue-starter"],
      keyItems: ["Pokédex"],
      nuzlockeNote:
        "First real encounter lock begins after this — not on Route 101.",
      priority: "critical",
      sortOrder: 15,
    },
    {
      id: "prologue-oldale-petalburg",
      chapterId: "prologue",
      title: "Reach Petalburg and talk to Dad",
      summary: "Visit Petalburg Gym — Norman sends you to Rustboro first.",
      detail:
        "Go through **Oldale** → **Route 102** → **Petalburg City**. Talk to **Norman** in the Gym. He will not battle you until you have **four badges**. He points you toward **Rustboro** via Route 104 / Petalburg Woods.",
      locations: ["Oldale Town", "Route 102", "Petalburg City"],
      requiresSteps: ["prologue-start-nuzlocke"],
      priority: "critical",
      sortOrder: 20,
    },
    {
      id: "prologue-route-104",
      chapterId: "prologue",
      title: "Head toward Rustboro",
      summary: "North on Route 104 into Petalburg Woods, then out to Rustboro.",
      detail:
        "From Petalburg, go **west/north on Route 104**. You’ll enter **Petalburg Woods**, then exit north toward **Rustboro City**. Don’t skip the woods event — a Devon researcher needs help before the north exit opens cleanly.",
      locations: ["Route 104", "Petalburg Woods", "Rustboro City"],
      requiresSteps: ["prologue-oldale-petalburg"],
      priority: "critical",
      sortOrder: 30,
    },

    // —— Rustboro ——
    {
      id: "rustboro-petalburg-woods",
      chapterId: "rustboro",
      title: "Clear Petalburg Woods",
      summary: "Help the Devon researcher — Magma/Aqua grunts block the north exit.",
      detail:
        "In **Petalburg Woods**, help the Devon employee fight off the Team Magma/Aqua grunt. Afterward you can continue north to **Rustboro City**.",
      locations: ["Petalburg Woods", "Rustboro City"],
      requiresSteps: ["prologue-route-104"],
      priority: "critical",
      sortOrder: 10,
    },
    {
      id: "rustboro-roxanne",
      chapterId: "rustboro",
      title: "Defeat Roxanne (Stone Badge)",
      summary: "Rustboro Gym — Rock types. Stone Badge enables field Cut (optional).",
      detail:
        "**Roxanne** is a Rock specialist. Water, Grass, and Fighting hit hard; Fire / Electric / Flying often bounce.\n\nThe **Stone Badge** unlocks **Cut** in the overworld if you pick up that HM — Cut is **not** required for the main story.",
      locations: ["Rustboro City"],
      gymPrep: {
        leaderName: "Roxanne",
        specialtyTypes: ["Rock"],
        recommendedTypes: ["Water", "Grass", "Fighting"],
        cautionTypes: ["Fire", "Electric", "Flying", "Normal"],
        partyNotes:
          "Vanilla Emerald: Geodude ×2, Nosepass. Modern Emerald Normal keeps gym parties; Hard+ may buff them.",
      },
      nuzlockeNote: "Gym battles are free XP — still respect your level cap.",
      priority: "critical",
      sortOrder: 20,
    },
    {
      id: "rustboro-get-cut",
      chapterId: "rustboro",
      title: "Optional: pick up Cut",
      summary:
        "Cutter’s house near the Rustboro Center — useful for item trees, not story-required.",
      detail:
        "From the **Rustboro Pokémon Center**, the **Cutter’s house** is nearby (west / same block as the Center in Modern Emerald layouts). Talk to him for **HM01 Cut**.\n\n**Cut is not needed for Rusturf Tunnel or main story progression.** It only removes thin trees for optional items and shortcuts (e.g. side pockets on early routes).\n\nIn Modern Emerald, field HMs work from the bag — you don’t need to teach Cut to a party mon.",
      locations: ["Rustboro City"],
      hms: ["Cut"],
      requiresSteps: ["rustboro-roxanne"],
      priority: "optional",
      sortOrder: 30,
    },
    {
      id: "rustboro-devon-letter",
      chapterId: "rustboro",
      title: "Take the letter from Mr. Stone",
      summary: "Devon Corp president gives you a letter for Steven in Dewford.",
      detail:
        "After the Devon plot in Rustboro (researcher → Devon Corp), speak with **Mr. Stone** upstairs. He gives you a **letter** to deliver to **Steven** in **Dewford**. This is the gate into the Dewford chapter.\n\nIf the letter isn’t offered yet: finish the Devon researcher rescue, return the stolen parts upstairs, then talk to Mr. Stone.",
      locations: ["Rustboro City"],
      keyItems: ["Letter"],
      requiresSteps: ["rustboro-roxanne"],
      priority: "critical",
      sortOrder: 40,
    },
    {
      id: "rustboro-to-dewford",
      chapterId: "rustboro",
      title: "Sail to Dewford with Mr. Briney",
      summary: "Cottage on Route 104 (south of Petalburg Woods) — ask Briney for Dewford.",
      detail:
        "Return to **Mr. Briney’s cottage** on the south end of **Route 104** (west of Petalburg Woods’ south exit). With the letter, he will ferry you to **Dewford Town**.",
      locations: ["Route 104", "Dewford Town"],
      requiresSteps: ["rustboro-devon-letter"],
      priority: "critical",
      sortOrder: 50,
    },

    // —— Dewford ——
    {
      id: "dewford-find-steven",
      chapterId: "dewford",
      title: "Find Steven in Granite Cave",
      summary:
        "Granite Cave north of Dewford — go to the lowest floor; he is easy to walk past.",
      detail:
        "From Dewford, go **north** into **Granite Cave**. Descend to the **bottom floor**. **Steven** stands in a side alcove on that floor — talk to him to deliver Mr. Stone’s letter.\n\nBring a Pokémon that can handle Rock types (and Flash later if you want the dark rooms).",
      locations: ["Dewford Town", "Granite Cave"],
      requiresBadges: ["gym-1"],
      keyItems: ["Letter"],
      priority: "critical",
      sortOrder: 10,
    },
    {
      id: "dewford-brawly",
      chapterId: "dewford",
      title: "Defeat Brawly (Knuckle Badge)",
      summary: "Dewford Gym — Fighting types. Knuckle Badge enables Flash.",
      detail:
        "**Brawly** is a Fighting specialist. Flying, Psychic, and Ghost are your friends; Normal / Rock / Steel / Ice / Dark often take heavy hits.\n\nThe **Knuckle Badge** lets you use **Flash** in the overworld.",
      locations: ["Dewford Town"],
      requiresBadges: ["gym-1"],
      gymPrep: {
        leaderName: "Brawly",
        specialtyTypes: ["Fighting"],
        recommendedTypes: ["Flying", "Psychic", "Ghost"],
        cautionTypes: ["Normal", "Rock", "Steel", "Ice", "Dark"],
        partyNotes:
          "Vanilla Emerald: Machop, Meditite, Makuhita. Modern Emerald Normal keeps gym parties; Hard+ may buff them.",
      },
      priority: "critical",
      sortOrder: 20,
    },
    {
      id: "dewford-to-slateport",
      chapterId: "dewford",
      title: "Sail to Slateport with Briney",
      summary: "After Steven, Briney takes you east to Route 109 / Slateport.",
      detail:
        "Once the letter is delivered, talk to **Mr. Briney** again in Dewford to sail to **Route 109** (beach south of Slateport).",
      locations: ["Dewford Town", "Route 109", "Slateport City"],
      requiresSteps: ["dewford-find-steven"],
      priority: "critical",
      sortOrder: 30,
    },

    // —— Mauville ——
    {
      id: "mauville-slateport-museum",
      chapterId: "mauville",
      title: "Progress the Slateport Museum plot",
      summary: "Team Magma/Aqua at the Oceanic Museum — then head north to Mauville.",
      detail:
        "In **Slateport**:\n\n1. Visit the **Oceanic Museum** (often after talking to the Team Magma/Aqua grunt blocking Dock / museum access).\n2. Clear the museum confrontation upstairs.\n3. Exit and continue **north on Route 110** toward **Mauville City**.\n\nBike path vs grassy side is your choice — both reach Mauville. Watch for the rival battle on the path if you take that route.",
      locations: ["Slateport City", "Route 110", "Mauville City"],
      requiresBadges: ["gym-1", "gym-2"],
      priority: "critical",
      sortOrder: 10,
    },
    {
      id: "mauville-wattson",
      chapterId: "mauville",
      title: "Defeat Wattson (Dynamo Badge)",
      summary: "Mauville Gym — Electric. Dynamo Badge unlocks Rock Smash.",
      detail:
        "**Wattson** is an Electric specialist. **Ground** is ideal; Grass / Dragon / Electric often shrug shocks. Water and Flying usually hate this gym.\n\nSolve the electric-fence switches to reach him. The **Dynamo Badge** unlocks **Rock Smash** outdoors.",
      locations: ["Mauville City"],
      requiresBadges: ["gym-1", "gym-2"],
      gymPrep: {
        leaderName: "Wattson",
        specialtyTypes: ["Electric"],
        recommendedTypes: ["Ground"],
        cautionTypes: ["Water", "Flying"],
        partyNotes:
          "Vanilla Emerald: Voltorb, Electrike, Magneton, Manectric. Magneton is Steel/Electric — Ground still hits hard. Modern Emerald Normal keeps gym parties; Hard+ may buff them.",
      },
      priority: "critical",
      sortOrder: 20,
    },
    {
      id: "mauville-rock-smash",
      chapterId: "mauville",
      title: "Get Rock Smash and open Rusturf Tunnel",
      summary:
        "Mauville house → smash rocks in Rusturf to reach Verdanturf (and get Strength).",
      detail:
        "In **Mauville**, the house across from the Poké Mart gives **HM06 Rock Smash** (requires Stone + Knuckle badges to receive).\n\nWith the **Dynamo Badge**, use Rock Smash in **Rusturf Tunnel** (Route 116 from Rustboro, or from Verdanturf later) to clear the boulders blocking the tunnel. That reunites the couple inside and rewards **HM04 Strength**.\n\n**Rock Smash — not Cut — is what opens Rusturf.**",
      locations: ["Mauville City", "Rusturf Tunnel", "Verdanturf Town"],
      requiresBadges: ["gym-1", "gym-2"],
      hms: ["Rock Smash", "Strength"],
      requiresSteps: ["mauville-wattson"],
      priority: "critical",
      sortOrder: 30,
    },

    // —— Fallarbor / Meteor Falls ——
    {
      id: "fallarbor-to-fallarbor",
      chapterId: "fallarbor",
      title: "Reach Fallarbor via Route 111 / 113",
      summary:
        "Go north around the desert (don’t need Go-Goggles yet) — Fallarbor is west of Route 113 ash.",
      detail:
        "From **Mauville**, head **north on Route 111**. You can walk the **grassy / mountainous path around the desert** without Go-Goggles — the deep sand in the middle is blocked until later.\n\nContinue through **Route 112** (cable car area — skip the summit for now) → **Fiery Path** or around → **Route 113** (ash) → **Fallarbor Town**.\n\nTalk to people in Fallarbor (including **Lanette’s house** south of town) so the Meteor Falls plot is ready.",
      locations: [
        "Route 111",
        "Route 112",
        "Fiery Path",
        "Route 113",
        "Fallarbor Town",
      ],
      requiresBadges: ["gym-1", "gym-2", "gym-3"],
      priority: "critical",
      sortOrder: 10,
    },
    {
      id: "fallarbor-meteor-falls",
      chapterId: "fallarbor",
      title: "Stop Team Magma/Aqua at Meteor Falls",
      summary: "Route 114 west of Fallarbor — cave confrontation, then return to town.",
      detail:
        "From **Fallarbor**, go **south/west on Route 114** into **Meteor Falls**. Follow the story confrontation with Team Magma/Aqua inside.\n\nAfter the event, return toward Fallarbor. This plot is easy to miss if you rush the cable car to Mt. Chimney first — do Meteor Falls before (or right as) you push the summit arc.",
      locations: ["Route 114", "Meteor Falls", "Fallarbor Town"],
      requiresSteps: ["fallarbor-to-fallarbor"],
      priority: "critical",
      sortOrder: 20,
    },
    {
      id: "fallarbor-go-goggles",
      chapterId: "fallarbor",
      title: "Pick up Go-Goggles",
      summary: "Desert entrance on Route 111 — required before crossing the sands.",
      detail:
        "After the Meteor Falls events, talk to the researcher / man at the **Route 111 desert entrance**. He gives **Go-Goggles**, which let you walk the desert sand.\n\nYou need these before any “cross the desert” routing later (and for desert encounters). You do **not** need them just to take the **cable car** up Mt. Chimney from Route 112.",
      locations: ["Route 111", "Fallarbor Town"],
      keyItems: ["Go-Goggles"],
      requiresSteps: ["fallarbor-meteor-falls"],
      priority: "critical",
      sortOrder: 30,
    },
    {
      id: "fallarbor-to-cable-car",
      chapterId: "fallarbor",
      title: "Take the cable car toward Mt. Chimney",
      summary: "Route 112 cable car — next chapter resolves the summit fight.",
      detail:
        "Return to **Route 112** and ride the **cable car** up **Mt. Chimney**. The Team Magma/Aqua summit battle and Jagged Pass down to Lavaridge are the next chapter.",
      locations: ["Route 112", "Mt. Chimney"],
      requiresSteps: ["fallarbor-go-goggles"],
      priority: "critical",
      sortOrder: 40,
    },

    // —— Lavaridge ——
    {
      id: "lavaridge-mt-chimney",
      chapterId: "lavaridge",
      title: "Resolve Mt. Chimney",
      summary: "Summit confrontation — then Jagged Pass down to Lavaridge.",
      detail:
        "On **Mt. Chimney**’s summit, finish the Team Magma/Aqua confrontation. Afterward descend **Jagged Pass** south into **Lavaridge Town**.\n\nHeal up before Flannery — Jagged Pass trainers and the gym come back-to-back for many runs.",
      locations: ["Mt. Chimney", "Jagged Pass", "Lavaridge Town"],
      requiresBadges: ["gym-1", "gym-2", "gym-3"],
      priority: "critical",
      sortOrder: 10,
    },
    {
      id: "lavaridge-flannery",
      chapterId: "lavaridge",
      title: "Defeat Flannery (Heat Badge)",
      summary: "Lavaridge Gym — Fire. Heat Badge unlocks Strength outdoors.",
      detail:
        "**Flannery** is a Fire specialist. Water, Ground, and Rock are the classic answers; Grass / Bug / Steel / Ice usually melt.\n\nNavigate the basement hole maze to reach her. The **Heat Badge** unlocks **Strength** in the overworld (you should already have the HM from Rusturf).",
      locations: ["Lavaridge Town"],
      gymPrep: {
        leaderName: "Flannery",
        specialtyTypes: ["Fire"],
        recommendedTypes: ["Water", "Ground", "Rock"],
        cautionTypes: ["Grass", "Bug", "Steel", "Ice"],
        partyNotes:
          "Vanilla Emerald: Numel, Slugma, Camerupt, Torkoal. Watch Drought / sunny Overheat turns. Modern Emerald Normal keeps gym parties; Hard+ may buff them.",
      },
      priority: "critical",
      sortOrder: 20,
    },

    // —— Petalburg Gym ——
    {
      id: "petalburg-norman",
      chapterId: "petalburg-gym",
      title: "Defeat Norman (Balance Badge)",
      summary: "Return to Petalburg Gym — Dad unlocks after four badges.",
      detail:
        "With **four badges**, return to **Petalburg Gym**. Clear the room trainers (each door needs a win) before **Norman**.\n\nNormal types — Fighting is ideal; Rock / Steel also chip well. Slaking’s Truant is the famous turn pattern — punish the loaf turns.",
      locations: ["Petalburg City"],
      requiresBadges: ["gym-1", "gym-2", "gym-3", "gym-4"],
      gymPrep: {
        leaderName: "Norman",
        specialtyTypes: ["Normal"],
        recommendedTypes: ["Fighting"],
        cautionTypes: ["Ghost"],
        partyNotes:
          "Vanilla Emerald: Spinda, Vigoroth, Linoone, Slaking. Ghost can’t touch Normal; Fighting is the clean answer. Modern Emerald Normal keeps gym parties; Hard+ may buff them.",
      },
      priority: "critical",
      sortOrder: 10,
    },
    {
      id: "petalburg-get-surf",
      chapterId: "petalburg-gym",
      title: "Get Surf",
      summary: "HM03 Surf — required for almost everything after Norman.",
      detail:
        "After Norman, obtain **HM03 Surf** from **Wally’s father** in the Petalburg Gym area (story gift once Dad is beaten).\n\nIn Modern Emerald, field Surf works from the bag. Surf opens **Route 118/119** toward Fortree and nearly every late-game water route.",
      locations: ["Petalburg City"],
      hms: ["Surf"],
      requiresSteps: ["petalburg-norman"],
      priority: "critical",
      sortOrder: 20,
    },

    // —— Fortree ——
    {
      id: "fortree-route-118",
      chapterId: "fortree",
      title: "Surf east from Route 118",
      summary: "From Mauville’s east exit — Surf the river toward Route 119.",
      detail:
        "With Surf, leave **Mauville** east onto **Route 118**. Surf the water segments and continue north onto **Route 119** (long grass + weather plot).",
      locations: ["Route 118", "Route 119"],
      requiresBadges: ["gym-1", "gym-2", "gym-3", "gym-4", "gym-5"],
      hms: ["Surf"],
      priority: "critical",
      sortOrder: 5,
    },
    {
      id: "fortree-weather-institute",
      chapterId: "fortree",
      title: "Clear the Weather Institute",
      summary: "Route 119 — Team Magma/Aqua; Castform reward; then Fortree.",
      detail:
        "Midway up **Route 119**, enter the **Weather Institute**. Clear Team Magma/Aqua floors, then talk to the scientists for **Castform** (optional catch / gift rules per season).\n\nExit north toward **Fortree City**. Your rival rematch on Route 119 is tied to receiving **Fly** after Winona — see the Fly step.",
      locations: ["Route 119", "Fortree City"],
      requiresSteps: ["fortree-route-118"],
      priority: "critical",
      sortOrder: 10,
    },
    {
      id: "fortree-winona",
      chapterId: "fortree",
      title: "Defeat Winona (Feather Badge)",
      summary: "Fortree Gym — Flying. Feather Badge unlocks Fly.",
      detail:
        "**Winona** is a Flying specialist. Electric, Ice, and Rock are the usual answers; Ground moves whiff. Reach her via the spinning-bird gym puzzle (talk to the gym guide if you’re stuck on rotating platforms).",
      locations: ["Fortree City"],
      gymPrep: {
        leaderName: "Winona",
        specialtyTypes: ["Flying"],
        recommendedTypes: ["Electric", "Ice", "Rock"],
        cautionTypes: ["Ground", "Grass", "Fighting", "Bug"],
        partyNotes:
          "Vanilla Emerald: Swablu, Tropius, Pelipper, Skarmory, Altaria. Skarmory is Steel/Flying — Fire / Electric / Fighting help. Modern Emerald Normal keeps gym parties; Hard+ may buff them.",
      },
      priority: "critical",
      sortOrder: 20,
    },
    {
      id: "fortree-get-fly",
      chapterId: "fortree",
      title: "Get Fly",
      summary: "HM02 Fly from Route 119 rival rematch / weather plot rewards.",
      detail:
        "After the Weather Institute events and Winona, your rival gives **HM02 Fly** on **Route 119**. You need the **Feather Badge** to use it outdoors.",
      locations: ["Route 119", "Fortree City"],
      hms: ["Fly"],
      requiresSteps: ["fortree-winona"],
      priority: "critical",
      sortOrder: 30,
    },

    // —— Mossdeep (Lilycove Magma/Aqua arc) ——
    {
      id: "mossdeep-route-120",
      chapterId: "mossdeep",
      title: "Clear Route 120 (Devon Scope)",
      summary:
        "Steven on Route 120 → Devon Scope → clear the invisible Kecleon blocking the east path.",
      detail:
        "From **Fortree**, head east onto **Route 120**. Meet **Steven** and receive the **Devon Scope**, then use it to reveal the invisible **Kecleon** blocking the bridge path toward **Route 121** / Mt. Pyre.\n\nWithout the Scope, you cannot continue the Magma/Aqua midgame.",
      locations: ["Route 120", "Route 121"],
      requiresBadges: [
        "gym-1",
        "gym-2",
        "gym-3",
        "gym-4",
        "gym-5",
        "gym-6",
      ],
      keyItems: ["Devon Scope"],
      nuzlockeNote:
        "Route 120 / 121 encounter locks matter before you commit to Mt. Pyre or Lilycove routing.",
      priority: "critical",
      sortOrder: 5,
    },
    {
      id: "mossdeep-mt-pyre",
      chapterId: "mossdeep",
      title: "Climb Mt. Pyre",
      summary:
        "Summit orb theft — both teams take Red/Blue Orbs; receive the Magma Emblem.",
      detail:
        "From **Route 121**, enter **Mt. Pyre** (surf **Route 122** if you use the pier approach). Climb to the **summit** for the Team Magma/Aqua confrontation.\n\nIn **Emerald**, both teams appear: they steal the **Red Orb** and **Blue Orb**. Talk to the old couple afterward for the **Magma Emblem** — that key item opens Magma’s hideout on **Jagged Pass**.\n\nDo **not** rush straight to the Lilycove Aqua Hideout yet; Magma Hideout and the Slateport submarine theft come first.",
      locations: ["Route 121", "Route 122", "Mt. Pyre"],
      requiresSteps: ["mossdeep-route-120"],
      keyItems: ["Magma Emblem"],
      priority: "critical",
      sortOrder: 10,
    },
    {
      id: "mossdeep-magma-hideout",
      chapterId: "mossdeep",
      title: "Clear Magma Hideout (Jagged Pass)",
      summary:
        "Return to Jagged Pass — Magma Emblem opens the cave; Maxie awakens Groudon.",
      detail:
        "Fly or travel back to **Lavaridge** / **Jagged Pass** (the path down Mt. Chimney). With the **Magma Emblem**, a secret entrance opens beside the large boulder.\n\nClear **Team Magma Hideout** (Strength puzzles, trainers, Maxie). Maxie uses an orb to awaken **Groudon**, which immediately flees. This is a long gauntlet — heal like a mini-gym.\n\n**Emerald-only layout:** Magma’s main hideout is here under the volcano, not the Lilycove cove (that’s Aqua).",
      locations: ["Jagged Pass", "Magma Hideout", "Mt. Chimney", "Lavaridge Town"],
      requiresSteps: ["mossdeep-mt-pyre"],
      keyItems: ["Magma Emblem"],
      hms: ["Strength"],
      nuzlockeNote:
        "Long trainer stretch plus Maxie — bank a heal before the leader fight.",
      priority: "critical",
      sortOrder: 20,
    },
    {
      id: "mossdeep-submarine-theft",
      chapterId: "mossdeep",
      title: "Witness the submarine theft",
      summary:
        "Slateport Harbor — Archie steals Capt. Stern’s Submarine Explorer 1.",
      detail:
        "After Magma Hideout, go to **Slateport City**’s **Harbor** (Capt. Stern / submarine dock — **not** Lilycove).\n\nWatch **Team Aqua** steal the **Submarine Explorer 1**. That cutscene is the gate into the Lilycove Aqua Hideout chase. Players who skip Slateport often soft-stall looking for the wrong event in Lilycove.",
      locations: ["Slateport City"],
      requiresSteps: ["mossdeep-magma-hideout"],
      priority: "critical",
      sortOrder: 30,
    },
    {
      id: "mossdeep-aqua-hideout",
      chapterId: "mossdeep",
      title: "Clear Team Aqua Hideout",
      summary:
        "Lilycove northeast shore warp maze — chase Archie; the sub launches for Seafloor Cavern.",
      detail:
        "In **Lilycove**, enter **Team Aqua Hideout** via the **northeast shore / cove** (past the Wailmer blockers once the plot has advanced).\n\nClear the **warp-tile maze** and admins. Archie escapes aboard the stolen submarine toward **Seafloor Cavern**. Optional: the Master Ball room is easy to miss in the warp puzzle.\n\nAfterward, Surf **Route 124** toward **Mossdeep City**.",
      locations: ["Lilycove City", "Route 124", "Mossdeep City"],
      requiresSteps: ["mossdeep-submarine-theft"],
      priority: "critical",
      sortOrder: 40,
    },
    {
      id: "mossdeep-tate-liza",
      chapterId: "mossdeep",
      title: "Defeat Tate & Liza (Mind Badge)",
      summary: "Mossdeep Gym — dual Psychic battle. Mind Badge unlocks Dive.",
      detail:
        "**Tate & Liza** is a **Double Battle** Psychic gym. Dark, Ghost, and Bug pressure them; Fighting / Poison often struggle.\n\nBring two mons that can fight at once. The **Mind Badge** unlocks **Dive** outdoors.",
      locations: ["Mossdeep City"],
      requiresSteps: ["mossdeep-aqua-hideout"],
      gymPrep: {
        leaderName: "Tate & Liza",
        specialtyTypes: ["Psychic"],
        recommendedTypes: ["Dark", "Ghost", "Bug"],
        cautionTypes: ["Fighting", "Poison"],
        partyNotes:
          "Vanilla Emerald (Doubles): Claydol, Xatu, Lunatone, Solrock. Wide coverage — prioritize speed control. Modern Emerald Normal keeps gym parties; Hard+ may buff them.",
      },
      priority: "critical",
      sortOrder: 50,
    },
    {
      id: "mossdeep-space-center",
      chapterId: "mossdeep",
      title: "Stop Magma at the Space Center",
      summary:
        "Mossdeep Space Center raid — double battle with Steven vs Maxie.",
      detail:
        "After (or around) the gym, Team Magma attacks the **Mossdeep Space Center**. Clear the raid and fight the **double battle** alongside **Steven** against Maxie and an admin.\n\nThis Magma beat is required before Steven hands over Dive — don’t skip it if HM08 isn’t offered yet.",
      locations: ["Mossdeep City", "Mossdeep Space Center"],
      requiresSteps: ["mossdeep-tate-liza"],
      priority: "critical",
      sortOrder: 60,
    },
    {
      id: "mossdeep-get-dive",
      chapterId: "mossdeep",
      title: "Get Dive",
      summary: "HM08 Dive from Steven’s house in Mossdeep — required for Seafloor Cavern.",
      detail:
        "Visit **Steven’s house** in **Mossdeep** after the **Space Center** raid to receive **HM08 Dive**. You need the **Mind Badge** to Dive in the overworld. Dark water patches on the routes around Mossdeep lead to **Seafloor Cavern**.",
      locations: ["Mossdeep City"],
      hms: ["Dive"],
      requiresSteps: ["mossdeep-space-center"],
      priority: "critical",
      sortOrder: 70,
    },

    // —— Sootopolis ——
    {
      id: "sootopolis-seafloor",
      chapterId: "sootopolis",
      title: "Enter Seafloor Cavern",
      summary: "Dive on Route 128 — confront Team Magma/Aqua and awaken the legendaries.",
      detail:
        "Surf to the dark water on **Route 128**, **Dive**, and enter **Seafloor Cavern**. Traverse the Strength / current puzzles to the legendary awakening fight with Team Magma/Aqua.",
      locations: ["Route 128", "Seafloor Cavern"],
      hms: ["Dive"],
      requiresSteps: ["mossdeep-get-dive"],
      priority: "critical",
      sortOrder: 10,
    },
    {
      id: "sootopolis-cave-of-origin",
      chapterId: "sootopolis",
      title: "Enter the Cave of Origin",
      summary:
        "Sootopolis crisis briefing — Cave of Origin does not end the fight in Emerald.",
      detail:
        "After Seafloor Cavern, you’re brought to **Sootopolis**. Talk to **Wallace** / the gym gatekeepers, then enter the **Cave of Origin**.\n\nIn **Emerald / Modern Emerald**, watching Kyogre and Groudon clash here does **not** calm the city — you still need **Sky Pillar** and **Rayquaza** next. (Ruby/Sapphire resolve differently; don’t follow those guides.)",
      locations: ["Sootopolis City", "Cave of Origin"],
      requiresSteps: ["sootopolis-seafloor"],
      priority: "critical",
      sortOrder: 20,
    },
    {
      id: "sootopolis-sky-pillar",
      chapterId: "sootopolis",
      title: "Awaken Rayquaza at Sky Pillar",
      summary:
        "Route 131 Sky Pillar — Rayquaza stops the Sootopolis clash (Emerald-required).",
      detail:
        "Leave Sootopolis and Surf to **Route 131** (near **Pacifidlog**). Enter **Sky Pillar**, climb the collapsing-floor tower, and awaken **Rayquaza**.\n\nRayquaza flies to Sootopolis and stops Kyogre/Groudon. Only then does the city calm and the gym path open.",
      locations: ["Route 131", "Sky Pillar", "Pacifidlog Town", "Sootopolis City"],
      requiresSteps: ["sootopolis-cave-of-origin"],
      priority: "critical",
      sortOrder: 30,
    },
    {
      id: "sootopolis-waterfall",
      chapterId: "sootopolis",
      title: "Get Waterfall",
      summary:
        "HM07 Waterfall from Wallace after Rayquaza — needed for Victory Road climbs.",
      detail:
        "Back in calm **Sootopolis**, talk to **Wallace** for **HM07 Waterfall**. You need the **Rain Badge** later to use it outdoors, but pick it up now before (or right around) challenging Juan.\n\nIn Modern Emerald, field Waterfall works from the bag once the badge is earned.",
      locations: ["Sootopolis City"],
      hms: ["Waterfall"],
      requiresSteps: ["sootopolis-sky-pillar"],
      priority: "critical",
      sortOrder: 40,
    },
    {
      id: "sootopolis-juan",
      chapterId: "sootopolis",
      title: "Defeat Juan (Rain Badge)",
      summary: "Sootopolis Gym — Water. Rain Badge unlocks Waterfall outdoors.",
      detail:
        "**Juan** is the Water specialist (Emerald / Modern Emerald). Electric and Grass are the clean answers; Fire / Rock / Ground often hate rain teams.\n\nIce-themed gym puzzle — slide carefully. The **Rain Badge** unlocks **Waterfall** in the overworld.",
      locations: ["Sootopolis City"],
      requiresSteps: ["sootopolis-waterfall"],
      gymPrep: {
        leaderName: "Juan",
        specialtyTypes: ["Water"],
        recommendedTypes: ["Electric", "Grass"],
        cautionTypes: ["Fire", "Rock", "Ground"],
        partyNotes:
          "Vanilla Emerald: Luvdisc, Whiscash, Sealeo, Crawdaunt, Kingdra. Whiscash is Water/Ground (Electric immune); Crawdaunt is Water/Dark. Modern Emerald Normal keeps gym parties; Hard+ may buff them.",
      },
      priority: "critical",
      sortOrder: 50,
    },

    // —— Elite Four ——
    {
      id: "e4-victory-road",
      chapterId: "elite-four",
      title: "Clear Victory Road",
      summary: "Ever Grande — Strength, Rock Smash, Waterfall, and Surf puzzles.",
      detail:
        "Enter **Victory Road** from **Ever Grande**. You’ll need **Surf**, **Strength**, **Rock Smash**, and **Waterfall** for the full path. Bring a balanced team — trainers here are a warm-up for the League.",
      locations: ["Ever Grande City", "Victory Road"],
      hms: ["Strength", "Rock Smash", "Waterfall", "Surf"],
      priority: "critical",
      sortOrder: 10,
    },
    {
      id: "e4-league",
      chapterId: "elite-four",
      title: "Beat the Elite Four & Champion",
      summary: "Sidney → Phoebe → Glacia → Drake → Wallace (Champion).",
      detail:
        "Order: **Sidney** (Dark) → **Phoebe** (Ghost) → **Glacia** (Ice) → **Drake** (Dragon) → **Wallace** (Water, Champion).\n\nPrepare a balanced party. You heal between members only if you leave — treat it as one long gauntlet. Mark **Championship** on your board when Wallace falls.",
      locations: ["Ever Grande City"],
      gymPrep: {
        leaderName: "Wallace (Champion)",
        specialtyTypes: ["Water"],
        recommendedTypes: ["Electric", "Grass"],
        cautionTypes: ["Fire", "Rock", "Ground"],
        partyNotes:
          "Full League gauntlet before Wallace. Pack answers for Dark, Ghost, Ice, Dragon, and Water. Modern Emerald Normal keeps core parties; Hard+ may buff them.",
      },
      priority: "critical",
      sortOrder: 20,
    },

    // —— Last Step ——
    {
      id: "last-step-lock-in",
      chapterId: "last-step",
      title: "Lock in your team on Discord",
      summary:
        "Message #gaming @’ing Oubori, jawn, and chedda that you’re finished and want to lock in your team.",
      detail:
        "Post in the **#gaming** Discord channel and @ **Oubori**, **jawn**, and **chedda** to say you’ve finished and would like to lock in your team.\n\nYou can keep trying new teams on new saves, but **Nuzlocke Manager only supports one trainer per player this season** (for now!).",
      requiresSteps: ["e4-league"],
      priority: "critical",
      sortOrder: 10,
      nuzlockeNote:
        "One trainer slot per player this season — lock in the run you want to keep.",
    },
  ],
};
