/**
 * The accessibility menu's settings: what a visitor turned on, kept in their
 * browser only, and applied as classes on <html> that the shared stylesheet
 * (packages/design-system/src/globals.css, "Accessibility menu adjustments")
 * turns into the adjustments.
 *
 * The personal area has the same file (apps/portal/src/components/a11y): the
 * two apps share the stylesheet, not React code, so keep the two in step.
 */

export const A11Y_STORAGE_KEY = 'odg-a11y'

export type A11yToggle = 'contrast' | 'links' | 'font' | 'spacing' | 'motion'

/** In the order the menu lists them. */
export const A11Y_TOGGLES: readonly A11yToggle[] = ['contrast', 'links', 'font', 'spacing', 'motion']

export type A11yPrefs = { text: 0 | 1 | 2 } & Record<A11yToggle, boolean>

export const DEFAULT_A11Y: A11yPrefs = {
  text: 0,
  contrast: false,
  links: false,
  font: false,
  spacing: false,
  motion: false,
}

/** Fired on window whenever the settings change, for script-driven motion. */
export const A11Y_EVENT = 'odg:a11y'

export function readA11y(): A11yPrefs {
  try {
    const raw = JSON.parse(window.localStorage.getItem(A11Y_STORAGE_KEY) ?? '{}') as Partial<A11yPrefs>
    const prefs: A11yPrefs = { ...DEFAULT_A11Y, text: raw.text === 1 || raw.text === 2 ? raw.text : 0 }
    for (const key of A11Y_TOGGLES) prefs[key] = raw[key] === true
    return prefs
  } catch {
    return DEFAULT_A11Y
  }
}

export function applyA11y(prefs: A11yPrefs): void {
  const classes = document.documentElement.classList
  classes.toggle('a11y-text-1', prefs.text === 1)
  classes.toggle('a11y-text-2', prefs.text === 2)
  for (const key of A11Y_TOGGLES) classes.toggle(`a11y-${key}`, prefs[key])
  window.dispatchEvent(new CustomEvent(A11Y_EVENT, { detail: prefs }))
}

export function saveA11y(prefs: A11yPrefs): void {
  try {
    window.localStorage.setItem(A11Y_STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // Storage blocked (private mode, settings): the choice holds for this page.
  }
}

/** Whether the visitor asked the menu to stop animations. */
export function a11yMotionStopped(): boolean {
  return document.documentElement.classList.contains('a11y-motion')
}

/**
 * The same as `applyA11y`, without React, inline at the top of <body>: the
 * classes are in place before the first paint, so a page never flashes in the
 * default style first.
 */
export const A11Y_BOOT_SCRIPT =
  `(function(){try{var p=JSON.parse(localStorage.getItem('${A11Y_STORAGE_KEY}')||'{}'),c=document.documentElement.classList;` +
  `if(p.text===1||p.text===2)c.add('a11y-text-'+p.text);` +
  `['contrast','links','font','spacing','motion'].forEach(function(k){if(p[k]===true)c.add('a11y-'+k)})}catch(e){}})();`
