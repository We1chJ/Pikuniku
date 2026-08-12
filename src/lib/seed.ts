import type { Card } from "./types";

/**
 * Demo deck. Deliberately includes the awkward cases the grader exists for:
 * an alternate reading (人), a blacklisted near-miss (上), a transitive verb
 * whose answer encodes its grammar (上げる), and two cards that share the
 * English meaning "person" so alternate-matching has something to catch.
 */
export const SEED_CARDS: Omit<Card, "id" | "createdAt">[] = [
  {
    front: "一",
    type: "component",
    meanings: ["one", "ground"],
    blacklist: [],
    readings: ["いち"],
    altReadings: ["ひと"],
    mnemonic: "A single horizontal line lying on the ground. One.",
  },
  {
    front: "人",
    type: "primary",
    meanings: ["person"],
    blacklist: ["people"],
    readings: ["じん"],
    altReadings: ["にん", "ひと"],
    mnemonic: "Two legs walking — a person. The on'yomi here is じん.",
    notes: "'people' is blacklisted: it's the plural, and we want the singular.",
  },
  {
    front: "大",
    type: "primary",
    meanings: ["big", "large"],
    blacklist: ["great"],
    readings: ["たい"],
    altReadings: ["だい", "おお"],
    mnemonic: "A person stretching their arms as wide as they go. Big.",
  },
  {
    front: "大人",
    type: "compound",
    meanings: ["adult"],
    blacklist: ["big person"],
    readings: ["おとな"],
    altReadings: ["だいじん"],
    mnemonic: "A big person is an adult. The reading is irregular: おとな.",
  },
  {
    front: "上",
    type: "primary",
    meanings: ["above", "up"],
    blacklist: ["over"],
    readings: ["じょう"],
    altReadings: ["うえ", "あ"],
    mnemonic: "A line sitting above the ground. Above.",
  },
  {
    front: "上げる",
    type: "compound",
    meanings: ["to raise something", "to lift something"],
    blacklist: ["to rise"],
    readings: ["あげる"],
    altReadings: [],
    mnemonic:
      "Transitive: you raise *something*. Its pair 上がる is what rises by itself.",
    notes:
      "The 'something' is the point — transitivity is taught through the answer string.",
  },
  {
    front: "山",
    type: "primary",
    meanings: ["mountain"],
    blacklist: [],
    readings: ["さん"],
    altReadings: ["やま"],
    mnemonic: "Three peaks rising from the ground. A mountain.",
  },
  {
    front: "火山",
    type: "compound",
    meanings: ["volcano"],
    blacklist: ["fire mountain"],
    readings: ["かざん"],
    altReadings: [],
    mnemonic: "A fire mountain is a volcano.",
  },
];
