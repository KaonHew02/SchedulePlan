/**
 * Modules that are switched off.
 *
 * A parked module stays compiled. The alternative — commenting the call
 * sites out — takes them out of the type checker's sight, and the day
 * somebody renames a prop the commented copy does not complain; it just
 * quietly stops being code that would work. These flags are read at each
 * site instead, so everything behind them is still checked, still built,
 * and comes back by changing one word.
 *
 * Vite drops the dead branches from the production bundle either way,
 * because the flag is a literal it can see through.
 */

/**
 * Expenses: the wallet tab, bill splits, receipt scanning, the spend on a
 * schedule item and the cost of a trip.
 *
 * Parked on 2026-09-22 at K's request. Nothing is deleted and no saved data
 * is touched — expenses and splits already recorded stay in the notebook and
 * come back with the screen.
 *
 * Currency is NOT part of this. It converts rates and is used on a trip
 * whether or not anything is being tracked, so it stays, and the home
 * currency setting in More stays with it.
 */
export const MONEY = false
