// src/data/repoWallets.js
// SENTINEL: NB_REPO_WALLETS_SNAPSHOT
// SNAPSHOT TAKEN 2026-09-26 from neonburro/src/data/wallets.js
//
// What the studio repo publishes today, so the wallets room can say what its
// export would do to the file instead of handing somebody a block of text and
// wishing them luck.
//
// ── THIS IS A COPY AND COPIES GO STALE ──────────────────────────────────────
// Pulse is its own repo and cannot import from the studio's src, so there is
// no way to read the real file at runtime and no honest way to pretend
// otherwise. This is a dated copy. The room prints the date above the diff so
// nobody reads a comparison without reading how old it is, which is the only
// thing that makes a stale copy safe.
//
// WHEN wallets.js CHANGES, THIS FILE CHANGES IN THE SAME SESSION. Not the
// same commit, because the two live in different repos, but the same sitting.
// A snapshot that lags the file makes the room report changes that already
// landed and, worse, report nothing when something did. If you are reading
// this and the date above is old, retake it before you trust a diff:
//
//   cd ~/Desktop/neonburro
//   node --input-type=module -e "import { WALLETS } from './src/data/wallets.js'; console.log(JSON.stringify(WALLETS, null, 2))"
//
// ── IT IS GENERATED, AND THE GENERATOR IS CHECKED ───────────────────────────
// The rows below came out of src/lib/walletExport.js toMapRow, the same
// function the room runs on a table row. On 2026-09-26 the formatter's output
// for these eight rows was compared line for line against the real array in
// wallets.js with comments stripped and matched exactly. That is the check
// worth having, because it proves the export reproduces the file's shape
// rather than proving it parses.
//
// The prose comments in wallets.js, the ones explaining the two installs and
// the vaults and the first furnace, are NOT here and are not in the export
// either. They are editorial, a person wrote them and a person keeps them.
// Pasting an export over that file would drop them, so the room says paste
// the entries, not replace the file.
//
// burn and retired are written on every row here, including as false and
// null, because this is a comparison table and a missing key and a false one
// have to read the same to the diff. The export writes them only when set,
// which is what the real file does.
//
// No oxford commas, no em dashes.

// The day the copy below was taken. The room prints it above every diff. If
// you retake the snapshot, move this line with it.
export const REPO_SNAPSHOT_DATE = '2026-09-26';

export const REPO_WALLETS = [
  {
    address: 'Gn4M8Z6YVqJfz5VJ7zixoyYp69naKN1K9zV9sJtbUHV5',
    burro: null,
    label: 'Origin',
    burn: false,
    purpose:
      'The wallet the mint was created from. Nothing has been done to obscure it and nothing can be, it is named as the creator on the mint itself. It was once the largest holding by some distance and it is not any more, it sits fourth among the published wallets, and that line was corrected on 2026-09-21 when a balance check contradicted it.',
    since: '2026-02-27',
    retired: null,
  },
  {
    address: '5u3VG7Yj5sF579cFLLCwFLh6KLrFYrAgpsaa5DBZB8v4',
    burro: 'cypher',
    label: 'Build',
    burn: false,
    purpose:
      'Cypher\'s wallet, funded from Origin on 22 August. What gets built runs through the burro who decides when a thing is done.',
    since: '2026-08-22',
    retired: null,
  },
  {
    address: 'HmnkeUfcRaPZpBZv6K5s7s9FThsakSQjVJ2YKdEb9oko',
    burro: 'tender',
    label: 'Settlement, phone',
    burn: false,
    purpose:
      'The one that moves. Small amounts, on hand, for settling work and adding depth to the pool. Held on a phone because that is where somebody actually is when a thing needs sending.',
    since: '2026-08-21',
    retired: null,
  },
  {
    address: '86JyeB94ABYCpQshm2xvoqf9WJopdEu8VGswYSufNDgE',
    burro: 'tender',
    label: 'Settlement, desk',
    burn: false,
    purpose:
      'The one that sits. Separate install and separate key, so a phone going missing does not take everything with it. Same rule as the other one, nothing leaves either of them without a hue man.',
    since: '2026-08-21',
    retired: null,
  },
  {
    address: 'EwScGspTqWYDuQokKUvGG6bkseQEUL9gKPNdodBPoMLK',
    burro: null,
    label: 'the Reserve',
    burn: false,
    purpose:
      'theburroship, the studio\'s treasury wallet, holds and moves by announcement, every move recorded on the ledger.',
    since: '2026-08-24',
    retired: null,
  },
  {
    address: '2aB6fpZP72Ld28E62bCnwdDH46rszZwRu3dR8vzwyDiM',
    burro: null,
    label: 'the Open Hand',
    burn: false,
    purpose:
      'The wallet that pays the people who show up. Tasks, puzzles and rewards are funded from here in NEONBURRO, to real wallets. It only ever sends outward.',
    since: '2026-08-24',
    retired: null,
  },
  {
    address: '9n35aUiNv2MW1DVjd8Rrh1edyRdSC31HdSWqcVSRT6wc',
    burro: null,
    label: 'the LP',
    burn: false,
    purpose:
      'Liquidity. Paired with SOL and added to the pool so the market is deeper and the price steadier for everyone who trades, the studio included.',
    since: '2026-08-24',
    retired: null,
  },
  {
    address: '59ujrcCz4fSXH88vJoeQVXxrd7qbAjXPhb4aWvCK5y9V',
    burro: null,
    label: 'thefurnace',
    burn: true,
    purpose:
      'The published burn intake. An eligible studio receipt may send only its planned burn share here. A completed burn appears on the burn band after its signature verifies on chain.',
    since: '2026-09-12',
    retired: null,
  },
];

export const REPO_WALLET_COUNT = REPO_WALLETS.length;

export default REPO_WALLETS;
