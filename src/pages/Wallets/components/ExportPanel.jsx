// src/pages/Wallets/components/ExportPanel.jsx
// SENTINEL: NB_WALLETS_EXPORT_PANEL_V1
//
// The export, and the sentence above it that stops somebody publishing a map
// with a hole in it.
//
// ── WHY THE DIFF COMES FIRST ────────────────────────────────────────────────
// On 2026-08-22 neonburro/src/data/wallets.js listed two wallets holding 10.5
// percent of supply while the yard actually controlled 59.5 percent across
// four, and the page still carried the sentence saying an address not on it
// is not ours. The file was making a completeness claim it could not support.
// That is the failure this panel exists to prevent, so the text is never
// shown on its own. Above it, in words, is what pasting it does to the file,
// and the dangerous line, a row the repo publishes that this export does not
// carry, is first and in the alarm colour.
//
// ── THE COMPARISON IS AGAINST A DATED COPY ──────────────────────────────────
// Pulse cannot read the studio repo at runtime, so the comparison runs
// against src/data/repoWallets.js, a snapshot with a date on it. The date is
// printed here every time. A comparison whose age is hidden is worse than no
// comparison, because it gets believed.
//
// ── PASTE THE ENTRIES, DO NOT REPLACE THE FILE ──────────────────────────────
// wallets.js carries prose between its entries explaining the two installs,
// the vaults and the first furnace. None of that is in the table and none of
// it comes out of here. Replacing the file wholesale would drop it, so the
// instruction on the panel is to paste the entries into the array and keep
// the header and the comments. A person reads the result before committing,
// which is the house rule about looking at the artifact and not the code that
// makes it.
//
// No width, no gutter, no inset and no font size here, the kit owns them.
// No oxford commas, no em dashes.

import { useState } from 'react';
import { VStack, HStack, Text, Textarea, Button, Icon } from '@chakra-ui/react';
import { TbCopy, TbCheck } from 'react-icons/tb';
import colors from '../../../theme/colors';
import { TYPE } from '../../../theme/layout';
import { Plate, Kicker } from '../../../components/common/Page';
import { exportBody, diffAgainstRepo, diffLines } from '../../../lib/walletExport';
import { REPO_WALLETS, REPO_SNAPSHOT_DATE } from '../../../data/repoWallets';

const P = colors.paper;

const TONE = { alarm: P.coral, note: P.ink, quiet: P.inkMuted };

const ExportPanel = ({ rows }) => {
  const [copied, setCopied] = useState(false);
  const body = exportBody(rows);
  const lines = diffLines(diffAgainstRepo(rows, REPO_WALLETS));

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Plate>
      <VStack align="stretch" spacing={4}>
        <VStack align="start" spacing={1}>
          <Kicker>What this does to the file</Kicker>
          <Text fontFamily="mono" fontSize={TYPE.micro} color={P.inkFaint}>
            compared against neonburro/src/data/wallets.js as copied on {REPO_SNAPSHOT_DATE}
          </Text>
        </VStack>

        <VStack align="start" spacing={0.5}>
          {lines.map((line, index) => (
            <Text
              key={`${line.text}-${index}`}
              fontFamily="mono"
              fontSize={TYPE.small}
              color={TONE[line.tone] || P.ink}
              whiteSpace="pre-wrap"
            >
              {line.text}
            </Text>
          ))}
        </VStack>

        <Text fontSize={TYPE.small} color={P.inkMuted}>
          Paste the entries into the WALLETS array in neonburro/src/data/wallets.js and keep
          that file&apos;s header and the prose between the entries, none of it lives in this
          table. Read the result, then commit it. Nothing here reaches the public page on its
          own. {rows.length} {rows.length === 1 ? 'row is' : 'rows are'} in this export and a row
          that is not on the map is never in it.
        </Text>

        <Textarea
          readOnly
          value={body}
          minH="280px"
          fontFamily="mono"
          fontSize={TYPE.small}
          spellCheck={false}
          onFocus={(event) => event.target.select()}
        />

        <HStack>
          <Button
            size="sm"
            onClick={copy}
            leftIcon={<Icon as={copied ? TbCheck : TbCopy} boxSize={4} />}
          >
            {copied ? 'Copied' : 'Copy the array'}
          </Button>
        </HStack>
      </VStack>
    </Plate>
  );
};

export default ExportPanel;
