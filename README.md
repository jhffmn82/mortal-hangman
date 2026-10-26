# Mortal Hangman

Hangman as a Mortal Kombat II fight: educational and violent. Two fighters share one SAT vocabulary word. You see the definition and a blank for each letter, and every letter you get right is a blow.

**Play:** open `index.html` in a browser (works straight from the folder), or use the GitHub Pages link for this repo.

## Rules

| What happens | Result |
|---|---|
| Who guesses first | A coin toss, 50/50 |
| Right letter | Your fighter walks over and punches (10%) |
| Right letters in a row | Every one after the first is a kick (15%) |
| Letter that completes the word | Your MK2 special move (20%), then a new word |
| Wrong letter | The other fighter walks over and punches you (10%), then it's their turn |
| 15 seconds without a guess | Counts as a wrong letter; the timer is between the health bars |
| A health bar empties | FINISH HIM / FINISH HER: the winner gets one fresh word |
| Solve that word without a single miss, 15 seconds a letter | FATALITY |
| One miss or running out of time | The loser falls over and you win without one |

Words are 7 letters or longer, from "5000 Collegiate Words with Brief Definitions".

## Controls

| Key | Does |
|---|---|
| A to Z, or the on-screen letters | Guess |
| Arrows, Enter | Menus and the character select |
| 0 | Mute |
| Esc | Back to the title |

Modes: 1 player against the CPU (Easy, Normal or Hard), or 2 players taking turns on one keyboard. The CPU guesses the way a person does: common letters first, then letters that fit the word as it fills in.

## What's in it

- All 12 MK2 fighters with their arcade sprites: stance, walk, punch, kick, uppercut, hit, knockdown, dizzy, victory, a projectile special each (Liu Kang's fireball, Scorpion's spear, Sub-Zero's freeze, Raiden's lightning, Kung Lao's hat and the rest) and a fatality each.
- The 9 arenas, with their animated pieces: Living Forest faces, Portal and Tower monks, the Pit II bridge fighters, Armory lava, Kombat Tomb bats, Dead Pool acid and the Kahn's Arena crowd.
- MK2's sounds: Shao Kahn's announcer lines (FIGHT, FINISH HIM, FATALITY, EXCELLENT, the winner's name), hits, voices, specials, explosions and "Toasty!".

## Rebuilding the assets

```
python tools/fetch_mkw.py .        # downloads the MK Warehouse rips into raw/ (not committed)
python tools/build_assets.py .     # sprite sheets, arenas, props, sounds -> assets/ and js/data/
python tools/build_words.py <pdf>  # the word list -> data/words.js
```

## Credits

A fan project, not affiliated with or endorsed by anyone below.

- Mortal Kombat II sprites, sounds and fonts: Midway (1993), now Warner Bros. Games. Ripped and collected by [Mortal Kombat Warehouse](https://www.mortalkombatwarehouse.com/mk2/).
- Word list: "5000 Collegiate Words with Brief Definitions", FreeVocabulary.com.
- Definitions: [Princeton WordNet](https://wordnet.princeton.edu/) (WordNet licence).
