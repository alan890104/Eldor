// Stage geometry of the prologue animation: where the Heart of the World, the wound, the tower and the masked figure sit. index.ts builds the set and beats.ts places the cameras, both reading from here.

import * as THREE from 'three';

/** Center and overall scale of the Heart of the World (the crystal is about ±1 × ±1.55 × ±1 in object space) */
export const HEART = new THREE.Vector3(0, 25, -8);
export const HEART_SIZE = 3.9;
const RADII = new THREE.Vector3(HEART_SIZE, HEART_SIZE * 1.55, HEART_SIZE);

/** Direction from the heart's center toward the wound (front left, slightly below the waist line; toward the far shot outside the city) */
const DIR = new THREE.Vector3(-0.8, -0.3, 0.55).normalize();
/** Surface distance along that direction (ellipsoid) */
const surface = 1 / Math.sqrt((DIR.x / RADII.x) ** 2 + (DIR.y / RADII.y) ** 2 + (DIR.z / RADII.z) ** 2);

/** The wound: the spot on the heart's surface where the masked figure's hand presses in */
export const WOUND = HEART.clone().addScaledVector(DIR, surface * 0.97);
/** Horizontal direction from the heart toward the masked figure */
export const OUT = new THREE.Vector3(DIR.x, 0, DIR.z).normalize();
/** Horizontal vector perpendicular to OUT, on the side facing the camera outside the city */
export const SIDE = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), OUT).normalize();
/** Scale of the masked figure (a chibi character, shoulder height about 0.88×, arm length about 0.33×) */
export const MASK_S = 1.3;
/** The masked figure (at the feet): leaning forward with the arm extended, the palm lands exactly on the wound */
export const FIGURE = WOUND.clone().addScaledVector(OUT, 0.66).add(new THREE.Vector3(0, -0.9 * MASK_S, 0));
/** The tower: the platform at its top is under the character's feet */
export const SPIRE_POS = new THREE.Vector3(FIGURE.x, 0, FIGURE.z);
export const SPIRE_H = FIGURE.y - 0.4;
/** Height of the top of the steps */
export const PLATFORM = 0.7;
