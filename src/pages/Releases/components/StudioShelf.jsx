// src/pages/Releases/components/StudioShelf.jsx
// SENTINEL: NB_PULSE_SOCIALS_SHELF_V1
//
// The studio's pictures, for one release. Two sources, one grid.
//
//   the library     https://neonburro.com/library/index.json, read live
//                   through the /studio-library/ proxy in netlify.toml (and
//                   vite.config.js in dev) because neonburro.com sends no
//                   CORS header. Rows carry file, alt, subject, dimensions
//                   and used, the alt is the one Tyler wrote.
//   the shelf       src/pages/Releases/studioShelf.json, the scenes, the
//                   share cards and the brand plates, a snapshot written by
//                   scripts/studio-shelf.mjs from the studio checkout with
//                   the pixel size read from each file. Rerun it when the
//                   studio adds plates. Alt lines there are the file name
//                   spelled out, weaker than the library's, edit them on the
//                   row after picking.
//
// Picking sets asset_path to the public url whole, asset_bucket to null and
// asset_alt to the alt line. No bytes are copied, no base64 enters a row,
// the posting hands hand Meta the url and Meta fetches it.
//
// ── THE PREVIEW SAYS WHAT META WILL SHOW ────────────────────────────────────
// The picked plate is drawn inside the frames the channel actually renders,
// SHAPES in shared.jsx, feed 1.91 to 1 or square for a Page, square, four
// by five or landscape for Instagram, laid in with cover so a crop is
// visible as a crop. The verdict beside it comes from the real pixels, read
// off the loaded image with naturalWidth, not from the index, so a plate
// that was recut on the studio reads true here. A wrong shape is drawn with
// contain on the sunken ground so the letterbox is visible, and the line
// says why. Instagram takes jpeg only and the picker says so on a webp.
//
// Telegram never sees this shelf. Its hand on the studio site reads the
// bucket and path pair and does not know a whole url yet, so a telegram
// release keeps the bucket picker beneath. The drawer decides which to show.
//
// No oxford commas, no em dashes.

import { useState, useEffect, useMemo } from 'react';
import { Box, VStack, HStack, Text, SimpleGrid, Spinner, Image, Icon, Input } from '@chakra-ui/react';
import { TbCheck, TbX } from 'react-icons/tb';
import shelf from '../studioShelf.json';
import {
  P,
  SHAPES,
  Field,
  inputProps,
  isMeta,
  isPublicUrl,
  formatOf,
  shapeVerdict,
  formatVerdict,
} from './shared';
import { TYPE, EASE, FAST } from '../../../theme/layout';

const SITE = 'https://neonburro.com';
const LIBRARY_INDEX = '/studio-library/index.json';

const GROUPS = [
  { id: 'library', label: 'library' },
  { id: 'cards', label: 'share cards' },
  { id: 'scenes', label: 'scenes' },
  { id: 'brand', label: 'brand' },
];

const groupOf = (file) => {
  if (file.startsWith('/library/brand')) return 'brand';
  if (file.startsWith('/library')) return 'library';
  if (file.startsWith('/og')) return 'cards';
  return 'scenes';
};

const parseDims = (text) => {
  const match = /^(\d+)x(\d+)$/.exec(text || '');
  return match ? { width: Number(match[1]), height: Number(match[2]) } : null;
};

const VERDICT_TINT = { exact: P.limeDeep, crop: P.gold, wrong: P.coral, unknown: P.inkFaint };

const Chip = ({ on, children, onClick, tone }) => (
  <Box
    as="button"
    type="button"
    onClick={onClick}
    fontFamily="mono"
    fontSize={TYPE.micro}
    letterSpacing="0.08em"
    textTransform="uppercase"
    px={2.5}
    h="26px"
    borderRadius="full"
    border="1px solid"
    borderColor={on ? (tone || P.ink) : P.hair}
    color={on ? (tone || P.ink) : P.inkMuted}
    bg={on ? P.sheet : 'transparent'}
    _hover={{ borderColor: tone || P.inkFaint }}
    transition={`all ${FAST} ${EASE}`}
  >
    {children}
  </Box>
);

const StudioShelf = ({ channel, selectedPath, onPick, onClear }) => {
  const [library, setLibrary] = useState(null);
  const [libraryNote, setLibraryNote] = useState('');
  const [group, setGroup] = useState('library');
  const [query, setQuery] = useState('');
  const [natural, setNatural] = useState(null);
  const [shape, setShape] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetch(LIBRARY_INDEX)
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((rows) => {
        if (cancelled) return;
        setLibrary(Array.isArray(rows) ? rows : []);
      })
      .catch((err) => {
        if (cancelled) return;
        setLibrary([]);
        setLibraryNote(`the library index did not answer (${err.message}). the shelf snapshot is still here.`);
      });
    return () => { cancelled = true; };
  }, []);

  const plates = useMemo(() => {
    const fromIndex = (library || []).map((row) => ({
      file: row.file,
      url: `${SITE}${row.file}`,
      alt: row.alt || '',
      subject: row.subject || '',
      dimensions: row.dimensions || null,
      format: formatOf(row.file),
      used: row.used || [],
      group: groupOf(row.file),
    }));
    const snapshot = shelf
      .filter((row) => !fromIndex.some((plate) => plate.file === row.file))
      .map((row) => ({ ...row, used: [], group: groupOf(row.file) }));
    return [...fromIndex, ...snapshot];
  }, [library]);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return plates.filter((plate) => (
      plate.group === group
      && (!needle || `${plate.alt} ${plate.subject} ${plate.file}`.toLowerCase().includes(needle))
    ));
  }, [plates, group, query]);

  const selected = plates.find((plate) => plate.url === selectedPath) || null;
  const shapes = SHAPES[channel] || null;
  const showing = isPublicUrl(selectedPath);

  useEffect(() => {
    setNatural(null);
    setShape(shapes ? shapes[0].id : null);
  }, [selectedPath, channel]);

  const dims = natural || (selected ? parseDims(selected.dimensions) : null);
  const verdict = showing ? shapeVerdict(channel, dims?.width, dims?.height) : null;
  const formatNote = showing ? formatVerdict(channel, selectedPath) : null;
  const frame = shapes ? shapes.find((item) => item.id === shape) || shapes[0] : null;

  return (
    <Field label="Studio shelf" hint={isMeta(channel) ? 'meta fetches the url' : 'public urls'}>
      <VStack align="stretch" spacing={2.5}>
        {showing && (
          <Box bg={P.sheet} border="1px solid" borderColor={P.hair} borderRadius="12px" p={3}>
            <VStack align="stretch" spacing={2.5}>
              {shapes && (
                <HStack spacing={1.5} flexWrap="wrap" rowGap={1.5}>
                  {shapes.map((item) => (
                    <Chip key={item.id} on={item.id === frame.id} onClick={() => setShape(item.id)}>
                      {item.label}
                    </Chip>
                  ))}
                </HStack>
              )}
              <Box
                maxW="360px"
                w="100%"
                borderRadius="10px"
                overflow="hidden"
                bg={P.sunken}
                border="1px solid"
                borderColor={verdict?.fit === 'wrong' ? P.coral : P.hairSoft}
                sx={{ aspectRatio: frame ? `${frame.w} / ${frame.h}` : (dims ? `${dims.width} / ${dims.height}` : '1.91 / 1') }}
              >
                <Image
                  src={selectedPath}
                  alt={selected?.alt || ''}
                  w="100%"
                  h="100%"
                  objectFit={verdict?.fit === 'wrong' ? 'contain' : 'cover'}
                  onLoad={(event) => setNatural({
                    width: event.target.naturalWidth,
                    height: event.target.naturalHeight,
                  })}
                />
              </Box>
              {verdict && (
                <Text fontFamily="mono" fontSize={TYPE.label} color={VERDICT_TINT[verdict.fit]} lineHeight="1.5">
                  {verdict.text}
                </Text>
              )}
              {formatNote && (
                <Text fontFamily="mono" fontSize={TYPE.label} color={P.coral} lineHeight="1.5">
                  {formatNote}
                </Text>
              )}
              {selected?.used?.length > 0 && (
                <Text fontFamily="mono" fontSize={TYPE.micro} color={P.inkFaint} noOfLines={2}>
                  used on {selected.used.join(', ')}
                </Text>
              )}
              <HStack justify="space-between">
                <Text fontFamily="mono" fontSize={TYPE.micro} color={P.inkMuted} noOfLines={1} minW={0}>
                  {selectedPath.replace(SITE, '')}
                </Text>
                <HStack as="button" type="button" onClick={onClear} spacing={1} flexShrink={0}
                  color={P.inkMuted} _hover={{ color: P.coral }} transition={`color ${FAST} ${EASE}`}>
                  <Icon as={TbX} boxSize={3.5} />
                  <Text fontFamily="mono" fontSize={TYPE.label}>clear</Text>
                </HStack>
              </HStack>
            </VStack>
          </Box>
        )}

        <HStack spacing={1.5} flexWrap="wrap" rowGap={1.5}>
          {GROUPS.map((item) => (
            <Chip key={item.id} on={item.id === group} onClick={() => setGroup(item.id)}>
              {item.label} · {plates.filter((plate) => plate.group === item.id).length}
            </Chip>
          ))}
        </HStack>

        <Input
          {...inputProps}
          h="34px"
          fontFamily="mono"
          fontSize={TYPE.small}
          value={query}
          placeholder="find a plate by subject or name"
          onChange={(event) => setQuery(event.target.value)}
        />

        {libraryNote && (
          <Text fontFamily="mono" fontSize={TYPE.micro} color={P.gold}>{libraryNote}</Text>
        )}

        {library === null && group === 'library' && (
          <HStack justify="center" py={4}><Spinner size="sm" color={P.inkMuted} /></HStack>
        )}

        {shown.length === 0 && (library !== null || group !== 'library') && (
          <Text fontSize={TYPE.small} color={P.inkFaint} py={2}>Nothing on this shelf matches.</Text>
        )}

        {shown.length > 0 && (
          <SimpleGrid columns={{ base: 3, sm: 4 }} spacing={2}>
            {shown.map((plate) => {
              const on = plate.url === selectedPath;
              const badFormat = Boolean(formatVerdict(channel, plate.url));
              const plateDims = parseDims(plate.dimensions);
              const plateVerdict = plateDims ? shapeVerdict(channel, plateDims.width, plateDims.height) : null;
              const bad = badFormat || plateVerdict?.fit === 'wrong';
              return (
                <Box
                  key={plate.url}
                  as="button"
                  type="button"
                  onClick={() => onPick({ url: plate.url, alt: plate.alt })}
                  title={plate.alt}
                  position="relative"
                  borderRadius="10px"
                  overflow="hidden"
                  bg={P.sunken}
                  border="2px solid"
                  borderColor={on ? P.limeDeep : 'transparent'}
                  _hover={{ borderColor: on ? P.limeDeep : P.inkFaint }}
                  transition={`border-color ${FAST} ${EASE}`}
                >
                  <Box pt="100%" position="relative">
                    <Image
                      src={plate.url}
                      alt={plate.alt}
                      position="absolute"
                      inset={0}
                      w="100%"
                      h="100%"
                      objectFit="cover"
                      loading="lazy"
                    />
                  </Box>
                  <Text
                    fontFamily="mono"
                    fontSize="8px"
                    color={bad ? P.coral : P.inkMuted}
                    bg={P.sheet}
                    px={1.5}
                    py={0.5}
                    textAlign="left"
                    noOfLines={1}
                  >
                    {plate.dimensions || 'size unread'} · {plate.format}
                  </Text>
                  {on && (
                    <Box position="absolute" top={1.5} right={1.5} boxSize="18px" borderRadius="full"
                      bg={P.lime} color={P.limeInk} display="flex" alignItems="center" justifyContent="center">
                      <Icon as={TbCheck} boxSize={3} />
                    </Box>
                  )}
                </Box>
              );
            })}
          </SimpleGrid>
        )}
      </VStack>
    </Field>
  );
};

export default StudioShelf;
