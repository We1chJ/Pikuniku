import type { Card } from "./types";

/**
 * Demo deck. Deliberately includes the awkward cases the grader exists for:
 * single kanji with competing on'yomi and kun'yomi readings (人, 大, 上, 山), a
 * blacklisted near-miss (人), a transitive verb whose answer encodes its grammar
 * (上げる), an irregular compound (大人), and a katakana loanword (珈琲).
 */
export const SEED_CARDS: Omit<Card, "id" | "createdAt">[] = [
  {
    front: "一",
    type: "component",
    meanings: ["one", "ground"],
    blacklist: [],
    readings: ["いち"],
    readingType: "onyomi",
    altReadings: [{ reading: "ひと", type: "kunyomi" }],
    mnemonic: "A single horizontal line lying on the ground. One.",
  },
  {
    front: "人",
    type: "primary",
    meanings: ["person"],
    blacklist: ["people"],
    readings: ["じん"],
    readingType: "onyomi",
    altReadings: [
      { reading: "にん", type: "onyomi" },
      { reading: "ひと", type: "kunyomi" },
    ],
    mnemonic: "Two legs walking — a person. The on'yomi here is じん.",
    notes: "'people' is blacklisted: it's the plural, and we want the singular.",
  },
  {
    front: "大",
    type: "primary",
    meanings: ["big", "large"],
    blacklist: ["great"],
    readings: ["たい"],
    readingType: "onyomi",
    altReadings: [
      { reading: "だい", type: "onyomi" },
      { reading: "おお", type: "kunyomi" },
    ],
    mnemonic: "A person stretching their arms as wide as they go. Big.",
  },
  {
    front: "大人",
    type: "compound",
    meanings: ["adult"],
    blacklist: ["big person"],
    readings: ["おとな"],
    altReadings: [{ reading: "だいじん", type: "onyomi" }],
    mnemonic: "A big person is an adult. The reading is irregular: おとな.",
  },
  {
    front: "上",
    type: "primary",
    meanings: ["above", "up"],
    blacklist: ["over"],
    readings: ["じょう"],
    readingType: "onyomi",
    altReadings: [
      { reading: "うえ", type: "kunyomi" },
      { reading: "あ", type: "kunyomi" },
    ],
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
    readingType: "onyomi",
    altReadings: [{ reading: "やま", type: "kunyomi" }],
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
  {
    front: "珈琲",
    type: "compound",
    meanings: ["coffee"],
    blacklist: [],
    readings: ["コーヒー"],
    altReadings: [],
    mnemonic:
      "A loanword, so it's written in katakana even though the kanji spelling exists. Type 'ko-hi-' and watch the box switch to katakana.",
  },
];
