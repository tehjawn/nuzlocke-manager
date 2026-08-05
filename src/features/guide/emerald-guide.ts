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
 *
 * Post-game (`section: "post-game"`) keeps Emerald map/story locations but
 * treats legendary/static names as slot labels under the randomizer, with
 * Nuzlocke claim / rematch notes on each step.
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
      summary: "Petalburg Woods, Rusturf Devon Goods, Roxanne, letter for Steven.",
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
      summary: "Stern’s Shipyard / museum, Wattson, Rock Smash → Rusturf Tunnel.",
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
      summary: "Norman unlocks after four badges; Surf from Wally’s dad.",
      requiresBadges: ["gym-1", "gym-2", "gym-3", "gym-4"],
      clearsWithBadge: "gym-5",
      locations: ["Petalburg City"],
      sortOrder: 6,
    },
    {
      id: "fortree",
      title: "Fortree & Weather Institute",
      summary: "Surf north, Weather Institute, Devon Scope, Winona, Fly.",
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
        "Route 121 → Mt. Pyre → Magma Hideout → Slateport sub theft → Aqua Hideout → Mossdeep / Space Center / Dive.",
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
      summary: "Dive, Seafloor Cavern, Sky Pillar, Dive re-entry, Juan.",
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
    {
      id: "post-game",
      title: "Post-game",
      summary:
        "Optional Modern Emerald epilogue — six Regis, ticket legendaries, Johto/Kanto unlock chains, rematches, Frontier. Skip for the tournament.",
      requiresBadges: [],
      section: "post-game",
      locations: [
        "Desert Ruins",
        "Island Cave",
        "Ancient Tomb",
        "Sealed Chamber",
        "Route 110",
        "Route 132",
        "Battle Frontier",
        "Mirage Island",
        "Southern Island",
        "Faraway Island",
        "Birth Island",
        "Navel Rock",
        "Meteor Falls",
        "Altering Cave",
        "Mossdeep City",
        "Petalburg Woods",
        "Shoal Cave",
        "New Mauville",
        "Scorched Slab",
        "Victory Road",
        "Magma Hideout",
      ],
      sortOrder: 12,
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
      id: "rustboro-devon-goods",
      chapterId: "rustboro",
      title: "Recover the Devon Goods (Rusturf Tunnel)",
      summary:
        "Deliver the researcher’s parcel, chase the thief to Route 116 / Rusturf, return the goods.",
      detail:
        "In **Rustboro**:\n\n1. Talk to the **Devon researcher** in the house near the south gate and give him the recovered parcel from Petalburg Woods.\n2. When Magma/Aqua steals the **Devon Goods**, chase the grunt east onto **Route 116** into **Rusturf Tunnel**.\n3. Battle the grunt, recover the goods, and return them upstairs at **Devon Corporation**.\n\nMr. Stone will not hand out the Dewford letter until this chase is done. You can battle **Roxanne** before or after — both orders work.",
      locations: ["Rustboro City", "Route 116", "Rusturf Tunnel"],
      requiresSteps: ["rustboro-petalburg-woods"],
      keyItems: ["Devon Goods"],
      priority: "critical",
      sortOrder: 15,
    },
    {
      id: "rustboro-roxanne",
      chapterId: "rustboro",
      title: "Defeat Roxanne (Stone Badge)",
      summary: "Rustboro Gym — Rock types. Stone Badge enables field Cut (optional).",
      detail:
        "**Roxanne** is a Rock specialist. Water, Grass, and Fighting hit hard; Fire / Electric / Flying often bounce.\n\nThe **Stone Badge** unlocks **Cut** in the overworld if you pick up that HM — Cut is **not** required for the main story.",
      locations: ["Rustboro City"],
      requiresSteps: ["rustboro-petalburg-woods"],
      // Ace levels: highest Pokémon on each Modern Emerald Normal party.
      // ME Normal keeps vanilla Emerald gym parties (Hard+ may buff). Source:
      // vanilla Emerald trainer data / standard Emerald nuzlocke level caps.
      gymPrep: {
        leaderName: "Roxanne",
        aceLevel: 15,
        badgeKey: "gym-1",
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
      summary:
        "Devon president gives a letter for Steven — and Devon Goods to deliver later in Slateport.",
      detail:
        "After recovering the **Devon Goods**, speak with **Mr. Stone** upstairs at Devon Corp. He gives you:\n\n- A **letter** for **Steven** in **Dewford** (next chapter)\n- The **Devon Goods** package to deliver to **Capt. Stern** in **Slateport** (after Dewford)\n\nIf nothing is offered yet, finish the Rusturf chase and return the goods first.",
      locations: ["Rustboro City"],
      keyItems: ["Letter", "Devon Goods"],
      requiresSteps: ["rustboro-devon-goods", "rustboro-roxanne"],
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
        "From Dewford, go **north** into **Granite Cave**. Descend to the **bottom floor**. **Steven** stands in a side alcove on that floor — talk to him to deliver Mr. Stone’s letter.\n\nBring a Pokémon that can handle Rock types. Optional **Flash** (next step) lights the dark rooms.",
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
        aceLevel: 19,
        badgeKey: "gym-2",
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
      id: "dewford-get-flash",
      chapterId: "dewford",
      title: "Optional: pick up Flash",
      summary: "Hiker in Granite Cave — lights dark rooms; needs Knuckle Badge outdoors.",
      detail:
        "In **Granite Cave**, talk to the **Hiker** for **HM05 Flash**. The **Knuckle Badge** unlocks field Flash.\n\nNot story-required, but the dark rooms are much easier with it. In Modern Emerald, field Flash works from the bag.",
      locations: ["Granite Cave", "Dewford Town"],
      hms: ["Flash"],
      requiresSteps: ["dewford-brawly"],
      priority: "optional",
      sortOrder: 25,
    },
    {
      id: "dewford-to-slateport",
      chapterId: "dewford",
      title: "Sail to Slateport with Briney",
      summary: "After Steven, Briney takes you east to Route 109 / Slateport.",
      detail:
        "Once the letter is delivered, talk to **Mr. Briney** again in Dewford to sail to **Route 109** (beach south of Slateport). Bring the **Devon Goods** — you’ll deliver them in the next chapter.",
      locations: ["Dewford Town", "Route 109", "Slateport City"],
      requiresSteps: ["dewford-find-steven"],
      keyItems: ["Devon Goods"],
      priority: "critical",
      sortOrder: 30,
    },

    // —— Mauville ——
    {
      id: "mauville-slateport-dock",
      chapterId: "mauville",
      title: "Talk to Dock at Stern’s Shipyard",
      summary:
        "Shipyard first — Dock points you to Capt. Stern at the Oceanic Museum.",
      detail:
        "In **Slateport**, enter **Stern’s Shipyard** (the large building by the water). Talk to **Dock** (the engineer with the blueprints) and try to deliver the **Devon Goods**.\n\nHe sends you to find **Capt. Stern** at the **Oceanic Museum**. After this conversation, the Aqua/Magma line outside the museum clears so you can enter.",
      locations: ["Slateport City"],
      requiresBadges: ["gym-1", "gym-2"],
      keyItems: ["Devon Goods"],
      priority: "critical",
      sortOrder: 5,
    },
    {
      id: "mauville-slateport-museum",
      chapterId: "mauville",
      title: "Clear the Oceanic Museum",
      summary:
        "Deliver Devon Goods to Capt. Stern upstairs — then Route 110 to Mauville.",
      detail:
        "Pay the small fee to enter the **Oceanic Museum**. Go **upstairs**, talk to **Capt. Stern**, and deliver the **Devon Goods**. Battle the Magma/Aqua grunts when they interrupt.\n\nExit the museum, then continue **north on Route 110** toward **Mauville City**. Bike path vs grassy side both work — watch for the rival battle on the cycling road side.",
      locations: ["Slateport City", "Route 110", "Mauville City"],
      requiresSteps: ["mauville-slateport-dock"],
      keyItems: ["Devon Goods"],
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
      requiresSteps: ["mauville-slateport-museum"],
      gymPrep: {
        leaderName: "Wattson",
        aceLevel: 24,
        badgeKey: "gym-3",
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
      id: "mauville-get-bike",
      chapterId: "mauville",
      title: "Optional: get the Mach Bike",
      summary: "Mauville Bike Shop — speeds up Route 111+ routing.",
      detail:
        "After Wattson (or once the shop will serve you), visit the **Mauville Bike Shop** for the **Mach Bike**. It makes ash routes and long treks much faster. You can swap to the Acro Bike later if you care about tricks — Mach is the story-friendly default.",
      locations: ["Mauville City"],
      requiresSteps: ["mauville-wattson"],
      keyItems: ["Mach Bike"],
      priority: "optional",
      sortOrder: 25,
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
        aceLevel: 29,
        badgeKey: "gym-4",
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
        aceLevel: 31,
        badgeKey: "gym-5",
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
        "Midway up **Route 119**, enter the **Weather Institute**. Clear Team Magma/Aqua floors, then talk to the scientists for **Castform** (optional catch / gift rules per season).\n\nExit north toward **Fortree City**. The gym door is blocked by an invisible **Kecleon** until you get the **Devon Scope** (next step).",
      locations: ["Route 119", "Fortree City"],
      requiresSteps: ["fortree-route-118"],
      priority: "critical",
      sortOrder: 10,
    },
    {
      id: "fortree-devon-scope",
      chapterId: "fortree",
      title: "Get the Devon Scope (Route 120)",
      summary:
        "Steven on Route 120 → Devon Scope → clear the Kecleon blocking Fortree Gym.",
      detail:
        "From **Fortree**, head east onto **Route 120**. Meet **Steven** and receive the **Devon Scope**.\n\nReturn to **Fortree Gym** and use the Scope to reveal the invisible **Kecleon** blocking the door, then battle it. You cannot challenge **Winona** until this is done.\n\nKeep the Scope — you’ll need it again on Route 120’s bridge toward Mt. Pyre.",
      locations: ["Route 120", "Fortree City"],
      requiresSteps: ["fortree-weather-institute"],
      keyItems: ["Devon Scope"],
      priority: "critical",
      sortOrder: 15,
    },
    {
      id: "fortree-winona",
      chapterId: "fortree",
      title: "Defeat Winona (Feather Badge)",
      summary: "Fortree Gym — Flying. Feather Badge unlocks Fly.",
      detail:
        "**Winona** is a Flying specialist. Electric, Ice, and Rock are the usual answers; Ground moves whiff. Reach her via the spinning-bird gym puzzle (talk to the gym guide if you’re stuck on rotating platforms).",
      locations: ["Fortree City"],
      requiresSteps: ["fortree-devon-scope"],
      gymPrep: {
        leaderName: "Winona",
        aceLevel: 33,
        badgeKey: "gym-6",
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
    {
      id: "fortree-safari",
      chapterId: "fortree",
      title: "Optional: visit the Safari Zone",
      summary: "Route 121 west pocket — encounter hunting, not story-required.",
      detail:
        "The **Safari Zone** sits off **Route 121** (accessible once you push east from Fortree / Route 120). Useful for Nuzlocke encounter options, but nothing here gates the Magma/Aqua plot.",
      locations: ["Safari Zone", "Route 121"],
      requiresSteps: ["fortree-get-fly"],
      priority: "optional",
      sortOrder: 40,
    },

    // —— Mossdeep (Lilycove Magma/Aqua arc) ——
    {
      id: "mossdeep-route-121",
      chapterId: "mossdeep",
      title: "Open the path to Route 121",
      summary:
        "Route 120 bridge Kecleon (Devon Scope) — then Mt. Pyre / Lilycove routing.",
      detail:
        "With the **Devon Scope** from Fortree, return to **Route 120** and clear the invisible **Kecleon** on the bridge so you can continue east/south toward **Route 121**.\n\nFrom Route 121 you can peel toward **Mt. Pyre** (story) or **Lilycove** / Safari. Heal before the Pyre climb.",
      locations: ["Route 120", "Route 121"],
      requiresSteps: ["fortree-get-fly"],
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
      requiresSteps: ["mossdeep-route-121"],
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
        aceLevel: 42,
        badgeKey: "gym-7",
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
      id: "sootopolis-return",
      chapterId: "sootopolis",
      title: "Dive back into Sootopolis",
      summary:
        "Route 126 dark water — Dive to re-enter the crater city after Sky Pillar.",
      detail:
        "After Sky Pillar, **Sootopolis**’s front door is not a normal walk-in. Surf the crater lake on **Route 126**, find the **dark water**, and **Dive** to warp back into the city.\n\nTalk to **Wallace** next for Waterfall once you’re inside again.",
      locations: ["Route 126", "Sootopolis City"],
      hms: ["Dive"],
      requiresSteps: ["sootopolis-sky-pillar"],
      priority: "critical",
      sortOrder: 35,
    },
    {
      id: "sootopolis-waterfall",
      chapterId: "sootopolis",
      title: "Get Waterfall",
      summary:
        "HM07 Waterfall from Wallace after Rayquaza — needed for Victory Road climbs.",
      detail:
        "Back in calm **Sootopolis**, talk to **Wallace** for **HM07 Waterfall**. You need the **Rain Badge** later to use it outdoors, but pick it up now before challenging Juan.\n\nIn Modern Emerald, field Waterfall works from the bag once the badge is earned.",
      locations: ["Sootopolis City"],
      hms: ["Waterfall"],
      requiresSteps: ["sootopolis-return"],
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
        aceLevel: 46,
        badgeKey: "gym-8",
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
      id: "e4-ever-grande",
      chapterId: "elite-four",
      title: "Reach Ever Grande City",
      summary:
        "Surf east from Sootopolis / Route 128 — Waterfall the cliff into Ever Grande.",
      detail:
        "With the **Rain Badge** and **HM07 Waterfall**, Surf the ocean routes east of Sootopolis (**Route 128** area) to the waterfall cliff at **Ever Grande City**. Use **Waterfall** to climb into town, heal at the Center, then enter **Victory Road**.",
      locations: ["Route 128", "Ever Grande City"],
      hms: ["Surf", "Waterfall"],
      requiresSteps: ["sootopolis-juan"],
      priority: "critical",
      sortOrder: 5,
    },
    {
      id: "e4-victory-road",
      chapterId: "elite-four",
      title: "Clear Victory Road",
      summary: "Ever Grande — Strength, Rock Smash, Waterfall, and Surf puzzles.",
      detail:
        "Enter **Victory Road** from **Ever Grande**. You’ll need **Surf**, **Strength**, **Rock Smash**, and **Waterfall** for the full path. Bring a balanced team — trainers here are a warm-up for the League.",
      locations: ["Ever Grande City", "Victory Road"],
      hms: ["Strength", "Rock Smash", "Waterfall", "Surf"],
      requiresSteps: ["e4-ever-grande"],
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
      requiresSteps: ["e4-victory-road"],
      gymPrep: {
        leaderName: "Wallace (Champion)",
        aceLevel: 58,
        badgeKey: "championship",
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

    // —— Post-game (optional; championship-gated section in the UI) ——
    // Modern Emerald keeps Emerald map/story but adds extra legendary statics
    // (6 Regis, ticket shop, Johto/Kanto unlock chains, Jirachi, Arceus egg).
    // Species names are slot labels under the randomizer — claim what appears.
    // Nuzlocke: each area/static is one encounter; rematches are not catches.
    {
      id: "postgame-national-dex",
      chapterId: "post-game",
      title: "Unlock the National Dex",
      summary:
        "Birch upgrades the Pokédex after Wallace — gates Match Call and most post-game legendaries.",
      detail:
        "After beating **Wallace**, talk to **Professor Birch** (Littleroot / Route 101) so your Pokédex expands to the **National Dex**.\n\nIn **Modern Emerald** this still gates **Pokénav Match Call** rematches (including Gym Leaders) and is the usual unlock before Regi doors, roamers, and event-island ferries behave as expected.\n\nThis is ROM progression chrome — it does **not** reshuffle your randomizer seed or grant free encounters.",
      locations: ["Littleroot Town", "Route 101"],
      priority: "optional",
      sortOrder: 10,
      nuzlockeNote:
        "National Dex doesn’t create new route claims by itself — keep logging encounters the same way.",
    },
    {
      id: "postgame-regi-trio",
      chapterId: "post-game",
      title: "Hunt all six Regis (+ Regigigas)",
      summary:
        "Sealed Chamber unlocks the classic trio plus ME’s Regieleki / Regidrago; Regigigas after all five + Champion.",
      detail:
        "**Modern Emerald has six Regis** (classic three + two new chambers + Regigigas), not just Emerald’s trio.\n\n1. Dive to the **Sealed Chamber** (underwater near Pacifidlog / Route 134) and solve the **Braille** inscription.\n2. Have **Relicanth** and **Wailord** in your party when you open the doors — the game checks those **species IDs**, even if wild tables are randomized. Emerald party order is **Wailord first / Relicanth last**. If your seed never rolled them, you’ll need gift / static / trade paths (or skip).\n3. Classic ruins statics:\n   - **Desert Ruins** (Route 111) → vanilla **Regirock**\n   - **Island Cave** (near Dewford) → vanilla **Regice**\n   - **Ancient Tomb** (Route 120) → vanilla **Registeel**\n4. **Modern Emerald–only** chambers (also need the Sealed Chamber unlock):\n   - East of **Route 110** → vanilla **Regieleki**\n   - Secret island north of **Route 132** → vanilla **Regidrago**\n5. **Regigigas** — after obtaining/defeating **all five** prior Regis **and** becoming Champion, solve the braille puzzle in **Dewford Cave** (ME addition near Dewford).\n\n**Randomizer:** names above are **slot labels**. If static/legendary rando is on, claim whatever stands in each chamber.",
      locations: [
        "Sealed Chamber",
        "Desert Ruins",
        "Island Cave",
        "Ancient Tomb",
        "Route 111",
        "Route 120",
        "Route 110",
        "Route 132",
      ],
      requiresSteps: ["postgame-national-dex"],
      priority: "optional",
      sortOrder: 20,
      nuzlockeNote:
        "Up to six separate area/static claims if your season treats legendaries as encounters. Dupes clause still applies to whatever species you roll.",
    },
    {
      id: "postgame-roamers",
      chapterId: "post-game",
      title: "Hunt roamers & leftover weather legendaries",
      summary:
        "Post-League Eon roamer (vanilla Latios/Latias); Kyogre/Groudon only if you skipped Seafloor Cavern.",
      detail:
        "**Eon roamer** — after the League, one of **Latios / Latias** (vanilla labeling) begins roaming Hoenn. Modern Emerald may assign either; the randomizer may also replace that slot. Track via Pokédex / sightings. Roamers flee constantly — save before the fight.\n\n**Kyogre / Groudon** — only if you did **not** take the **Seafloor Cavern** static during the story Magma/Aqua beat. Don’t re-run Route 128 awakening if you already cleared that mid-story chapter.\n\n**Rayquaza** is the **Sky Pillar** story encounter — skip it here if you already claimed that area.",
      locations: ["Seafloor Cavern", "Sky Pillar"],
      requiresSteps: ["postgame-national-dex"],
      priority: "optional",
      sortOrder: 30,
      nuzlockeNote:
        "Roamers are high wipe risk on a deathless run — optional for tournament lock-in. One claim per static/roamer slot under season rules.",
    },
    {
      id: "postgame-event-islands",
      chapterId: "post-game",
      title: "Buy tickets & visit event islands",
      summary:
        "Battle Frontier Exchange sells ME’s event tickets — Southern / Faraway / Birth / Navel.",
      detail:
        "In **Modern Emerald**, event tickets are typically bought with **BP** at the **Battle Frontier Exchange Service** (not distribution events):\n\n- **Eon Ticket** → **Southern Island** (vanilla: the other Eon, **Latias** / **Latios**)\n- **Old Sea Map** → **Faraway Island** (vanilla **Mew**)\n- **Mystic Ticket** → **Birth Island** (vanilla **Deoxys**)\n- **Aurora Ticket** → **Navel Rock** (vanilla **Lugia** and **Ho-Oh** — both tied to this ticket in ME)\n\n**Randomizer:** treat names as slot labels. Catching **Mew** / **Lugia** / **Ho-Oh** also unlocks further ME static chains (next step).\n\nIf a ferry never appears, ask hosts — don’t softlock your Nuzlocke chasing unreachable tickets.",
      locations: [
        "Battle Frontier",
        "Southern Island",
        "Faraway Island",
        "Birth Island",
        "Navel Rock",
      ],
      requiresSteps: ["postgame-battle-frontier"],
      priority: "optional",
      sortOrder: 40,
      nuzlockeNote:
        "Each island is its own encounter area if your rules count statics. Confirm ticket / legendary bans with season hosts before burning BP or attempts.",
    },
    {
      id: "postgame-me-legendary-chains",
      chapterId: "post-game",
      title: "Unlock ME’s Johto / Kanto legendary chains",
      summary:
        "After Lugia / Ho-Oh / Mew — beasts, birds, Celebi, Mewtwo, plus Jirachi at Mossdeep.",
      detail:
        "**Modern Emerald–only** static chains (vanilla species labels; rando may swap the slot):\n\nAfter **Lugia** (defeat or catch):\n- **Shoal Cave** icy room → **Suicune**\n- **Magma Hideout** → **Entei**\n- **New Mauville** → **Raikou**\n- Then **Petalburg Woods** with **Entei + Raikou + Suicune** in the party → **Celebi**\n\nAfter **Ho-Oh** (defeat or catch):\n- **Meteor Falls** (Bagon’s room) → **Articuno**\n- **Scorched Slab** → **Zapdos**\n- **Victory Road** → **Moltres**\n\nAfter **Mew** (defeat or catch):\n- **Altering Cave** → **Mewtwo** (Altering Cave is also ME’s Unown cave for wilds)\n\n**Jirachi** — after becoming Champion, interact with the **White Rock** in **Mossdeep City** (no ticket).\n\nThese are easy to miss if you only follow vanilla Emerald post-game guides.",
      locations: [
        "Shoal Cave",
        "Magma Hideout",
        "New Mauville",
        "Petalburg Woods",
        "Meteor Falls",
        "Scorched Slab",
        "Victory Road",
        "Altering Cave",
        "Mossdeep City",
      ],
      requiresSteps: ["postgame-event-islands"],
      priority: "optional",
      sortOrder: 45,
      nuzlockeNote:
        "Each static is its own claim under season rules. Defeat-to-unlock still works if you can’t (or won’t) catch the gate legendary.",
    },
    {
      id: "postgame-match-call",
      chapterId: "post-game",
      title: "Rematch trainers via Match Call",
      summary:
        "Pokénav Match Call — Gym Leaders and prior trainers with stronger (often randomized) teams.",
      detail:
        "With the **National Dex**, previously beaten trainers (including **Gym Leaders**) periodically **Match Call** you for rematches.\n\nThis is Emerald’s rematch system (not a VS Seeker) — ideal post-champion XP and tournament practice **without** spending wild encounter slots.\n\n**Modern Emerald / randomizer:** rematch parties follow your challenge difficulty and trainer-randomizer settings (Normal often keeps familiar cores; **Hard+** and full trainer rando can be much meaner). Don’t assume vanilla Gym rematch sets.\n\nAnswer calls from the **Pokénav**, then travel to the trainer.",
      locations: [],
      requiresSteps: ["postgame-national-dex"],
      priority: "optional",
      sortOrder: 50,
      nuzlockeNote:
        "Rematches are not wild encounters — still honor death / set rules. Great grind path when you’re encounter-locked.",
    },
    {
      id: "postgame-steven-rematch",
      chapterId: "post-game",
      title: "Rematch Steven (Arceus egg prize)",
      summary:
        "Meteor Falls Steven rematch — ME awards an Arceus egg for beating him the second time.",
      detail:
        "After the National Dex, return to **Meteor Falls** and find **Steven** for a tough rematch.\n\nVanilla Emerald gives a Steel-heavy squad; **Modern Emerald** may change levels, species, or both depending on difficulty and trainer rando. Scout the first send-out before committing your ace.\n\n**Modern Emerald reward:** beating Steven for the **second time** grants an **Arceus egg** (gift / egg — not a wild static). Hatch and nickname under your season gift rules.\n\nHeal first — optional boss, not a story gate.",
      locations: ["Meteor Falls"],
      requiresSteps: ["postgame-national-dex"],
      priority: "optional",
      sortOrder: 60,
      nuzlockeNote:
        "The fight itself isn’t a catch. Arceus egg counts as a gift encounter if your rules log gifts — confirm with hosts. A wipe still counts under death rules.",
    },
    {
      id: "postgame-battle-frontier",
      chapterId: "post-game",
      title: "Challenge the Battle Frontier",
      summary:
        "Ferry from Slateport / Lilycove — facilities, Brains, BP shop (items + ME event tickets).",
      detail:
        "After the League, take the ferry to the **Battle Frontier** (real MAPSEC / catch-route in this ROM).\n\nFacilities (vanilla Brain names — teams may differ under Modern Emerald / Hard+):\n1. **Battle Tower** → **Anabel**\n2. **Battle Dome** → **Tucker**\n3. **Battle Factory** → **Noland**\n4. **Battle Palace** → **Spenser**\n5. **Battle Arena** → **Greta**\n6. **Battle Pike** → **Lucy**\n7. **Battle Pyramid** → **Brandon**\n\nWin streaks unlock each **Frontier Brain**. Spend **Battle Points (BP)** on held items, tutors, **and** Modern Emerald’s **event tickets** (Eon / Old Sea Map / Mystic / Aurora) at the Exchange Service — often the real post-game unlock hub.\n\n**Scott**’s story invitations also point here. Read each facility’s ruleset before risking boxed mons.",
      locations: ["Battle Frontier", "Slateport City", "Lilycove City"],
      priority: "optional",
      sortOrder: 35,
      nuzlockeNote:
        "Ask season hosts whether Frontier wipes / rental facilities count toward your Nuzlocke. BP for tickets + items is usually the safe value play.",
    },
    {
      id: "postgame-mirage-island",
      chapterId: "post-game",
      title: "Check Mirage Island",
      summary:
        "Daily RNG island off Pacifidlog — ME can also force it with a certain party Pokémon.",
      detail:
        "**Mirage Island** (Route 130 / Pacifidlog) appears on a daily RNG check tied to your trainer ID. **Modern Emerald** can also force the island by holding a **specific Pokémon in the party** (works even from PC in some builds — check in-game hints).\n\nWhen it’s up, it is a normal **wild encounter area** under Nuzlocke rules. Vanilla headline species is **Wynaut**; the randomizer will usually put something else — claim your first encounter like any other route.\n\nPure completionist bait — skip if you’re locking a tournament team.\n\nStill hunting **Feebas**? That’s the Route 119 under-tiles grind, not Mirage Island.",
      locations: ["Mirage Island", "Route 130", "Pacifidlog Town"],
      priority: "optional",
      sortOrder: 80,
      nuzlockeNote:
        "First encounter on the island locks the area — Repels / intentional faint rules still apply.",
    },
  ],
};
