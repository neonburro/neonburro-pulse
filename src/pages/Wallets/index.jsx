// src/pages/Wallets/index.jsx
// SENTINEL: NB_WALLETS_ROOM_V1
//
// The wallets room. Tyler's ask, 2026-09-26, in his words: somewhere in house
// where I can copy and paste the live wallets to each character, attach a
// wallet and an address, all of our council members, Tender, Epoch, and I
// would like to add Kolache, and really I would like to add Chime.
//
// ── WHAT THIS ROOM IS, AND WHAT STAYS THE RECORD ────────────────────────────
// The published record does not move. It stays the committed file
// neonburro/src/data/wallets.js. The public token page must never read the
// address list from a database at render, and the reason is in that file's
// own header. The page carries a published sentence saying an address not on
// it is not ours, which is a completeness claim, and a node or a table that
// refuses for one second blanks a band that is making a completeness claim.
// An incomplete map is worse than no map.
//
// So this room is where a person types, and the room produces the file. It is
// not the live source for the public page. The export is text somebody pastes
// into the studio repo, reads and commits. Nothing in here publishes anything
// and the head of the page says so out loud.
//
// ── IT IS NOT THE REGISTRY ──────────────────────────────────────────────────
// /registry/ stays exactly as it is. That is the private operational book,
// complete, every wallet the moment it exists, with live balances. This room
// is editorial, a subset, and it carries the six facts the public map needs
// and no balance at all. The two are allowed to disagree and they read the
// same table, public.token_wallets. The paste parser and the base58 test both
// pages use now live in src/lib/walletParse.js so the two cannot drift on
// what counts as an address.
//
// ── NO BALANCES HERE, ON PURPOSE ────────────────────────────────────────────
// Not shown and never written to the table. A number typed into a record is
// out of date the moment somebody transacts and a stale figure on a
// transparency surface reads as a claim. Every row links to solscan and
// solscan is the balance. If this room ever grows a figure it reads it live
// through src/lib/registryBalances.js and says when it read it, the way the
// Registry does.
//
// ── THE MIGRATION GATE ──────────────────────────────────────────────────────
// The six columns this room needs come from
// supabase/migrations/20260926001122_token_wallets_public_map.sql, which is
// prepared and NOT applied. Until a hand runs it the room probes for the
// columns, says plainly on its face that the migration has not landed and
// refuses every write rather than half working. Reading still works, so the
// rows already in the book are visible either way. That is the honest state
// and it is the same pattern the desk doors use.
//
// ── NEVER ───────────────────────────────────────────────────────────────────
// No private key, no seed phrase and no keypair in this table, this room, a
// log or a commit. There is no field for one and there will not be. The page
// says this where a person can read it, not only here.
//
// ── LAYOUT ──────────────────────────────────────────────────────────────────
// Composed from src/components/common/Page.jsx on the law in
// src/theme/layout.js, commit 5fcecdb. This file types no width, no gutter,
// no inset and no font size. Read those two files before changing anything
// visual here.
//
// No oxford commas, no em dashes.

import { useState, useEffect, useCallback, useMemo } from 'react';
import { VStack, Text, Button, Icon } from '@chakra-ui/react';
import { TbFileExport, TbRefresh } from 'react-icons/tb';
import { supabase } from '../../lib/supabase';
import colors from '../../theme/colors';
import { TYPE } from '../../theme/layout';
import { Page, PageHead, Section, Plate, Stats, Loading, Kicker } from '../../components/common/Page';
import { HOLDERS, HOLDER_BY_KEY, UNCLAIMED } from '../../data/walletHolders';
import { isDuplicate } from '../../lib/walletParse';
import { toMapRow, shortfalls } from '../../lib/walletExport';
import HolderBlock from './components/HolderBlock';
import ExportPanel from './components/ExportPanel';
import WalletForm, { EMPTY_WALLET, draftFromRow } from './components/WalletForm';

const P = colors.paper;

const MIGRATION = 'supabase/migrations/20260926001122_token_wallets_public_map.sql';

// The columns the room needs, asked for by name. Probing this way is the only
// check that also works on an empty table, which reading a row and looking at
// its keys does not.
const PUBLIC_COLUMNS =
  'id, label, address, burro, purpose, since, burn, retired, published, holder_kind, sort, created_at';

// A date input hands back an empty string and the column is a nullable date,
// so an empty string has to become null or postgres refuses the whole row.
const orNull = (value) => {
  const trimmed = String(value || '').trim();
  return trimmed === '' ? null : trimmed;
};

const keyOf = (row) => String(row.burro || '').trim().toLowerCase();

// Origin first, then everybody with a face, then the rest of the vaults. The
// public file lists Origin first because a map that buries its origin is
// arranged to mislead, so the export that feeds it does the same.
const ORDER = [
  ...HOLDERS.filter((h) => h.key === 'origin'),
  ...HOLDERS.filter((h) => h.kind !== 'treasury'),
  ...HOLDERS.filter((h) => h.kind === 'treasury' && h.key !== 'origin'),
];

const Wallets = () => {
  const [rows, setRows] = useState([]);
  const [ready, setReady] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null);
  const [draft, setDraft] = useState(EMPTY_WALLET);
  const [formNote, setFormNote] = useState('');
  const [note, setNote] = useState('');
  const [copiedId, setCopiedId] = useState('');
  const [showExport, setShowExport] = useState(false);

  const refresh = useCallback(async () => {
    const wide = await supabase
      .from('token_wallets')
      .select(PUBLIC_COLUMNS)
      .order('sort', { ascending: true })
      .order('created_at', { ascending: true });

    if (!wide.error) {
      setRows(wide.data || []);
      setReady(true);
      setLoading(false);
      return;
    }

    // The columns are not there yet. Fall back to what the table has carried
    // since 2026082605 so the rows still render, and close every write.
    const narrow = await supabase
      .from('token_wallets')
      .select('*')
      .order('sort', { ascending: true })
      .order('created_at', { ascending: true });
    setRows(narrow.data || []);
    setReady(false);
    setLoading(false);
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const byHolder = useMemo(() => {
    const map = new Map(ORDER.map((h) => [h.key, []]));
    const loose = [];
    rows.forEach((row) => {
      const key = keyOf(row);
      if (map.has(key)) map.get(key).push(row);
      else loose.push(row);
    });
    return { map, loose };
  }, [rows]);

  // Every published row, in the order the export writes them, already mapped
  // into the file's shape. The export panel and the count on the head both
  // read this, so the number on the page and the number in the text cannot
  // disagree.
  const mapRows = useMemo(() => {
    const out = [];
    ORDER.forEach((holder) => {
      (byHolder.map.get(holder.key) || [])
        .filter((row) => row.published)
        .forEach((row) => out.push(toMapRow(row, holder)));
    });
    byHolder.loose
      .filter((row) => row.published)
      .forEach((row) => out.push(toMapRow(row, UNCLAIMED)));
    return out;
  }, [byHolder]);

  const holdersWithNothing = ORDER.filter((h) => (byHolder.map.get(h.key) || []).length === 0).length;
  const incomplete = rows.filter((row) => row.published && shortfalls(row).length > 0).length;

  // Who holds the burn flag, other than the row being edited. The table
  // enforces one true row with a partial unique index, this only spares
  // somebody typing into a checkbox the database is going to refuse.
  const burnHeldBy = useMemo(() => {
    const held = rows.find((row) => row.burn === true && row.id !== editing?.id);
    if (!held) return '';
    return held.label || HOLDER_BY_KEY[keyOf(held)]?.name || held.address.slice(0, 8);
  }, [rows, editing]);

  const startAdd = (holder) => {
    setEditing({ id: null, block: holder.key });
    setDraft({ ...EMPTY_WALLET, holder: holder.key });
    setFormNote('');
    setNote('');
  };

  const startEdit = (row) => {
    const key = keyOf(row);
    setEditing({ id: row.id, block: HOLDER_BY_KEY[key] ? key : UNCLAIMED.key });
    setDraft(draftFromRow(row));
    setFormNote('');
    setNote('');
  };

  const cancel = () => {
    setEditing(null);
    setDraft(EMPTY_WALLET);
    setFormNote('');
  };

  const save = async () => {
    if (!ready) { setFormNote('the migration has not landed, nothing can be written yet'); return; }
    const address = String(draft.address || '').trim();
    if (!address) { setFormNote('a wallet needs an address'); return; }

    // A duplicate is refused by name, not by a code, so whoever pasted it can
    // go and look at the row that already holds it.
    const clash = rows.find((row) => row.address === address && row.id !== editing.id);
    if (clash) {
      const who = HOLDER_BY_KEY[keyOf(clash)]?.name || 'nobody named';
      setFormNote(`that address is already on ${who}, labelled ${clash.label || 'no label'}`);
      return;
    }

    const holder = HOLDER_BY_KEY[draft.holder] || UNCLAIMED;
    const payload = {
      label: String(draft.label || '').trim(),
      address,
      purpose: String(draft.purpose || '').trim(),
      since: orNull(draft.since),
      retired: orNull(draft.retired),
      burn: draft.burn === true,
      burro: holder.key,
      holder_kind: holder.key ? holder.kind : 'treasury',
    };

    setSaving(true);
    const { error } = editing.id
      ? await supabase.from('token_wallets').update(payload).eq('id', editing.id)
      : await supabase.from('token_wallets').insert({ ...payload, published: false });
    setSaving(false);

    if (error) {
      if (isDuplicate(error) && /burn/i.test(error.message || '')) {
        setFormNote('another wallet already carries the burn flag, clear it there first');
      } else if (isDuplicate(error)) {
        setFormNote('that address is already in the book');
      } else {
        setFormNote(error.message);
      }
      return;
    }

    cancel();
    refresh();
  };

  const publish = async (row, next) => {
    if (!ready) return;
    const gaps = shortfalls(row);
    if (next && gaps.length) {
      setNote(`${row.label || 'that wallet'} needs ${gaps.join(' and ')} before it goes on the map`);
      return;
    }
    setNote('');
    const { error } = await supabase.from('token_wallets').update({ published: next }).eq('id', row.id);
    if (error) { setNote(error.message); return; }
    refresh();
  };

  const remove = async (row) => {
    if (!ready) return;
    const name = row.label || row.address.slice(0, 8);
    const ask = row.published
      ? `${name} is on the public map. Dropping the row here does not take it off the published file, somebody has to paste a new array. Drop it?`
      : `Drop ${name} from the book? The wallet itself is untouched. If it simply stopped being used, set a retired date instead.`;
    if (!window.confirm(ask)) return;
    const { error } = await supabase.from('token_wallets').delete().eq('id', row.id);
    if (error) { setNote(error.message); return; }
    refresh();
  };

  const copyAddress = async (row) => {
    try {
      await navigator.clipboard.writeText(row.address);
      setCopiedId(row.id);
      setTimeout(() => setCopiedId(''), 1500);
    } catch {
      setNote('the clipboard said no');
    }
  };

  // The form opens inside the block it was started from and stays there even
  // if the holder select is changed, so the thing a person clicked does not
  // jump out from under them mid edit. It moves on save.
  const formFor = (holder) => {
    if (!editing || editing.block !== holder.key) return null;
    return (
      <Plate sunken>
        <VStack align="stretch" spacing={3}>
          <Kicker>{editing.id ? 'Editing a wallet' : `A wallet for ${holder.name}`}</Kicker>
          <WalletForm
            draft={draft}
            holders={ORDER}
            onChange={setDraft}
            onSave={save}
            onCancel={cancel}
            saving={saving}
            note={formNote}
            submitLabel={editing.id ? 'Save' : 'Into the book'}
            burnHeldBy={burnHeldBy}
          />
        </VStack>
      </Plate>
    );
  };

  return (
    <Page>
      <PageHead
        kicker="Wallets"
        title="The map, before it is published."
        lede="One block per holder, a wallet and an address typed by hand. Nothing here reaches the token page on its own. The published record is the committed file in the studio repo and this room produces it."
        actions={(
          <>
            <Button size="sm" variant="ghost" leftIcon={<Icon as={TbRefresh} boxSize={4} />} onClick={refresh}>
              Read
            </Button>
            <Button
              size="sm"
              leftIcon={<Icon as={TbFileExport} boxSize={4} />}
              onClick={() => setShowExport((v) => !v)}
              isDisabled={!ready}
            >
              {showExport ? 'Hide the export' : 'Export the map'}
            </Button>
          </>
        )}
      >
        <Stats items={[
          { key: 'map', n: mapRows.length, label: 'on the map' },
          { key: 'book', n: rows.length, label: 'wallets written' },
          { key: 'holders', n: holdersWithNothing, label: 'holders with nothing', tone: holdersWithNothing ? P.gold : P.inkMuted },
          { key: 'gaps', n: incomplete, label: 'published and incomplete', tone: incomplete ? P.coral : P.inkMuted },
        ]}
        />
      </PageHead>

      <Text fontFamily="mono" fontSize={TYPE.small} color={P.inkMuted}>
        Public addresses only. No private key, no seed phrase and no keypair goes in this room,
        this table, a log or a commit. There is no field for one.
      </Text>

      {!ready && (
        <Plate sunken>
          <VStack align="start" spacing={2}>
            <Kicker color={P.coral}>The migration has not landed</Kicker>
            <Text fontSize={TYPE.small} color={P.inkSec}>
              The table does not carry purpose, since, burn, retired, published or holder_kind
              yet, so the room writes nothing. It is prepared and waiting at
              {' '}
              <Text as="span" fontFamily="mono">{MIGRATION}</Text>
              {' '}
              in this repo. Tyler or Warbleur runs it through the dashboard SQL editor and the
              ledger row at the bottom of it records the run. The rows below are what the book
              already holds.
            </Text>
          </VStack>
        </Plate>
      )}

      {note && (
        <Text fontFamily="mono" fontSize={TYPE.small} color={P.gold}>{note}</Text>
      )}

      {showExport && ready && <ExportPanel rows={mapRows} />}

      {loading ? (
        <Loading label="opening the map" />
      ) : (
        <Section kicker="Holders" count={ORDER.length}>
          <VStack align="stretch" spacing={9}>
            {ORDER.map((holder) => (
              <HolderBlock
                key={holder.key}
                holder={holder}
                rows={byHolder.map.get(holder.key) || []}
                canWrite={ready}
                onAdd={startAdd}
                onEdit={startEdit}
                onRemove={remove}
                onPublish={publish}
                onCopy={copyAddress}
                copiedId={copiedId}
              >
                {formFor(holder)}
              </HolderBlock>
            ))}

            {byHolder.loose.length > 0 && (
              <HolderBlock
                holder={UNCLAIMED}
                rows={byHolder.loose}
                canWrite={ready}
                onAdd={startAdd}
                onEdit={startEdit}
                onRemove={remove}
                onPublish={publish}
                onCopy={copyAddress}
                copiedId={copiedId}
              >
                {formFor(UNCLAIMED)}
              </HolderBlock>
            )}
          </VStack>
        </Section>
      )}
    </Page>
  );
};

export default Wallets;
