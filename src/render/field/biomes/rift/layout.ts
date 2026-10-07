// The map layout of the Void Rift: the Knights' Outpost is on the south shore cliff, and the main road crosses the cracked
// fields, climbs onto the Old Kingdom Road, spans the Wound and reaches the tower door;
// a path circles the Wound, linking the kingdom ruins, the Inverted Quarter, the broken bridge,
// the Blightcrystal Basin and the knight's tomb through the four stone bridges, and the ridge of the northern broken plain
// leads to the secret-realm isle.

import type { FieldLayout } from '../../kit.ts';
import { BASIN, bridgeEnds, CRACKS, CRATER, ISLE, T, TOWN } from './shape.ts';

const [sw, se, e, w] = CRACKS;
const [swA, swB] = bridgeEnds(sw);
const [seA, seB] = bridgeEnds(se);
const [eA, eB] = bridgeEnds(e);
const [wA, wB] = bridgeEnds(w);

// Spawn on the main road outside the outpost's north gate: look up and there are the rift and the tower
const spawn: [number, number] = [-1.5, 40.5];

export const LAYOUT: FieldLayout = {
  size: 128,
  edge: 'void',
  town: TOWN,
  townR: 15,
  tower: T,
  spawn: [spawn[0], spawn[1], Math.atan2(T[0] - spawn[0], T[1] - spawn[1])],
  waypoint: [19.5, 69],
  pathW: 2.5,
  // Main road: camp -> north gate -> cracked fields (skirting the broken slabs) -> Old Kingdom Road -> tower door
  path: [
    [6, 79],
    [6, 66],
    [6, 56],
    [5, 47],
    [-3, 39],
    [-4, 30],
    [0, 22],
    [0, 10],
    [0, -1],
  ],
  trails: [
    // West route: fields -> southwest stone bridge -> kingdom ruins -> statue of the Uncrowned King -> west stone bridge ->
    // Inverted Quarter -> northern broken plain
    [
      [-3, 39],
      [-18, 36],
      [swA[0], swA[1]],
      [sw.bridge[0], sw.bridge[1]],
      [swB[0], swB[1]],
      [-56, 8],
      [-62, -6],
      [-66, -24],
      [wA[0], wA[1]],
      [w.bridge[0], w.bridge[1]],
      [wB[0], wB[1]],
      [-48, -74],
      [-28, -76],
      [-12, -82],
      [2, -84],
    ],
    // East route: northern broken plain -> east stone bridge -> Blightcrystal Basin -> southeast stone bridge -> knight's
    // tomb -> back to the main road
    [
      [2, -84],
      [18, -86],
      [34, -80],
      [44, -70],
      [eB[0], eB[1]],
      [e.bridge[0], e.bridge[1]],
      [eA[0], eA[1]],
      [58, -24],
      [BASIN[0] - 14, -8],
      [BASIN[0] - 12, 10],
      [seA[0], seA[1]],
      [se.bridge[0], se.bridge[1]],
      [seB[0], seB[1]],
      [30, 36],
      [16, 46],
      [5, 47],
    ],
    // Broken bridge: the section extending from the north shore
    [
      [2, -84],
      [0, -76],
      [0, -67],
    ],
    // Secret realm: along the ridge to the isle
    [
      [44, -70],
      [52, -70],
      [60, -76.5],
      [68, -83],
      [ISLE[0] - 2, ISLE[1] + 1],
    ],
    // The edge of the Inverted Quarter's pit
    [
      [-48, -74],
      [CRATER[0] - 2, CRATER[1] + 9],
    ],
  ],
  zones: [
    // The fields outside the outpost: ordinary spirits, but already half of them corrupted
    { x: -22, z: 47, r: 9, tier: 0, count: 2, species: ['gargoyle', 'maskfox', 'abyssjelly'], corrupt: 0.4 },
    { x: 24, z: 62, r: 8, tier: 0, count: 2, species: ['maskfox', 'gargoyle'], corrupt: 0.4 },
    // Cracked fields: jellyfish (`abyssjelly`) and foxes (`maskfox`) crawling out of the fissures
    { x: -18, z: 25, r: 8, tier: 1, count: 3, species: ['abyssjelly', 'maskfox', 'tombhound'], corrupt: 0.55 },
    // Knight's tomb: the grave-guarding tomb hounds (`tombhound`)
    { x: 30, z: 50, r: 8, tier: 1, count: 2, species: ['tombhound', 'gargoyle'], corrupt: 0.6 },
    // The kingdom ruins and the statue of the Uncrowned King: ruins held by gargoyles (`gargoyle`)
    { x: -64, z: -8, r: 12, tier: 1, count: 3, species: ['gargoyle', 'tombhound', 'maskfox'], corrupt: 0.6 },
    // Blightcrystal Basin: eclipse bat lords (`eclipse_batlord`) flying among the crystals
    { x: 60, z: -6, r: 10, tier: 1, count: 3, species: ['abyssjelly', 'eclipse_batlord', 'maskfox'], corrupt: 0.65 },
    // Northern broken plain
    { x: 24, z: -86, r: 7, tier: 1, count: 2, species: ['eclipse_batlord', 'gargoyle', 'tombhound'], corrupt: 0.65 },
    // Inverted Quarter: under the upside-down houses are eclipse bat lords and soul lanterns (`soul_lantern`)
    { x: CRATER[0], z: CRATER[1], r: 9, tier: 2, count: 3, species: ['eclipse_batlord', 'soul_lantern', 'tombhound', 'gargoyle'], corrupt: 0.75 },
    // Road bridgehead and the broken bridge: the fiercest group around the tower
    { x: -9, z: 29, r: 5, tier: 2, count: 2, species: ['gargoyle', 'tombhound', 'eclipse_batlord'], corrupt: 0.8 },
    { x: -8, z: -84, r: 7, tier: 2, count: 2, species: ['maskfox', 'tombhound', 'soul_lantern', 'sandserpent'], corrupt: 0.75 },
    // Secret-realm isle: sirens (`siren`) and soul lanterns (corrupted less, so there is a chance to recruit them)
    { x: ISLE[0], z: ISLE[1], r: 6, tier: 2, count: 2, species: ['siren', 'soul_lantern', 'sandserpent'], corrupt: 0.4 },
  ],
  chests: [
    [-24, 62],
    [-60, 12],
    [BASIN[0] + 2, -3],
    [0, -69.5],
    [CRATER[0] + 3, CRATER[1] - 2],
    [ISLE[0] + 3, ISLE[1] - 3],
  ],
  npcs: [
    [-6.5, 36, 0.84],
    [-1.5, 77, 1.2],
    [13.5, 82.5, -1.9],
  ],
};
